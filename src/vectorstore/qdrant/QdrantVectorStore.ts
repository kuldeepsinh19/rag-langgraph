import { VectorStoreError } from '../../common/errors';
import type { ScoredChunk, SearchOpts, VectorChunk } from '../../common/types';
import type { IVectorStore } from '../IVectorStore';
import { ensureQdrantCollection, type QdrantCollectionClient } from './qdrant.init';

type PointId = string | number;

interface SearchResult {
  id: PointId;
  score: number;
  payload?: Record<string, unknown> | null;
  vector?: unknown;
}

interface QdrantClientLike extends QdrantCollectionClient {
  upsert(
    collectionName: string,
    options: {
      points: Array<{
        id: string;
        vector: number[];
        payload: Record<string, unknown>;
      }>;
    },
  ): Promise<unknown>;
  search(
    collectionName: string,
    options: {
      vector: number[];
      limit: number;
      score_threshold?: number;
      filter?: Record<string, unknown>;
      with_payload: boolean;
      with_vector: boolean;
    },
  ): Promise<SearchResult[]>;
  delete(
    collectionName: string,
    options: {
      filter: {
        must: Array<{
          key: string;
          match: { value: string };
        }>;
      };
    },
  ): Promise<unknown>;
  getCollections(): Promise<unknown>;
}

interface ChunkPayload {
  documentId?: unknown;
  filename?: unknown;
  chunkIndex?: unknown;
  text?: unknown;
  pageNumber?: unknown;
  sheetName?: unknown;
}

export class QdrantVectorStore implements IVectorStore {
  private client?: QdrantClientLike;
  private initialized = false;

  constructor(
    private readonly url: string,
    private readonly collectionName: string,
    private readonly dimensions: number,
  ) {}

  async upsert(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    try {
      await this.ensureInitialized();
      const client = await this.getClient();
      await client.upsert(this.collectionName, {
        points: chunks.map((chunk) => ({
          id: chunk.id,
          vector: chunk.embedding,
          payload: {
            documentId: chunk.metadata.documentId,
            filename: chunk.metadata.filename,
            chunkIndex: chunk.metadata.chunkIndex,
            text: chunk.text,
            pageNumber: chunk.metadata.pageNumber,
            sheetName: chunk.metadata.sheetName,
          },
        })),
      });
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to upsert chunks into Qdrant');
    }
  }

  async similaritySearch(embedding: number[], opts: SearchOpts): Promise<ScoredChunk[]> {
    try {
      await this.ensureInitialized();
      const client = await this.getClient();
      const results = await client.search(this.collectionName, {
        vector: embedding,
        limit: opts.topK,
        score_threshold: opts.minScore,
        filter: opts.filter,
        with_payload: true,
        with_vector: true,
      });

      return results.map((result) => {
        const payload = (result.payload ?? {}) as ChunkPayload;

        return {
          id: String(result.id),
          text: asString(payload.text),
          embedding: vectorFromResult(result.vector),
          score: result.score,
          metadata: {
            documentId: asString(payload.documentId),
            filename: asString(payload.filename),
            chunkIndex: asNumber(payload.chunkIndex),
            pageNumber: optionalNumber(payload.pageNumber),
            sheetName: optionalString(payload.sheetName),
          },
        };
      });
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to search chunks in Qdrant');
    }
  }

  async delete(documentId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      const client = await this.getClient();
      await client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId,
              },
            },
          ],
        },
      });
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to delete chunks from Qdrant');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.getCollections();
      return true;
    } catch {
      return false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const client = await this.getClient();
    await ensureQdrantCollection(client, this.collectionName, this.dimensions);
    this.initialized = true;
  }

  private async getClient(): Promise<QdrantClientLike> {
    if (this.client) {
      return this.client;
    }

    const { QdrantClient } = await import('@qdrant/js-client-rest');
    this.client = new QdrantClient({
      url: this.url,
      checkCompatibility: false,
    }) as QdrantClientLike;
    return this.client;
  }
}

function vectorFromResult(vector: unknown): number[] {
  if (Array.isArray(vector) && vector.every((value) => typeof value === 'number')) {
    return vector;
  }

  return [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numberValue = asNumber(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toVectorStoreError(error: unknown, fallbackMessage: string): VectorStoreError {
  const message = error instanceof Error ? `${fallbackMessage}: ${error.message}` : fallbackMessage;
  return new VectorStoreError(message);
}
