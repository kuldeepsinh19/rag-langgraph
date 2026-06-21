import type { Config } from '../../common/config';
import { logger } from '../../common/logger';
import type { IEmbeddingService } from '../../embeddings';
import type { IVectorStore } from '../../vectorstore/IVectorStore';
import type { RagLLM } from '../llm';
import type { RagState } from '../state';

export async function gradeDocumentsNode(
  state: RagState,
  deps: {
    vectorStore: IVectorStore;
    embedder: IEmbeddingService;
    config: Config;
    llm?: RagLLM;
  },
): Promise<Partial<RagState>> {
  const minScore = state.minScore ?? deps.config.MIN_RELEVANCE_SCORE;
  const scoreQualifiedChunks = state.retrievedChunks.filter((chunk) => chunk.score >= minScore);
  const gradedChunks =
    scoreQualifiedChunks.length > 0 ? scoreQualifiedChunks : state.retrievedChunks.slice(0, deps.config.TOP_K);
  const confidence = gradedChunks.length > 0 ? 'high' : 'low';

  logger.info(
    {
      retrievedCount: state.retrievedChunks.length,
      scoreQualifiedCount: scoreQualifiedChunks.length,
      afterScoreFilterCount: gradedChunks.length,
      minScoreThreshold: minScore,
      usedBestAvailableFallback: scoreQualifiedChunks.length === 0 && gradedChunks.length > 0,
      confidence,
    },
    'Grading complete',
  );

  return { gradedChunks, confidence };
}
