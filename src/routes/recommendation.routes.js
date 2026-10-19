import express from 'express';
import * as recommendationController from '../controllers/recommendation.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, recommendationController.getRecommendations);

export default router;
