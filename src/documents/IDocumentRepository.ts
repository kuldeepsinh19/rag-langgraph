import type { DocumentRecord } from '../common/types';

export interface IDocumentRepository {
  create(filename: string, mimeType: string): Promise<DocumentRecord>;
  updateStatus(
    id: string,
    status: DocumentRecord['status'],
    chunkCount?: number,
    error?: string,
  ): Promise<void>;
  findAll(): Promise<DocumentRecord[]>;
  findById(id: string): Promise<DocumentRecord | null>;
  delete(id: string): Promise<void>;
}
