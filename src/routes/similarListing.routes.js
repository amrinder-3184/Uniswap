import express from 'express';
import * as similarListingController from '../controllers/similarListing.controller.js';
import { validateListingIdParam } from '../middleware/validation.middleware.js';

const router = express.Router();

router.get('/:listingId/similar', validateListingIdParam, similarListingController.getSimilarListings);

export default router;
