import express from 'express';
import * as listingImageController from '../controllers/listingImage.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateListingIdParam, validateImageIdParam } from '../middleware/validation.middleware.js';
import { handleUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/:listingId/images', validateListingIdParam, listingImageController.getImages);
router.post('/:listingId/images', authenticateToken, validateListingIdParam, handleUpload, listingImageController.uploadImage);
router.delete('/:listingId/images/:imageId', authenticateToken, validateListingIdParam, validateImageIdParam, listingImageController.deleteImage);

export default router;
