import pool from './db.js';
import express from 'express';
import listingRoutes from './src/routes/listing.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import categoryRoutes from './src/routes/category.routes.js';
import userRoutes from './src/routes/user.routes.js';
import aiRoutes from './src/routes/ai.routes.js';
import recommendationRoutes from './src/routes/recommendation.routes.js';
import { errorHandler } from './src/middleware/error.middleware.js';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/listings', listingRoutes);
app.use('/users', userRoutes);
app.use('/ai', aiRoutes);
app.use('/recommendations', recommendationRoutes);
app.use(errorHandler);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;
  
  try {
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM favorites');
    await pool.query('DELETE FROM listings');
    await pool.query('DELETE FROM categories');
    await pool.query('DELETE FROM users');
    
    // Create users
    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Seller', email: 'seller@test.com', password: 'password' }) });
    const sellerToken = (await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'seller@test.com', password: 'password' }) }).then(r => r.json())).token;
    
    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Buyer1', email: 'buyer1@test.com', password: 'password' }) });
    const buyer1Token = (await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'buyer1@test.com', password: 'password' }) }).then(r => r.json())).token;

    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'NewUser', email: 'new@test.com', password: 'password' }) });
    const newUserToken = (await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'new@test.com', password: 'password' }) }).then(r => r.json())).token;

    const cat1 = await fetch(baseUrl + '/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Electronics' }) }).then(r => r.json());
    
    // Set up listings
    const l1 = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Phone', 'desc', 1000, 'Used', (SELECT id FROM users WHERE email='seller@test.com'), $1, 'available') RETURNING id`, [cat1.id]).then(r => r.rows[0].id);
    const l2 = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Sold Phone', 'desc', 1000, 'Used', (SELECT id FROM users WHERE email='seller@test.com'), $1, 'sold') RETURNING id`, [cat1.id]).then(r => r.rows[0].id);
    const l3 = await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('My Laptop', 'desc', 1200, 'Used', (SELECT id FROM users WHERE email='buyer1@test.com'), $1, 'available') RETURNING id`, [cat1.id]).then(r => r.rows[0].id);
    
    for (let i = 0; i < 15; i++) {
        await pool.query(`INSERT INTO listings (title, description, price, condition, seller_id, category_id, status) VALUES ('Filler ${i}', 'desc', 100, 'Used', (SELECT id FROM users WHERE email='seller@test.com'), $1, 'available')`, [cat1.id]);
    }

    // Set up history
    await pool.query(`INSERT INTO favorites (user_id, listing_id) VALUES ((SELECT id FROM users WHERE email='buyer1@test.com'), $1)`, [l1]);

    const getRecs = async (token, query = '') => {
      const res = await fetch(baseUrl + '/recommendations' + query, {
        method: 'GET',
        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
      });
      return { status: res.status, body: await res.json() };
    };

    console.log('--- A. Authenticated user receives recommendations ---');
    let res = await getRecs(buyer1Token);
    console.log('Status A:', res.status, 'Is Data Array?', Array.isArray(res.body.data));

    console.log('--- B. Unauthenticated request returns 401 ---');
    res = await getRecs(null);
    console.log('Status B:', res.status);

    console.log('--- C. User cannot spoof another user through query/body parameters ---');
    res = await getRecs(buyer1Token, '?userId=999');
    console.log('Status C:', res.status, 'Body returned data?', !!res.body.data);

    console.log('--- D. New user receives the fallback recommendations ---');
    res = await getRecs(newUserToken);
    console.log('Status D:', res.status, 'Has Fallback Reason?', res.body.data[0]?.reason === 'Newest arrivals on UniSwap');

    console.log('--- E. Sold listings never appear ---');
    res = await getRecs(buyer1Token);
    const hasSold = res.body.data.some(l => l.id === l2);
    console.log('Contains sold?', hasSold);

    console.log('--- F. User\'s own listings never appear ---');
    const hasOwn = res.body.data.some(l => l.id === l3);
    console.log('Contains own?', hasOwn);

    console.log('--- G. Already-favorited listings never appear ---');
    const hasFavorited = res.body.data.some(l => l.id === l1);
    console.log('Contains favorited?', hasFavorited);

    console.log('--- H. Maximum 10 recommendations is preserved ---');
    console.log('Length:', res.body.data.length <= 10);

    console.log('--- I. Response has the expected { data: [...] } structure ---');
    console.log('Has data?', 'data' in res.body);

    console.log('--- J. Sensitive fields are not returned ---');
    const hasSensitive = res.body.data.some(r => 'password_hash' in r || 'email' in r || 'seller_id' in r);
    console.log('Has sensitive?', hasSensitive);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
    server.close();
  }
});
