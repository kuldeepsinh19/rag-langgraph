import { logger } from '../../common/logger';

export interface QdrantCollectionClient {
  getCollection(collectionName: string): Promise<unknown>;
  createCollection(
    collectionName: string,
    options: { vectors: { size: number; distance: 'Cosine' } },
  ): Promise<unknown>;
}

export async function ensureQdrantCollection(
  client: QdrantCollectionClient,
  collectionName: string,
  dimensions: number,
): Promise<void> {
  try {
    await client.getCollection(collectionName);
    logger.info({ collectionName }, 'Qdrant collection already exists');
  } catch {
    await client.createCollection(collectionName, {
      vectors: {
        size: dimensions,
        distance: 'Cosine',
      },
    });
    logger.info({ collectionName, dimensions }, 'Created Qdrant collection');
  }
}
