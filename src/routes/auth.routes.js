import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { validateRegister, validateLogin } from '../middleware/validation.middleware.js';
import { isRateLimitDisabled } from '../config/security.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes
  skip: isRateLimitDisabled,
  message: { message: "Too many authentication attempts, please try again later." }
});

router.post('/register', authLimiter, validateRegister, authController.register);
router.post('/login', authLimiter, validateLogin, authController.login);

export default router;
