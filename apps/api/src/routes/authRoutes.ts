
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';

import rateLimit from 'express-rate-limit';

import {
  registerOptions,
  registerVerify,
  verifyEmail,
  loginOptions,
  loginVerify,
  getSession,
  logout,
  startRecovery,
  verifyRecoveryEmail,
  verifyRecoveryCode,
  emergencyLock,
  recoveryAuthenticationOptions,
  verifyRecoveryPasskey,
  recoveryRegistrationOptions,
  verifyRecoveryRegistration,
  completeRecovery,
} from '../controllers/authController';

const router = express.Router();

const TRUSTED_FRONTEND_ORIGIN = new URL(
  process.env.FRONTEND_URL || 'http://localhost:3000'
).origin;

// Reject cookie-authenticated requests from untrusted origins.
function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestOrigin = req.get('origin');

  if (!requestOrigin || requestOrigin !== TRUSTED_FRONTEND_ORIGIN) {
    res.status(403).json({
      success: false,
      message: 'Request origin is not allowed.',
    });
    return;
  }

  next();
}

const registrationOptionsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.',
  },
});

const registrationVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
  },
});

const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/verify-email',
  emailVerificationLimiter,
  verifyEmail
);

const loginOptionsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please try again later.',
  },
});

const loginVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
  },
});

const emergencyLockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/emergency-lock',
  requireTrustedOrigin,
  emergencyLockLimiter,
  emergencyLock
);

// Registration
router.post(
  '/register/options',
  registrationOptionsLimiter,
  registerOptions
);

router.post(
  '/register/verify',
  registrationVerifyLimiter,
  registerVerify
);

// Passkey sign-in
router.post(
  '/login/options',
  loginOptionsLimiter,
  loginOptions
);

router.post(
  '/login/verify',
  loginVerifyLimiter,
  loginVerify
);

// Session management
router.get('/session', getSession);

router.post('/logout', requireTrustedOrigin, logout);

const recoveryStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryCodeVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryAuthenticationOptionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryAuthenticationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryRegistrationOptionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryRegistrationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const recoveryCompletionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/recovery/passkey/options',
  requireTrustedOrigin,
  recoveryAuthenticationOptionsLimiter,
  recoveryAuthenticationOptions
);

router.post(
  '/recovery/passkey/verify',
  requireTrustedOrigin,
  recoveryAuthenticationVerifyLimiter,
  verifyRecoveryPasskey
);

router.post(
  '/recovery/start',
  requireTrustedOrigin,
  recoveryStartLimiter,
  startRecovery
);

router.post(
  '/recovery/verify-email',
  requireTrustedOrigin,
  recoveryVerifyLimiter,
  verifyRecoveryEmail
);

router.post(
  '/recovery/code/verify',
  requireTrustedOrigin,
  recoveryCodeVerifyLimiter,
  verifyRecoveryCode
);

router.post(
  '/recovery/replacement-passkey/options',
  requireTrustedOrigin,
  recoveryRegistrationOptionsLimiter,
  recoveryRegistrationOptions
);

router.post(
  '/recovery/replacement-passkey/verify',
  requireTrustedOrigin,
  recoveryRegistrationVerifyLimiter,
  verifyRecoveryRegistration
);

router.post(
  '/recovery/complete',
  requireTrustedOrigin,
  recoveryCompletionLimiter,
  completeRecovery
);

export default router;