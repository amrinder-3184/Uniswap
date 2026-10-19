import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import listingRoutes from './routes/listing.routes.js';
import authRoutes from './routes/auth.routes.js';
import categoryRoutes from './routes/category.routes.js';
import userRoutes from './routes/user.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import messageRoutes from './routes/message.routes.js';
import listingImageRoutes from './routes/listingImage.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import aiRoutes from './routes/ai.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import similarListingRoutes from './routes/similarListing.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { AppError } from './utils/AppError.js';
import { validateJwtSecret, isRateLimitDisabled } from './config/security.js';
import { UPLOAD_ROOT } from './config/uploads.js';

// Builds the Express application without binding to a port.
// index.js calls listen() for production; tests pass the app straight to Supertest.
export const createApp = () => {
  // Refuse to build an app that would sign tokens with a missing or weak secret
  validateJwtSecret();

  const app = express();

  // Security Headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // Explicit CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new AppError('Not allowed by CORS', 403));
      }
    },
    credentials: true
  }));

  // Rate Limiters
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // 1000 requests per 15 min per IP
    skip: isRateLimitDisabled,
    message: { message: "Too many requests from this IP" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  // Body parser limits
  app.use(express.json({ limit: '10kb' }));

  // Serve static files (ensure safety of uploaded contents)
  app.use('/uploads', express.static(UPLOAD_ROOT));

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  app.get('/', (req, res) => {
    res.send('UniSwap Backend Running');
  });

  app.use('/auth', authRoutes);
  app.use('/categories', categoryRoutes);
  app.use('/users', userRoutes);
  app.use('/favorites', favoriteRoutes);
  app.use('/messages', messageRoutes);
  app.use('/ai', aiRoutes);
  app.use('/recommendations', recommendationRoutes);

  app.use('/listings', similarListingRoutes);
  app.use('/listings', listingRoutes);
  app.use('/listings', listingImageRoutes);
  app.use('/', transactionRoutes);

  // Unknown routes get a JSON 404 instead of Express's default HTML page
  app.use(notFoundHandler);

  // Centralized error handling middleware MUST be after all routes
  app.use(errorHandler);

  return app;
};
