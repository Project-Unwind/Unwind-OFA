const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  registerOptions,
  registerVerify,
  verifyEmail,
  loginOptions,
  loginVerify,
  getSession,
  logout,
} = require('../controllers/authController');

const router = express.Router();

const TRUSTED_FRONTEND_ORIGIN = new URL(
  process.env.FRONTEND_URL || 'http://localhost:5173'
).origin;

// Reject cookie-authenticated requests from untrusted origins.
function requireTrustedOrigin(req, res, next) {
  const requestOrigin = req.get('origin');

  if (!requestOrigin || requestOrigin !== TRUSTED_FRONTEND_ORIGIN) {
    return res.status(403).json({
      success: false,
      message: 'Request origin is not allowed.',
    });
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

module.exports = router;