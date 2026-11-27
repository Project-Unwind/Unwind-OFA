import {
  randomUUID,
  randomBytes,
  createHash,
} from 'node:crypto';

import type { Request, Response } from 'express';

import { z } from 'zod';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

import { supabase } from '../config/supabase';
import { webauthnConfig } from '../config/webauthn';
import { sendBrevoEmail } from '../services/emailService';

import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === 'production';

const SESSION_COOKIE_NAME = isProduction
  ? '__Host-ofa_session'
  : 'ofa_session';

const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_DURATION_MS,
}as const;

const optionsSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address.')
    .max(254)
    .transform((value: string) => value.toLowerCase()),
});

const verifySchema = z.object({
  userId: z.string().uuid(),
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

const loginVerifySchema = z.object({
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

const emailVerificationSchema = z.object({
  token: z.string().min(32).max(256),
});

const emergencyLockSchema = z.object({
  token: z.string().min(40).max(100),
});

const recoveryStartSchema = z.object({
  email: z.string().trim().email().max(254)
    .transform((value: string) => value.toLowerCase()),
});

const recoveryEmailVerifySchema = z.object({
  token: z.string().min(32).max(256),
});

const recoveryCodeVerifySchema = z.object({
  recoveryToken: z.string().min(40).max(100),
  recoveryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/,
      'Invalid recovery code format.'
    ),
});

const recoveryAuthenticationOptionsSchema = z.object({
  recoveryToken: z.string().min(40).max(100),
});

const recoveryAuthenticationVerifySchema = z.object({
  recoveryToken: z.string().min(40).max(100),
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

const recoveryRegistrationOptionsSchema = z.object({
  recoveryToken: z.string().min(40).max(100),
});

const recoveryRegistrationVerifySchema = z.object({
  recoveryToken: z.string().min(40).max(100),
  challengeId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

const recoveryCompletionSchema = z.object({
  recoveryToken: z.string().min(40).max(100),
});

async function deletePendingUser(userId: string): Promise<void> {
  try {
    await supabase
      .from('ofa_users')
      .delete()
      .eq('id', userId)
      .is('registration_completed_at', null);
  } catch (error) {
    console.error(
      'Pending user cleanup failed:',
      getErrorMessage(error)
    );
  }
}

// --------------------------------------------------
// REGISTRATION
// --------------------------------------------------

async function registerOptions(req: Request, res: Response) {
  const parsed = optionsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid display name.',
    });
  }

  const userId = randomUUID();
const displayName = parsed.data.displayName;
const email = parsed.data.email;

  try {
    const { error: userError } = await supabase
  .from('ofa_users')
  .insert({
    id: userId,
    display_name: displayName,
    email,
  });

   if (userError) {
  if (userError.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'An account with this email address already exists.',
    });
  }

  console.error(
    'OFA user creation failed:',
    userError.message
  );

  return res.status(500).json({
    success: false,
    message: 'Unable to start registration.',
  });
}

    const options = await generateRegistrationOptions({
      rpName: webauthnConfig.rpName,
      rpID: webauthnConfig.rpID,

      userID: Buffer.from(
        userId.replace(/-/g, ''),
        'hex'
      ),

      userName: `ofa-${userId}`,
      userDisplayName: displayName,

      attestationType: 'none',

     authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
    },

      timeout: 60000,
    });

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

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
      getErrorMessage(error)
    );

    await deletePendingUser(userId);

    return res.status(500).json({
      success: false,
      message: 'Unable to generate registration options.',
    });
  }
}

async function registerVerify(req: Request, res: Response) {
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

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
      .select(
  'id, display_name, email, registration_completed_at, disabled_at'
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

    let verification;

    try {
      verification = await verifyRegistrationResponse({
response: response as unknown as RegistrationResponseJSON,        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: webauthnConfig.expectedOrigin,
        expectedRPID: webauthnConfig.rpID,
        requireUserVerification: true,
      });
    } catch (verificationError) {
      console.warn(
        'Passkey registration verification rejected:',
        getErrorMessage(verificationError)
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
  (transport: string) => typeof transport === 'string'
)
      : [];

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

    // Generate a secure email verification token.
const verificationToken = randomBytes(32).toString('hex');

const verificationTokenHash = createHash('sha256')
  .update(verificationToken)
  .digest('hex');

const verificationExpiresAt = new Date(
  Date.now() + 30 * 60 * 1000
).toISOString();

// Store only the token hash.
const { error: emailUpdateError } = await supabase
  .from('ofa_users')
  .update({
    email_verification_token_hash: verificationTokenHash,
    email_verification_expires_at: verificationExpiresAt,
  })
  .eq('id', userId);

if (emailUpdateError) {
  console.error(
    'Email verification token storage failed:',
    emailUpdateError.message
  );

  return res.status(200).json({
    success: true,
    message: 'Passkey registered, but email verification could not be prepared. Please contact support.',
    user: {
      id: userId,
      displayName: user.display_name,
    },
  });
}

// Send the verification email.
try {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new Error('FRONTEND_URL is not configured.');
  }

  const verificationUrl =
    `${frontendUrl.replace(/\/$/, '')}/verify-email?token=${verificationToken}`;

  await sendBrevoEmail({
    toEmail: user.email,
    toName: user.display_name,
    subject: 'Verify your Unwind OFA email address',

 htmlContent: `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color: #172321;">
    <h2>Verify your Unwind OFA email address</h2>

    <p>Hello ${user.display_name},</p>

    <p>Your passkey has been registered successfully.</p>

    <p>Click the button below to verify your email address:</p>

    <a href="${verificationUrl}"
       style="display:inline-block;padding:12px 20px;background:#087f70;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
      Verify email address
    </a>

    <p>This link expires in 30 minutes and can only be used once.</p>

    <p>— Unwind OFA Security Team</p>
  </div>
`,

textContent: `
Verify your Unwind OFA email address

Hello ${user.display_name},

Your passkey has been registered successfully.

Verify your email address using this link:

${verificationUrl}

This link expires in 30 minutes and can only be used once.

— Unwind OFA Security Team
`,
  });
} catch (emailError) {
  // Do not undo successful passkey registration.
  console.error(
    'Registration verification email failed:',
    getErrorMessage(emailError)
  );
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
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected registration error occurred.',
    });
  }
}

async function verifyEmail(req: Request, res: Response) {
  const parsed = emailVerificationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email verification request.',
    });
  }

  try {
    const tokenHash = createHash('sha256')
      .update(parsed.data.token)
      .digest('hex');

    const now = new Date().toISOString();

    const {
      data: updatedUser,
      error: updateError,
    } = await supabase
      .from('ofa_users')
      .update({
        email_verified_at: now,
        email_verification_token_hash: null,
        email_verification_expires_at: null,
      })
      .eq('email_verification_token_hash', tokenHash)
      .gt('email_verification_expires_at', now)
      .is('email_verified_at', null)
      .select('id, display_name, email')
      .maybeSingle();

    if (updateError) {
      console.error(
        'Email verification update failed:',
        updateError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to verify your email address.',
      });
    }

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid, expired, or already used.',
      });
    }

    // Send account-created confirmation.
    // Verification remains successful even if email delivery fails.
    try {
      await sendBrevoEmail({
        toEmail: updatedUser.email,
        toName: updatedUser.display_name,
        subject: 'Your Unwind OFA account is ready',

        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color: #172321;">
            <h2>Welcome to Unwind OFA!</h2>

            <p>Hello ${updatedUser.display_name},</p>

            <p>Your email address has been successfully verified.</p>

            <p>Your passkey registration is complete, and your Unwind OFA account is ready to use.</p>

            <p>You can now sign in securely using your registered passkey.</p>

            <p><strong>Security reminder:</strong> Never share your passkey or account recovery codes with anyone.</p>

            <p>— Unwind OFA Security Team</p>
          </div>
        `,

        textContent: `
Welcome to Unwind OFA!

Hello ${updatedUser.display_name},

Your email address has been successfully verified.

Your passkey registration is complete, and your Unwind OFA account is ready to use.

You can now sign in securely using your registered passkey.

Security reminder: Never share your passkey or account recovery codes with anyone.

— Unwind OFA Security Team
        `,
      });
    } catch (emailError) {
      console.error(
        'Account confirmation email failed:',
        getErrorMessage(emailError)
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully.',
    });
  } catch (error) {
    console.error(
      'Email verification error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected email verification error occurred.',
    });
  }
}

// --------------------------------------------------
// PASSKEY SIGN-IN
// --------------------------------------------------

async function loginOptions(_req: Request, res: Response) {
  try {
    // Generate discoverable passkey authentication options.
    const options = await generateAuthenticationOptions({
      rpID: webauthnConfig.rpID,
      userVerification: 'required',
      timeout: 60000,
    });

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    // Store a user-independent authentication challenge.
    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .insert({
        challenge: options.challenge,
        user_id: null,
        ceremony: 'authentication',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (challengeError || !challengeRecord) {
      console.error(
        'Authentication challenge creation failed:',
        challengeError?.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to start passkey sign-in.',
      });
    }

    return res.status(200).json({
      success: true,
      challengeId: challengeRecord.id,
      options,
    });
  } catch (error) {
    console.error(
      'Authentication options error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to generate sign-in options.',
    });
  }
}

async function loginVerify(req: Request, res: Response) {
  const parsed = loginVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid passkey sign-in request.',
    });
  }

  const {
    challengeId,
    response,
  } = parsed.data;

  try {
    // Retrieve the authentication challenge.
    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .select(
        'id, challenge, ceremony, expires_at, consumed_at'
      )
      .eq('id', challengeId)
      .maybeSingle();

    if (challengeError || !challengeRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid authentication challenge.',
      });
    }

    if (
      challengeRecord.ceremony !== 'authentication' ||
      challengeRecord.consumed_at ||
      new Date(challengeRecord.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Authentication challenge has expired or was already used.',
      });
    }

    // Identify the credential returned by the browser.
    const credentialId =
      typeof response.id === 'string'
        ? response.id
        : typeof response.rawId === 'string'
          ? response.rawId
          : null;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'No passkey credential was provided.',
      });
    }

    const {
      data: storedCredential,
      error: credentialError,
    } = await supabase
      .from('ofa_passkey_credentials')
      .select(
        'credential_id, user_id, public_key, counter, transports'
      )
      .eq('credential_id', credentialId)
      .maybeSingle();

    if (credentialError || !storedCredential) {
      return res.status(401).json({
        success: false,
        message: 'This passkey is not recognized.',
      });
    }

    // Load the identity linked to the credential.
    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
 .select(
  'id, display_name, email, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
)
      .eq('id', storedCredential.user_id)
      .maybeSingle();

    if (
  userError ||
  !user ||
  !user.registration_completed_at ||
  user.disabled_at ||
  user.emergency_locked_at
) {
  return res.status(401).json({
    success: false,
    message: 'This Unwind OFA account is unavailable.',
  });
}

    if (!user.email_verified_at) {
  return res.status(403).json({
    success: false,
    message: 'Please verify your email address before signing in.',
    code: 'EMAIL_NOT_VERIFIED',
  });
}
    
    // Verify the discoverable credential's user handle
    // when the authenticator provides one.
    //
    // Some authenticators omit userHandle even when the
    // credential ID is available. The credential ID has
    // already been matched to a stored account above.
    const suppliedUserHandle = response.userHandle;

    if (
      suppliedUserHandle !== undefined &&
      suppliedUserHandle !== null &&
      suppliedUserHandle !== ''
    ) {
      if (
        typeof suppliedUserHandle !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(suppliedUserHandle)
      ) {
        return res.status(401).json({
          success: false,
          message: 'Invalid passkey account handle.',
        });
      }

      const decodedUserHandle = Buffer.from(
        suppliedUserHandle,
        'base64url'
      );

      // Require canonical base64url encoding.
      if (
        decodedUserHandle.toString('base64url') !==
        suppliedUserHandle
      ) {
        return res.status(401).json({
          success: false,
          message: 'Invalid passkey account handle.',
        });
      }

      const expectedUserHandle = Buffer.from(
        user.id.replace(/-/g, ''),
        'hex'
      );

      if (
        decodedUserHandle.length !== expectedUserHandle.length ||
        !decodedUserHandle.equals(expectedUserHandle)
      ) {
        return res.status(401).json({
          success: false,
          message: 'Passkey account verification failed.',
        });
      }
    }

    // Verify the cryptographic authentication response.
    let verification;

    try {
      verification = await verifyAuthenticationResponse({
response: response as unknown as AuthenticationResponseJSON,        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: webauthnConfig.expectedOrigin,
        expectedRPID: webauthnConfig.rpID,

        credential: {
          id: storedCredential.credential_id,
          publicKey: Buffer.from(
            storedCredential.public_key,
            'base64url'
          ),
          counter: Number(storedCredential.counter),
          transports: storedCredential.transports || [],
        },

        requireUserVerification: true,
      });
    } catch (verificationError) {
      console.warn(
        'Passkey authentication rejected:',
        getErrorMessage(verificationError)
      );

      return res.status(401).json({
        success: false,
        message: 'Passkey verification failed. Please try again.',
      });
    }

    if (
      !verification.verified ||
      !verification.authenticationInfo ||
      !verification.authenticationInfo.userVerified
    ) {
      return res.status(401).json({
        success: false,
        message: 'Passkey authentication was unsuccessful.',
      });
    }

    const newCounter =
      verification.authenticationInfo.newCounter;

    if (
      !Number.isSafeInteger(newCounter) ||
      newCounter < 0
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticator counter.',
      });
    }

    // Generate a high-entropy opaque session token.
    const sessionToken = randomBytes(32).toString('base64url');

    // Only its SHA-256 hash is stored in the database.
    const sessionTokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const sessionExpiresAt = new Date(
      Date.now() + SESSION_DURATION_MS
    ).toISOString();

    // Atomically consume the challenge, update the counter,
    // and create the session.
    const {
      data: sessionRecords,
      error: sessionError,
    } = await supabase.rpc(
      'complete_ofa_login',
      {
        p_challenge_id: challengeId,
        p_credential_id: storedCredential.credential_id,
        p_new_counter: newCounter,
        p_session_token_hash: sessionTokenHash,
        p_expires_at: sessionExpiresAt,
      }
    );

    if (sessionError || !sessionRecords?.length) {
      console.error(
        'Passkey session creation failed:',
        sessionError?.message
      );

      return res.status(401).json({
        success: false,
        message: 'Unable to establish your sign-in session.',
      });
    }

    const authenticatedUser = sessionRecords[0];

    // The raw token is sent only as an HTTP-only cookie.
    res.cookie(
      SESSION_COOKIE_NAME,
      sessionToken,
      sessionCookieOptions
    );

    // Generate a one-time emergency lockdown token.
let emergencyLockUrl = null;

try {
  const emergencyToken = randomBytes(32).toString('base64url');

  const emergencyTokenHash = createHash('sha256')
    .update(emergencyToken)
    .digest('hex');

  const emergencyTokenExpiresAt = new Date(
    Date.now() + 15 * 60 * 1000
  ).toISOString();

  const { error: emergencyTokenError } = await supabase
    .from('ofa_emergency_tokens')
    .insert({
      user_id: user.id,
      token_hash: emergencyTokenHash,
      expires_at: emergencyTokenExpiresAt,
    });

  if (emergencyTokenError) {
    throw emergencyTokenError;
  }

  const frontendUrl = new URL(
    '/emergency-lock',
    process.env.FRONTEND_URL
  );

  frontendUrl.searchParams.set('token', emergencyToken);

  emergencyLockUrl = frontendUrl.toString();
} catch (tokenError) {
  console.error(
    'Emergency token generation failed:',
    getErrorMessage(tokenError)
  );
}

    // Send a security notification after successful sign-in.
    // Email delivery failure must never invalidate authentication.
    try {
      const loginTime = new Date().toUTCString();

      await sendBrevoEmail({
        toEmail: user.email,
        toName: user.display_name,
        subject: 'New sign-in to your Unwind OFA account',

        htmlContent: `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color: #172321;">
    <h2>New sign-in to Unwind OFA</h2>

    <p>A successful passkey sign-in was completed for your account.</p>

    <div style="padding: 16px; background: #f0f7f5; border-radius: 8px;">
      <p><strong>Sign-in method:</strong> Passkey</p>
      <p><strong>Date and time:</strong> ${loginTime} (UTC)</p>
    </div>

    <div style="margin-top: 24px; padding: 20px; background: #fff3f0; border-radius: 8px;">
      <h3 style="color: #9b2c20;">Wasn't you?</h3>

      <p>If you did not initiate this sign-in, immediately lock your account and revoke all active sessions.</p>

      ${
        emergencyLockUrl
          ? `<a href="${emergencyLockUrl}"
              style="display:inline-block;padding:12px 20px;background:#b42318;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
              Secure my account
            </a>`
          : '<p>Emergency protection is temporarily unavailable. Please contact Unwind OFA support.</p>'
      }

      <p style="font-size:13px;color:#666;">
        This link expires in 15 minutes and can only be used once.
      </p>
    </div>

    <p>If you recognize this sign-in, no action is necessary.</p>
    <p>— Unwind OFA Security Team</p>
  </div>
`,

textContent: `
New sign-in to Unwind OFA

A successful passkey sign-in was completed for your account.

Sign-in method: Passkey
Date and time: ${loginTime} (UTC)

If you did not initiate this sign-in, secure your account here:

${emergencyLockUrl || 'Emergency protection is temporarily unavailable.'}

This link expires in 15 minutes and can only be used once.

If you recognize this sign-in, no action is necessary.

— Unwind OFA Security Team
`,
      });
    } catch (emailError) {
      console.error(
        'Login security notification failed:',
        getErrorMessage(emailError)
      );
    }

    return res.status(200).json({
      success: true,
      message: 'You have successfully signed in to Unwind OFA.',
      user: {
        id: authenticatedUser.user_id,
        displayName: authenticatedUser.display_name,
      },
    });
  } catch (error) {
    console.error(
      'Passkey authentication error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected sign-in error occurred.',
    });
  }
}

function getSessionToken(req: Request): string | null {
  const cookies = (req.headers.cookie || '').split(';');

  const sessionCookie = cookies.find((cookie: string) =>
    cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`)
  );

  if (!sessionCookie) {
    return null;
  }

  const value = sessionCookie.trim().slice(
    SESSION_COOKIE_NAME.length + 1
  );

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

// --------------------------------------------------
// SESSION VALIDATION
// --------------------------------------------------

async function getSession(req: Request, res: Response) {
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    return res.status(200).json({
      success: true,
      authenticated: false,
      user: null,
    });
  }

  try {
    const sessionTokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from('ofa_sessions')
      .select('id, user_id, expires_at, revoked_at')
      .eq('token_hash', sessionTokenHash)
      .maybeSingle();

    if (sessionError) {
      console.error(
        'Session lookup failed:',
        sessionError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to validate your session.',
      });
    }

    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      clearSessionCookie(res);

      return res.status(200).json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
      .select(
  'id, display_name, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
)
      .eq('id', session.user_id)
      .maybeSingle();

    if (userError) {
      console.error(
        'Session user lookup failed:',
        userError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to validate your account.',
      });
    }

    if (
  !user ||
  !user.registration_completed_at ||
  user.disabled_at ||
  user.emergency_locked_at ||
  !user.email_verified_at
) {
      // Revoke sessions belonging to invalid or unverified accounts.
      await supabase
        .from('ofa_sessions')
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq('id', session.id)
        .is('revoked_at', null);

      clearSessionCookie(res);

      return res.status(200).json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    await supabase
      .from('ofa_sessions')
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .is('revoked_at', null);

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    console.error(
      'Session validation error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected session error occurred.',
    });
  }
}

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

async function logout(req: Request, res: Response) {
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: 'You are signed out.',
    });
  }

  try {
    const sessionTokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const { error: revokeError } = await supabase
      .from('ofa_sessions')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('token_hash', sessionTokenHash)
      .is('revoked_at', null);

    if (revokeError) {
      console.error(
        'Session revocation failed:',
        revokeError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to sign out. Please try again.',
      });
    }

    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: 'You have successfully signed out.',
    });
  } catch (error) {
    console.error(
      'Logout error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected logout error occurred.',
    });
  }
}

async function emergencyLock(req: Request, res: Response) {
  const parsed = emergencyLockSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid emergency security request.',
    });
  }

  try {
    const tokenHash = createHash('sha256')
      .update(parsed.data.token)
      .digest('hex');

    const { data, error } = await supabase.rpc(
      'complete_ofa_emergency_lock',
      {
        p_token_hash: tokenHash,
      }
    );

    if (error || !data?.length) {
      console.error(
        'Emergency account lockdown failed:',
        error?.message
      );

      return res.status(400).json({
        success: false,
        message: 'This emergency link is invalid, expired, or already used.',
      });
    }

    // Clear the current browser session if the same browser
    // initiated the emergency action.
    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Your account has been locked and all active sessions have been revoked.',
    });
  } catch (error) {
    console.error(
      'Emergency lockdown error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to secure your account. Please try again.',
    });
  }
}

// --------------------------------------------------
// ACCOUNT RECOVERY — EMAIL VERIFICATION
// --------------------------------------------------

async function startRecovery(req: Request, res: Response) {
  const parsed = recoveryStartSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
  }

  try {
    const emailToken = randomBytes(32).toString('hex');

    const emailTokenHash = createHash('sha256')
      .update(emailToken)
      .digest('hex');

    const emailTokenExpiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase.rpc(
      'start_ofa_recovery',
      {
        p_email: parsed.data.email,
        p_email_token_hash: emailTokenHash,
        p_email_token_expires_at: emailTokenExpiresAt,
      }
    );

    if (error) {
      console.error(
        'Recovery initiation failed:',
        getErrorMessage(error)
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to process your recovery request.',
      });
    }

    // Always return the same public response when no eligible
    // account exists. Never reveal account eligibility.
    if (data?.length) {
      const recoveryUser = data[0];

      try {
        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
          throw new Error('FRONTEND_URL is not configured.');
        }

        const recoveryUrl = new URL(
          '/recover-account',
          frontendUrl
        );

        recoveryUrl.searchParams.set('token', emailToken);

        await sendBrevoEmail({
          toEmail: recoveryUser.email,
          toName: recoveryUser.display_name,
          subject: 'Unwind OFA account recovery',

          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color: #172321;">
              <h2>Account recovery requested</h2>

              <p>A recovery request was made for your Unwind OFA account.</p>

              <p>To continue, verify your email address using the button below.</p>

              <a href="${recoveryUrl.toString()}"
                 style="display:inline-block;padding:12px 20px;background:#087f70;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
                Verify email and continue
              </a>

              <p>This link expires in 30 minutes and can only be used once.</p>

              <p>If you did not request account recovery, you can ignore this email.</p>

              <p>— Unwind OFA Security Team</p>
            </div>
          `,

          textContent: `
Unwind OFA account recovery

A recovery request was made for your account.

Verify your email and continue:

${recoveryUrl.toString()}

This link expires in 30 minutes and can only be used once.

If you did not request account recovery, ignore this email.

— Unwind OFA Security Team
          `,
        });
      } catch (emailError) {
        console.error(
          'Recovery email delivery failed:',
          getErrorMessage(emailError)
        );

        // Do not reveal account existence through email errors.
      }
    }

    return res.status(200).json({
      success: true,
      message: 'If an eligible account exists for that email address, a recovery link will be sent.',
    });
  } catch (error) {
    console.error(
      'Recovery initiation error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to process your recovery request.',
    });
  }
}

async function verifyRecoveryEmail(req: Request, res: Response) {
  const parsed = recoveryEmailVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid recovery verification request.',
    });
  }

  try {
    const emailTokenHash = createHash('sha256')
      .update(parsed.data.token)
      .digest('hex');

    const attemptToken = randomBytes(32).toString('base64url');

    const attemptTokenHash = createHash('sha256')
      .update(attemptToken)
      .digest('hex');

    const attemptExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase.rpc(
      'verify_ofa_recovery_email',
      {
        p_email_token_hash: emailTokenHash,
        p_attempt_token_hash: attemptTokenHash,
        p_attempt_expires_at: attemptExpiresAt,
      }
    );

    if (error) {
      console.error(
        'Recovery email verification failed:',
        getErrorMessage(error)
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to verify your recovery link.',
      });
    }

    if (!data?.length) {
      return res.status(400).json({
        success: false,
        message: 'This recovery link is invalid, expired, or already used.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email verification successful. Continue with your existing passkey.',
      recoveryToken: attemptToken,
    });
  } catch (error) {
    console.error(
      'Recovery email verification error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected recovery verification error occurred.',
    });
  }
}

async function verifyRecoveryCode(req: Request, res: Response) {
  const parsed = recoveryCodeVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid recovery code.',
    });
  }

  try {
    const attemptTokenHash = createHash('sha256')
      .update(parsed.data.recoveryToken)
      .digest('hex');

    const recoveryCodeHash = createHash('sha256')
      .update(parsed.data.recoveryCode)
      .digest('hex');

    const { data, error } = await supabase.rpc(
      'verify_ofa_recovery_code',
      {
        p_attempt_token_hash: attemptTokenHash,
        p_recovery_code_hash: recoveryCodeHash,
      }
    );

    if (error || !data?.length) {
      if (error) {
        console.error(
          'Recovery code verification failed:',
          getErrorMessage(error)
        );
      }

      return res.status(400).json({
        success: false,
        message: 'The recovery code is invalid, already used, or the recovery session has expired.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recovery code verified successfully.',
    });
  } catch (error) {
    console.error(
      'Recovery code verification error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected recovery code verification error occurred.',
    });
  }
}

async function recoveryAuthenticationOptions(req: Request, res: Response) {
  const parsed = recoveryAuthenticationOptionsSchema.safeParse(
    req.body
  );

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid recovery authentication request.',
    });
  }

  try {
    const attemptTokenHash = createHash('sha256')
      .update(parsed.data.recoveryToken)
      .digest('hex');

    const now = new Date().toISOString();

    const {
      data: attempt,
      error: attemptError,
    } = await supabase
      .from('ofa_recovery_attempts')
      .select('id, user_id')
      .eq('attempt_token_hash', attemptTokenHash)
      .not('email_verified_at', 'is', null)
      .is('passkey_verified_at', null)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (attemptError || !attempt) {
      return res.status(400).json({
        success: false,
        message: 'Your recovery session is invalid or expired.',
      });
    }

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
      .select(
        'id, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
      )
      .eq('id', attempt.user_id)
      .maybeSingle();

    if (
      userError ||
      !user ||
      !user.registration_completed_at ||
      user.disabled_at ||
      !user.email_verified_at ||
      !user.emergency_locked_at
    ) {
      return res.status(400).json({
        success: false,
        message: 'This account cannot be recovered.',
      });
    }

    const {
      data: credentials,
      error: credentialsError,
    } = await supabase
      .from('ofa_passkey_credentials')
      .select('credential_id, transports')
      .eq('user_id', user.id);

    if (credentialsError) {
      console.error(
        'Recovery credential lookup failed:',
        credentialsError.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to retrieve registered passkeys.',
      });
    }

    if (!credentials?.length) {
      return res.status(400).json({
        success: false,
        message: 'No existing passkey is available for recovery.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: webauthnConfig.rpID,
      userVerification: 'required',
      timeout: 60000,
      allowCredentials: credentials.map((credential: {
  credential_id: string;
  transports: string[] | null;
}) => ({
        id: credential.credential_id,
        transports: credential.transports || [],
      })),
    });

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .insert({
        challenge: options.challenge,
        user_id: user.id,
        ceremony: 'recovery_authentication',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (challengeError || !challengeRecord) {
      console.error(
        'Recovery authentication challenge creation failed:',
        challengeError?.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to start passkey recovery.',
      });
    }

    return res.status(200).json({
      success: true,
      challengeId: challengeRecord.id,
      options,
    });
  } catch (error) {
    console.error(
      'Recovery authentication options error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to generate recovery authentication options.',
    });
  }
}

async function verifyRecoveryPasskey(req: Request, res: Response) {
  const parsed = recoveryAuthenticationVerifySchema.safeParse(
    req.body
  );

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid recovery passkey verification request.',
    });
  }

  const {
    recoveryToken,
    challengeId,
    response,
  } = parsed.data;

  try {
    const attemptTokenHash = createHash('sha256')
      .update(recoveryToken)
      .digest('hex');

    const now = new Date().toISOString();

    const {
      data: attempt,
      error: attemptError,
    } = await supabase
      .from('ofa_recovery_attempts')
      .select('id, user_id')
      .eq('attempt_token_hash', attemptTokenHash)
      .not('email_verified_at', 'is', null)
      .is('passkey_verified_at', null)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (attemptError || !attempt) {
      return res.status(400).json({
        success: false,
        message: 'Your recovery session is invalid or expired.',
      });
    }

    const {
      data: challengeRecord,
      error: challengeError,
    } = await supabase
      .from('ofa_auth_challenges')
      .select(
        'id, challenge, user_id, ceremony, expires_at, consumed_at'
      )
      .eq('id', challengeId)
      .eq('user_id', attempt.user_id)
      .maybeSingle();

    if (
      challengeError ||
      !challengeRecord ||
      challengeRecord.ceremony !== 'recovery_authentication' ||
      challengeRecord.consumed_at ||
      new Date(challengeRecord.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Recovery authentication challenge is invalid or expired.',
      });
    }

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('ofa_users')
      .select(
        'id, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
      )
      .eq('id', attempt.user_id)
      .maybeSingle();

    if (
      userError ||
      !user ||
      !user.registration_completed_at ||
      user.disabled_at ||
      !user.email_verified_at ||
      !user.emergency_locked_at
    ) {
      return res.status(400).json({
        success: false,
        message: 'This account cannot be recovered.',
      });
    }

    const credentialId =
      typeof response.id === 'string'
        ? response.id
        : typeof response.rawId === 'string'
          ? response.rawId
          : null;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'No passkey credential was provided.',
      });
    }

    // Only accept a credential belonging to this recovery account.
    const {
      data: storedCredential,
      error: credentialError,
    } = await supabase
      .from('ofa_passkey_credentials')
      .select(
        'credential_id, user_id, public_key, counter, transports'
      )
      .eq('credential_id', credentialId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (credentialError || !storedCredential) {
      return res.status(401).json({
        success: false,
        message: 'This passkey is not registered to the recovery account.',
      });
    }

    let verification;

    const suppliedUserHandle = response.userHandle;

if (
  suppliedUserHandle !== undefined &&
  suppliedUserHandle !== null &&
  suppliedUserHandle !== ''
) {
  if (
    typeof suppliedUserHandle !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(suppliedUserHandle)
  ) {
    return res.status(401).json({
      success: false,
      message: 'Invalid passkey account handle.',
    });
  }

  const decodedUserHandle = Buffer.from(
    suppliedUserHandle,
    'base64url'
  );

  const expectedUserHandle = Buffer.from(
    user.id.replace(/-/g, ''),
    'hex'
  );

  if (
    decodedUserHandle.toString('base64url') !== suppliedUserHandle ||
    !decodedUserHandle.equals(expectedUserHandle)
  ) {
    return res.status(401).json({
      success: false,
      message: 'Passkey account verification failed.',
    });
  }
}

    try {
      verification = await verifyAuthenticationResponse({
response: response as unknown as AuthenticationResponseJSON,        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: webauthnConfig.expectedOrigin,
        expectedRPID: webauthnConfig.rpID,

        credential: {
          id: storedCredential.credential_id,
          publicKey: Buffer.from(
            storedCredential.public_key,
            'base64url'
          ),
          counter: Number(storedCredential.counter),
          transports: storedCredential.transports || [],
        },

        requireUserVerification: true,
      });
    } catch (verificationError) {
      console.warn(
        'Recovery passkey verification rejected:',
        getErrorMessage(verificationError)
      );

      return res.status(401).json({
        success: false,
        message: 'Passkey verification failed. Please try again.',
      });
    }

    if (
      !verification.verified ||
      !verification.authenticationInfo ||
      !verification.authenticationInfo.userVerified
    ) {
      return res.status(401).json({
        success: false,
        message: 'Passkey verification was unsuccessful.',
      });
    }

    const newCounter =
      verification.authenticationInfo.newCounter;

    if (
      !Number.isSafeInteger(newCounter) ||
      newCounter < 0
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authenticator counter.',
      });
    }

    // Atomically consume the recovery challenge,
    // update the credential counter, and mark the
    // recovery attempt as passkey-verified.
    const {
      data: recoveryRecords,
      error: recoveryError,
    } = await supabase.rpc(
      'complete_ofa_recovery_authentication',
      {
        p_attempt_token_hash: attemptTokenHash,
        p_challenge_id: challengeId,
        p_credential_id: storedCredential.credential_id,
        p_new_counter: newCounter,
      }
    );

    if (recoveryError || !recoveryRecords?.length) {
      console.error(
        'Recovery passkey completion failed:',
        recoveryError?.message
      );

      return res.status(401).json({
        success: false,
        message: 'Unable to verify the recovery passkey.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Existing passkey verified successfully.',
    });
  } catch (error) {
    console.error(
      'Recovery passkey verification error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected recovery authentication error occurred.',
    });
  }
}


async function recoveryRegistrationOptions(req: Request, res: Response) {
  const parsed = recoveryRegistrationOptionsSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid replacement passkey request.',
    });
  }

  try {
    const attemptTokenHash = createHash('sha256')
      .update(parsed.data.recoveryToken)
      .digest('hex');

    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await supabase
      .from('ofa_recovery_attempts')
      .select('id, user_id, recovery_credential_id')
      .eq('attempt_token_hash', attemptTokenHash)
      .not('email_verified_at', 'is', null)
      .or(
  'passkey_verified_at.not.is.null,recovery_code_verified_at.not.is.null'
)
      .is('consumed_at', null)
      .is('recovery_credential_id', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (attemptError || !attempt) {
      return res.status(400).json({
        success: false,
        message: 'Your recovery session is invalid, expired, or already used.',
      });
    }

    const { data: user, error: userError } = await supabase
      .from('ofa_users')
      .select(
        'id, display_name, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
      )
      .eq('id', attempt.user_id)
      .maybeSingle();

    if (
      userError ||
      !user ||
      !user.registration_completed_at ||
      user.disabled_at ||
      !user.email_verified_at ||
      !user.emergency_locked_at
    ) {
      return res.status(400).json({
        success: false,
        message: 'This account cannot be recovered.',
      });
    }

const options = await generateRegistrationOptions({
  rpName: webauthnConfig.rpName,
  rpID: webauthnConfig.rpID,

  userID: Buffer.from(
    user.id.replace(/-/g, ''),
    'hex'
  ),

  userName: `ofa-${user.id}`,
  userDisplayName: user.display_name,

  attestationType: 'none',

  authenticatorSelection: {
    authenticatorAttachment: 'platform',
    residentKey: 'required',
    userVerification: 'required',
  },

  // Intentionally omit excludeCredentials during recovery.
  // The user must be able to register a replacement passkey
  // even when the authenticator already has an older credential.

  timeout: 60000,
});

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    const { data: challengeRecord, error: challengeError } =
      await supabase
        .from('ofa_auth_challenges')
        .insert({
          challenge: options.challenge,
          user_id: user.id,
          ceremony: 'recovery_registration',
          expires_at: expiresAt,
        })
        .select('id')
        .single();

    if (challengeError || !challengeRecord) {
      console.error(
        'Replacement registration challenge failed:',
        challengeError?.message
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to start replacement passkey registration.',
      });
    }

    return res.status(200).json({
      success: true,
      challengeId: challengeRecord.id,
      options,
    });
  } catch (error) {
    console.error(
      'Recovery registration options error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to generate replacement passkey options.',
    });
  }
}

async function verifyRecoveryRegistration(req: Request, res: Response) {
  const parsed = recoveryRegistrationVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid replacement passkey verification request.',
    });
  }

  const {
    recoveryToken,
    challengeId,
    response,
  } = parsed.data;

  try {
    const attemptTokenHash = createHash('sha256')
      .update(recoveryToken)
      .digest('hex');

    const now = new Date().toISOString();

    const { data: attempt, error: attemptError } = await supabase
      .from('ofa_recovery_attempts')
      .select('id, user_id, recovery_credential_id')
      .eq('attempt_token_hash', attemptTokenHash)
      .not('email_verified_at', 'is', null)
      .or(
  'passkey_verified_at.not.is.null,recovery_code_verified_at.not.is.null'
)
      .is('consumed_at', null)
      .is('recovery_credential_id', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (attemptError || !attempt) {
      return res.status(400).json({
        success: false,
        message: 'Your recovery session is invalid, expired, or already used.',
      });
    }

    const { data: challengeRecord, error: challengeError } =
      await supabase
        .from('ofa_auth_challenges')
        .select(
          'id, challenge, user_id, ceremony, expires_at, consumed_at'
        )
        .eq('id', challengeId)
        .eq('user_id', attempt.user_id)
        .maybeSingle();

    if (
      challengeError ||
      !challengeRecord ||
      challengeRecord.ceremony !== 'recovery_registration' ||
      challengeRecord.consumed_at ||
      new Date(challengeRecord.expires_at).getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Replacement registration challenge is invalid or expired.',
      });
    }

    const { data: user, error: userError } = await supabase
      .from('ofa_users')
      .select(
        'id, registration_completed_at, disabled_at, email_verified_at, emergency_locked_at'
      )
      .eq('id', attempt.user_id)
      .maybeSingle();

    if (
      userError ||
      !user ||
      !user.registration_completed_at ||
      user.disabled_at ||
      !user.email_verified_at ||
      !user.emergency_locked_at
    ) {
      return res.status(400).json({
        success: false,
        message: 'This account cannot be recovered.',
      });
    }

    let verification;

    try {
      verification = await verifyRegistrationResponse({
response: response as unknown as RegistrationResponseJSON,        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: webauthnConfig.expectedOrigin,
        expectedRPID: webauthnConfig.rpID,
        requireUserVerification: true,
      });
    } catch (verificationError) {
      console.warn(
        'Replacement passkey verification rejected:',
        getErrorMessage(verificationError)
      );

      return res.status(400).json({
        success: false,
        message: 'Replacement passkey verification failed.',
      });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        message: 'Replacement passkey registration was unsuccessful.',
      });
    }

    const {
      credential,
      credentialDeviceType,
      credentialBackedUp,
      aaguid,
    } = verification.registrationInfo;

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
        message: 'Invalid replacement passkey credential.',
      });
    }

    const transports = Array.isArray(credential.transports)
      ? credential.transports.filter(
  (transport: string) => typeof transport === 'string'
)
      : [];

    const { data: recoveryRecords, error: recoveryError } =
      await supabase.rpc('register_ofa_recovery_passkey', {
        p_attempt_token_hash: attemptTokenHash,
        p_challenge_id: challengeId,
        p_credential_id: credential.id,
        p_public_key: Buffer.from(
          credential.publicKey
        ).toString('base64url'),
        p_counter: credential.counter,
        p_transports: transports,
        p_device_type: credentialDeviceType,
        p_backed_up: credentialBackedUp,
        p_aaguid: aaguid || null,
      });

    if (recoveryError || !recoveryRecords?.length) {
      console.error(
        'Replacement passkey storage failed:',
        recoveryError?.message
      );

      return res.status(409).json({
        success: false,
        message: 'Unable to register the replacement passkey.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Replacement passkey registered successfully.',
    });
  } catch (error) {
    console.error(
      'Replacement passkey registration error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected replacement registration error occurred.',
    });
  }
}

async function completeRecovery(req: Request, res: Response) {
  const parsed = recoveryCompletionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid recovery completion request.',
    });
  }

  try {
    const attemptTokenHash = createHash('sha256')
      .update(parsed.data.recoveryToken)
      .digest('hex');

    // Generate ten independent 128-bit recovery codes.
    // Plaintext codes are never stored in the database.
    const recoveryCodes = Array.from(
      { length: 10 },
      () => {
        const rawCode = randomBytes(16)
          .toString('hex')
          .toUpperCase();

        return (rawCode.match(/.{1,4}/g) ?? []).join('-');
      }
    );

    // Hash the exact displayed code before storing it.
    const recoveryCodeHashes = recoveryCodes.map((code) =>
      createHash('sha256')
        .update(code)
        .digest('hex')
    );

    // The database RPC atomically:
    // - validates the recovery attempt and replacement passkey
    // - revokes active sessions
    // - removes old passkeys, retaining the replacement
    // - replaces old recovery codes
    // - consumes the recovery attempt
    // - unlocks the account
    const { data, error } = await supabase.rpc(
      'complete_ofa_recovery',
      {
        p_attempt_token_hash: attemptTokenHash,
        p_recovery_code_hashes: recoveryCodeHashes,
      }
    );

    if (error || !data?.length) {
      console.error(
        'Final account recovery failed:',
        error?.message
      );

      return res.status(409).json({
        success: false,
        message:
          'Unable to complete account recovery. Your account has not been confirmed as unlocked.',
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Your account has been recovered successfully. Save your new recovery codes securely.',
      recoveryCodes,
      user: {
        id: data[0].recovery_user_id,
        displayName: data[0].display_name,
      },
    });
  } catch (error) {
    console.error(
      'Final account recovery error:',
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected account recovery error occurred.',
    });
  }
}

export {
  registerOptions,
  registerVerify,
  verifyEmail,
  loginOptions,
  loginVerify,
  emergencyLock,
  getSession,
  logout,
  startRecovery,
  verifyRecoveryEmail,
  verifyRecoveryCode,
  recoveryAuthenticationOptions,
  verifyRecoveryPasskey,
  recoveryRegistrationOptions,
  verifyRecoveryRegistration,
  completeRecovery,
};