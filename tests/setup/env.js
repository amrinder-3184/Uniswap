import path from 'path';
import { TEST_UPLOAD_PARENT } from './paths.js';

// Runs in each test file before any application module is imported.
// Uploads go to a temporary folder so the real ./uploads directory is never touched.
process.env.UPLOAD_ROOT = path.join(TEST_UPLOAD_PARENT, `run-${process.pid}`);
