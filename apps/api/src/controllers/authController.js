const {
  randomUUID,
  randomBytes,
  createHash,
} = require('node:crypto');

const { z } = require('zod');

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const { supabase } = require('../config/supabase');
const { webauthnConfig } = require('../config/webauthn');

const { sendBrevoEmail } = require('../services/emailService');

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
};

const optionsSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address.')
    .max(254)
    .transform((value) => value.toLowerCase()),
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

// --------------------------------------------------
// REGISTRATION
// --------------------------------------------------

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
        <h2>Welcome to Unwind OFA</h2>

        <p>Your passkey has been successfully registered.</p>

        <p>Please verify your email address by clicking below:</p>

        <a
          href="${verificationUrl}"
          style="display: inline-block; padding: 13px 22px; background: #16F5D0; color: #020606; text-decoration: none; border-radius: 8px; font-weight: bold;"
        >
          Verify email address
        </a>

        <p>This link expires in 30 minutes.</p>

        <p>If you did not create this account, you can ignore this email.</p>

        <p>— Unwind OFA Security Team</p>
      </div>
    `,

    textContent: `
Welcome to Unwind OFA.

Your passkey has been registered successfully.

Verify your email address using this link:
${verificationUrl}

This link expires in 30 minutes.

If you did not create this account, ignore this email.
    `,
  });
} catch (emailError) {
  // Do not undo successful passkey registration.
  console.error(
    'Registration verification email failed:',
    emailError.message
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
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected registration error occurred.',
    });
  }
}

async function verifyEmail(req, res) {
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
        emailError.message
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully.',
    });
  } catch (error) {
    console.error(
      'Email verification error:',
      error.message
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

async function loginOptions(_req, res) {
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
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to generate sign-in options.',
    });
  }
}

async function loginVerify(req, res) {
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
  'id, display_name, email, registration_completed_at, disabled_at, email_verified_at'
)
      .eq('id', storedCredential.user_id)
      .maybeSingle();

    if (
      userError ||
      !user ||
      !user.registration_completed_at ||
      user.disabled_at
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
        response,
        expectedChallenge: challengeRecord.challenge,
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
        verificationError.message
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
              <p style="margin: 0 0 8px;">
                <strong>Sign-in method:</strong> Passkey
              </p>

              <p style="margin: 0;">
                <strong>Date and time:</strong> ${loginTime} (UTC)
              </p>
            </div>

            <p>
              If you don't recognize this activity, take steps to secure
              your account and contact Unwind OFA support.
            </p>

            <p>— Unwind OFA Security Team</p>
          </div>
        `,

        textContent: `
New sign-in to Unwind OFA

A successful passkey sign-in was completed for your account.

Sign-in method: Passkey
Date and time: ${loginTime} (UTC)

If you don't recognize this activity, take steps to secure your
account and contact Unwind OFA support.

— Unwind OFA Security Team
        `,
      });
    } catch (emailError) {
      console.error(
        'Login security notification failed:',
        emailError.message
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
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected sign-in error occurred.',
    });
  }
}

function getSessionToken(req) {
  const cookies = (req.headers.cookie || '').split(';');

  const sessionCookie = cookies.find((cookie) =>
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

function clearSessionCookie(res) {
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

async function getSession(req, res) {
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
        'id, display_name, registration_completed_at, disabled_at, email_verified_at'
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
      error.message
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

async function logout(req, res) {
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
      error.message
    );

    return res.status(500).json({
      success: false,
      message: 'An unexpected logout error occurred.',
    });
  }
}

module.exports = {
  registerOptions,
  registerVerify,
  verifyEmail,
  loginOptions,
  loginVerify,
  getSession,
  logout,
};