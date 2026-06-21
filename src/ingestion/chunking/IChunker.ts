import type { ChunkMetadata, VectorChunk } from '../../common/types';

export interface IChunker {
  chunk(text: string, metadata: Omit<ChunkMetadata, 'chunkIndex'>): VectorChunk[];
}
