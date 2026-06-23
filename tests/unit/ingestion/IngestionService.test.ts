import { describe, expect, it, vi } from 'vitest';
import { AppError, ParseError } from '../../../src/common/errors';
import type { VectorChunk } from '../../../src/common/types';
import type { IDocumentRepository } from '../../../src/documents';
import type { IEmbeddingService } from '../../../src/embeddings';
import { IngestionService } from '../../../src/ingestion/IngestionService';
import type { IChunker } from '../../../src/ingestion/chunking';
import type { IVectorStore } from '../../../src/vectorstore/IVectorStore';

vi.mock('../../../src/ingestion/parsers', () => ({
  getParser: vi.fn(),
}));

import { getParser } from '../../../src/ingestion/parsers';

describe('IngestionService', () => {
  function createDocRepo() {
    return {
      create: vi.fn(async () => ({
        id: 'doc-1',
        filename: 'doc.txt',
        mimeType: 'text/plain',
        uploadedAt: new Date(),
        chunkCount: 0,
        status: 'processing' as const,
      })),
      updateStatus: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn(),
    } satisfies IDocumentRepository;
  }

  function createVectorStore() {
    return {
      upsert: vi.fn(),
      similaritySearch: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn(),
    } satisfies IVectorStore;
  }

  it('preserves the original ingestion error when status update also fails', async () => {
    const docRepo = {
      ...createDocRepo(),
      updateStatus: vi.fn(async (_id, status) => {
        if (status === 'failed') {
          throw new Error('column "error" does not exist');
        }
      }),
    } satisfies IDocumentRepository;

    const vectorStore = createVectorStore();

    const embedder = {
      dimensions: 768,
      model: 'test',
      embedText: vi.fn(),
      embedBatch: vi.fn(),
    } satisfies IEmbeddingService;

    const chunker = {
      chunk: vi.fn(),
    } satisfies IChunker;

    vi.mocked(getParser).mockReturnValue({
      supportedMimes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ] as const,
      parse: vi.fn(async () => {
        throw new ParseError('Unable to parse DOCX document: corrupted zip');
      }),
    });

    const service = new IngestionService(docRepo, vectorStore, embedder, chunker);

    await expect(
      service.ingest(
        Buffer.from('bad'),
        'bad.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).rejects.toThrow('Unable to parse DOCX document: corrupted zip');
  });

  it('persists embedded chunks incrementally by ingestion batch', async () => {
    const docRepo = createDocRepo();
    const vectorStore = createVectorStore();
    const embedder = {
      dimensions: 768,
      model: 'test',
      embedText: vi.fn(),
      embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
    } satisfies IEmbeddingService;
    const chunks: VectorChunk[] = Array.from({ length: 3 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      text: `chunk ${index}`,
      embedding: [],
      metadata: {
        documentId: 'doc-1',
        filename: 'doc.txt',
        chunkIndex: index,
      },
    }));
    const chunker = {
      chunk: vi.fn(() => chunks),
    } satisfies IChunker;

    vi.mocked(getParser).mockReturnValue({
      supportedMimes: ['text/plain'] as const,
      parse: vi.fn(async () => ({ text: 'chunk 0 chunk 1 chunk 2' })),
    });

    const service = new IngestionService(docRepo, vectorStore, embedder, chunker, {
      embedBatchSize: 2,
      maxChunksPerDocument: 10,
    });

    await expect(service.ingest(Buffer.from('ok'), 'doc.txt', 'text/plain')).resolves.toEqual({
      documentId: 'doc-1',
      chunkCount: 3,
    });

    expect(embedder.embedBatch).toHaveBeenCalledTimes(2);
    expect(vectorStore.upsert).toHaveBeenCalledTimes(2);
    expect(vectorStore.upsert).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ text: 'chunk 0', embedding: [0.1, 0.2] }),
        expect.objectContaining({ text: 'chunk 1', embedding: [0.1, 0.2] }),
      ]),
    );
    expect(docRepo.updateStatus).toHaveBeenCalledWith('doc-1', 'ready', 3);
  });

  it('rejects documents that exceed the configured chunk limit and cleans up vectors', async () => {
    const docRepo = createDocRepo();
    const vectorStore = createVectorStore();
    const embedder = {
      dimensions: 768,
      model: 'test',
      embedText: vi.fn(),
      embedBatch: vi.fn(),
    } satisfies IEmbeddingService;
    const chunker = {
      chunk: vi.fn(() =>
        Array.from({ length: 3 }, (_, index) => ({
          id: `00000000-0000-4000-8000-00000000000${index}`,
          text: `chunk ${index}`,
          embedding: [],
          metadata: {
            documentId: 'doc-1',
            filename: 'doc.txt',
            chunkIndex: index,
          },
        })),
      ),
    } satisfies IChunker;

    vi.mocked(getParser).mockReturnValue({
      supportedMimes: ['text/plain'] as const,
      parse: vi.fn(async () => ({ text: 'too much text' })),
    });

    const service = new IngestionService(docRepo, vectorStore, embedder, chunker, {
      maxChunksPerDocument: 2,
    });

    await expect(service.ingest(Buffer.from('ok'), 'doc.txt', 'text/plain')).rejects.toMatchObject({
      code: 'TOO_MANY_CHUNKS',
    } satisfies Partial<AppError>);

    expect(embedder.embedBatch).not.toHaveBeenCalled();
    expect(vectorStore.delete).toHaveBeenCalledWith('doc-1');
    expect(docRepo.updateStatus).toHaveBeenCalledWith(
      'doc-1',
      'failed',
      0,
      expect.stringContaining('MAX_CHUNKS_PER_DOCUMENT=2'),
    );
  });
});
