import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';
import { LISTING_UPLOAD_DIR } from '../config/uploads.js';

const uploadDir = LISTING_UPLOAD_DIR;

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate safe, unique filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    let ext = '';
    if (file.mimetype === 'image/jpeg') ext = '.jpg';
    else if (file.mimetype === 'image/png') ext = '.png';
    else if (file.mimetype === 'image/webp') ext = '.webp';
    
    cb(null, 'listing-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPEG, PNG, and WebP are allowed.', 400), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

import { fileTypeFromFile } from 'file-type';

export const handleUpload = (req, res, next) => {
  const uploadSingle = upload.single('image');
  
  uploadSingle(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File too large. Maximum size is 5MB.', 400));
      }
      return next(new AppError('File upload error: ' + err.message, 400));
    } else if (err) {
      return next(err);
    }
    
    // Validate magic bytes
    if (req.file) {
      try {
        const meta = await fileTypeFromFile(req.file.path);
        if (!meta || !['image/jpeg', 'image/png', 'image/webp'].includes(meta.mime)) {
          fs.unlinkSync(req.file.path); // Clean up fake file
          return next(new AppError('Invalid file signature. File is not a real image.', 400));
        }
      } catch {
        fs.unlinkSync(req.file.path);
        return next(new AppError('Failed to process image signature.', 400));
      }
    }
    
    next();
  });
};
