import jwt from 'jsonwebtoken';
import pool from '../../db.js';
import { JWT_ALGORITHM } from '../config/security.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Extract the token part
  const token = authHeader.split(' ')[1];

  try {
    // Verify the token, accepting only the algorithm we sign with
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

    // Attach the payload to the request object so next routes can access it
    req.user = decodedPayload;

    // Move to the next middleware or route handler
    next();
  } catch {
    // If token is invalid or expired
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Must run after authenticateToken. The role is read from the database rather than
// the token, so a demoted or deleted user loses access immediately instead of
// keeping it until their token expires.
export const requireAdmin = async (req, res, next) => {
  const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.userId]);

  if (result.rows.length === 0) {
    return res.status(401).json({ message: 'User account no longer exists' });
  }

  if (result.rows[0].role !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges required' });
  }

  next();
};
