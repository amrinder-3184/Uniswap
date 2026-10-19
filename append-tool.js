import fs from 'fs';
fs.appendFileSync('src/services/aiTools.service.js', `
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
`);
