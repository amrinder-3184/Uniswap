import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const buyListing = async (buyerId, listingId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the listing row
    const result = await client.query(
      `SELECT id, seller_id, price, status
       FROM listings
       WHERE id = $1
       FOR UPDATE`,
      [listingId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Listing not found', 404);
    }

    const listing = result.rows[0];

    if (listing.status === 'sold') {
      throw new AppError('Listing already sold', 400);
    }

    if (listing.seller_id === buyerId) {
      throw new AppError('You cannot buy your own listing', 400);
    }

    const transactionResult = await client.query(
      `INSERT INTO transactions (
         listing_id,
         buyer_id,
         seller_id,
         purchase_price
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id, listing_id, buyer_id, seller_id, purchase_price, created_at`,
      [listing.id, buyerId, listing.seller_id, listing.price]
    );

    await client.query(
      `UPDATE listings
       SET status = 'sold'
       WHERE id = $1`,
      [listing.id]
    );

    await client.query('COMMIT');

    return transactionResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getPurchases = async (userId) => {
  const query = `
    SELECT 
      t.id, 
      t.listing_id, 
      l.title AS listing_title, 
      t.buyer_id, 
      t.seller_id, 
      u.name AS seller_name, 
      u.email AS seller_email, 
      t.purchase_price, 
      t.created_at
    FROM transactions t
    LEFT JOIN listings l ON t.listing_id = l.id
    LEFT JOIN users u ON t.seller_id = u.id
    WHERE t.buyer_id = $1
    ORDER BY t.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const getSales = async (userId) => {
  const query = `
    SELECT 
      t.id, 
      t.listing_id, 
      l.title AS listing_title, 
      t.buyer_id, 
      u.name AS buyer_name, 
      u.email AS buyer_email, 
      t.seller_id, 
      t.purchase_price, 
      t.created_at
    FROM transactions t
    LEFT JOIN listings l ON t.listing_id = l.id
    LEFT JOIN users u ON t.buyer_id = u.id
    WHERE t.seller_id = $1
    ORDER BY t.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};
