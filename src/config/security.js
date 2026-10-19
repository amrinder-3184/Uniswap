// Central place for authentication and rate-limit settings.

// Tokens are signed and verified with exactly this algorithm. Pinning it stops a
// forged token from choosing a different algorithm (e.g. "none").
// HS256 is also jsonwebtoken's default for string secrets, so tokens issued
// before this was pinned remain valid.
export const JWT_ALGORITHM = 'HS256';
export const JWT_EXPIRES_IN = '1h';

// 32 characters is the minimum for a 256-bit HMAC key written as text
const MIN_JWT_SECRET_LENGTH = 32;

// Placeholder values from documentation and example env files
const PLACEHOLDER_PATTERNS = [/replace_with/i, /change_?me/i, /super_secret_jwt_signature_key/i];

// Throws if the secret is missing or obviously insecure. The error message never
// includes the secret itself.
export const validateJwtSecret = (secret = process.env.JWT_SECRET) => {
  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('JWT_SECRET is not set. Add a long random value to your .env file.');
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET is too short. Use at least ${MIN_JWT_SECRET_LENGTH} random characters.`);
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(secret))) {
    throw new Error('JWT_SECRET is still a placeholder value. Replace it with a long random string.');
  }
};

// Rate limits are skipped only when running the automated tests against a
// dedicated *_test database. Both conditions are required, so setting
// NODE_ENV=test by mistake on a real deployment does not remove the limits.
export const isRateLimitDisabled = () => {
  return process.env.NODE_ENV === 'test' && /_test$/.test(process.env.DB_NAME || '');
};
