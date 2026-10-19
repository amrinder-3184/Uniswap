import os from 'os';
import path from 'path';

// All files uploaded during tests go under the OS temp folder, never ./uploads
export const TEST_UPLOAD_PARENT = path.join(os.tmpdir(), 'uniswap-test-uploads');
