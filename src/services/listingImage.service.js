import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const addImage = async (userId, listingId, imageUrl) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the parent listing row to serialize uploads and prevent race conditions
    // on both the 5-image limit and the display_order calculation.
    const listingCheck = await client.query('SELECT id, seller_id FROM listings WHERE id = $1 FOR UPDATE', [listingId]);
    
    if (listingCheck.rows.length === 0) {
      throw new AppError('Listing not found', 404);
    }

    if (listingCheck.rows[0].seller_id !== userId) {
      throw new AppError('Unauthorized access to listing', 403);
    }

    const countCheck = await client.query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
    const imageCount = parseInt(countCheck.rows[0].count, 10);

    if (imageCount >= 5) {
      throw new AppError('Maximum 5 images allowed per listing', 400);
    }

    const result = await client.query(
      `INSERT INTO listing_images (listing_id, image_url, display_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM listing_images WHERE listing_id = $1))
       RETURNING id, listing_id, image_url, display_order, created_at`,
      [listingId, imageUrl]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getImages = async (listingId) => {
  const listingCheck = await pool.query('SELECT id FROM listings WHERE id = $1', [listingId]);
  
  if (listingCheck.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }

  const result = await pool.query(
    `SELECT id, listing_id, image_url, display_order, created_at
     FROM listing_images
     WHERE listing_id = $1
     ORDER BY display_order ASC, id ASC`,
    [listingId]
  );
  
  return result.rows;
};

export const deleteImage = async (userId, listingId, imageId) => {
  const listingCheck = await pool.query('SELECT id, seller_id FROM listings WHERE id = $1', [listingId]);
  
  if (listingCheck.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }

  if (listingCheck.rows[0].seller_id !== userId) {
    throw new AppError('Unauthorized access to listing', 403);
  }

  const imageCheck = await pool.query('SELECT image_url FROM listing_images WHERE id = $1 AND listing_id = $2', [imageId, listingId]);
  
  if (imageCheck.rows.length === 0) {
    throw new AppError('Image not found', 404);
  }

  const imageUrl = imageCheck.rows[0].image_url;

  await pool.query('DELETE FROM listing_images WHERE id = $1 AND listing_id = $2', [imageId, listingId]);

  return imageUrl;
};
