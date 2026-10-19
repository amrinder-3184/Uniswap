import express from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { validateCreateCategory, validateCategoryId } from '../middleware/validation.middleware.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Reading categories is public; creating them is restricted to administrators
router.get('/', categoryController.getCategories);
router.get('/:id', validateCategoryId, categoryController.getCategoryById);
router.post('/', authenticateToken, requireAdmin, validateCreateCategory, categoryController.createCategory);

export default router;
