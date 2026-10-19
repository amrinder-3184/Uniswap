import path from 'path';

// Root folder for user uploads. Defaults to ./uploads in the project.
// UPLOAD_ROOT lets the automated tests write to a temporary folder instead,
// so test runs never add or remove files in the real uploads directory.
export const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(process.cwd(), 'uploads');

export const LISTING_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'listings');
