import dotenv from 'dotenv';

// Loads environment variables from exactly one file.
// Automated tests (NODE_ENV=test) read .env.test ONLY, so they can never pick up
// the development database settings or the real OpenAI key from .env.
// Variables already set in the shell or CI always take precedence over the file.
export const ENV_FILE = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

dotenv.config({ path: ENV_FILE, quiet: true });
