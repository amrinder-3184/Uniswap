import js from '@eslint/js';
import globals from 'globals';

// Static checks run by `npm run lint` locally and in CI.
export default [
  {
    // The legacy root-level scripts (test-*.js, verify-*.js and other one-off
    // helpers) have not been reviewed yet and are not part of the app or CI.
    // frontend/ is linted by its own Oxlint setup (frontend/.oxlintrc.json), and
    // its local build output (frontend/dist) must never be linted with these rules.
    ignores: ['node_modules/', 'coverage/', 'uploads/', 'frontend/', '*.js', '*.cjs', '!index.js', '!db.js', '!jest.config.js', '!eslint.config.js'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // A leading underscore marks a parameter that must exist but is not used
      // (e.g. Express's 4-argument error handler signature)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
