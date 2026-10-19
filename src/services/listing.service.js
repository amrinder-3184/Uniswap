import pool from '../../db.js';
import { getEmbedding } from './embedding.service.js';
import { AppError } from '../utils/AppError.js';

// Feature flag: set to false if pgvector is unavailable in the environment.
const IS_PGVECTOR_ENABLED = false; 

export const getListings = async (categoryId = null, page = 1, limit = 10, search = null, sortBy = 'created_at', order = 'desc') => {
  let countQuery = `SELECT COUNT(*) FROM listings l`;
  const countValues = [];
  let countWhere = [`l.status = 'available'`];

  if (categoryId) {
    countValues.push(categoryId);
    countWhere.push(`l.category_id = $${countValues.length}`);
  }

  // Keyword exact matching for counts
  if (search) {
    countValues.push(`%${search}%`);
    countWhere.push(`(l.title ILIKE $${countValues.length} OR l.description ILIKE $${countValues.length})`);
  }

  if (countWhere.length > 0) {
    countQuery += ` WHERE ` + countWhere.join(' AND ');
  }

  const countResult = await pool.query(countQuery, countValues);
  const total = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(total / limit) || 1;
  const hasNextPage = page < totalPages;

  let query = `
    SELECT 
      l.id, 
      l.title, 
      l.description, 
      l.price, 
      l.condition, 
      l.seller_id, 
      l.category_id, 
      c.name AS category_name, 
      l.created_at
  `;
  
  const values = [];
  let where = [`l.status = 'available'`];
  let isHybridSearch = false;
  
  if (search && IS_PGVECTOR_ENABLED) {
    // Attempt semantic embedding
    const queryEmbedding = await getEmbedding(search);
    if (queryEmbedding) {
      isHybridSearch = true;
      values.push(JSON.stringify(queryEmbedding)); // $1
      
      // Calculate semantic similarity (Cosine similarity: 1 - cosine_distance)
      query += `, (1 - (l.embedding <=> $${values.length})) AS semantic_score`;
      
      // Calculate keyword relevance (simple binary or ts_rank for full text)
      values.push(`%${search}%`); // $2
      query += `, CASE WHEN (l.title ILIKE $${values.length} OR l.description ILIKE $${values.length}) THEN 1.0 ELSE 0.0 END AS keyword_score`;
    }
  }

  query += ` FROM listings l LEFT JOIN categories c ON l.category_id = c.id`;
  
  if (categoryId) {
    values.push(categoryId);
    where.push(`l.category_id = $${values.length}`);
  }

  if (search) {
    if (!isHybridSearch) {
      // Fallback Keyword Search
      values.push(`%${search}%`);
      where.push(`(l.title ILIKE $${values.length} OR l.description ILIKE $${values.length})`);
    } else {
      // Hybrid Filter: Keep items that are EITHER keyword-matched OR highly semantically similar
      // Assuming $2 is the search string and $1 is the embedding. 
      // We rely on the ORDER BY to rank them, but we still need a broad WHERE clause to filter garbage.
      // (semantic_score > 0.7 OR keyword_score > 0)
      where.push(`((1 - (l.embedding <=> $1)) > 0.7 OR (l.title ILIKE $2 OR l.description ILIKE $2))`);
    }
  }

  if (where.length > 0) {
    query += ` WHERE ` + where.join(' AND ');
  }
  
  const sortMap = {
    price: "l.price",
    created_at: "l.created_at",
    title: "l.title"
  };
  const sqlSortBy = sortMap[sortBy] || "l.created_at";
  const sqlOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  if (isHybridSearch) {
    // Hybrid scoring formula: 50% keyword, 50% semantic
    // We override sortBy explicitly if they search by hybrid
    query += ` ORDER BY (0.5 * (CASE WHEN (l.title ILIKE $2 OR l.description ILIKE $2) THEN 1.0 ELSE 0.0 END) + 0.5 * (1 - (l.embedding <=> $1))) DESC, l.id ASC`;
  } else {
    query += ` ORDER BY ${sqlSortBy} ${sqlOrder}, l.id ASC`;
  }

  const offset = (page - 1) * limit;
  values.push(limit, offset);
  query += ` LIMIT $${values.length - 1} OFFSET $${values.length};`;
  
  const result = await pool.query(query, values);
  
  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      is_hybrid: isHybridSearch
    }
  };
};

export const getListingById = async (id) => {
  const requestedId = parseInt(id);
  const result = await pool.query(
    `SELECT 
       l.id, l.title, l.description, l.price, l.condition, l.status, 
       l.seller_id, u.name AS seller_name, 
       l.category_id, c.name AS category_name, 
       l.created_at 
     FROM listings l
     LEFT JOIN users u ON l.seller_id = u.id
     LEFT JOIN categories c ON l.category_id = c.id
     WHERE l.id = $1;`,
    [requestedId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const createListing = async (listingData) => {
  const { title, description, price, condition, seller_id, category_id } = listingData;
  const result = await pool.query(
    `INSERT INTO listings (title, description, price, condition, seller_id, category_id) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, title, description, price, condition, seller_id, category_id, created_at;`,
    [title, description, price, condition, seller_id, category_id]
  );
  return result.rows[0];
};

export const updateListing = async (id, updateData, userId) => {
  const requestedId = parseInt(id);

  // First, verify ownership
  const checkResult = await pool.query('SELECT seller_id FROM listings WHERE id = $1', [requestedId]);
  if (checkResult.rows.length === 0) {
    throw new Error('Listing not found');
  }
  
  const listing = checkResult.rows[0];
  if (listing.seller_id !== userId) {
    throw new Error('You are not allowed to modify this listing');
  }

  // Remove seller_id from allowedFields so ownership cannot be transferred
  const allowedFields = ['title', 'description', 'price', 'condition', 'category_id'];
  
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      setClauses.push(`${field} = $${paramIndex}`);
      values.push(updateData[field]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    throw new Error("No valid fields to update");
  }

  values.push(requestedId);
  const query = `
    UPDATE listings 
    SET ${setClauses.join(', ')} 
    WHERE id = $${paramIndex} 
    RETURNING id, title, description, price, condition, seller_id, category_id, created_at;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

export const deleteListing = async (id, userId) => {
  const requestedId = parseInt(id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Acquire row lock to prevent race conditions with Buy
    const checkResult = await client.query('SELECT seller_id, status FROM listings WHERE id = $1 FOR UPDATE', [requestedId]);
    if (checkResult.rows.length === 0) {
      throw new AppError('Listing not found', 404);
    }

    const listing = checkResult.rows[0];
    
    if (String(listing.seller_id) !== String(userId)) {
      throw new AppError('You are not allowed to delete this listing', 403);
    }

    if (listing.status === 'sold') {
      throw new AppError('Sold listings cannot be deleted', 400);
    }

    const result = await client.query(
      'DELETE FROM listings WHERE id = $1 AND seller_id = $2 RETURNING id;',
      [requestedId, listing.seller_id]
    );
    
    await client.query('COMMIT');
    return result.rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
