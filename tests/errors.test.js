import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';
import { pool } from './helpers/db.js';

const app = createApp();

describe('error handling and general security', () => {
  test('GET /health responds', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'healthy', timestamp: expect.any(String) });
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: 'Route GET /does-not-exist not found' });
  });

  test('malformed JSON returns 400 with a generic message (no parser internals)', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Malformed JSON in request body' });
  });

  test('bodies over 10kb return 413', async () => {
    const res = await request(app).post('/auth/register').send({ name: 'x'.repeat(11 * 1024), email: 'a@test.example', password: 'password123' });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: 'Request body is too large' });
  });

  test('requests from a disallowed browser origin get 403', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Not allowed by CORS' });
  });

  test('the configured frontend origin is allowed', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('security headers are set by helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  describe('database failures', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('an unexpected database error returns a generic 500 and is logged server-side', async () => {
      const dbError = Object.assign(new Error('connection to server lost: password authentication details...'), { code: '08006' });
      jest.spyOn(pool, 'query').mockRejectedValueOnce(dbError);

      const res = await request(app).get('/categories');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Internal server error' });
      expect(JSON.stringify(res.body)).not.toMatch(/password|connection|stack/i);
      expect(console.error).toHaveBeenCalledWith(dbError);
    });

    test('client errors (4xx) are not logged, so request bodies with passwords never reach the logs', async () => {
      await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"password": "hunter2"');
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  test('invalid input across endpoints never produces a 5xx', async () => {
    const user = await createUser(app);
    const category = await createCategory();
    const listing = await createListing(app, user.token, category.id);
    const auth = authHeader(user.token);
    const nasty = ["'; DROP TABLE users; --", '../../etc/passwd', '%00', '9'.repeat(30), '-1', '1.0', 'null', '{}'];

    const responses = [];
    for (const value of nasty) {
      const encoded = encodeURIComponent(value);
      responses.push(
        await request(app).get(`/listings/${encoded}`),
        await request(app).get(`/categories/${encoded}`),
        await request(app).get(`/listings/${encoded}/similar`),
        await request(app).get(`/listings/${encoded}/images`),
        await request(app).patch(`/listings/${encoded}`).set(auth).send({ title: value }),
        await request(app).delete(`/favorites/${encoded}`).set(auth),
        await request(app).get(`/messages/${encoded}/${encoded}`).set(auth),
        await request(app).get('/listings').query({ search: value, category: value }),
        await request(app).post('/listings').set(auth).send({ title: value, description: value, price: value, condition: value, category_id: value }),
        await request(app).patch(`/listings/${listing.id}`).set(auth).send({ price: value, category_id: value }),
        await request(app).post('/messages').set(auth).send({ listing_id: value, content: value }),
      );
    }

    const serverErrors = responses.filter((r) => r.status >= 500).map((r) => `${r.req.method} ${r.req.path} -> ${r.status}`);
    expect(serverErrors).toEqual([]);
  });
});
