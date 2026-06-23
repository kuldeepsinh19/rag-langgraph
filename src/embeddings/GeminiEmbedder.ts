import { VectorStoreError } from '../common/errors';
import type { EmbedBatchOptions, IEmbeddingService } from './IEmbeddingService';

type GeminiClient = {
  models: {
    embedContent(params: {
      model: string;
      contents: string[];
      config: { outputDimensionality: number };
    }): Promise<{ embeddings?: Array<{ values?: number[] }> }>;
  };
};

export class GeminiEmbedder implements IEmbeddingService {
  private clientPromise?: Promise<GeminiClient>;

  constructor(
    private readonly apiKey: string,
    private readonly _model: string,
    readonly dimensions: number,
    private readonly concurrency = 1,
    private readonly delayMs = 1000,
    private readonly maxRetries = 3,
  ) {
    if (!apiKey) {
      throw new VectorStoreError('GEMINI_API_KEY is required when EMBEDDER_PROVIDER=gemini');
    }
  }

  get model(): string {
    return this._model;
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedFormattedBatch([formatQueryText(text)]);
    return embedding;
  }

  async embedBatch(texts: string[], options: EmbedBatchOptions = {}): Promise<number[][]> {
    return this.embedFormattedBatch(texts.map((text) => formatDocumentText(text, options.filename)));
  }

  private async embedFormattedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const client = await this.getClient();
      const embeddings = new Array<number[]>(texts.length);
      let nextIndex = 0;

      const worker = async () => {
        while (true) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= texts.length) {
            return;
          }

          embeddings[currentIndex] = await this.embedSingleFormattedText(client, texts[currentIndex]);
          if (this.delayMs > 0 && currentIndex < texts.length - 1) {
            await delay(this.delayMs);
          }
        }
      };

      const workerCount = Math.min(this.concurrency, texts.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      return embeddings;
    } catch (error) {
      throw toGeminiEmbeddingError(error);
    }
  }

  private async embedSingleFormattedText(client: GeminiClient, text: string): Promise<number[]> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await client.models.embedContent({
          model: this._model,
          contents: [text],
          config: { outputDimensionality: this.dimensions },
        });

        const embedding = response.embeddings?.[0]?.values;
        if (!embedding || embedding.length !== this.dimensions) {
          throw new Error(
            `Gemini returned invalid embedding: expected ${this.dimensions} dimensions, received ${embedding?.length ?? 0}`,
          );
        }

        return embedding;
      } catch (error) {
        if (!isRateLimitError(error) || attempt === this.maxRetries) {
          throw error;
        }

        await delay(backoffMs(attempt));
      }
    }

    throw new Error('Gemini embedding request failed after retries');
  }

  private getClient(): Promise<GeminiClient> {
    this.clientPromise ??= import('@google/genai').then(({ GoogleGenAI }) => {
      return new GoogleGenAI({ apiKey: this.apiKey }) as GeminiClient;
    });

    return this.clientPromise;
  }
}

function formatDocumentText(text: string, filename = 'document'): string {
  return `title: ${filename} | text: ${text}`;
}

function formatQueryText(text: string): string {
  return `task: question answering | query: ${text}`;
}

function toGeminiEmbeddingError(error: unknown): Error {
  if (error instanceof VectorStoreError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('"code":429') || message.includes('RESOURCE_EXHAUSTED')) {
    return new VectorStoreError(
      `Gemini embedding quota or rate limit exceeded. Reduce CHUNK_SIZE/embedding request volume, wait for quota reset, or use a billed/higher-quota Gemini project. Raw error: ${message}`,
    );
  }

  return new VectorStoreError(`Gemini embedding request failed: ${message}`);
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('"code":429') || message.includes('RESOURCE_EXHAUSTED');
}

function backoffMs(attempt: number): number {
  return Math.min(30000, 2000 * 2 ** attempt);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
