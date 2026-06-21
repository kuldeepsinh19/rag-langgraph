import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../../common/config';
import { GraphExecutionError } from '../../common/errors';
import { logger } from '../../common/logger';
import { validateQuery } from '../middleware/validateQuery';

export function createQueryRoute(ragGraph: any) {
  const router = Router();

  router.post('/query', validateQuery, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // At this point, validateQuery middleware has already validated req.body.query

      // Step 1: Extract parameters from request body
      const query = req.body.query.trim();
      const topK = req.body.topK ?? config.TOP_K;
      const minScore = req.body.minScore ?? config.MIN_RELEVANCE_SCORE;

      logger.debug({ query, topK, minScore }, 'Processing query');

      // Step 2: Invoke LangGraph with timeout protection (30 seconds)
      let finalState;
      try {
        finalState = await Promise.race([
          ragGraph.invoke({ query, topK, minScore }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout after 30s')), 30000),
          ),
        ]);
      } catch (timeoutErr) {
        logger.warn({ err: timeoutErr }, 'Query timeout');
        return next(new GraphExecutionError('Query timed out after 30 seconds'));
      }

      // Step 3: Handle case where answer is empty
      const answer =
        finalState.answer || 'I could not find relevant information to answer that question.';

      // Step 4: Format sources (trim text to 200 chars)
      const sources = (finalState.sources || []).map((chunk: any) => ({
        id: chunk.id,
        text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
        score: chunk.score,
        documentId: chunk.metadata.documentId,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
      }));

      // Step 5: Return response
      res.status(200).json({
        answer,
        sources,
        rewriteCount: finalState.retryCount || 0,
        query: finalState.rewrittenQuery || query,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
