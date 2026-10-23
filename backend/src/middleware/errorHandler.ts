/**
 * Unified Error Handling Module
 * =============================
 * 
 * Consolidates all error handling functionality:
 * - AppError class for custom errors
 * - asyncHandler for async route handlers
 * - errorHandler middleware for centralized error processing
 * - notFound middleware for 404 responses
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { sendError } from '../utils/response';

/**
 * Custom error class for operational errors
 * Use this for errors that are expected and handled gracefully
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code || 'ERROR';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch promise rejections
 * Wraps async route handlers to forward errors to Express error middleware
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Centralized error handler middleware
 * Processes all errors and sends appropriate responses
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  error.statusCode = error.statusCode || 500;
  error.message = error.message || 'Internal Server Error';

  // Log error details
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
    stack: error.stack
  });

  // Wrong MongoDB ID error
  if (error.name === 'CastError') {
    return sendError(res, 400, `Invalid ${error.path}: ${error.value}`);
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    return sendError(res, 400, `${field} already exists`);
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token expired');
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((err: any) => err.message);
    return sendError(res, 400, 'Validation failed', messages);
  }

  // Send custom error or generic error
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Something went wrong';

  return sendError(res, statusCode, message);
};

/**
 * 404 Not Found handler middleware
 * Use at the end of route definitions
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};