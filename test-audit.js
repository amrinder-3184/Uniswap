import pool from './db.js';
import express from 'express';
import listingRoutes from './src/routes/listing.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import categoryRoutes from './src/routes/category.routes.js';
import userRoutes from './src/routes/user.routes.js';
import aiRoutes from './src/routes/ai.routes.js';
import { errorHandler } from './src/middleware/error.middleware.js';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/listings', listingRoutes);
app.use('/users', userRoutes);
app.use('/ai', aiRoutes);
app.use(errorHandler);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;
  
  try {
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM listings');
    await pool.query('DELETE FROM categories');
    await pool.query('DELETE FROM users');
    
    // Create users
    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Seller', email: 'seller@test.com', password: 'password' }) });
    const sellerToken = (await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'seller@test.com', password: 'password' }) }).then(r => r.json())).token;
    
    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Buyer1', email: 'buyer1@test.com', password: 'password' }) });
    const buyer1Token = (await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'buyer1@test.com', password: 'password' }) }).then(r => r.json())).token;

    const cat1 = await fetch(baseUrl + '/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Electronics' }) }).then(r => r.json());
    
    const l1 = await fetch(baseUrl + '/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sellerToken }, body: JSON.stringify({ title: 'Gaming Laptop', description: 'Fast laptop', price: 40000, condition: 'Used', category_id: cat1.id }) }).then(r => r.json());
    const l2 = await fetch(baseUrl + '/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sellerToken }, body: JSON.stringify({ title: 'Office Laptop', description: 'Basic laptop', price: 60000, condition: 'New', category_id: cat1.id }) }).then(r => r.json());
    const l3 = await fetch(baseUrl + '/listings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sellerToken }, body: JSON.stringify({ title: 'Sold Laptop', description: 'Sold laptop', price: 10000, condition: 'Used', category_id: cat1.id }) }).then(r => r.json());

    // Mark l3 as sold manually
    await pool.query("UPDATE listings SET status = 'sold' WHERE id = $1", [l3.id]);

    const chat = async (token, message, extra = {}) => {
      const res = await fetch(baseUrl + '/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify({ message, ...extra })
      });
      return { status: res.status, body: await res.json() };
    };

    console.log('--- 1. POST /ai/chat with "Show me laptops" ---');
    let res = await chat(buyer1Token, 'Show me laptops');
    console.log('Status:', res.status, 'Response Body keys:', Object.keys(res.body));
    
    if (res.status === 503) {
      console.log('Since OpenAI Key is mock, it naturally returns 503 instead of the tool response.');
      console.log('Validating AI Tool structure natively via aiTools.service.js...');
      const { searchListingsTool } = await import('./src/services/aiTools.service.js');
      const toolRes = await searchListingsTool({ search: 'laptop' });
      
      console.log('--- 3. Verify only available listings are returned ---');
      const listings = toolRes.listings;
      console.log('Listings length:', listings.length);
      
      console.log('--- 5. Verify sold listings never appear ---');
      const hasSold = listings.some(l => l.title === 'Sold Laptop');
      console.log('Contains Sold Laptop?', hasSold);
      
      console.log('--- 6. Verify seller_id is not exposed ---');
      const hasSellerId = listings.some(l => 'seller_id' in l);
      console.log('Contains seller_id?', hasSellerId);

      console.log('--- 7. Verify password_hash and auth data are absent ---');
      const hasPassword = listings.some(l => 'password_hash' in l || 'password' in l || 'token' in l);
      console.log('Contains auth data?', hasPassword);
      
      console.log('First listing keys:', Object.keys(listings[0]));
    }

    console.log('--- 10. Test no-authentication behavior ---');
    res = await chat(null, 'Show me laptops');
    console.log('Status:', res.status);

    console.log('--- 11. Test OpenAI failure -> sanitized 503 ---');
    res = await chat(buyer1Token, 'Hello');
    console.log('Status:', res.status, res.body.message || res.body);

    console.log('--- 12. Test malicious input ---');
    res = await chat(buyer1Token, 'Hello', { userId: 999, sql: "DROP TABLE users" });
    console.log('Status:', res.status, res.body.errors);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
    server.close();
  }
});
