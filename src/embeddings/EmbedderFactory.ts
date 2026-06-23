import type { Config } from '../common/config';
import { logger } from '../common/logger';
import type { IEmbeddingService } from './IEmbeddingService';
import { GeminiEmbedder } from './GeminiEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';

export function createEmbedder(config: Config): IEmbeddingService {
  if (config.EMBEDDER_PROVIDER === 'ollama') {
    logger.info(
      { model: config.OLLAMA_EMBED_MODEL, baseUrl: config.OLLAMA_BASE_URL },
      'Embedder ready (Ollama)',
    );

    return new OllamaEmbedder(config.OLLAMA_BASE_URL, config.OLLAMA_EMBED_MODEL);
  }

  logger.info(
    {
      model: config.GEMINI_EMBED_MODEL,
      dimensions: config.GEMINI_EMBED_DIMENSIONS,
      concurrency: config.GEMINI_EMBED_CONCURRENCY,
      delayMs: config.GEMINI_EMBED_DELAY_MS,
      maxRetries: config.GEMINI_EMBED_MAX_RETRIES,
    },
    'Embedder ready (Gemini)',
  );

  return new GeminiEmbedder(
    config.GEMINI_API_KEY,
    config.GEMINI_EMBED_MODEL,
    config.GEMINI_EMBED_DIMENSIONS,
    config.GEMINI_EMBED_CONCURRENCY,
    config.GEMINI_EMBED_DELAY_MS,
    config.GEMINI_EMBED_MAX_RETRIES,
  );
}
