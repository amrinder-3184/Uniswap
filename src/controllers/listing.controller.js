import * as listingService from '../services/listing.service.js';
import { AppError } from '../utils/AppError.js';
export const getListings = async (req, res) => {
  const categoryId = req.query.category ? Number(req.query.category) : null;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const search = req.query.search ? req.query.search.trim() : null;
  const sortBy = req.query.sortBy || 'created_at';
  const order = req.query.order || 'desc';
  
  const result = await listingService.getListings(categoryId, page, limit, search, sortBy, order);
  res.json(result);
};

export const getListingById = async (req, res) => {
  const listing = await listingService.getListingById(req.params.id);
  if (listing) {
    res.json(listing);
  } else {
    const error = new Error("Listing not found");
    error.statusCode = 404;
    throw error;
  }
};

export const createListing = async (req, res) => {
  const { title, description, price, condition, category_id } = req.body;
  const seller_id = req.user.userId;
  const newListing = await listingService.createListing({ title, description, price, condition, seller_id, category_id });
  res.status(201).json(newListing);
};

export const updateListing = async (req, res) => {
  const updatedListing = await listingService.updateListing(
    req.params.id,
    req.body,
    req.user.userId
  ).catch(err => {
    if (err.message === "Listing not found") {
      throw new AppError(err.message, 404);
    } else if (err.message === "You are not allowed to modify this listing") {
      throw new AppError(err.message, 403);
    } else if (err.message === "No valid fields to update") {
      throw new AppError(err.message, 400);
    }
    throw err;
  });

  res.status(200).json(updatedListing);
};

export const deleteListing = async (req, res) => {
  await listingService.deleteListing(
    req.params.id,
    req.user.userId
  ).catch(err => {
    if (err.message === "Listing not found") {
      throw new AppError(err.message, 404);
    } else if (err.message === "You are not allowed to delete this listing") {
      throw new AppError(err.message, 403);
    } else if (err.message === "Sold listings cannot be deleted") {
      throw new AppError(err.message, 400);
    }
    throw err;
  });

  res.status(200).json({ "message": "Listing deleted successfully" });
};
