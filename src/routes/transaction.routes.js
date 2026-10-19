import express from 'express';
import * as transactionController from '../controllers/transaction.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateListingIdParam } from '../middleware/validation.middleware.js';

const router = express.Router();

router.post('/listings/:listingId/buy', authenticateToken, validateListingIdParam, transactionController.buyListing);
router.get('/transactions/purchases', authenticateToken, transactionController.getPurchases);
router.get('/transactions/sales', authenticateToken, transactionController.getSales);

export default router;
