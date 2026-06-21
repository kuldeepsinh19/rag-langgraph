import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateQuery } from './validateQuery';
import { Request, Response, NextFunction } from 'express';
import { EmptyQueryError, AppError } from '../../common/errors';

describe('validateQuery middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = vi.fn();
  });

  it('should pass valid query', () => {
    req.body = { query: 'what is AI?' };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(); // Called with no error
  });

  it('should reject empty query string', () => {
    req.body = { query: '' };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(EmptyQueryError));
  });

  it('should reject whitespace-only query', () => {
    req.body = { query: '   ' };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(EmptyQueryError));
  });

  it('should reject invalid topK (too high)', () => {
    req.body = { query: 'test', topK: 25 }; // > 20

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('should reject invalid topK (zero)', () => {
    req.body = { query: 'test', topK: 0 };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('should accept valid topK', () => {
    req.body = { query: 'test', topK: 5 };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(); // No error
  });

  it('should reject invalid minScore (> 1)', () => {
    req.body = { query: 'test', minScore: 1.5 };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('should reject invalid minScore (< 0)', () => {
    req.body = { query: 'test', minScore: -0.1 };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('should accept valid minScore', () => {
    req.body = { query: 'test', minScore: 0.7 };

    validateQuery(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(); // No error
  });
});
