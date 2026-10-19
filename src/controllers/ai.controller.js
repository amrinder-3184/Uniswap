import * as aiService from '../services/ai.service.js';

export const chat = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const message = req.body.message;
    const context = req.body.context;
    const history = req.body.history || [];

    const response = await aiService.chatWithAI(userId, message, context, history);

    res.json(response);
  } catch (err) {
    next(err);
  }
};
