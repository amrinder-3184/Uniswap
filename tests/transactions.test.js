import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';
import { countRows } from './helpers/db.js';

const app = createApp();

describe('transactions', () => {
  let seller;
  let buyer;
  let listing;

  beforeEach(async () => {
    seller = await createUser(app, { name: 'Seller' });
    buyer = await createUser(app, { name: 'Buyer' });
    const category = await createCategory();
    listing = await createListing(app, seller.token, category.id, { title: 'Mini fridge', price: 3500 });
  });

  const buy = (token, listingId) => request(app).post(`/listings/${listingId}/buy`).set(authHeader(token));

  test('buying records the transaction at the listing price and marks the listing sold', async () => {
    const res = await buy(buyer.token, listing.id);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      listing_id: listing.id,
      buyer_id: buyer.id,
      seller_id: seller.id,
      purchase_price: '3500.00',
      created_at: expect.any(String),
    });

    const after = await request(app).get(`/listings/${listing.id}`);
    expect(after.body.status).toBe('sold');
  });

  test('the same listing cannot be bought twice', async () => {
    await buy(buyer.token, listing.id);
    const secondBuyer = await createUser(app);
    const res = await buy(secondBuyer.token, listing.id);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Listing already sold' });
    expect(await countRows('transactions')).toBe(1);
  });

  test('concurrent purchases of one listing: exactly one succeeds (row lock)', async () => {
    const buyers = await Promise.all([createUser(app), createUser(app), createUser(app), createUser(app)]);
    const responses = await Promise.all(buyers.map((b) => buy(b.token, listing.id)));

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 400, 400, 400]);
    expect(await countRows('transactions')).toBe(1);
  });

  test('a seller cannot buy their own listing', async () => {
    const res = await buy(seller.token, listing.id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'You cannot buy your own listing' });
  });

  test('buying a listing that does not exist returns 404', async () => {
    expect((await buy(buyer.token, 999999)).status).toBe(404);
  });

  test('malformed listing id returns 400', async () => {
    expect((await buy(buyer.token, 'abc')).status).toBe(400);
  });

  test('purchases and sales are listed for the right users only', async () => {
    await buy(buyer.token, listing.id);

    const purchases = await request(app).get('/transactions/purchases').set(authHeader(buyer.token));
    const sales = await request(app).get('/transactions/sales').set(authHeader(seller.token));
    const sellerPurchases = await request(app).get('/transactions/purchases').set(authHeader(seller.token));

    expect(purchases.body.data).toEqual([expect.objectContaining({ listing_id: listing.id, listing_title: 'Mini fridge', seller_name: 'Seller' })]);
    expect(sales.body.data).toEqual([expect.objectContaining({ listing_id: listing.id, buyer_name: 'Buyer' })]);
    expect(sellerPurchases.body.data).toEqual([]);
  });

  test('all transaction routes require authentication', async () => {
    expect((await request(app).post(`/listings/${listing.id}/buy`)).status).toBe(401);
    expect((await request(app).get('/transactions/purchases')).status).toBe(401);
    expect((await request(app).get('/transactions/sales')).status).toBe(401);
  });
});
