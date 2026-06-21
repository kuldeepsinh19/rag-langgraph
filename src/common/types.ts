export interface VectorChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageNumber?: number;
  sheetName?: string;
}

export interface ScoredChunk extends VectorChunk {
  score: number;
}

export interface SearchOpts {
  topK: number;
  minScore?: number;
  query?: string;
  filter?: Record<string, unknown>;
}

export interface ParsedDocument {
  text: string;
  metadata: {
    title: string;
    pageCount?: number;
    sheetNames?: string[];
  };
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: Date;
  chunkCount: number;
  status: 'processing' | 'ready' | 'failed';
}
