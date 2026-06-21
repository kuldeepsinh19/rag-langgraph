import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from './errorHandler';
import { AppError } from '../../common/errors';
import { Request, Response, NextFunction } from 'express';

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/test', method: 'POST' };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it('should handle AppError and return correct status code', () => {
    const err = new AppError('Test error message', 400, 'TEST_ERROR');

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'TEST_ERROR',
        message: 'Test error message',
      }),
    );
  });

  it('should handle file size errors', () => {
    const err = { code: 'LIMIT_FILE_SIZE' };

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FILE_TOO_LARGE',
      }),
    );
  });

  it('should return 500 for unknown errors', () => {
    const err = new Error('Unknown error');

    errorHandler(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
      }),
    );
  });
});
