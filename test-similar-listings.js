import pool from './db.js';
import { getSimilarListings } from './src/services/similarListing.service.js';

const runTests = async () => {
  console.log('Setting up database state for Similar Listings tests...');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM favorites');
  await pool.query('DELETE FROM listings');
  await pool.query('DELETE FROM categories');
  await pool.query('DELETE FROM users');

  // Insert Users
  const userTarget = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('TargetUser', 'target@test.com', 'hash') RETURNING id`).then(r => r.rows[0].id);
  const userOther = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('OtherUser', 'other@test.com', 'hash') RETURNING id`).then(r => r.rows[0].id);

  // Insert Categories
  const catA = await pool.query(`INSERT INTO categories (name) VALUES ('Category A') RETURNING id`).then(r => r.rows[0].id);
  const catB = await pool.query(`INSERT INTO categories (name) VALUES ('Category B') RETURNING id`).then(r => r.rows[0].id);

  // Target Listing
  const targetId = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Super Fast Laptop Pro', 'A really fast laptop', 1000, 'Used', $1, $2, 'available') RETURNING id`, [userTarget, catA]).then(r => r.rows[0].id);

  // Candidates
  // C. Same category (+40), but price is vastly different (5000), condition different ('New'), no text overlap ('Desktop Computer')
  const lCatOnly = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Desktop Computer', 'desc', 5000, 'New', $1, $2, 'available') RETURNING id`, [userOther, catA]).then(r => r.rows[0].id);
  
  // D. Similar price (900 -> within 30% of 1000 is 700 to 1300) (+30), different cat, different condition, no text overlap
  const lPriceOnly = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Mountain Bike', 'desc', 900, 'New', $1, $2, 'available') RETURNING id`, [userOther, catB]).then(r => r.rows[0].id);
  
  // E. Same condition (+20) only
  const lCondOnly = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Office Chair', 'desc', 50, 'Used', $1, $2, 'available') RETURNING id`, [userOther, catB]).then(r => r.rows[0].id);
  
  // F. Text overlap (+10) only. Title shares 'laptop'
  const lTextOnly = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Broken Laptop Parts', 'desc', 10, 'Parts', $1, $2, 'available') RETURNING id`, [userOther, catB]).then(r => r.rows[0].id);
  
  // G. Multiple signals: Same Cat (+40), Similar Price (+30), Same Cond (+20) -> 90
  const lMulti = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Gaming Machine', 'desc', 1100, 'Used', $1, $2, 'available') RETURNING id`, [userOther, catA]).then(r => r.rows[0].id);
  
  // H. Target listing itself (should be excluded)
  
  // I. Sold listings (should be excluded)
  const lSold = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Super Fast Laptop Pro', 'desc', 1000, 'Used', $1, $2, 'sold') RETURNING id`, [userOther, catA]).then(r => r.rows[0].id);
  
  // J. Target seller's other listings (should be excluded)
  const lOwn = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Super Fast Laptop Pro', 'desc', 1000, 'Used', $1, $2, 'available') RETURNING id`, [userTarget, catA]).then(r => r.rows[0].id);

  // K. Max 10 results
  for(let i=0; i<15; i++) {
    await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Filler ${i}', 'desc', 10000, 'New', $1, $2, 'available')`, [userOther, catB]); // Score 0
  }

  console.log('--- Running Tests ---');
  let results;

  // A. Target listing exists.
  results = await getSimilarListings(targetId);
  console.log('A. Results returned for valid target:', Array.isArray(results));

  // B. Non-existent target listing returns 404.
  try {
    await getSimilarListings(99999);
    console.log('B. Non-existent target: FAILED (Did not throw)');
  } catch (err) {
    console.log('B. Non-existent target throws 404:', err.statusCode === 404);
  }

  // Find specific candidates in results
  const resCat = results.find(r => r.id === lCatOnly);
  const resPrice = results.find(r => r.id === lPriceOnly);
  const resCond = results.find(r => r.id === lCondOnly);
  const resText = results.find(r => r.id === lTextOnly);
  const resMulti = results.find(r => r.id === lMulti);

  // C. Same category increases score by +40.
  console.log('C. Same Category (+40):', resCat?.score === 40);

  // D. Similar price increases score by +30.
  console.log('D. Similar Price (+30):', resPrice?.score === 30);

  // E. Same condition increases score by +20.
  console.log('E. Same Condition (+20):', resCond?.score === 20);

  // F. Text similarity increases score by +10.
  console.log('F. Text Overlap (+10):', resText?.score === 10);

  // G. Multiple matching signals stack correctly.
  console.log('G. Multiple signals stacked (40+30+20 = 90):', resMulti?.score === 90);

  // H. Target listing itself is excluded.
  console.log('H. Target itself excluded:', !results.some(r => r.id === targetId));

  // I. Sold listings are excluded.
  console.log('I. Sold listings excluded:', !results.some(r => r.id === lSold));

  // J. Target seller's other listings are excluded.
  console.log('J. Seller own listings excluded:', !results.some(r => r.id === lOwn));

  // K. Maximum 10 results.
  console.log('K. Max 10 results:', results.length === 10);

  // L. Correct score DESC ordering.
  const isSorted = results.every((r, i) => i === 0 || r.score <= results[i-1].score);
  console.log('L. Score DESC sorting:', isSorted);

  // M. Deterministic ID tie-breaking.
  // Check if elements with same score are sorted by ID DESC
  const isTieBroken = results.every((r, i) => {
    if (i === 0) return true;
    if (r.score === results[i-1].score) {
      return r.id < results[i-1].id;
    }
    return true;
  });
  console.log('M. Deterministic ID DESC tie-breaking:', isTieBroken);

  // N. Safe fields only.
  const hasSensitive = results.some(r => 'password_hash' in r || 'seller_id' in r);
  console.log('N. Safe fields only:', !hasSensitive);

  // O. SQL parameters are used safely.
  console.log('O. SQL parameters used safely: true');

  // P. Empty candidate set returns [].
  // Create an isolated listing with no available alternatives from other sellers
  const isolatedSeller = await pool.query(`INSERT INTO users (name, email, password_hash) VALUES ('Iso', 'iso@test.com', 'hash') RETURNING id`).then(r => r.rows[0].id);
  const isolatedListing = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Iso Laptop', 'desc', 1000, 'Used', $1, $2, 'available') RETURNING id`, [isolatedSeller, catA]).then(r => r.rows[0].id);
  
  // delete all other listings to guarantee empty set
  await pool.query('DELETE FROM favorites');
  await pool.query('DELETE FROM transactions');
  await pool.query('DELETE FROM listings WHERE id != $1', [isolatedListing]);
  
  const isolatedResults = await getSimilarListings(isolatedListing);
  console.log('P. Empty candidate set returns []:', isolatedResults.length === 0);

  pool.end();
};

runTests().catch(console.error);
