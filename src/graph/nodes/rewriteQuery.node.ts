import type { Config } from '../../common/config';
import { logger } from '../../common/logger';
import type { IEmbeddingService } from '../../embeddings';
import type { IVectorStore } from '../../vectorstore/IVectorStore';
import { createLLM, llmResponseToText, type RagLLM } from '../llm';
import type { RagState } from '../state';

export async function rewriteQueryNode(
  state: RagState,
  deps: {
    vectorStore: IVectorStore;
    embedder: IEmbeddingService;
    config: Config;
    llm?: RagLLM;
  },
): Promise<Partial<RagState>> {
  const llm = deps.llm ?? createLLM(deps.config);
  const response = await llm.invoke(`The original question did not retrieve useful documents. Rewrite the question to be more specific and likely to find relevant information.
Original question: ${state.query}
Rewritten question (return ONLY the rewritten question, no explanation):`);
  const rewrittenQuery = llmResponseToText(response).trim();
  const retryCount = state.retryCount + 1;

  logger.debug({ query: state.query, rewrittenQuery, retryCount }, 'rewrote query');
  return { rewrittenQuery, retryCount };
}
