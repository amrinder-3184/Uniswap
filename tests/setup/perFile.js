import { jest } from '@jest/globals';
import pool from '../../db.js';
import { openai as chatClient } from '../../src/services/ai.service.js';
import { openai as embeddingClient } from '../../src/services/embedding.service.js';
import { assertTestEnvironment, assertConnectedToTestDatabase } from './testDbGuard.js';
import { resetDatabase } from '../helpers/db.js';

// Hooks shared by every test file (configured as setupFilesAfterEnv in jest.config.js).

// Counts any OpenAI call that a test did not explicitly mock
let unexpectedOpenAICalls = 0;
const blockOpenAI = () => {
  unexpectedOpenAICalls += 1;
  return Promise.reject(new Error('Real OpenAI calls are blocked in tests'));
};

beforeAll(async () => {
  assertTestEnvironment();
  await assertConnectedToTestDatabase(pool);
});

beforeEach(async () => {
  await resetDatabase();
  unexpectedOpenAICalls = 0;
  // Tests that exercise the AI endpoint replace these with their own mock responses
  jest.spyOn(chatClient.chat.completions, 'create').mockImplementation(blockOpenAI);
  jest.spyOn(embeddingClient.embeddings, 'create').mockImplementation(blockOpenAI);
});

afterEach(() => {
  jest.restoreAllMocks();
  expect(unexpectedOpenAICalls).toBe(0);
});

// Close the pool even when tests fail, so Jest exits cleanly
afterAll(async () => {
  await pool.end();
});
