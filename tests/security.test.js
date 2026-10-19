import { validateJwtSecret } from '../src/config/security.js';

// Unit tests for the startup check that refuses to run with a weak JWT secret
describe('validateJwtSecret', () => {
  test('rejects a missing JWT_SECRET environment variable', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => validateJwtSecret()).toThrow(/not set/);
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  test.each([
    ['null', null, /not set/],
    ['empty', '', /not set/],
    ['whitespace only', '    ', /not set/],
    ['shorter than 32 characters', 'a'.repeat(31), /too short/],
    ['a documentation placeholder', 'replace_with_a_long_random_string_please', /placeholder/],
    ['"changeme" padded to length', 'changeme'.repeat(5), /placeholder/],
  ])('rejects a secret that is %s', (_label, secret, message) => {
    expect(() => validateJwtSecret(secret)).toThrow(message);
  });

  test('error messages never contain the secret itself', () => {
    const secret = 'short-but-sensitive';
    let message = '';
    try {
      validateJwtSecret(secret);
    } catch (err) {
      message = err.message;
    }
    expect(message).toMatch(/too short/);
    expect(message).not.toContain(secret);
  });

  test('accepts a long random secret, including the one configured for tests', () => {
    expect(() => validateJwtSecret('4f9c1d7a2b8e6f3a9d0c5b7e1a2f8d6c4b9e0a7f3d1c')).not.toThrow();
    expect(() => validateJwtSecret(process.env.JWT_SECRET)).not.toThrow();
  });
});
