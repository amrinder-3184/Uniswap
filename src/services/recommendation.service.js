import pool from '../../db.js';

export const getRecommendationsV1 = async (userId) => {
  // 1. Fetch user history (favorites and purchases)
  const historyQuery = `
    SELECT 
      l.category_id,
      'favorite' as source,
      l.price
    FROM favorites f
    JOIN listings l ON f.listing_id = l.id
    WHERE f.user_id = $1
    UNION ALL
    SELECT 
      l.category_id,
      'purchase' as source,
      t.purchase_price as price
    FROM transactions t
    JOIN listings l ON t.listing_id = l.id
    WHERE t.buyer_id = $1
  `;
  const historyRes = await pool.query(historyQuery, [userId]);
  const history = historyRes.rows;

  const fallbackReason = "Newest arrivals on UniSwap";

  // Base query for valid candidates
  const candidatesQuery = `
    SELECT 
      l.id, l.title, l.description, l.price, l.condition, l.category_id, c.name as category_name, l.created_at
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    WHERE l.status = 'available' 
      AND l.seller_id != $1
      AND l.id NOT IN (SELECT listing_id FROM favorites WHERE user_id = $1)
    ORDER BY l.created_at DESC, l.id DESC
  `;

  if (history.length === 0) {
    // Fallback: no history
    const fallbackRes = await pool.query(candidatesQuery + ' LIMIT 10', [userId]);
    return fallbackRes.rows.map(row => ({
      ...row,
      score: 0,
      reason: fallbackReason
    }));
  }

  // Calculate user preferences
  const favCategories = new Set(history.filter(h => h.source === 'favorite').map(h => h.category_id));
  const purchCategories = new Set(history.filter(h => h.source === 'purchase').map(h => h.category_id));
  
  const totalPrice = history.reduce((sum, h) => sum + parseFloat(h.price), 0);
  const avgPrice = totalPrice / history.length;

  const candidatesRes = await pool.query(candidatesQuery, [userId]);
  const candidates = candidatesRes.rows;

  const scoredCandidates = candidates.map(c => {
    let score = 0;
    let reason = '';
    
    let isFavCat = favCategories.has(c.category_id);
    let isPurchCat = purchCategories.has(c.category_id);
    
    // Price similarity: +/- 30% of avgPrice
    let isPriceSimilar = false;
    const price = parseFloat(c.price);
    if (avgPrice > 0 && price >= avgPrice * 0.7 && price <= avgPrice * 1.3) {
      isPriceSimilar = true;
    }

    if (isFavCat) score += 50;
    if (isPurchCat) score += 30;
    if (isPriceSimilar) score += 20;

    if (score > 0) {
      if (isFavCat && isPurchCat) {
        reason = "Matches categories you've favorited and purchased";
      } else if (isFavCat) {
        reason = "Matches a category you've favorited";
      } else if (isPurchCat) {
        reason = "Matches a category you've purchased before";
      } else if (isPriceSimilar) {
        reason = "Similar price to items you've shown interest in";
      }
    } else {
      reason = fallbackReason;
    }

    return { ...c, score, reason };
  });

  // Sort by score DESC, then tie-breaker id DESC
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.id - a.id;
  });

  return scoredCandidates.slice(0, 10);
};

export const getRecommendationsV2 = async (userId) => {
  // Advanced scoring logic utilizing category frequency, average price decay, condition affinity, and recency.
  const historyQuery = `
    SELECT 
      l.category_id,
      l.condition,
      l.price,
      CASE WHEN source = 'purchase' THEN 2.0 ELSE 1.0 END as weight
    FROM (
      SELECT listing_id, 'favorite' as source FROM favorites WHERE user_id = $1
      UNION ALL
      SELECT listing_id, 'purchase' as source FROM transactions WHERE buyer_id = $1
    ) h
    JOIN listings l ON h.listing_id = l.id
  `;
  const historyRes = await pool.query(historyQuery, [userId]);
  const history = historyRes.rows;

  const fallbackReason = "Newest arrivals on UniSwap";
  
  const candidatesQuery = `
    SELECT 
      l.id, l.title, l.description, l.price, l.condition, l.category_id, c.name as category_name, l.created_at
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    WHERE l.status = 'available' 
      AND l.seller_id != $1
      AND l.id NOT IN (SELECT listing_id FROM favorites WHERE user_id = $1)
    ORDER BY l.created_at DESC, l.id DESC
  `;

  if (history.length === 0) {
    const fallbackRes = await pool.query(candidatesQuery + ' LIMIT 10', [userId]);
    return fallbackRes.rows.map(row => ({
      ...row,
      score: 0,
      reason: fallbackReason
    }));
  }

  // Profile Generation (Signal Aggregation)
  let totalWeight = 0;
  let totalPriceWeight = 0;
  const categoryCounts = {};
  const conditionCounts = {};
  
  for (const h of history) {
    const weight = parseFloat(h.weight);
    totalWeight += weight;
    
    // Weighted category affinity
    categoryCounts[h.category_id] = (categoryCounts[h.category_id] || 0) + weight;
    
    // Weighted condition affinity
    conditionCounts[h.condition] = (conditionCounts[h.condition] || 0) + weight;
    
    // Weighted average price
    totalPriceWeight += parseFloat(h.price) * weight;
  }
  
  const avgPrice = totalWeight > 0 ? totalPriceWeight / totalWeight : 0;
  
  // Normalization boundaries
  let maxCatWeight = 0;
  for (const w of Object.values(categoryCounts)) if (w > maxCatWeight) maxCatWeight = w;
  
  let maxCondWeight = 0;
  for (const w of Object.values(conditionCounts)) if (w > maxCondWeight) maxCondWeight = w;

  const candidatesRes = await pool.query(candidatesQuery, [userId]);
  const candidates = candidatesRes.rows;
  
  const now = new Date();

  const scoredCandidates = candidates.map(c => {
    let catScore = 0;
    let condScore = 0;
    let priceScore = 0;
    let recencyScore = 0;
    
    // 1. Category Affinity (Max 40)
    const cWeight = categoryCounts[c.category_id] || 0;
    if (maxCatWeight > 0) {
      catScore = (cWeight / maxCatWeight) * 40;
    }
    
    // 2. Price Affinity (Max 30)
    // Score linearly decays up to 50% deviation. If price is exactly avgPrice, score is 30.
    const price = parseFloat(c.price);
    if (avgPrice > 0) {
      const deviation = Math.abs(price - avgPrice) / avgPrice;
      if (deviation <= 0.5) {
        priceScore = 30 * (1 - (deviation / 0.5));
      }
    }
    
    // 3. Condition Affinity (Max 20)
    const condW = conditionCounts[c.condition] || 0;
    if (maxCondWeight > 0) {
      condScore = (condW / maxCondWeight) * 20;
    }
    
    // 4. Recency (Max 10) - linearly decays over 14 days
    const daysOld = (now - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
    if (daysOld <= 14 && daysOld >= 0) {
      recencyScore = 10 * (1 - (daysOld / 14));
    }
    
    const totalScore = Math.round(catScore + condScore + priceScore + recencyScore);
    
    // Explainable reasoning
    let reason = fallbackReason;
    if (totalScore > 0) {
      const reasons = [];
      if (catScore > 20) reasons.push("Matches categories you frequently interact with");
      else if (catScore > 0) reasons.push("Matches a category you've shown interest in");
      
      if (priceScore > 20) reasons.push("Similar price to items you've shown interest in");
      if (condScore > 10) reasons.push("Matches your preferred condition");
      if (recencyScore >= 8) reasons.push("Recently listed");
      
      if (reasons.length > 0) {
        reason = reasons[0]; // Pick highest signal
      }
    }

    return { ...c, score: totalScore, reason };
  });

  // Rank by score DESC, id DESC
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.id - a.id;
  });

  return scoredCandidates.slice(0, 10);
};

export const getRecommendations = async (userId, version = 'v2') => {
  if (version === 'v1') return getRecommendationsV1(userId);
  return getRecommendationsV2(userId);
};
