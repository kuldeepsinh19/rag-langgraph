import { Router, Request, Response, NextFunction } from 'express';
import { IDocumentRepository } from '../../documents/IDocumentRepository';
import { IVectorStore } from '../../vectorstore/IVectorStore';
import { AppError } from '../../common/errors';
import { logger } from '../../common/logger';

export function createDocumentsRoute(docRepo: IDocumentRepository, vectorStore: IVectorStore) {
  const router = Router();

  // GET /documents - list all uploaded documents
  router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documents = await docRepo.findAll();
      res.status(200).json({
        documents,
        count: documents.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /documents/:id - remove a document and its embeddings
  router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Step 1: Check document exists
      const doc = await docRepo.findById(id);
      if (!doc) {
        return next(new AppError(`Document ${id} not found`, 404, 'NOT_FOUND'));
      }

      logger.debug({ documentId: id, filename: doc.filename }, 'Deleting document');

      // Step 2: Delete from vector store
      await vectorStore.delete(id);

      // Step 3: Delete from document repository
      await docRepo.delete(id);

      // Step 4: Return success
      res.status(200).json({
        message: 'Document deleted',
        documentId: id,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
