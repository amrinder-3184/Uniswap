import * as similarListingService from '../services/similarListing.service.js';

export const getSimilarListings = async (req, res, next) => {
  try {
    const listingId = req.params.listingId;
    const similarListings = await similarListingService.getSimilarListings(listingId);
    res.json({ data: similarListings });
  } catch (error) {
    next(error);
  }
};
