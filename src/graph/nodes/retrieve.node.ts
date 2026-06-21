import type { Config } from '../../common/config';
import { logger } from '../../common/logger';
import type { IEmbeddingService } from '../../embeddings';
import type { IVectorStore } from '../../vectorstore/IVectorStore';
import type { RagState } from '../state';

export async function retrieveNode(
  state: RagState,
  deps: { vectorStore: IVectorStore; embedder: IEmbeddingService; config: Config },
): Promise<Partial<RagState>> {
  const queryToUse = state.rewrittenQuery ?? state.query;
  const topK = state.topK ?? deps.config.TOP_K;

  logger.info({ query: queryToUse, topK }, 'Starting retrieval');

  const embedding = await deps.embedder.embedText(queryToUse);
  logger.info({ embeddingLength: embedding.length }, 'Embedding generated');

  const chunks = await deps.vectorStore.similaritySearch(embedding, {
    topK,
    minScore: 0,
    query: queryToUse,
  });

  logger.info(
    {
      chunkCount: chunks.length,
      topK,
      query: queryToUse,
      scores: chunks.map((chunk) => chunk.score),
    },
    'Retrieved chunks with scores',
  );

  return { retrievedChunks: chunks };
}
