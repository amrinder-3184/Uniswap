import * as listingImageService from '../services/listingImage.service.js';
import { AppError } from '../utils/AppError.js';
import { LISTING_UPLOAD_DIR } from '../config/uploads.js';
import fs from 'fs';
import path from 'path';

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image provided', 400);
    }

    const userId = req.user.userId;
    const listingId = Number(req.params.listingId);
    
    // We only store the relative path
    const imageUrl = '/uploads/listings/' + req.file.filename;

    const imageRecord = await listingImageService.addImage(userId, listingId, imageUrl);

    res.status(201).json(imageRecord);
  } catch (err) {
    // If the database operation fails, we must clean up the physical file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

export const getImages = async (req, res, next) => {
  try {
    const listingId = Number(req.params.listingId);
    const images = await listingImageService.getImages(listingId);
    res.json({ data: images });
  } catch (err) {
    next(err);
  }
};

export const deleteImage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const listingId = Number(req.params.listingId);
    const imageId = Number(req.params.imageId);

    const imageUrl = await listingImageService.deleteImage(userId, listingId, imageId);

    // imageUrl is expected to be like "/uploads/listings/filename.ext"
    // We safely extract only the basename to prevent any path traversal attempts
    const filename = path.basename(imageUrl);
    const physicalPath = path.join(LISTING_UPLOAD_DIR, filename);

    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    } else {
      console.warn(`Physical image file missing during deletion: ${physicalPath}`);
    }

    res.status(200).json({ message: "Image deleted successfully" });
  } catch (err) {
    next(err);
  }
};
