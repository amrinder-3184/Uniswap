import * as recommendationService from '../services/recommendation.service.js';

export const getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const recommendations = await recommendationService.getRecommendations(userId);
    res.json({ data: recommendations });
  } catch (error) {
    next(error);
  }
};
