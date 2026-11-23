const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  registerOptions,
  registerVerify,
} = require('../controllers/authController');

const router = express.Router();

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

module.exports = router;