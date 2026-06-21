import { Request, Response, NextFunction } from 'express';
import { EmptyQueryError, AppError } from '../../common/errors';

export function validateQuery(req: Request, res: Response, next: NextFunction) {
  // Step 1: Extract and trim query
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';

  // Step 2: Validate query is not empty
  if (!query) {
    return next(new EmptyQueryError('Query cannot be empty'));
  }

  // Step 3: Validate optional topK parameter if provided
  if (req.body.topK !== undefined) {
    const topK = Number(req.body.topK);
    if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
      return next(new AppError('topK must be an integer between 1 and 20', 400, 'INVALID_TOP_K'));
    }
  }

  // Step 4: Validate optional minScore parameter if provided
  if (req.body.minScore !== undefined) {
    const minScore = Number(req.body.minScore);
    if (typeof minScore !== 'number' || minScore < 0 || minScore > 1) {
      return next(
        new AppError('minScore must be a number between 0 and 1', 400, 'INVALID_MIN_SCORE'),
      );
    }
  }

  // Step 5: Pass to next middleware
  next();
}
