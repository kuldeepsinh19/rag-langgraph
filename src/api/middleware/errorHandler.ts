import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/errors';
import { logger } from '../../common/logger';
import { config } from '../../common/config';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Step 1: Log all errors
  logger.error(
    { err, path: req.path, method: req.method, statusCode: err.statusCode },
    'Request error',
  );

  // Step 2: Check if error is an AppError (our custom error type)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 3: Handle specific multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit`,
      timestamp: new Date().toISOString(),
    });
  }

  // Step 4: For any other error, return generic 500
  // NOTE: Never expose stack traces in production
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    // Only include stack in development
    ...(config.LOG_LEVEL === 'debug' && { stack: err.stack }),
  });
}
