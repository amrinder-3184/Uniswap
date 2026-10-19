import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';

const app = createApp();

// Both features are plain SQL scoring (no OpenAI), so they run against the real test database
describe('recommendations and similar listings', () => {
  let seller;
  let shopper;
  let books;
  let furniture;

  beforeEach(async () => {
    seller = await createUser(app);
    shopper = await createUser(app);
    books = await createCategory('Books');
    furniture = await createCategory('Furniture');
  });

  describe('GET /recommendations', () => {
    test('requires authentication', async () => {
      expect((await request(app).get('/recommendations')).status).toBe(401);
    });

    test('never recommends the user\'s own listings or sold listings', async () => {
      await createListing(app, shopper.token, books.id, { title: 'My own book' });
      const sold = await createListing(app, seller.token, books.id, { title: 'Already sold' });
      await request(app).post(`/listings/${sold.id}/buy`).set(authHeader(shopper.token));
      await createListing(app, seller.token, books.id, { title: 'Available book' });

      const res = await request(app).get('/recommendations').set(authHeader(shopper.token));
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.title)).toEqual(['Available book']);
      expect(res.body.data[0]).toEqual(expect.objectContaining({ score: expect.any(Number), reason: expect.any(String) }));
    });

    test('ranks listings from a favorited category above others', async () => {
      const liked = await createListing(app, seller.token, furniture.id, { title: 'Study chair', price: 800 });
      await createListing(app, seller.token, furniture.id, { title: 'Study table', price: 900 });
      await createListing(app, seller.token, books.id, { title: 'Novel', price: 850 });
      await request(app).post(`/favorites/${liked.id}`).set(authHeader(shopper.token));

      const res = await request(app).get('/recommendations').set(authHeader(shopper.token));
      const titles = res.body.data.map((l) => l.title);
      // The favorited listing itself is excluded; the same-category table ranks first
      expect(titles).not.toContain('Study chair');
      expect(titles[0]).toBe('Study table');
    });
  });

  describe('GET /listings/:listingId/similar', () => {
    test('returns other available listings ranked by similarity, excluding the seller\'s own', async () => {
      const target = await createListing(app, seller.token, furniture.id, { title: 'Wooden study table', price: 1000, condition: 'Used' });
      const otherSeller = await createUser(app);
      await createListing(app, otherSeller.token, furniture.id, { title: 'Study table with drawer', price: 1100, condition: 'Used' });
      await createListing(app, otherSeller.token, books.id, { title: 'Poetry book', price: 50, condition: 'New' });
      await createListing(app, seller.token, furniture.id, { title: 'Same seller table', price: 1000, condition: 'Used' });

      const res = await request(app).get(`/listings/${target.id}/similar`);
      expect(res.status).toBe(200);
      const titles = res.body.data.map((l) => l.title);
      expect(titles[0]).toBe('Study table with drawer');
      expect(titles).not.toContain('Wooden study table');
      expect(titles).not.toContain('Same seller table');
    });

    test('returns 404 for a missing listing and 400 for a malformed id', async () => {
      expect((await request(app).get('/listings/999999/similar')).status).toBe(404);
      expect((await request(app).get('/listings/abc/similar')).status).toBe(400);
    });
  });
});
