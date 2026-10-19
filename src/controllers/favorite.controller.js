import * as favoriteService from '../services/favorite.service.js';

export const addFavorite = async (req, res) => {
  const userId = req.user.userId;
  const listingId = Number(req.params.listingId);
  
  await favoriteService.addFavorite(userId, listingId);
  
  res.status(201).json({ message: 'Listing added to favorites' });
};

export const getFavorites = async (req, res) => {
  const userId = req.user.userId;
  const favorites = await favoriteService.getFavorites(userId);
  res.json({ data: favorites });
};

export const removeFavorite = async (req, res) => {
  const userId = req.user.userId;
  const listingId = Number(req.params.listingId);
  
  await favoriteService.removeFavorite(userId, listingId);
  
  res.json({ message: 'Favorite removed successfully' });
};
