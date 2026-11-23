const { randomUUID } = require('node:crypto');
const { z } = require('zod');

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');

const { supabase } = require('../config/supabase');
const { webauthnConfig } = require('../config/webauthn');

const optionsSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
});

const verifySchema = z.object({
  userId: z.string().uuid(),
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

async function deletePendingUser(userId) {
  try {
    await supabase
      .from('ofa_users')
      .delete()
      .eq('id', userId)
      .is('registration_completed_at', null);
  } catch (error) {
    console.error(
      'Pending user cleanup failed:',
      error.message
    );
  }
}

async function registerOptions(req, res) {
  const parsed = optionsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid display name.',
    });
  }

  const userId = randomUUID();
  const displayName = parsed.data.displayName;

  try {
    // Create a pending Unwind OFA identity.
    const { error: userError } = await supabase
      .from('ofa_users')
      .insert({
        id: userId,
        display_name: displayName,
      });

    if (userError) {
      console.error(
        'OFA user creation failed:',
        userError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to start registration.',
      });
    }

    // Generate passkey registration options.
    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: webauthnConfig.rpID,

      // Use an opaque UUID as the WebAuthn user handle.
      userID: Buffer.from(userId.replace(/-/g, ''), 'hex'),

      userName: `ofa-${userId}`,
      userDisplayName: displayName,

      attestationType: 'none',

      authenticatorSelection: {
        // Do not restrict users to platform authenticators.
        // This allows compatible external security keys too.
        residentKey: 'required',
        userVerification: 'required',
      },

      timeout: 60000,
    });

    // Registration challenges expire after five minutes.
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    // Store the challenge before returning options.
    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .insert({
        challenge: options.challenge,
        user_id: userId,
        ceremony: 'registration',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (challengeError || !challengeRecord) {
      console.error(
        'Registration challenge creation failed:',
        challengeError?.message
      );

      await deletePendingUser(userId);

      return res.status(500).json({
        success: false,
        message: 'Unable to start passkey registration.',
      });
    }

    return res.status(200).json({
      success: true,
      userId,
      challengeId: challengeRecord.id,
      options,
    });
  } catch (error) {
    console.error(
      'Registration options error:',
      error.message
    );

    await deletePendingUser(userId);

    return res.status(500).json({
      success: false,
      message: 'Unable to generate registration options.',
    });
  }
}

async function registerVerify(req, res) {
  const parsed = verifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid registration verification request.',
    });
  }

  const {
    userId,
    challengeId,
    response,
  } = parsed.data;

  try {
    // Retrieve the challenge belonging to this user.
    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .select(
        'id, challenge, ceremony, expires_at, consumed_at, user_id'
      )
      .eq('id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (challengeError || !challengeRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration challenge.',
      });
    }

    // Reject incorrect, expired or previously consumed challenges.
    if (
      challengeRecord.ceremony !== 'registration' ||
      challengeRecord.consumed_at ||
      new Date(challengeRecord.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Registration challenge has expired or was already used.',
      });
    }

    // Confirm that the identity is still pending.
    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
      .select(
        'id, display_name, registration_completed_at, disabled_at'
      )
      .eq('id', userId)
      .maybeSingle();

    if (
      userError ||
      !user ||
      user.registration_completed_at ||
      user.disabled_at
    ) {
      return res.status(400).json({
        success: false,
        message: 'This registration cannot be completed.',
      });
    }

    // Cryptographically verify the authenticator response.
    let verification;

    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: webauthnConfig.expectedOrigin,
        expectedRPID: webauthnConfig.rpID,
        requireUserVerification: true,
      });
    } catch (verificationError) {
      console.warn(
        'Passkey registration verification rejected:',
        verificationError.message
      );

      return res.status(400).json({
        success: false,
        message: 'Passkey verification failed. Please try again.',
      });
    }

    if (
      !verification.verified ||
      !verification.registrationInfo
    ) {
      return res.status(400).json({
        success: false,
        message: 'Passkey verification was unsuccessful.',
      });
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
      aaguid,
    } = verification.registrationInfo;

    // Validate the verified credential before storing it.
    if (
      !credential ||
      typeof credential.id !== 'string' ||
      !credential.id ||
      !credential.publicKey ||
      !Number.isSafeInteger(credential.counter) ||
      credential.counter < 0 ||
      !['singleDevice', 'multiDevice'].includes(
        credentialDeviceType
      ) ||
      typeof credentialBackedUp !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid passkey credential.',
      });
    }

    const transports = Array.isArray(credential.transports)
      ? credential.transports.filter(
          (transport) => typeof transport === 'string'
        )
      : [];

    // Atomically:
    // 1. Consume the registration challenge.
    // 2. Activate the OFA identity.
    // 3. Store the verified public credential.
    const {
      error: completionError,
    } = await supabase.rpc(
      'complete_ofa_registration',
      {
        p_challenge_id: challengeId,
        p_user_id: userId,
        p_credential_id: credential.id,

        p_public_key: Buffer.from(
          credential.publicKey
        ).toString('base64url'),

        p_counter: credential.counter,
        p_transports: transports,
        p_device_type: credentialDeviceType,
        p_backed_up: credentialBackedUp,
        p_aaguid: aaguid || null,
      }
    );

    if (completionError) {
      console.error(
        'Registration completion failed:',
        completionError.message
      );

      return res.status(409).json({
        success: false,
        message: 'Unable to complete registration. Please try again.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Your Unwind OFA passkey was registered successfully.',
      user: {
        id: userId,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error(
      'Registration verification error:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected registration error occurred.',
    });
  }
}

module.exports = {
  registerOptions,
  registerVerify,
};