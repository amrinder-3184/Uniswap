import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const addFavorite = async (userId, listingId) => {
  const listingCheck = await pool.query('SELECT id FROM listings WHERE id = $1', [listingId]);
  if (listingCheck.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }

  try {
    await pool.query(
      'INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)',
      [userId, listingId]
    );
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      throw new AppError('Listing already favorited', 409);
    }
    throw err;
  }
};

export const getFavorites = async (userId) => {
  const query = `
    SELECT
      l.id,
      l.title,
      l.description,
      l.price,
      l.condition,
      l.category_id,
      c.name AS category_name,
      f.created_at AS favorited_at
    FROM favorites f
    JOIN listings l ON f.listing_id = l.id
    LEFT JOIN categories c ON l.category_id = c.id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const removeFavorite = async (userId, listingId) => {
  const result = await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2 RETURNING user_id, listing_id',
    [userId, listingId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('Favorite not found', 404);
  }
};
