import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateUpdateProfile, validateChangePassword, validateDeleteAccount } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get('/me', authenticateToken, userController.getMe);
router.get('/me/listings', authenticateToken, userController.getMyListings);
router.patch('/me', authenticateToken, validateUpdateProfile, userController.updateMe);
router.patch('/me/password', authenticateToken, validateChangePassword, userController.changePassword);
router.delete('/me', authenticateToken, validateDeleteAccount, userController.deleteMe);

export default router;
