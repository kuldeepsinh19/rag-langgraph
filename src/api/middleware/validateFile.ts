import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { AppError, UnsupportedTypeError } from '../../common/errors';
import { config } from '../../common/config';
import { ALLOWED_MIME_TYPES } from '../../ingestion/parsers/ParserFactory';
import { logger } from '../../common/logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

export function validateFile(req: Request, res: Response, next: NextFunction) {
  // Step 1: Run multer parsing for single file named 'file'
  upload.single('file')(req, res, (err: any) => {
    // Step 2: Handle multer errors
    if (err) {
      logger.error({ err }, 'Multer error during file upload');
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(
            `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit`,
            400,
            'FILE_TOO_LARGE',
          ),
        );
      }
      return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
    }

    // Step 3: Check file exists
    if (!req.file) {
      return next(new AppError('No file was uploaded', 400, 'NO_FILE'));
    }

    // Step 4: Check MIME type is allowed
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return next(new UnsupportedTypeError(`Unsupported document type: ${req.file.mimetype}`));
    }

    // Step 5: Sanitize filename to prevent path traversal
    req.file.originalname = path.basename(req.file.originalname);

    logger.debug({ filename: req.file.originalname, size: req.file.size }, 'File validated');

    // Step 6: Pass to next middleware
    next();
  });
}
