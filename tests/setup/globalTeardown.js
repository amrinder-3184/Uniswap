import fs from 'fs';
import { TEST_UPLOAD_PARENT } from './paths.js';

// Runs once after the whole suite, including when tests fail
export default async function globalTeardown() {
  fs.rmSync(TEST_UPLOAD_PARENT, { recursive: true, force: true });
}
