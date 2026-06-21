import { logger } from '../common/logger';
import type { VectorChunk } from '../common/types';
import type { IDocumentRepository } from '../documents';
import type { IEmbeddingService } from '../embeddings';
import type { IVectorStore } from '../vectorstore/IVectorStore';
import type { IChunker } from './chunking';
import { getParser } from './parsers';

const EMBED_BATCH_SIZE = 50;

export class IngestionService {
  constructor(
    private readonly docRepo: IDocumentRepository,
    private readonly vectorStore: IVectorStore,
    private readonly embedder: IEmbeddingService,
    private readonly chunker: IChunker,
  ) {}

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

      const embeddedChunks: VectorChunk[] = [];
      const embeddingStartedAt = Date.now();
      for (let i = 0; i < rawChunks.length; i += EMBED_BATCH_SIZE) {
        const batch = rawChunks.slice(i, i + EMBED_BATCH_SIZE);
        const texts = batch.map((chunk) => chunk.text);
        const embeddings = await this.embedder.embedBatch(texts);

        batch.forEach((chunk, index) => {
          embeddedChunks.push({ ...chunk, embedding: embeddings[index] });
        });

        logger.debug({ batchStart: i, batchEnd: i + batch.length }, 'embedded batch');
      }
      const embeddingMs = Date.now() - embeddingStartedAt;

      const upsertStartedAt = Date.now();
      await this.vectorStore.upsert(embeddedChunks);
      const upsertMs = Date.now() - upsertStartedAt;
      await this.docRepo.updateStatus(doc.id, 'ready', embeddedChunks.length);

      logger.info(
        {
          documentId: doc.id,
          chunkCount: embeddedChunks.length,
          filename,
          embeddingMs,
          upsertMs,
          totalMs: parseMs + chunkMs + embeddingMs + upsertMs,
        },
        'ingestion complete',
      );

      return { documentId: doc.id, chunkCount: embeddedChunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown ingestion error';

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
