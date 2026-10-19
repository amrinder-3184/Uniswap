import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';
import { countRows } from './helpers/db.js';

const app = createApp();

describe('messages', () => {
  let seller;
  let buyer;
  let outsider;
  let listing;

  beforeEach(async () => {
    seller = await createUser(app, { name: 'Seller' });
    buyer = await createUser(app, { name: 'Buyer' });
    outsider = await createUser(app, { name: 'Outsider' });
    const category = await createCategory();
    listing = await createListing(app, seller.token, category.id, { title: 'Bicycle' });
  });

  const send = (token, body) => request(app).post('/messages').set(authHeader(token)).send(body);

  test('a buyer can message the seller; the receiver is derived from the listing', async () => {
    const res = await send(buyer.token, { listing_id: listing.id, content: '  Is this still available?  ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      sender_id: buyer.id,
      receiver_id: seller.id,
      listing_id: listing.id,
      content: 'Is this still available?', // trimmed
      created_at: expect.any(String),
    });
  });

  test('a client cannot choose the sender or receiver', async () => {
    const res = await send(buyer.token, { listing_id: listing.id, content: 'Hi', sender_id: seller.id, receiver_id: outsider.id });
    expect(res.status).toBe(400);
    expect(await countRows('messages')).toBe(0);
  });

  test('a seller cannot message themselves about their own listing', async () => {
    const res = await send(seller.token, { listing_id: listing.id, content: 'Hello me' });
    expect(res.status).toBe(400);
  });

  test('messaging about a listing that does not exist returns 404', async () => {
    const res = await send(buyer.token, { listing_id: 999999, content: 'Hi' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['missing listing_id', { content: 'Hi' }],
    ['listing_id as a string', { listing_id: '1', content: 'Hi' }],
    ['missing content', { listing_id: 1 }],
    ['blank content', { listing_id: 1, content: '   ' }],
    ['content over 2000 characters', { listing_id: 1, content: 'x'.repeat(2001) }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await send(buyer.token, body);
    expect(res.status).toBe(400);
  });

  test('both participants see the thread and conversation list; an outsider sees nothing', async () => {
    await send(buyer.token, { listing_id: listing.id, content: 'Is it available?' });

    const buyerThread = await request(app).get(`/messages/${listing.id}/${seller.id}`).set(authHeader(buyer.token));
    const sellerThread = await request(app).get(`/messages/${listing.id}/${buyer.id}`).set(authHeader(seller.token));
    expect(buyerThread.body.data).toHaveLength(1);
    expect(sellerThread.body.data).toEqual(buyerThread.body.data);

    const sellerConversations = await request(app).get('/messages').set(authHeader(seller.token));
    expect(sellerConversations.body.data).toEqual([
      expect.objectContaining({ listing_id: listing.id, other_user_id: buyer.id, latest_message: 'Is it available?', message_count: 1 }),
    ]);

    // The outsider asks for the same thread by naming the participants: they get nothing
    const outsiderThread = await request(app).get(`/messages/${listing.id}/${seller.id}`).set(authHeader(outsider.token));
    const outsiderConversations = await request(app).get('/messages').set(authHeader(outsider.token));
    expect(outsiderThread.status).toBe(200);
    expect(outsiderThread.body.data).toEqual([]);
    expect(outsiderConversations.body.data).toEqual([]);
  });

  test('thread lookup validates ids and listing existence', async () => {
    expect((await request(app).get(`/messages/abc/${seller.id}`).set(authHeader(buyer.token))).status).toBe(400);
    expect((await request(app).get(`/messages/${listing.id}/abc`).set(authHeader(buyer.token))).status).toBe(400);
    expect((await request(app).get(`/messages/999999/${seller.id}`).set(authHeader(buyer.token))).status).toBe(404);
  });

  test('all message routes require authentication', async () => {
    expect((await request(app).get('/messages')).status).toBe(401);
    expect((await request(app).post('/messages').send({ listing_id: listing.id, content: 'Hi' })).status).toBe(401);
    expect((await request(app).get(`/messages/${listing.id}/${seller.id}`)).status).toBe(401);
  });
});
