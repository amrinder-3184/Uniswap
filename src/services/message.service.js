import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const sendMessage = async (senderId, listingId, content) => {
  const listingQuery = await pool.query('SELECT id, seller_id FROM listings WHERE id = $1', [listingId]);
  
  if (listingQuery.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }
  
  const receiverId = listingQuery.rows[0].seller_id;
  
  if (senderId === receiverId) {
    throw new AppError('You cannot message yourself about your own listing', 400);
  }
  
  const result = await pool.query(
    `INSERT INTO messages (sender_id, receiver_id, listing_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, receiver_id, listing_id, content, created_at`,
    [senderId, receiverId, listingId, content]
  );
  
  return result.rows[0];
};

export const getConversations = async (userId) => {
  const query = `
    WITH ThreadLatest AS (
      SELECT
        DISTINCT ON (m.listing_id, LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id))
        m.listing_id,
        l.title AS listing_title,
        CASE
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END AS other_user_id,
        m.content AS latest_message,
        m.created_at AS latest_message_at,
        COUNT(m.id) OVER (PARTITION BY m.listing_id, LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id))::int AS message_count
      FROM messages m
      JOIN listings l ON m.listing_id = l.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY
        m.listing_id,
        LEAST(m.sender_id, m.receiver_id),
        GREATEST(m.sender_id, m.receiver_id),
        m.created_at DESC
    )
    SELECT *
    FROM ThreadLatest
    ORDER BY latest_message_at DESC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const getThread = async (userId, listingId, otherUserId) => {
  const listingCheck = await pool.query('SELECT id FROM listings WHERE id = $1', [listingId]);
  
  if (listingCheck.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }

  const query = `
    SELECT id, sender_id, receiver_id, listing_id, content, created_at
    FROM messages
    WHERE listing_id = $1
      AND (
          (sender_id = $2 AND receiver_id = $3)
          OR
          (sender_id = $3 AND receiver_id = $2)
      )
    ORDER BY created_at ASC
  `;
  
  const result = await pool.query(query, [listingId, userId, otherUserId]);
  return result.rows;
};
