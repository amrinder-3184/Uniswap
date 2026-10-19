import pool from '../../db.js';
import { AppError } from '../utils/AppError.js';

export const getSimilarListings = async (listingId) => {
  const targetId = parseInt(listingId, 10);
  
  // 1. Fetch Target Listing
  const targetRes = await pool.query(
    'SELECT id, title, price, condition, category_id, seller_id FROM listings WHERE id = $1',
    [targetId]
  );
  
  if (targetRes.rows.length === 0) {
    throw new AppError('Listing not found', 404);
  }
  
  const target = targetRes.rows[0];

  // 2. Extract significant words for text overlap
  // Split by non-alphanumeric, keep words length >= 4 to avoid too many stop words
  const words = (target.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  // If no words >= 4, fallback to >= 3
  let targetWords = words.length > 0 ? words : (target.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  // Remove duplicates
  targetWords = [...new Set(targetWords)];

  // 3. PostgreSQL Query for Candidates
  const query = `
    SELECT 
      c.id, 
      c.title, 
      c.description, 
      c.price, 
      c.condition, 
      c.category_id, 
      cat.name as category_name, 
      c.created_at,
      (
        CASE WHEN c.category_id = $2 THEN 40 ELSE 0 END +
        CASE WHEN c.price >= $3::numeric * 0.7 AND c.price <= $3::numeric * 1.3 THEN 30 ELSE 0 END +
        CASE WHEN c.condition = $4 THEN 20 ELSE 0 END +
        CASE WHEN (
          SELECT count(*) > 0 
          FROM unnest($5::text[]) as w 
          WHERE lower(c.title || ' ' || coalesce(c.description, '')) LIKE '%' || w || '%'
        ) THEN 10 ELSE 0 END
      ) as score
    FROM listings c
    JOIN categories cat ON c.category_id = cat.id
    WHERE c.status = 'available'
      AND c.id != $1
      AND c.seller_id != $6
    ORDER BY score DESC, c.id DESC
    LIMIT 10
  `;

  const values = [
    target.id,
    target.category_id,
    target.price,
    target.condition,
    targetWords,
    target.seller_id
  ];

  const result = await pool.query(query, values);
  const candidates = result.rows;

  // 4. Generate Reason and Map response
  const finalListings = candidates.map(c => {
    let reason = [];
    const isSameCat = c.category_id === target.category_id;
    const isSimPrice = parseFloat(c.price) >= parseFloat(target.price) * 0.7 && parseFloat(c.price) <= parseFloat(target.price) * 1.3;
    const isSameCond = c.condition === target.condition;

    if (isSameCat && isSimPrice) {
      reason.push("Same category and similar price");
    } else if (isSameCat && isSameCond) {
      reason.push("Same category and condition");
    } else if (isSameCat) {
      reason.push("Same category");
    } else if (isSimPrice && isSameCond) {
      reason.push("Similar price and condition");
    } else if (isSimPrice) {
      reason.push("Similar price");
    } else if (isSameCond) {
      reason.push("Same condition");
    } else {
      reason.push("Similar listing");
    }

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      price: c.price,
      condition: c.condition,
      category_id: c.category_id,
      category_name: c.category_name,
      score: parseInt(c.score, 10),
      reason: reason[0]
    };
  });

  return finalListings;
};
