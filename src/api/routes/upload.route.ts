import { Router, Request, Response, NextFunction } from 'express';
import { IngestionService } from '../../ingestion/IngestionService';
import { logger } from '../../common/logger';
import { validateFile } from '../middleware/validateFile';

export function createUploadRoute(ingestionService: IngestionService) {
  const router = Router();

  router.post('/upload', validateFile, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // At this point, validateFile middleware has already:
      // - Parsed the file into req.file
      // - Validated MIME type
      // - Sanitized filename

      // Step 1: Extract file details
      const file = req.file!; // ! because validateFile ensures it exists
      const buffer = file.buffer;
      const filename = file.originalname;
      const mimeType = file.mimetype;

      logger.debug({ filename, mimeType, size: file.size }, 'Starting ingestion');

      // Step 2: Call ingestion service
      const result = await ingestionService.ingest(buffer, filename, mimeType);

      // Step 3: Return success response with 201 status
      res.status(201).json({
        documentId: result.documentId,
        filename,
        chunkCount: result.chunkCount,
        message: 'File ingested successfully',
      });
    } catch (err) {
      // Pass any error to error handler middleware
      next(err);
    }
  });

  return router;
}
