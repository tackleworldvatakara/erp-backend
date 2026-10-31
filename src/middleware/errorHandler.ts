import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../config/env';

interface AppError extends Error {
  statusCode?: number;
  errors?: unknown[];
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Default to 500
  let statusCode = err.statusCode ?? 500;
  let message = err.message || 'Internal server error';
  let errors: unknown[] | undefined;

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Validation error';
    errors = Object.values(err.errors).map((e) => ({
      field: (e as mongoose.Error.ValidatorError | mongoose.Error.CastError).path,
      message: (e as mongoose.Error.ValidatorError | mongoose.Error.CastError).message,
    }));
  }

  // Mongoose CastError (invalid ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  // MongoDB duplicate key (code 11000)
  else if (err.code === 11000 && err.keyValue) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value: ${field} already exists`;
  }

  // ZodError
  else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = err.errors;
  }

  // JWT errors — handled by name check since jwt types vary
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(config.isDevelopment && err.stack && { stack: err.stack }),
  });
}
