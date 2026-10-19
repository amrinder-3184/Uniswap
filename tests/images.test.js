import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { LISTING_UPLOAD_DIR } from '../src/config/uploads.js';
import { TEST_UPLOAD_PARENT } from './setup/paths.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';
import { countRows } from './helpers/db.js';

const app = createApp();

// A real 1x1 PNG, so the magic-byte check sees a genuine image
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

const filesOnDisk = () => (fs.existsSync(LISTING_UPLOAD_DIR) ? fs.readdirSync(LISTING_UPLOAD_DIR) : []);

describe('listing images', () => {
  let owner;
  let otherUser;
  let listing;

  beforeEach(async () => {
    owner = await createUser(app);
    otherUser = await createUser(app);
    const category = await createCategory();
    listing = await createListing(app, owner.token, category.id);
    // Each test starts with an empty temporary upload folder
    fs.rmSync(LISTING_UPLOAD_DIR, { recursive: true, force: true });
    fs.mkdirSync(LISTING_UPLOAD_DIR, { recursive: true });
  });

  const upload = (token, listingId, buffer = TINY_PNG, options = { filename: 'photo.png', contentType: 'image/png' }) => {
    const req = request(app).post(`/listings/${listingId}/images`);
    if (token) req.set(authHeader(token));
    return req.attach('image', buffer, options);
  };

  test('uploads go to a temporary test folder, never the project uploads directory', () => {
    expect(LISTING_UPLOAD_DIR.startsWith(TEST_UPLOAD_PARENT)).toBe(true);
    expect(LISTING_UPLOAD_DIR).not.toBe(path.join(process.cwd(), 'uploads', 'listings'));
  });

  test('the owner can upload, list, fetch and delete an image', async () => {
    const uploaded = await upload(owner.token, listing.id);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toEqual({
      id: expect.any(Number),
      listing_id: listing.id,
      image_url: expect.stringMatching(/^\/uploads\/listings\/listing-.+\.png$/),
      display_order: 1,
      created_at: expect.any(String),
    });
    expect(filesOnDisk()).toHaveLength(1);

    const listed = await request(app).get(`/listings/${listing.id}/images`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([uploaded.body]);

    const served = await request(app).get(uploaded.body.image_url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    const deleted = await request(app).delete(`/listings/${listing.id}/images/${uploaded.body.id}`).set(authHeader(owner.token));
    expect(deleted.status).toBe(200);
    expect(filesOnDisk()).toHaveLength(0);
    expect(await countRows('listing_images')).toBe(0);
  });

  test('another user cannot upload to the listing, and the uploaded file is cleaned up', async () => {
    const res = await upload(otherUser.token, listing.id);
    expect(res.status).toBe(403);
    expect(filesOnDisk()).toHaveLength(0);
    expect(await countRows('listing_images')).toBe(0);
  });

  test('another user cannot delete the owner\'s image', async () => {
    const uploaded = await upload(owner.token, listing.id);
    const res = await request(app).delete(`/listings/${listing.id}/images/${uploaded.body.id}`).set(authHeader(otherUser.token));
    expect(res.status).toBe(403);
    expect(filesOnDisk()).toHaveLength(1);
  });

  test('a file that only claims to be a PNG is rejected by its signature and removed', async () => {
    const res = await upload(owner.token, listing.id, Buffer.from('definitely not an image'));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid file signature. File is not a real image.' });
    expect(filesOnDisk()).toHaveLength(0);
  });

  test('a non-image content type is rejected', async () => {
    const res = await upload(owner.token, listing.id, Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid file type/);
  });

  test('files over 5MB are rejected', async () => {
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(owner.token, listing.id, big);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'File too large. Maximum size is 5MB.' });
    expect(filesOnDisk()).toHaveLength(0);
  });

  test('a request without a file is rejected', async () => {
    const res = await request(app).post(`/listings/${listing.id}/images`).set(authHeader(owner.token)).field('note', 'no file');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'No image provided' });
  });

  test('a listing can have at most 5 images', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await upload(owner.token, listing.id)).status).toBe(201);
    }
    const sixth = await upload(owner.token, listing.id);
    expect(sixth.status).toBe(400);
    expect(sixth.body).toEqual({ message: 'Maximum 5 images allowed per listing' });
    expect(filesOnDisk()).toHaveLength(5);
  });

  test('missing listings and images return 404; malformed ids return 400', async () => {
    expect((await upload(owner.token, 999999)).status).toBe(404);
    expect((await request(app).get('/listings/999999/images')).status).toBe(404);
    expect((await request(app).delete(`/listings/${listing.id}/images/999999`).set(authHeader(owner.token))).status).toBe(404);
    expect((await request(app).delete(`/listings/${listing.id}/images/abc`).set(authHeader(owner.token))).status).toBe(400);
  });

  test('uploading requires authentication', async () => {
    const res = await upload(null, listing.id);
    expect(res.status).toBe(401);
  });
});
