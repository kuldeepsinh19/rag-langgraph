import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VectorStoreError } from '../common/errors';
import type { Config } from '../common/config';
import { createEmbedder } from './EmbedderFactory';
import { GeminiEmbedder } from './GeminiEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';

const embeddingsMock = vi.fn();
const embedContentMock = vi.fn();

vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    embeddings: embeddingsMock,
  })),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: embedContentMock,
    },
  })),
}));

const baseConfig: Config = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/ragdb',
  VECTOR_STORE: 'pgvector',
  EMBEDDER_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'test-key',
  GEMINI_EMBED_MODEL: 'gemini-embedding-2',
  GEMINI_EMBED_DIMENSIONS: 768,
  GEMINI_EMBED_CONCURRENCY: 1,
  GEMINI_EMBED_DELAY_MS: 0,
  GEMINI_EMBED_MAX_RETRIES: 0,
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_EMBED_MODEL: 'nomic-embed-text',
  OLLAMA_LLM_MODEL: 'llama3.2',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_COLLECTION: 'test_collection',
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  TOP_K: 3,
  MIN_RELEVANCE_SCORE: 0.7,
  MAX_REWRITE_RETRIES: 2,
  MAX_CONTEXT_CHARS: 12000,
  MAX_CHUNKS_PER_DOCUMENT: 500,
  INGEST_EMBED_BATCH_SIZE: 25,
  PORT: 3000,
  LOG_LEVEL: 'error',
  MAX_FILE_SIZE_MB: 20,
};

function embedding(value: number): { values: number[] } {
  return { values: Array.from({ length: 768 }, () => value) };
}

describe('GeminiEmbedder', () => {
  beforeEach(() => {
    embedContentMock.mockReset();
  });

  it('embedText returns a 768-dimensional query embedding', async () => {
    embedContentMock.mockResolvedValue({ embeddings: [embedding(0.5)] });
    const embedder = new GeminiEmbedder('test-key', 'gemini-embedding-2', 768, 1, 0, 0);

    const result = await embedder.embedText('hello');

    expect(result).toHaveLength(768);
    expect(result.every((value) => typeof value === 'number')).toBe(true);
    expect(embedContentMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-2',
      contents: ['task: question answering | query: hello'],
      config: { outputDimensionality: 768 },
    });
  });

  it('embedBatch preserves input order and includes document titles', async () => {
    embedContentMock
      .mockResolvedValueOnce({ embeddings: [embedding(0.1)] })
      .mockResolvedValueOnce({ embeddings: [embedding(0.2)] })
      .mockResolvedValueOnce({ embeddings: [embedding(0.3)] });
    const embedder = new GeminiEmbedder('test-key', 'gemini-embedding-2', 768, 1, 0, 0);

    const result = await embedder.embedBatch(['a', 'b', 'c'], { filename: 'notes.txt' });

    expect(result).toHaveLength(3);
    expect(result.map((item) => item[0])).toEqual([0.1, 0.2, 0.3]);
    expect(embedContentMock).toHaveBeenCalledTimes(3);
    expect(embedContentMock).toHaveBeenNthCalledWith(1, {
      model: 'gemini-embedding-2',
      contents: ['title: notes.txt | text: a'],
      config: { outputDimensionality: 768 },
    });
    expect(embedContentMock).toHaveBeenNthCalledWith(2, {
      model: 'gemini-embedding-2',
      contents: ['title: notes.txt | text: b'],
      config: { outputDimensionality: 768 },
    });
    expect(embedContentMock).toHaveBeenNthCalledWith(3, {
      model: 'gemini-embedding-2',
      contents: ['title: notes.txt | text: c'],
      config: { outputDimensionality: 768 },
    });
  });

  it('wraps Gemini API failures with a readable error', async () => {
    embedContentMock.mockRejectedValue(new Error('API key not valid'));
    const embedder = new GeminiEmbedder('bad-key', 'gemini-embedding-2', 768, 1, 0, 0);

    await expect(embedder.embedText('hello')).rejects.toMatchObject({
      message: 'Gemini embedding request failed: API key not valid',
      code: 'VECTOR_STORE_ERROR',
    } satisfies Partial<VectorStoreError>);
  });

  it('factory chooses Gemini from config', () => {
    const embedder = createEmbedder(baseConfig);

    expect(embedder).toBeInstanceOf(GeminiEmbedder);
    expect(embedder.model).toBe('gemini-embedding-2');
    expect(embedder.dimensions).toBe(768);
  });
});

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

  it('factory can still choose Ollama explicitly', () => {
    const embedder = createEmbedder({
      ...baseConfig,
      EMBEDDER_PROVIDER: 'ollama',
    });

    expect(embedder).toBeInstanceOf(OllamaEmbedder);
    expect(embedder.model).toBe('nomic-embed-text');
  });
});
