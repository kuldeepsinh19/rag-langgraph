import type { Config } from '../common/config';
import { logger } from '../common/logger';
import type { IEmbeddingService } from './IEmbeddingService';
import { OllamaEmbedder } from './OllamaEmbedder';

export function createEmbedder(config: Config): IEmbeddingService {
  logger.info(
    { model: config.OLLAMA_EMBED_MODEL, baseUrl: config.OLLAMA_BASE_URL },
    'Embedder ready (Ollama)',
  );

  return new OllamaEmbedder(config.OLLAMA_BASE_URL, config.OLLAMA_EMBED_MODEL);
}
