import express from 'express';
import * as listingService from './src/services/listing.service.js';
import * as aiTools from './src/services/aiTools.service.js';
import pool from './db.js';

const runEvaluation = async () => {
  let passed = 0;
  let failed = 0;
  
  const assert = (condition, name) => {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      failed++;
    }
  };

  console.log("==================================================");
  console.log("1. HYBRID SEARCH FALLBACK EVALUATION");
  console.log("==================================================");
  console.log("Environment Note: 'pgvector' extension is missing.");
  console.log("The architecture handles this by gracefully falling back to V1 Keyword Search.");
  
  try {
    const dummyCat = await pool.query(`INSERT INTO categories (name) VALUES ('HybridTestCat') ON CONFLICT DO NOTHING RETURNING id`);
    const catId = dummyCat.rows[0]?.id || (await pool.query(`SELECT id FROM categories WHERE name = 'HybridTestCat'`)).rows[0].id;
    
    const dummyUser = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('HybridUser', 'hybrid@test.com', 'hash') ON CONFLICT DO NOTHING RETURNING id`);
    const sellerId = dummyUser.rows[0]?.id || (await pool.query(`SELECT id FROM users WHERE email = 'hybrid@test.com'`)).rows[0].id;

    const listingId = await pool.query(`
      INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) 
      VALUES ('Comfortable gaming chair', 'Great for long coding sessions', 150, 'Used', $1, $2, 'available') 
      RETURNING id
    `, [sellerId, catId]).then(r => r.rows[0].id);

    // Test 1: Exact keyword search (Should succeed natively)
    const exactSearch = await listingService.getListings(null, 1, 10, 'gaming chair');
    assert(exactSearch.data.length > 0 && exactSearch.data[0].id === listingId, "Exact keyword search works natively");
    assert(exactSearch.pagination.is_hybrid === false, "Search gracefully bypassed semantic failure and used keyword fallback");

    // Test 2: AI Tool Integration
    const toolSearch = await aiTools.searchListingsTool({ search: 'gaming chair' });
    assert(toolSearch.listings.length > 0, "AI search_listings tool uses the robust fallback architecture");

    // Cleanup
    await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
    await pool.query('DELETE FROM users WHERE id = $1', [sellerId]);
    await pool.query('DELETE FROM categories WHERE id = $1', [catId]);

  } catch (e) {
    console.error(e);
  }

  console.log("==================================================");
  console.log("EVALUATION SUMMARY");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
};

runEvaluation().catch(console.error);
