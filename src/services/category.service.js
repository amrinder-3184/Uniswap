import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const getCategories = async () => {
  const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
  return result.rows;
};

export const createCategory = async (name) => {
  const checkResult = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
  if (checkResult.rows.length > 0) {
    throw new Error('Category already exists');
  }

  const result = await pool.query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name]
  );
  return result.rows[0];
};

export const getCategoryById = async (id) => {
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw new AppError('Category not found', 404);
  }
  return result.rows[0];
};
