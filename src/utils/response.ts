import { Response } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  pagination?: PaginationMeta
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(pagination && { pagination }),
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[]
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}
