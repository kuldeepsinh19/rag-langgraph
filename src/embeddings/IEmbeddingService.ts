export interface EmbedBatchOptions {
  filename?: string;
}

export interface IEmbeddingService {
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[], options?: EmbedBatchOptions): Promise<number[][]>;
  readonly dimensions: number;
  readonly model: string;
}
