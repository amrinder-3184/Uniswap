import request from 'supertest';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

// Test data builders. Users and listings are created through the real API so
// fixtures exercise the same code paths as clients. Categories and roles are
// set directly in the database because the API (correctly) restricts them.

export const DEFAULT_PASSWORD = 'password123';

let sequence = 0;
const nextId = () => `${process.pid}-${Date.now()}-${++sequence}`;

export const uniqueEmail = (label = 'user') => `${label}.${nextId()}@test.example`;

// Registers and logs in a user; returns { id, email, password, token, user }
export const createUser = async (app, { name = 'Test User', role = 'student', password = DEFAULT_PASSWORD, label } = {}) => {
  const email = uniqueEmail(label);

  const registerRes = await request(app).post('/auth/register').send({ name, email, password });
  if (registerRes.status !== 201) {
    throw new Error(`createUser: register failed with ${registerRes.status} ${JSON.stringify(registerRes.body)}`);
  }

  if (role !== 'student') {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, registerRes.body.id]);
  }

  const loginRes = await request(app).post('/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`createUser: login failed with ${loginRes.status}`);
  }

  return { id: registerRes.body.id, email, password, token: loginRes.body.token, user: loginRes.body.user };
};

export const createCategory = async (name = `Category ${nextId()}`) => {
  const result = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name', [name]);
  return result.rows[0];
};

export const validListingBody = (categoryId, overrides = {}) => ({
  title: 'Engineering Mathematics textbook',
  description: 'Second-hand copy with a few notes in pencil',
  price: 450,
  condition: 'Used',
  category_id: categoryId,
  ...overrides,
});

export const createListing = async (app, token, categoryId, overrides = {}) => {
  const res = await request(app)
    .post('/listings')
    .set('Authorization', `Bearer ${token}`)
    .send(validListingBody(categoryId, overrides));
  if (res.status !== 201) {
    throw new Error(`createListing failed with ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
};

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// Signs a token with the test secret, for checking how the API treats unusual tokens.
// A payload that sets its own "exp" (e.g. an already-expired token) gets no expiresIn.
export const signToken = (payload, options = {}) => {
  const defaults = payload.exp === undefined ? { algorithm: 'HS256', expiresIn: '1h' } : { algorithm: 'HS256' };
  return jwt.sign(payload, process.env.JWT_SECRET, { ...defaults, ...options });
};
