import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorStoreError } from '../common/errors';
import { OllamaEmbedder } from './OllamaEmbedder';

const embeddingsMock = vi.fn();

vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    embeddings: embeddingsMock,
  })),
}));

describe('OllamaEmbedder', () => {
  beforeEach(() => {
    embeddingsMock.mockReset();
  });

  it('embedText returns a 768-dimensional embedding', async () => {
    embeddingsMock.mockResolvedValue({ embedding: Array.from({ length: 768 }, () => 0.5) });
    const embedder = new OllamaEmbedder('http://localhost:11434', 'nomic-embed-text');

    const embedding = await embedder.embedText('hello');

    expect(embedding).toHaveLength(768);
    expect(embedding.every((value) => typeof value === 'number')).toBe(true);
    expect(embeddingsMock).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      prompt: 'hello',
    });
  });

  it('embedBatch embeds all texts in parallel', async () => {
    embeddingsMock.mockResolvedValue({ embedding: Array.from({ length: 768 }, () => 0.25) });
    const embedder = new OllamaEmbedder('http://localhost:11434', 'nomic-embed-text');

    const embeddings = await embedder.embedBatch(['a', 'b', 'c']);

    expect(embeddings).toHaveLength(3);
    expect(embeddings.every((embedding) => embedding.length === 768)).toBe(true);
    expect(embeddingsMock).toHaveBeenCalledTimes(3);
  });

  it('retries transient network failures', async () => {
    const resetError = Object.assign(new Error('fetch failed: read ECONNRESET'), {
      code: 'ECONNRESET',
    });
    embeddingsMock
      .mockRejectedValueOnce(resetError)
      .mockResolvedValueOnce({ embedding: Array.from({ length: 768 }, () => 0.5) });

    const embedder = new OllamaEmbedder('http://localhost:11434', 'nomic-embed-text');
    const embedding = await embedder.embedText('hello');

    expect(embedding).toHaveLength(768);
    expect(embeddingsMock).toHaveBeenCalledTimes(2);
  });

  it('throws a descriptive error when Ollama is not running', async () => {
    const connectionError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), {
      code: 'ECONNREFUSED',
    });
    embeddingsMock.mockRejectedValue(connectionError);
    const embedder = new OllamaEmbedder('http://localhost:11434', 'nomic-embed-text');

    await expect(embedder.embedText('hello')).rejects.toMatchObject({
      message: 'Ollama is not running. Start it with: ollama serve',
      code: 'VECTOR_STORE_ERROR',
    } satisfies Partial<VectorStoreError>);
  });
});
