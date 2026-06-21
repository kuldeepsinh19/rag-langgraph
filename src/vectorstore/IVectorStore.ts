import type { ScoredChunk, SearchOpts, VectorChunk } from '../common/types';

export interface IVectorStore {
  upsert(chunks: VectorChunk[]): Promise<void>;
  similaritySearch(embedding: number[], opts: SearchOpts): Promise<ScoredChunk[]>;
  delete(documentId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
