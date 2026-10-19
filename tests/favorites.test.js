import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';

const app = createApp();

describe('favorites', () => {
  let owner;
  let fan;
  let listing;

  beforeEach(async () => {
    owner = await createUser(app);
    fan = await createUser(app);
    const category = await createCategory();
    listing = await createListing(app, owner.token, category.id, { title: 'Desk lamp' });
  });

  const addFavorite = (token, listingId) => request(app).post(`/favorites/${listingId}`).set(authHeader(token));
  const removeFavorite = (token, listingId) => request(app).delete(`/favorites/${listingId}`).set(authHeader(token));
  const listFavorites = (token) => request(app).get('/favorites').set(authHeader(token));

  test('add, list and remove a favorite', async () => {
    const added = await addFavorite(fan.token, listing.id);
    expect(added.status).toBe(201);
    expect(added.body).toEqual({ message: 'Listing added to favorites' });

    const listed = await listFavorites(fan.token);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: listing.id, title: 'Desk lamp', favorited_at: expect.any(String) }),
    ]);

    const removed = await removeFavorite(fan.token, listing.id);
    expect(removed.status).toBe(200);
    expect((await listFavorites(fan.token)).body.data).toEqual([]);
  });

  test('favorites are private to each user', async () => {
    await addFavorite(fan.token, listing.id);
    const res = await listFavorites(owner.token);
    expect(res.body.data).toEqual([]);
  });

  test('adding the same favorite twice returns 409', async () => {
    await addFavorite(fan.token, listing.id);
    const res = await addFavorite(fan.token, listing.id);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Listing already favorited' });
  });

  test('favoriting a listing that does not exist returns 404', async () => {
    const res = await addFavorite(fan.token, 999999);
    expect(res.status).toBe(404);
  });

  test('removing a favorite that does not exist returns 404', async () => {
    const res = await removeFavorite(fan.token, listing.id);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Favorite not found' });
  });

  test.each(['abc', '0', '1.5'])('malformed listing id "%s" returns 400', async (id) => {
    expect((await addFavorite(fan.token, id)).status).toBe(400);
    expect((await removeFavorite(fan.token, id)).status).toBe(400);
  });

  test('all favorites routes require authentication', async () => {
    expect((await request(app).get('/favorites')).status).toBe(401);
    expect((await request(app).post(`/favorites/${listing.id}`)).status).toBe(401);
    expect((await request(app).delete(`/favorites/${listing.id}`)).status).toBe(401);
  });
});
