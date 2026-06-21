import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gradeDocumentsNode } from '../../../src/graph/nodes/gradeDocuments.node';
import { RagState } from '../../../src/graph/state';
import { ScoredChunk } from '../../../src/common/types';
import { Config } from '../../../src/common/config';

describe('gradeDocuments node', () => {
  let mockChunk1: ScoredChunk;
  let mockChunk2: ScoredChunk;
  let mockState: RagState;
  let mockConfig: Partial<Config>;

  beforeEach(() => {
    mockChunk1 = {
      id: 'chunk1',
      text: 'AI is artificial intelligence.',
      embedding: [],
      score: 0.9,
      metadata: { documentId: 'doc1', filename: 'test.txt', chunkIndex: 0 },
    };

    mockChunk2 = {
      id: 'chunk2',
      text: 'Machine learning is a subset of AI.',
      embedding: [],
      score: 0.85,
      metadata: { documentId: 'doc1', filename: 'test.txt', chunkIndex: 1 },
    };

    mockState = {
      query: 'what is AI?',
      retrievedChunks: [mockChunk1, mockChunk2],
      retryCount: 0,
    };

    mockConfig = { MAX_REWRITE_RETRIES: 2, MIN_RELEVANCE_SCORE: 0.5, TOP_K: 5 };
  });

  it('should include chunks above the score threshold', async () => {
    const result = await gradeDocumentsNode(mockState, {
      vectorStore: {} as any,
      embedder: {} as any,
      config: mockConfig as Config,
    });

    expect(result.gradedChunks?.length).toBe(2);
    expect(result.confidence).toBe('high');
  });

  it('should use retrieved chunks as fallback when all scores are below threshold', async () => {
    mockChunk1.score = 0.2;
    mockChunk2.score = 0.3;
    const result = await gradeDocumentsNode(mockState, {
      vectorStore: {} as any,
      embedder: {} as any,
      config: mockConfig as Config,
    });

    expect(result.gradedChunks?.length).toBe(2);
    expect(result.confidence).toBe('high');
  });

  it('should keep only score-qualified chunks', async () => {
    mockChunk2.score = 0.4;
    const result = await gradeDocumentsNode(mockState, {
      vectorStore: {} as any,
      embedder: {} as any,
      config: mockConfig as Config,
    });

    expect(result.gradedChunks?.length).toBe(1);
    expect(result.gradedChunks?.[0]?.id).toBe('chunk1');
  });

  it('should use request minScore when provided in state', async () => {
    mockState.minScore = 0.9;
    const result = await gradeDocumentsNode(mockState, {
      vectorStore: {} as any,
      embedder: {} as any,
      config: mockConfig as Config,
    });

    expect(result.gradedChunks?.length).toBe(1);
    expect(result.gradedChunks?.[0]?.id).toBe('chunk1');
  });

  it('should handle empty retrieved chunks', async () => {
    mockState.retrievedChunks = [];
    const result = await gradeDocumentsNode(mockState, {
      vectorStore: {} as any,
      embedder: {} as any,
      config: mockConfig as Config,
    });

    expect(result.gradedChunks?.length).toBe(0);
    expect(result.confidence).toBe('low');
  });
});
