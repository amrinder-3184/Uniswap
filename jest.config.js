// Jest configuration. The project uses native ES modules, so tests run with
// `node --experimental-vm-modules` (see the npm scripts) and no Babel transform.
export default {
  testEnvironment: 'node',
  transform: {},

  // Only the new suite under tests/. The legacy root-level test-*.js scripts
  // are standalone programs and are deliberately excluded.
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],

  // All test files share one database and empty it before each test, so they
  // must never run in parallel.
  maxWorkers: 1,

  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv:['<rootDir>/tests/setup/perFile.js'],

  collectCoverageFrom: ['src/**/*.js', 'db.js'],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  // Set a few points below the measured baseline (83% statements, 70% branches,
  // 81% functions, 85% lines) so a drop in coverage fails `npm run test:coverage`.
  coverageThreshold: {
    global: { statements: 80, branches: 65, functions: 75, lines: 80 },
  },
};
