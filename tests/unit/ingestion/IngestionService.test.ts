import { describe, expect, it, vi } from 'vitest';
import { ParseError } from '../../../src/common/errors';
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
  it('preserves the original ingestion error when status update also fails', async () => {
    const docRepo = {
      create: vi.fn(async () => ({
        id: 'doc-1',
        filename: 'bad.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedAt: new Date(),
        chunkCount: 0,
        status: 'processing' as const,
      })),
      updateStatus: vi.fn(async (_id, status) => {
        if (status === 'failed') {
          throw new Error('column "error" does not exist');
        }
      }),
      findAll: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn(),
    } satisfies IDocumentRepository;

    const vectorStore = {
      upsert: vi.fn(),
      similaritySearch: vi.fn(),
      delete: vi.fn(),
      healthCheck: vi.fn(),
    } satisfies IVectorStore;

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
});
