import express from 'express';
import aiRoutes from './src/routes/ai.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import { errorHandler } from './src/middleware/error.middleware.js';
import { openai } from './src/services/ai.service.js';
import pool from './db.js';

openai.chat.completions.create = async (req) => {
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: 'Yes, we have several laptops available. You can find a MacBook Pro and others by searching our listings.'
      }
    }]
  };
};

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/ai', aiRoutes);
app.use(errorHandler);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;
  try {
    await pool.query("DELETE FROM users WHERE email='verify@test.com'");
    await fetch(baseUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Verify', email: 'verify@test.com', password: 'password' }) });
    const loginRes = await fetch(baseUrl + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'verify@test.com', password: 'password' }) });
    const { token } = await loginRes.json();
    const res = await fetch(baseUrl + '/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ message: 'Are there any laptops available?' }) });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
    server.close();
  }
});
