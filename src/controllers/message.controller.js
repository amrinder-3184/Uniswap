import * as messageService from '../services/message.service.js';

export const createMessage = async (req, res) => {
  const senderId = req.user.userId;
  const { listing_id, content } = req.body;
  
  const message = await messageService.sendMessage(senderId, listing_id, content.trim());
  
  res.status(201).json(message);
};

export const getConversations = async (req, res) => {
  const userId = req.user.userId;
  const conversations = await messageService.getConversations(userId);
  res.json({ data: conversations });
};

export const getThread = async (req, res) => {
  const userId = req.user.userId;
  const listingId = Number(req.params.listingId);
  const otherUserId = Number(req.params.otherUserId);
  
  const messages = await messageService.getThread(userId, listingId, otherUserId);
  res.json({ data: messages });
};
