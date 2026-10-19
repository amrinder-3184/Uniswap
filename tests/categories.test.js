import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, authHeader, signToken } from './helpers/fixtures.js';
import { countRows, pool } from './helpers/db.js';

const app = createApp();

describe('categories', () => {
  describe('public reads', () => {
    test('GET /categories lists all categories ordered by id, without authentication', async () => {
      const first = await createCategory('Books');
      const second = await createCategory('Furniture');

      const res = await request(app).get('/categories');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([first, second]);
    });

    test('GET /categories/:id returns one category', async () => {
      const category = await createCategory('Cycles');
      const res = await request(app).get(`/categories/${category.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(category);
    });

    test('GET /categories/:id returns 404 when missing', async () => {
      const res = await request(app).get('/categories/999999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Category not found' });
    });

    test.each(['abc', '1.0', '0', '99999999999'])('GET /categories/%s is rejected with 400', async (id) => {
      const res = await request(app).get(`/categories/${id}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /categories (admin only)', () => {
    const createViaApi = (token, body = { name: 'Electronics' }) => {
      const req = request(app).post('/categories');
      if (token) req.set(authHeader(token));
      return req.send(body);
    };

    test('rejects unauthenticated requests with 401', async () => {
      const res = await createViaApi(null);
      expect(res.status).toBe(401);
      expect(await countRows('categories')).toBe(0);
    });

    test('rejects ordinary users with 403', async () => {
      const student = await createUser(app);
      const res = await createViaApi(student.token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Admin privileges required' });
      expect(await countRows('categories')).toBe(0);
    });

    test('ignores an "admin" role claim in the token; the role is read from the database', async () => {
      const student = await createUser(app);
      const forged = signToken({ userId: student.id, role: 'admin' });
      const res = await createViaApi(forged);
      expect(res.status).toBe(403);
    });

    test('rejects a valid token for a user that no longer exists with 401', async () => {
      const ghost = signToken({ userId: 2147483000, role: 'admin' });
      const res = await createViaApi(ghost);
      expect(res.status).toBe(401);
    });

    test('allows admins to create a category', async () => {
      const admin = await createUser(app, { role: 'admin' });
      const res = await createViaApi(admin.token, { name: 'Electronics' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(Number), name: 'Electronics' });
    });

    test('a demoted admin loses access immediately, even with an unexpired token', async () => {
      const admin = await createUser(app, { role: 'admin' });
      await pool.query("UPDATE users SET role = 'student' WHERE id = $1", [admin.id]);
      const res = await createViaApi(admin.token);
      expect(res.status).toBe(403);
    });

    test('rejects a duplicate name with 409', async () => {
      const admin = await createUser(app, { role: 'admin' });
      await createCategory('Electronics');
      const res = await createViaApi(admin.token, { name: 'Electronics' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: 'Category already exists' });
    });

    test.each([
      ['missing name', {}],
      ['blank name', { name: '  ' }],
      ['non-string name', { name: 42 }],
      ['name over 255 characters', { name: 'x'.repeat(256) }],
    ])('validates the body for admins: %s -> 400', async (_label, body) => {
      const admin = await createUser(app, { role: 'admin' });
      const res = await createViaApi(admin.token, body);
      expect(res.status).toBe(400);
    });
  });
});
