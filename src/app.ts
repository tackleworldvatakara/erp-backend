import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import mainRouter from './routes/index';

const app = express();

// Security headers
app.use(helmet());

// CORS — credentials required for refresh token cookie
app.use(
  cors({
    origin: config.clientUrls,
    credentials: true,
  })
);

// Request logging (dev only)
if (!config.isProduction) {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limiter — relaxed for dev, tighter in production
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !config.isProduction, // disable entirely in development
});
app.use(globalLimiter);

// Swagger / OpenAPI documentation
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Industrial ERP API',
    version: '1.0.0',
    description: 'REST API for the Industrial Finishing Products ERP System',
  },
  servers: [{ url: '/api', description: 'API base' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, 'routes/**/*.ts'),
    path.join(__dirname, 'controllers/**/*.ts'),
    path.join(__dirname, 'routes/**/*.js'),
    path.join(__dirname, 'controllers/**/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api', mainRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
});

export default app;
