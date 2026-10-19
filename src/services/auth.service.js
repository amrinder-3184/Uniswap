import pool from '../../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { JWT_ALGORITHM, JWT_EXPIRES_IN } from '../config/security.js';

export const registerUser = async (name, email, password) => {
  // Hash the password with 10 salt rounds
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Insert the new user. There is no separate "does this email exist?" query:
  // two simultaneous sign-ups could both pass such a check. The UNIQUE constraint
  // on users.email is the single source of truth, and its violation (23505 on
  // users_email_key) is turned into a 409 by the error middleware.
  // The role column is never set here, so every new account gets the default 'student'.
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at;`,
    [name, email, passwordHash]
  );

  return result.rows[0];
};

export const loginUser = async (email, password) => {
  const result = await pool.query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};
