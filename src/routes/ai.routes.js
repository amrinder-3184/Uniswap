import express from 'express';
import rateLimit from 'express-rate-limit';
import * as aiController from '../controllers/ai.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateAIChat } from '../middleware/validation.middleware.js';
import { isRateLimitDisabled } from '../config/security.js';

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 requests per minute
  skip: isRateLimitDisabled,
  message: { message: "Too many AI requests, please slow down." }
});

router.post('/chat', authenticateToken, aiLimiter, validateAIChat, aiController.chat);

export default router;
