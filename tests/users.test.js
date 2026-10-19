import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, createCategory, createListing, authHeader, uniqueEmail, signToken, DEFAULT_PASSWORD } from './helpers/fixtures.js';
import { countRows, pool } from './helpers/db.js';

const app = createApp();

describe('users (/users/me)', () => {
  let user;

  beforeEach(async () => {
    user = await createUser(app, { name: 'Priya' });
  });

  test.each([
    ['GET', '/users/me'],
    ['GET', '/users/me/listings'],
    ['PATCH', '/users/me'],
    ['PATCH', '/users/me/password'],
    ['DELETE', '/users/me'],
  ])('%s %s requires authentication', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Authentication required' });
  });

  describe('GET /users/me', () => {
    test('returns the profile of the token owner without the password hash', async () => {
      const res = await request(app).get('/users/me').set(authHeader(user.token));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: user.id, name: 'Priya', email: user.email, role: 'student', created_at: expect.any(String),
      });
    });

    test('returns 404 when the account in a valid token no longer exists', async () => {
      const ghostToken = signToken({ userId: 2147483000, role: 'student' });
      const res = await request(app).get('/users/me').set(authHeader(ghostToken));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /users/me/listings', () => {
    test('returns only the authenticated user\'s listings', async () => {
      const other = await createUser(app);
      const category = await createCategory();
      await createListing(app, user.token, category.id, { title: 'Mine' });
      await createListing(app, other.token, category.id, { title: 'Theirs' });

      const res = await request(app).get('/users/me/listings').set(authHeader(user.token));
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.title)).toEqual(['Mine']);
    });
  });

  describe('PATCH /users/me', () => {
    test('updates name and email', async () => {
      const newEmail = uniqueEmail('renamed');
      const res = await request(app)
        .patch('/users/me')
        .set(authHeader(user.token))
        .send({ name: 'Priya S', email: newEmail });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, name: 'Priya S', email: newEmail, role: 'student' });
    });

    test('rejects an email that belongs to another account with 409', async () => {
      const other = await createUser(app);
      const res = await request(app).patch('/users/me').set(authHeader(user.token)).send({ email: other.email });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: 'Email already registered' });
    });

    test.each([
      ['role (privilege escalation)', { role: 'admin' }],
      ['id', { id: 1 }],
      ['password_hash', { password_hash: 'x' }],
    ])('rejects attempts to change %s', async (_label, body) => {
      const res = await request(app).patch('/users/me').set(authHeader(user.token)).send(body);
      expect(res.status).toBe(400);
      const stored = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
      expect(stored.rows[0].role).toBe('student');
    });

    test.each([
      ['empty body', {}],
      ['blank name', { name: ' ' }],
      ['invalid email', { email: 'nope' }],
      ['name over 255 characters', { name: 'x'.repeat(256) }],
    ])('rejects %s with 400', async (_label, body) => {
      const res = await request(app).patch('/users/me').set(authHeader(user.token)).send(body);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /users/me/password', () => {
    const changePassword = (token, body) => request(app).patch('/users/me/password').set(authHeader(token)).send(body);

    test('changes the password; the old one stops working', async () => {
      const res = await changePassword(user.token, { currentPassword: DEFAULT_PASSWORD, newPassword: 'brand-new-pass' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Password changed successfully' });

      const oldLogin = await request(app).post('/auth/login').send({ email: user.email, password: DEFAULT_PASSWORD });
      const newLogin = await request(app).post('/auth/login').send({ email: user.email, password: 'brand-new-pass' });
      expect(oldLogin.status).toBe(401);
      expect(newLogin.status).toBe(200);
    });

    test('rejects a wrong current password with 401', async () => {
      const res = await changePassword(user.token, { currentPassword: 'wrong-password', newPassword: 'brand-new-pass' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Current password is incorrect' });
    });

    test.each([
      ['new password too short', { currentPassword: DEFAULT_PASSWORD, newPassword: '123' }],
      ['new password over 72 bytes', { currentPassword: DEFAULT_PASSWORD, newPassword: 'é'.repeat(37) }],
      ['new password same as current', { currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD }],
      ['missing current password', { newPassword: 'brand-new-pass' }],
    ])('rejects %s with 400', async (_label, body) => {
      const res = await changePassword(user.token, body);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /users/me', () => {
    test('requires the current password', async () => {
      const missing = await request(app).delete('/users/me').set(authHeader(user.token)).send({});
      const wrong = await request(app).delete('/users/me').set(authHeader(user.token)).send({ currentPassword: 'wrong-password' });

      expect(missing.status).toBe(400);
      expect(wrong.status).toBe(401);
      expect(await countRows('users')).toBe(1);
    });

    test('deletes the account and its listings; the old token no longer finds the user', async () => {
      const category = await createCategory();
      await createListing(app, user.token, category.id);

      const res = await request(app).delete('/users/me').set(authHeader(user.token)).send({ currentPassword: DEFAULT_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Account deleted successfully' });
      expect(await countRows('users')).toBe(0);
      expect(await countRows('listings')).toBe(0); // ON DELETE CASCADE

      const after = await request(app).get('/users/me').set(authHeader(user.token));
      expect(after.status).toBe(404);
    });

    test('a deleted user\'s token cannot create listings (400, not a 500)', async () => {
      const category = await createCategory();
      await request(app).delete('/users/me').set(authHeader(user.token)).send({ currentPassword: DEFAULT_PASSWORD });

      const res = await request(app)
        .post('/listings')
        .set(authHeader(user.token))
        .send({ title: 'T', description: 'D', price: 1, condition: 'New', category_id: category.id });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'User account no longer exists' });
    });
  });
});
