import express from 'express';
import * as favoriteController from '../controllers/favorite.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateListingIdParam } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, favoriteController.getFavorites);
router.post('/:listingId', authenticateToken, validateListingIdParam, favoriteController.addFavorite);
router.delete('/:listingId', authenticateToken, validateListingIdParam, favoriteController.removeFavorite);

export default router;
