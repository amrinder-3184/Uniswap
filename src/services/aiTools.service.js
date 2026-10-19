import * as listingService from './listing.service.js';
import * as recommendationService from './recommendation.service.js';
import * as similarListingService from './similarListing.service.js';

export const searchListingsTool = async (args) => {
  let { search = null, category = null, page = 1, limit = 5, sortBy = 'created_at', order = 'desc' } = args;
  
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 20) limit = 20;
  
  const allowedSortBy = ['price', 'created_at', 'title'];
  if (!allowedSortBy.includes(sortBy)) sortBy = 'created_at';
  
  const allowedOrder = ['asc', 'desc'];
  if (typeof order !== 'string' || !allowedOrder.includes(order.toLowerCase())) order = 'desc';

  if (category !== null && (!Number.isInteger(category) || category <= 0)) category = null;
  if (search !== null && typeof search !== 'string') search = null;
  
  const result = await listingService.getListings(category, page, limit, search, sortBy, order);
  
  // Safe filtering: map only safe fields just in case
  const safeListings = result.data.map(l => ({
    id: l.id,
    title: l.title,
    description: l.description,
    price: l.price,
    condition: l.condition,
    category_id: l.category_id,
    category_name: l.category_name,
    created_at: l.created_at
  }));

  return {
    listings: safeListings,
    pagination: result.pagination
  };
};

export const getRecommendationsTool = async (userId) => {
  const result = await recommendationService.getRecommendations(userId);
  
  // Safe filtering: map only safe fields just in case
  const safeListings = result.map(l => ({
    id: l.id,
    title: l.title,
    description: l.description,
    price: l.price,
    condition: l.condition,
    category_id: l.category_id,
    category_name: l.category_name,
    created_at: l.created_at,
    score: l.score,
    reason: l.reason
  }));

  return {
    listings: safeListings
  };
};

export const getSimilarListingsTool = async (listingId) => {
  const id = Number(listingId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid listing ID provided to tool.");
  }
  const result = await similarListingService.getSimilarListings(id);
  
  // Safe filtering: map only safe fields just in case
  const safeListings = result.map(l => ({
    id: l.id,
    title: l.title,
    description: l.description,
    price: l.price,
    condition: l.condition,
    category_id: l.category_id,
    category_name: l.category_name,
    created_at: l.created_at,
    score: l.score,
    reason: l.reason
  }));

  return {
    listings: safeListings
  };
};

export const getListingDetailsTool = async (listingId) => {
  const id = Number(listingId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid listing ID provided to tool.");
  }
  const listing = await listingService.getListingById(id);
  
  if (!listing) {
    return { error: "Listing not found or has been deleted." };
  }

  // Strictly return only safe, unauthenticated data
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    condition: listing.condition,
    category_id: listing.category_id,
    category_name: listing.category_name,
    status: listing.status,
    created_at: listing.created_at
  };
};
