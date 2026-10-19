import express from 'express';
import * as listingController from '../controllers/listing.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateCreateListing, validateUpdateListing, validateGetListingsQuery, validateListingId } from '../middleware/validation.middleware.js';

const router = express.Router();

// This corresponds to GET /listings because the router will be mounted at /listings
router.get('/', validateGetListingsQuery, listingController.getListings);
router.get('/:id', validateListingId, listingController.getListingById);
// Chained middlewares: Authenticate first, then validate body, then create
router.post('/', authenticateToken, validateCreateListing, listingController.createListing);
router.patch('/:id', authenticateToken, validateListingId, validateUpdateListing, listingController.updateListing);
router.delete('/:id', authenticateToken, validateListingId, listingController.deleteListing);

export default router;
