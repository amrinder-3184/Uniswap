import express from 'express';
import * as messageController from '../controllers/message.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateCreateMessage, validateListingIdParam, validateOtherUserIdParam } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, messageController.getConversations);
router.post('/', authenticateToken, validateCreateMessage, messageController.createMessage);
router.get('/:listingId/:otherUserId', authenticateToken, validateListingIdParam, validateOtherUserIdParam, messageController.getThread);

export default router;
