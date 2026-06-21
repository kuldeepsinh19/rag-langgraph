import { Ollama } from 'ollama';
import { logger } from '../common/logger';
import { VectorStoreError } from '../common/errors';
import type { IEmbeddingService } from './IEmbeddingService';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;
const EMBED_BATCH_CONCURRENCY = 4;

export class OllamaEmbedder implements IEmbeddingService {
  readonly dimensions = 768;
  private readonly client: Ollama;

  constructor(
    baseUrl: string,
    private readonly _model: string,
  ) {
    this.client = new Ollama({ host: baseUrl });
  }

  get model(): string {
    return this._model;
  }

  async embedText(text: string): Promise<number[]> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.client.embeddings({
          model: this._model,
          prompt: text,
        });

        return response.embedding;
      } catch (error) {
        if (isConnectionRefused(error)) {
          throw new VectorStoreError('Ollama is not running. Start it with: ollama serve');
        }

        const retryable = isRetryableNetworkError(error);
        if (!retryable || attempt === MAX_RETRIES) {
          throw error;
        }

        logger.warn(
          { attempt, maxRetries: MAX_RETRIES, err: error },
          'Ollama embedding request failed, retrying',
        );
        await delay(RETRY_DELAY_MS * attempt);
      }
    }

    throw new Error('Embedding request failed after retries');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings = new Array<number[]>(texts.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= texts.length) {
          return;
        }

        embeddings[currentIndex] = await this.embedText(texts[currentIndex]);
      }
    };

    const workerCount = Math.min(EMBED_BATCH_CONCURRENCY, texts.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return embeddings;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectionRefused(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; cause?: unknown };

  if (maybeError.code === 'ECONNREFUSED') {
    return true;
  }

  return isConnectionRefused(maybeError.cause);
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; cause?: unknown; message?: unknown };
  const message = typeof maybeError.message === 'string' ? maybeError.message : '';

  if (
    maybeError.code === 'ECONNRESET' ||
    maybeError.code === 'ETIMEDOUT' ||
    maybeError.code === 'UND_ERR_SOCKET'
  ) {
    return true;
  }

  if (message.includes('ECONNRESET') || message.includes('fetch failed')) {
    return true;
  }

  return isRetryableNetworkError(maybeError.cause);
}
