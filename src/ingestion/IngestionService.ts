import { logger } from '../common/logger';
import { AppError } from '../common/errors';
import type { VectorChunk } from '../common/types';
import type { IDocumentRepository } from '../documents';
import type { IEmbeddingService } from '../embeddings';
import type { IVectorStore } from '../vectorstore/IVectorStore';
import type { IChunker } from './chunking';
import { getParser } from './parsers';

interface IngestionOptions {
  embedBatchSize?: number;
  maxChunksPerDocument?: number;
}

export class IngestionService {
  private readonly embedBatchSize: number;
  private readonly maxChunksPerDocument: number;

  constructor(
    private readonly docRepo: IDocumentRepository,
    private readonly vectorStore: IVectorStore,
    private readonly embedder: IEmbeddingService,
    private readonly chunker: IChunker,
    options: IngestionOptions = {},
  ) {
    this.embedBatchSize = options.embedBatchSize ?? 25;
    this.maxChunksPerDocument = options.maxChunksPerDocument ?? 500;
  }

  async ingest(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ documentId: string; chunkCount: number }> {
    const doc = await this.docRepo.create(filename, mimeType);

    try {
      const parser = getParser(mimeType);
      const parseStartedAt = Date.now();
      const parsed = await parser.parse(buffer, filename);
      const parseMs = Date.now() - parseStartedAt;

      const chunkStartedAt = Date.now();
      const rawChunks = this.chunker.chunk(parsed.text, {
        documentId: doc.id,
        filename,
      });
      const chunkMs = Date.now() - chunkStartedAt;

      if (rawChunks.length > this.maxChunksPerDocument) {
        throw new AppError(
          `Document produced ${rawChunks.length} chunks, which exceeds MAX_CHUNKS_PER_DOCUMENT=${this.maxChunksPerDocument}. Increase CHUNK_SIZE or split the document.`,
          413,
          'TOO_MANY_CHUNKS',
        );
      }

      logger.info(
        {
          documentId: doc.id,
          filename,
          textLength: parsed.text.length,
          chunkCount: rawChunks.length,
          parseMs,
          chunkMs,
        },
        'document parsed and chunked',
      );

      let embeddedChunkCount = 0;
      const embeddingStartedAt = Date.now();
      for (let i = 0; i < rawChunks.length; i += this.embedBatchSize) {
        const batch = rawChunks.slice(i, i + this.embedBatchSize);
        const texts = batch.map((chunk) => chunk.text);
        const embeddings = await this.embedder.embedBatch(texts, { filename });
        const embeddedBatch: VectorChunk[] = batch.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index],
        }));

        await this.vectorStore.upsert(embeddedBatch);
        embeddedChunkCount += embeddedBatch.length;

        logger.debug(
          {
            documentId: doc.id,
            batchStart: i,
            batchEnd: i + batch.length,
            embeddedChunkCount,
          },
          'embedded and persisted batch',
        );
      }
      const embeddingMs = Date.now() - embeddingStartedAt;

      await this.docRepo.updateStatus(doc.id, 'ready', embeddedChunkCount);

      logger.info(
        {
          documentId: doc.id,
          chunkCount: embeddedChunkCount,
          filename,
          embeddingMs,
          totalMs: parseMs + chunkMs + embeddingMs,
        },
        'ingestion complete',
      );

      return { documentId: doc.id, chunkCount: embeddedChunkCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown ingestion error';

      try {
        await this.vectorStore.delete(doc.id);
      } catch (cleanupErr) {
        logger.warn({ documentId: doc.id, filename, cleanupErr }, 'failed to clean up partial vectors');
      }

      try {
        await this.docRepo.updateStatus(doc.id, 'failed', 0, message);
      } catch (statusErr) {
        logger.warn(
          { documentId: doc.id, filename, originalError: message, statusErr },
          'failed to persist ingestion failure status',
        );
      }

      logger.error({ documentId: doc.id, filename, err }, 'ingestion failed');
      throw err;
    }
  }
}
