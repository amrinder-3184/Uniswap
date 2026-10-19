import * as userService from '../services/user.service.js';

export const getMe = async (req, res) => {
  const userId = req.user.userId;
  const user = await userService.getUserProfile(userId);
  res.json(user);
};

export const getMyListings = async (req, res) => {
  const userId = req.user.userId;
  const listings = await userService.getUserListings(userId);
  res.json({ data: listings });
};

export const updateMe = async (req, res) => {
  const userId = req.user.userId;
  const updatedUser = await userService.updateUserProfile(userId, req.body);
  res.json(updatedUser);
};

export const changePassword = async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;
  
  await userService.changeUserPassword(userId, currentPassword, newPassword);
  
  res.json({ message: "Password changed successfully" });
};

export const deleteMe = async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword } = req.body;
  
  await userService.deleteUserAccount(userId, currentPassword);
  
  res.json({ message: "Account deleted successfully" });
};
