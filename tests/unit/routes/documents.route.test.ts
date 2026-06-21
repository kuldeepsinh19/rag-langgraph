import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';
import { createDocumentsRoute } from '../../../src/api/routes/documents.route';
import { AppError } from '../../../src/common/errors';
import type { IDocumentRepository } from '../../../src/documents/IDocumentRepository';
import type { IVectorStore } from '../../../src/vectorstore/IVectorStore';
import type { DocumentRecord } from '../../../src/common/types';

describe('Documents Route', () => {
  let mockDocRepo: Partial<IDocumentRepository>;
  let mockVectorStore: Partial<IVectorStore>;
  let router: Router;

  const mockDocuments: DocumentRecord[] = [
    {
      id: 'doc1',
      filename: 'test1.pdf',
      uploadedAt: new Date('2026-01-01'),
      chunkCount: 5,
    },
    {
      id: 'doc2',
      filename: 'test2.docx',
      uploadedAt: new Date('2026-01-02'),
      chunkCount: 3,
    },
  ];

  beforeEach(() => {
    mockDocRepo = {
      findAll: vi.fn().mockResolvedValue(mockDocuments),
      findById: vi.fn().mockResolvedValue(mockDocuments[0]),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockVectorStore = {
      delete: vi.fn().mockResolvedValue(undefined),
    };

    router = createDocumentsRoute(
      mockDocRepo as IDocumentRepository,
      mockVectorStore as IVectorStore,
    );
  });

  it('should list all documents', async () => {
    const result = await mockDocRepo.findAll!();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mockDocuments[0]);
  });

  it('should return empty array when no documents exist', async () => {
    mockDocRepo.findAll = vi.fn().mockResolvedValue([]);

    const result = await mockDocRepo.findAll!();
    expect(result).toHaveLength(0);
  });

  it('should find document by ID', async () => {
    const result = await mockDocRepo.findById!('doc1');
    expect(result).toEqual(mockDocuments[0]);
    expect(mockDocRepo.findById).toHaveBeenCalledWith('doc1');
  });

  it('should return null when document not found', async () => {
    mockDocRepo.findById = vi.fn().mockResolvedValue(null);

    const result = await mockDocRepo.findById!('nonexistent');
    expect(result).toBeNull();
  });

  it('should delete document and its embeddings', async () => {
    await mockVectorStore.delete!('doc1');
    await mockDocRepo.delete!('doc1');

    expect(mockVectorStore.delete).toHaveBeenCalledWith('doc1');
    expect(mockDocRepo.delete).toHaveBeenCalledWith('doc1');
  });

  it('should handle vector store deletion errors gracefully', async () => {
    mockVectorStore.delete = vi.fn().mockRejectedValue(new Error('Vector store error'));

    try {
      await mockVectorStore.delete!('doc1');
      expect.fail('Should have thrown error');
    } catch (err: any) {
      expect(err.message).toBe('Vector store error');
    }
  });

  it('should handle document repository deletion errors gracefully', async () => {
    mockDocRepo.delete = vi.fn().mockRejectedValue(new Error('Database error'));

    try {
      await mockDocRepo.delete!('doc1');
      expect.fail('Should have thrown error');
    } catch (err: any) {
      expect(err.message).toBe('Database error');
    }
  });
});
