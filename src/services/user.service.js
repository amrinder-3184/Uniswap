import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';
import bcrypt from 'bcrypt';

export const getUserProfile = async (userId) => {
  const result = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('User not found', 404);
  }
  
  return result.rows[0];
};

export const getUserListings = async (userId) => {
  const query = `
    SELECT l.id, l.title, l.description, l.price, l.condition, l.status, l.category_id, c.name AS category_name, l.created_at, l.seller_id, u.name AS seller_name,
    (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY id ASC LIMIT 1) AS image_url
    FROM listings l
    LEFT JOIN categories c ON l.category_id = c.id
    LEFT JOIN users u ON l.seller_id = u.id
    WHERE l.seller_id = $1
    ORDER BY l.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const updateUserProfile = async (userId, updateData) => {
  const { name, email } = updateData;

  const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  if (email) {
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (emailCheck.rows.length > 0) {
      throw new AppError('Email already registered', 409);
    }
  }

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(name);
    paramIndex++;
  }

  if (email !== undefined) {
    setClauses.push(`email = $${paramIndex}`);
    values.push(email);
    paramIndex++;
  }

  values.push(userId);
  const query = `
    UPDATE users 
    SET ${setClauses.join(', ')} 
    WHERE id = $${paramIndex} 
    RETURNING id, name, email, role, created_at;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};



export const changeUserPassword = async (userId, currentPassword, newPassword) => {
  const userCheck = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  
  if (userCheck.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { password_hash } = userCheck.rows[0];

  const isValidPassword = await bcrypt.compare(currentPassword, password_hash);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 401);
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
};

export const deleteUserAccount = async (userId, currentPassword) => {
  const userCheck = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  
  if (userCheck.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const { password_hash } = userCheck.rows[0];

  const isValidPassword = await bcrypt.compare(currentPassword, password_hash);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 401);
  }

  await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
};
