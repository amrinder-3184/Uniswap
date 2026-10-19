import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser, uniqueEmail, signToken, authHeader, DEFAULT_PASSWORD } from './helpers/fixtures.js';
import { pool } from './helpers/db.js';

const app = createApp();

const register = (body) => request(app).post('/auth/register').send(body);
const login = (body) => request(app).post('/auth/login').send(body);

describe('POST /auth/register', () => {
  test('creates a student account and never returns the password hash', async () => {
    const email = uniqueEmail();
    const res = await register({ name: 'Asha', email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Asha',
      email,
      role: 'student',
      created_at: expect.any(String),
    });

    const stored = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(stored.rows[0].password_hash).not.toBe(DEFAULT_PASSWORD);
    expect(stored.rows[0].password_hash).toMatch(/^\$2[aby]\$10\$/); // bcrypt, cost 10
  });

  test('ignores a client-supplied role (no self-promotion to admin)', async () => {
    const res = await register({ name: 'Mallory', email: uniqueEmail(), password: DEFAULT_PASSWORD, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('student');
  });

  test('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail();
    await register({ name: 'First', email, password: DEFAULT_PASSWORD });
    const res = await register({ name: 'Second', email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'Email already registered' });
  });

  test('concurrent registrations with the same email: exactly one succeeds, the rest get 409', async () => {
    const email = uniqueEmail('race');
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => register({ name: 'Racer', email, password: DEFAULT_PASSWORD }))
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
  });

  test.each([
    ['missing name', { email: 'a@test.example', password: DEFAULT_PASSWORD }],
    ['blank name', { name: '   ', email: 'a@test.example', password: DEFAULT_PASSWORD }],
    ['invalid email', { name: 'A', email: 'not-an-email', password: DEFAULT_PASSWORD }],
    ['email is a number', { name: 'A', email: 12345, password: DEFAULT_PASSWORD }],
    ['missing password', { name: 'A', email: 'a@test.example' }],
    ['password too short', { name: 'A', email: 'a@test.example', password: '12345' }],
    ['password is not a string', { name: 'A', email: 'a@test.example', password: 12345678 }],
    ['name too long', { name: 'x'.repeat(256), email: 'a@test.example', password: DEFAULT_PASSWORD }],
  ])('rejects %s with 400 and a list of errors', async (_label, body) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Validation failed', errors: expect.any(Array) });
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  describe('bcrypt 72-byte password limit (measured in UTF-8 bytes)', () => {
    test.each([
      ['72 ASCII characters (72 bytes)', 'a'.repeat(72), 201],
      ['73 ASCII characters (73 bytes)', 'a'.repeat(73), 400],
      ['36 x "é" (36 chars, 72 bytes)', 'é'.repeat(36), 201],
      ['37 x "é" (37 chars, 74 bytes)', 'é'.repeat(37), 400],
      ['18 x emoji (36 UTF-16 units, 72 bytes)', '😀'.repeat(18), 201],
      ['19 x emoji (38 UTF-16 units, 76 bytes)', '😀'.repeat(19), 400],
    ])('%s -> %i', async (_label, password, expectedStatus) => {
      const res = await register({ name: 'Byte Tester', email: uniqueEmail(), password });
      expect(res.status).toBe(expectedStatus);
      if (expectedStatus === 400) {
        expect(res.body.errors.join(' ')).toMatch(/72 bytes/);
      }
    });

    test('a 72-byte multi-byte password can be used to log in', async () => {
      const email = uniqueEmail();
      const password = 'é'.repeat(36);
      await register({ name: 'Multi', email, password });
      const res = await login({ email, password });
      expect(res.status).toBe(200);
    });
  });
});

describe('POST /auth/login', () => {
  test('returns a token and the public user profile', async () => {
    const { email, id } = await createUser(app, { name: 'Ravi' });
    const res = await login({ email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Login successful',
      token: expect.any(String),
      user: { id, name: 'Ravi', email, role: 'student' },
    });
  });

  test('issues an HS256 token that carries the user id and role', async () => {
    const { token, id } = await createUser(app);
    const [header, payload] = token.split('.').slice(0, 2).map((part) => JSON.parse(Buffer.from(part, 'base64url')));

    expect(header.alg).toBe('HS256');
    expect(payload).toMatchObject({ userId: id, role: 'student' });
    expect(payload.exp - payload.iat).toBe(60 * 60); // 1 hour
  });

  test('wrong password and unknown email give the same 401 (no account enumeration)', async () => {
    const { email } = await createUser(app);
    const wrongPassword = await login({ email, password: 'not-the-password' });
    const unknownEmail = await login({ email: uniqueEmail('nobody'), password: DEFAULT_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ message: 'Invalid email or password' });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  test.each([
    ['missing email', { password: DEFAULT_PASSWORD }],
    ['invalid email', { email: 'bad', password: DEFAULT_PASSWORD }],
    ['missing password', { email: 'a@test.example' }],
    ['SQL injection in email', { email: "' OR '1'='1", password: DEFAULT_PASSWORD }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('SQL-injection-style password is treated as a plain wrong password', async () => {
    const { email } = await createUser(app);
    const res = await login({ email, password: "' OR '1'='1' --" });
    expect(res.status).toBe(401);
  });
});

describe('JWT verification on protected routes', () => {
  const me = (headers = {}) => request(app).get('/users/me').set(headers);

  test('accepts a valid token', async () => {
    const { token } = await createUser(app);
    const res = await me(authHeader(token));
    expect(res.status).toBe(200);
  });

  test('accepts a token signed without an explicit algorithm (format used before HS256 was pinned)', async () => {
    const { id } = await createUser(app);
    const jwt = (await import('jsonwebtoken')).default;
    const legacyToken = jwt.sign({ userId: id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await me(authHeader(legacyToken));
    expect(res.status).toBe(200);
  });

  test.each([
    ['no Authorization header', {}, 'Authentication required'],
    ['non-Bearer scheme', { Authorization: 'Basic abc123' }, 'Authentication required'],
    // The trailing space is stripped by HTTP, so this arrives as just "Bearer"
    ['"Bearer" with no token', { Authorization: 'Bearer ' }, 'Authentication required'],
    ['malformed token', { Authorization: 'Bearer not.a.jwt' }, 'Invalid or expired token'],
  ])('rejects %s with 401', async (_label, headers, message) => {
    const res = await me(headers);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message });
  });

  test('rejects an expired token', async () => {
    const { id } = await createUser(app);
    const expired = signToken({ userId: id, exp: Math.floor(Date.now() / 1000) - 10 });
    const res = await me(authHeader(expired));
    expect(res.status).toBe(401);
  });

  test('rejects a token signed with a different secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ userId: 1 }, 'a-completely-different-secret-value-123456', { algorithm: 'HS256' });
    const res = await me(authHeader(forged));
    expect(res.status).toBe(401);
  });

  test('rejects a token signed with the right secret but a different algorithm (HS512)', async () => {
    const { id } = await createUser(app);
    const hs512 = signToken({ userId: id }, { algorithm: 'HS512' });
    const res = await me(authHeader(hs512));
    expect(res.status).toBe(401);
  });

  test('rejects an unsigned token with alg "none"', async () => {
    const { id } = await createUser(app);
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ userId: id, role: 'admin' })}.`;
    const res = await me(authHeader(unsigned));
    expect(res.status).toBe(401);
  });
});
