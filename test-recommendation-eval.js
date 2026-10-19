import pool from './db.js';
import { getRecommendationsV1, getRecommendationsV2 } from './src/services/recommendation.service.js';

// Precision@K = (relevant in top K) / K
// Recall@K = (relevant in top K) / total relevant
// HitRate@K = 1 if (relevant in top K) > 0 else 0

const runEvaluation = async () => {
  console.log('--- Setting up Deterministic Synthetic Dataset ---');
  
  // 1. Create categories
  const catNames = ['Laptops', 'Phones', 'Books', 'Furniture'];
  const catIds = {};
  for (const name of catNames) {
    const res = await pool.query(`INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [name]);
    catIds[name] = res.rows[0].id;
  }

  // 2. Create users
  const sellerId = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('Seller', 'seller_rec@test.com', 'hash') ON CONFLICT DO NOTHING RETURNING id`).then(r => r.rows[0]?.id || pool.query(`SELECT id FROM users WHERE email='seller_rec@test.com'`).then(res => res.rows[0].id));
  const userId = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('Buyer', 'buyer_rec@test.com', 'hash') ON CONFLICT DO NOTHING RETURNING id`).then(r => r.rows[0]?.id || pool.query(`SELECT id FROM users WHERE email='buyer_rec@test.com'`).then(res => res.rows[0].id));
  const coldUserId = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('ColdUser', 'cold_rec@test.com', 'hash') ON CONFLICT DO NOTHING RETURNING id`).then(r => r.rows[0]?.id || pool.query(`SELECT id FROM users WHERE email='cold_rec@test.com'`).then(res => res.rows[0].id));

  // Clear existing interactions and listings to maintain deterministic scoring for these users
  await pool.query(`DELETE FROM favorites WHERE user_id IN ($1, $2)`, [userId, coldUserId]);
  await pool.query(`DELETE FROM transactions WHERE buyer_id IN ($1, $2)`, [userId, coldUserId]);

  // 3. Create listings
  // We want to create a distribution
  const listings = [];
  const addListing = async (title, cat, price, condition, status = 'available', ageDays = 1, owner = sellerId) => {
    const date = new Date();
    date.setDate(date.getDate() - ageDays);
    const res = await pool.query(
      `INSERT INTO listings (title, description, price, condition, seller_id, category_id, status, created_at) VALUES ($1, 'Desc', $2, $3, $4, $5, $6, $7) RETURNING id`,
      [title, price, condition, owner, catIds[cat], status, date]
    );
    listings.push({ id: res.rows[0].id, title, cat, price, condition, status, owner, ageDays });
    return res.rows[0].id;
  };

  // User 1 interactions (Training Data)
  // Highly prefers Laptops (around $1000) and Used condition
  const hist1 = await addListing('Hist Mac 1', 'Laptops', 1000, 'Used');
  const hist2 = await addListing('Hist Mac 2', 'Laptops', 1100, 'Used');
  const hist3 = await addListing('Hist Book 1', 'Books', 20, 'New');
  
  await pool.query(`INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)`, [userId, hist1]);
  await pool.query(`INSERT INTO transactions (listing_id, buyer_id, purchase_price) VALUES ($1, $2, 1100)`, [hist2, userId]);
  await pool.query(`INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)`, [userId, hist3]);

  // Candidate generation (Test Data / Ground Truth mappings)
  // We expect Laptops around $1000 Used to rank highest.
  const cand1_Relevant = await addListing('Cand Mac 1 (Relevant)', 'Laptops', 1050, 'Used'); // Perfect match
  const cand2_Relevant = await addListing('Cand PC 1 (Relevant)', 'Laptops', 950, 'Used', 'available', 0); // Perfect match + fresh
  const cand3_IrrelevantCat = await addListing('Cand Phone (Irrelevant)', 'Phones', 1000, 'Used'); 
  const cand4_IrrelevantPrice = await addListing('Cand Cheap Laptop', 'Laptops', 100, 'Used');
  const cand5_IrrelevantCond = await addListing('Cand Mac New', 'Laptops', 1050, 'New');
  
  // Exclusions tests
  const cand6_Sold = await addListing('Cand Sold', 'Laptops', 1000, 'Used', 'sold');
  const cand7_Own = await addListing('Cand Own', 'Laptops', 1000, 'Used', 'available', 1, userId);
  
  // A fresh irrelevant item to test cold start
  const cand8_Fresh = await addListing('Cand Fresh Phone', 'Phones', 500, 'New', 'available', 0);

  // Ground truth for User 1 (The relevant items we hope to see in top K)
  const truePositives_User1 = [cand1_Relevant, cand2_Relevant];

  // Evaluate Function
  const evaluate = async (recommenderFn, name) => {
    console.log(`\nEvaluating ${name}...`);
    
    // User 1 (Warm Start)
    const recs1 = await recommenderFn(userId);
    const recIds1 = recs1.map(r => r.id);
    
    // Exclusions Check
    const hasSold = recIds1.includes(cand6_Sold);
    const hasOwn = recIds1.includes(cand7_Own);
    const hasFavorited = recIds1.includes(hist1);
    
    console.log(`- Sold Excluded: ${!hasSold}`);
    console.log(`- Own Excluded: ${!hasOwn}`);
    console.log(`- Favorited Excluded: ${!hasFavorited}`);

    // Metrics (K=5)
    const K = 5;
    const topK = recIds1.slice(0, K);
    
    let tpCount = 0;
    for (const tp of truePositives_User1) {
      if (topK.includes(tp)) tpCount++;
    }

    const precision = tpCount / K;
    const recall = tpCount / truePositives_User1.length;
    const hitRate = tpCount > 0 ? 1 : 0;

    console.log(`- Precision@${K}: ${precision}`);
    console.log(`- Recall@${K}: ${recall}`);
    console.log(`- HitRate@${K}: ${hitRate}`);
    
    // Output top items for visual inspection
    console.log('- Top 3 Recommendations:');
    recs1.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.title} | Score: ${r.score} | Reason: ${r.reason}`);
    });

    // Cold Start User
    const recsCold = await recommenderFn(coldUserId);
    console.log(`- Cold Start (No History) Generated: ${recsCold.length > 0}`);
    if (recsCold.length > 0) {
      console.log(`  Top cold start item: ${recsCold[0].title} | Reason: ${recsCold[0].reason}`);
    }
    
    return { precision, recall, hitRate };
  };

  const v1Stats = await evaluate(getRecommendationsV1, "Baseline V1");
  const v2Stats = await evaluate(getRecommendationsV2, "Recommender V2");

  console.log("\n==================================================");
  console.log("10. V1 VS V2 COMPARISON");
  console.log("==================================================");
  console.log(`Metric        V1       V2`);
  console.log(`Precision@5   ${v1Stats.precision.toFixed(2)}     ${v2Stats.precision.toFixed(2)}`);
  console.log(`Recall@5      ${v1Stats.recall.toFixed(2)}     ${v2Stats.recall.toFixed(2)}`);
  console.log(`HitRate@5     ${v1Stats.hitRate.toFixed(2)}     ${v2Stats.hitRate.toFixed(2)}`);
  
  if (v2Stats.recall >= v1Stats.recall && v2Stats.precision >= v1Stats.precision) {
    console.log("\n✅ V2 performs equal to or better than V1 on all metrics.");
  } else {
    console.log("\n⚠️ V2 performs worse on some metrics. This may happen if V2 weights spread scores differently.");
  }

  // Cleanup
  for (const l of listings) {
    await pool.query('DELETE FROM listings WHERE id = $1', [l.id]);
  }
  pool.end();
};

runEvaluation().catch(console.error);
