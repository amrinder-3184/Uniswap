import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, validListingBody, authHeader } from './helpers/fixtures.js';
import { countRows } from './helpers/db.js';

const app = createApp();

describe('listings', () => {
  let seller;
  let otherUser;
  let category;

  beforeEach(async () => {
    seller = await createUser(app, { name: 'Seller' });
    otherUser = await createUser(app, { name: 'Other' });
    category = await createCategory('Books');
  });

  describe('POST /listings', () => {
    test('creates a listing owned by the authenticated user', async () => {
      const res = await request(app)
        .post('/listings')
        .set(authHeader(seller.token))
        .send(validListingBody(category.id, { price: 199.99 }));

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        title: 'Engineering Mathematics textbook',
        description: 'Second-hand copy with a few notes in pencil',
        price: '199.99', // NUMERIC is returned as a string by pg
        condition: 'Used',
        seller_id: seller.id,
        category_id: category.id,
        created_at: expect.any(String),
      });
    });

    test('takes the owner from the token, never from the request body', async () => {
      const res = await request(app)
        .post('/listings')
        .set(authHeader(seller.token))
        .send(validListingBody(category.id, { seller_id: otherUser.id }));

      expect(res.status).toBe(201);
      expect(res.body.seller_id).toBe(seller.id);
    });

    test('requires authentication', async () => {
      const res = await request(app).post('/listings').send(validListingBody(category.id));
      expect(res.status).toBe(401);
      expect(await countRows('listings')).toBe(0);
    });

    test.each([
      ['missing title', { title: undefined }],
      ['blank title', { title: '   ' }],
      ['title over 255 characters', { title: 'x'.repeat(256) }],
      ['missing description', { description: undefined }],
      ['description over 5000 characters', { description: 'x'.repeat(5001) }],
      ['price as a string', { price: '450' }],
      ['zero price', { price: 0 }],
      ['negative price', { price: -5 }],
      ['price above NUMERIC(10,2) range', { price: 100000000 }],
      ['missing condition', { condition: undefined }],
      ['condition over 100 characters', { condition: 'x'.repeat(101) }],
      ['category_id as a string', { category_id: '1' }],
      ['category_id as a decimal', { category_id: 1.5 }],
      ['category_id beyond INTEGER range', { category_id: 2147483648 }],
    ])('rejects %s with 400', async (_label, override) => {
      const res = await request(app)
        .post('/listings')
        .set(authHeader(seller.token))
        .send(validListingBody(category.id, override));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Validation failed', errors: expect.any(Array) });
      expect(await countRows('listings')).toBe(0);
    });

    test('rejects a category that does not exist with 400 (not a 500 from the foreign key)', async () => {
      const res = await request(app)
        .post('/listings')
        .set(authHeader(seller.token))
        .send(validListingBody(category.id + 1000));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Category does not exist' });
    });

    test('stores SQL-injection-style text literally and leaves other tables intact', async () => {
      const malicious = "Book'); DROP TABLE users; --";
      const created = await createListing(app, seller.token, category.id, { title: malicious });

      const res = await request(app).get(`/listings/${created.id}`);
      expect(res.body.title).toBe(malicious);
      expect(await countRows('users')).toBe(2);
    });
  });

  describe('GET /listings/:id', () => {
    test('returns the listing with seller and category names', async () => {
      const created = await createListing(app, seller.token, category.id);
      const res = await request(app).get(`/listings/${created.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.id,
        status: 'available',
        seller_id: seller.id,
        seller_name: 'Seller',
        category_id: category.id,
        category_name: 'Books',
      });
    });

    test('returns 404 for a listing that does not exist', async () => {
      const res = await request(app).get('/listings/999999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Listing not found' });
    });

    test.each(['abc', '1.0', '1e2', '0', '-1', '99999999999', '12abc'])('rejects malformed id "%s" with 400', async (id) => {
      const res = await request(app).get(`/listings/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('GET /listings (pagination, filtering, sorting)', () => {
    let electronics;

    beforeEach(async () => {
      electronics = await createCategory('Electronics');
      await createListing(app, seller.token, category.id, { title: 'Physics notes', price: 100 });
      await createListing(app, seller.token, category.id, { title: 'Chemistry book', price: 300 });
      await createListing(app, seller.token, electronics.id, { title: 'Scientific calculator', price: 200 });
    });

    test('returns data with pagination metadata', async () => {
      const res = await request(app).get('/listings?limit=2&page=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toEqual({
        page: 1, limit: 2, total: 3, totalPages: 2, hasNextPage: true, is_hybrid: false,
      });
    });

    test('second page holds the remaining item', async () => {
      const res = await request(app).get('/listings?limit=2&page=2');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.hasNextPage).toBe(false);
    });

    test('filters by category', async () => {
      const res = await request(app).get(`/listings?category=${electronics.id}`);
      expect(res.body.data.map((l) => l.title)).toEqual(['Scientific calculator']);
    });

    test('searches title and description case-insensitively', async () => {
      const res = await request(app).get('/listings?search=CHEMISTRY');
      expect(res.body.data.map((l) => l.title)).toEqual(['Chemistry book']);
    });

    test('sorts by price ascending and descending', async () => {
      const asc = await request(app).get('/listings?sortBy=price&order=asc');
      const desc = await request(app).get('/listings?sortBy=price&order=desc');
      expect(asc.body.data.map((l) => Number(l.price))).toEqual([100, 200, 300]);
      expect(desc.body.data.map((l) => Number(l.price))).toEqual([300, 200, 100]);
    });

    test('treats SQL-injection-style search text as plain text', async () => {
      const res = await request(app).get('/listings').query({ search: "' OR 1=1; --" });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('does not include sold listings', async () => {
      const listing = await createListing(app, seller.token, category.id, { title: 'Sold item' });
      await request(app).post(`/listings/${listing.id}/buy`).set(authHeader(otherUser.token));

      const res = await request(app).get('/listings?search=Sold');
      expect(res.body.data).toEqual([]);
    });

    test.each([
      ['page=0', 'page=0'],
      ['page=abc', 'page=abc'],
      ['limit=0', 'limit=0'],
      ['limit=101', 'limit=101'],
      ['category=abc', 'category=abc'],
      ['sortBy=password_hash', 'sortBy=password_hash'],
      ['order=sideways', 'order=sideways'],
      ['repeated order', 'order=asc&order=desc'],
      ['repeated search', 'search=a&search=b'],
      ['empty search', 'search=%20'],
      ['search over 200 characters', `search=${'a'.repeat(201)}`],
    ])('rejects invalid query %s with 400', async (_label, query) => {
      const res = await request(app).get(`/listings?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('PATCH /listings/:id', () => {
    let listing;

    beforeEach(async () => {
      listing = await createListing(app, seller.token, category.id);
    });

    test('lets the owner update selected fields', async () => {
      const res = await request(app)
        .patch(`/listings/${listing.id}`)
        .set(authHeader(seller.token))
        .send({ title: 'Updated title', price: 99.5 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: listing.id, title: 'Updated title', price: '99.50', condition: 'Used' });
    });

    test('forbids another user from editing the listing', async () => {
      const res = await request(app)
        .patch(`/listings/${listing.id}`)
        .set(authHeader(otherUser.token))
        .send({ price: 1 });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'You are not allowed to modify this listing' });
      const unchanged = await request(app).get(`/listings/${listing.id}`);
      expect(unchanged.body.price).toBe('450.00');
    });

    test('refuses to change the owner (seller_id)', async () => {
      const res = await request(app)
        .patch(`/listings/${listing.id}`)
        .set(authHeader(seller.token))
        .send({ seller_id: otherUser.id });
      expect(res.status).toBe(400);
    });

    test('rejects an empty update', async () => {
      const res = await request(app).patch(`/listings/${listing.id}`).set(authHeader(seller.token)).send({});
      expect(res.status).toBe(400);
    });

    test('returns 404 for a missing listing', async () => {
      const res = await request(app).patch('/listings/999999').set(authHeader(seller.token)).send({ price: 10 });
      expect(res.status).toBe(404);
    });

    test('rejects a malformed id with 400', async () => {
      const res = await request(app).patch('/listings/abc').set(authHeader(seller.token)).send({ price: 10 });
      expect(res.status).toBe(400);
    });

    test('requires authentication', async () => {
      const res = await request(app).patch(`/listings/${listing.id}`).send({ price: 10 });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /listings/:id', () => {
    let listing;

    beforeEach(async () => {
      listing = await createListing(app, seller.token, category.id);
    });

    test('lets the owner delete the listing', async () => {
      const res = await request(app).delete(`/listings/${listing.id}`).set(authHeader(seller.token));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Listing deleted successfully' });
      expect((await request(app).get(`/listings/${listing.id}`)).status).toBe(404);
    });

    test('forbids another user from deleting it', async () => {
      const res = await request(app).delete(`/listings/${listing.id}`).set(authHeader(otherUser.token));
      expect(res.status).toBe(403);
      expect(await countRows('listings')).toBe(1);
    });

    test('refuses to delete a sold listing', async () => {
      await request(app).post(`/listings/${listing.id}/buy`).set(authHeader(otherUser.token));
      const res = await request(app).delete(`/listings/${listing.id}`).set(authHeader(seller.token));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Sold listings cannot be deleted' });
    });

    test('returns 404 for a missing listing', async () => {
      const res = await request(app).delete('/listings/999999').set(authHeader(seller.token));
      expect(res.status).toBe(404);
    });

    test('rejects a malformed id with 400', async () => {
      const res = await request(app).delete('/listings/1.5').set(authHeader(seller.token));
      expect(res.status).toBe(400);
    });
  });
});
