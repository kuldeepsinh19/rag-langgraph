import type { Config } from '../common/config';
import type { IVectorStore } from './IVectorStore';
import { PgVectorStore } from './pgvector/PgVectorStore';
import { QdrantVectorStore } from './qdrant/QdrantVectorStore';

export function createVectorStore(config: Config, embedderDimensions: number): IVectorStore {
  switch (config.VECTOR_STORE) {
    case 'pgvector':
      return new PgVectorStore(config.DATABASE_URL);
    case 'qdrant':
      return new QdrantVectorStore(
        config.QDRANT_URL,
        config.QDRANT_COLLECTION,
        embedderDimensions,
      );
    default:
      throw new Error(`Unknown vector store: ${config.VECTOR_STORE satisfies never}`);
  }
}
