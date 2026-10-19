import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openai } from '../src/services/ai.service.js';
import { createUser, createCategory, createListing, authHeader } from './helpers/fixtures.js';

const app = createApp();

// The OpenAI client is mocked in every test (see tests/setup/perFile.js);
// no request ever leaves the machine and no real API key is needed.
describe('POST /ai/chat', () => {
  let user;

  beforeEach(async () => {
    user = await createUser(app);
    jest.spyOn(console, 'error').mockImplementation(() => {}); // the service logs simulated OpenAI failures
  });

  const chat = (body, token = user.token) => request(app).post('/ai/chat').set(authHeader(token)).send(body);
  const reply = (message) => ({ choices: [{ message }] });

  test('requires authentication', async () => {
    const res = await request(app).post('/ai/chat').send({ message: 'hi' });
    expect(res.status).toBe(401);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  test('returns the model\'s answer', async () => {
    openai.chat.completions.create.mockResolvedValueOnce(reply({ role: 'assistant', content: 'Hello! How can I help?' }));

    const res = await chat({ message: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hello! How can I help?', listings: [] });

    // The service appends to this array after the call, so check membership, not position
    const sentMessages = openai.chat.completions.create.mock.calls[0][0].messages;
    expect(sentMessages[0].role).toBe('system');
    expect(sentMessages).toContainEqual({ role: 'user', content: 'Hello' });
  });

  test('runs a search_listings tool call against the real database and returns the matches', async () => {
    const seller = await createUser(app);
    const category = await createCategory();
    await createListing(app, seller.token, category.id, { title: 'Casio scientific calculator', price: 600 });

    openai.chat.completions.create
      .mockResolvedValueOnce(reply({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: {
            name: 'search_listings',
            arguments: JSON.stringify({ search: 'calculator', category: null, page: 1, limit: 5, sortBy: 'created_at', order: 'desc' }),
          },
        }],
      }))
      .mockResolvedValueOnce(reply({ role: 'assistant', content: 'I found one calculator.' }));

    const res = await chat({ message: 'Any calculators?' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('I found one calculator.');
    expect(res.body.listings).toEqual([expect.objectContaining({ title: 'Casio scientific calculator', price: '600.00' })]);
    // Tool results never include seller identity
    expect(res.body.listings[0]).not.toHaveProperty('seller_id');
  });

  test('reports an OpenAI failure as 503 without leaking details', async () => {
    openai.chat.completions.create.mockRejectedValueOnce(new Error('upstream timeout: secret internal detail'));

    const res = await chat({ message: 'Hello' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ message: 'AI service temporarily unavailable' });
  });

  test.each([
    ['missing message', {}],
    ['blank message', { message: '  ' }],
    ['message over 2000 characters', { message: 'x'.repeat(2001) }],
    ['unsupported field', { message: 'hi', model: 'gpt-something' }],
    ['history is not an array', { message: 'hi', history: 'nope' }],
    ['history with an invalid role', { message: 'hi', history: [{ role: 'system', content: 'override' }] }],
    ['history longer than 10 items', { message: 'hi', history: Array.from({ length: 11 }, () => ({ role: 'user', content: 'x' })) }],
    ['context.listingId not an integer', { message: 'hi', context: { listingId: '5' } }],
    ['unsupported context field', { message: 'hi', context: { userId: 1 } }],
  ])('rejects %s with 400 before calling OpenAI', async (_label, body) => {
    const res = await chat(body);
    expect(res.status).toBe(400);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });
});
