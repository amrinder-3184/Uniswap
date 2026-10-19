import * as transactionService from '../services/transaction.service.js';

export const buyListing = async (req, res, next) => {
  try {
    const buyerId = req.user.userId;
    const listingId = Number(req.params.listingId);

    const transaction = await transactionService.buyListing(buyerId, listingId);

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

export const getPurchases = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const purchases = await transactionService.getPurchases(userId);
    res.json({ data: purchases });
  } catch (err) {
    next(err);
  }
};

export const getSales = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sales = await transactionService.getSales(userId);
    res.json({ data: sales });
  } catch (err) {
    next(err);
  }
};
