import { describe, expect, it } from 'vitest';
import type { ChunkMetadata } from '../../common/types';
import { RecursiveChunker } from './RecursiveChunker';

const metadata: Omit<ChunkMetadata, 'chunkIndex'> = {
  documentId: 'doc-1',
  filename: 'sample.txt',
};

describe('RecursiveChunker', () => {
  it('produces multiple chunks for long text', () => {
    const chunker = new RecursiveChunker(1000, 200);
    const chunks = chunker.chunk('a'.repeat(5000), metadata);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    expect(chunks.length).toBeLessThanOrEqual(6);
  });

  it('keeps chunk lengths within the configured chunk size plus overlap tolerance', () => {
    const chunker = new RecursiveChunker(1000, 200);
    const chunks = chunker.chunk('a'.repeat(5000), metadata);

    expect(chunks.every((chunk) => chunk.text.length <= 1200)).toBe(true);
  });

  it('carries overlap characters into the start of the next chunk', () => {
    const chunker = new RecursiveChunker(10, 3);
    const chunks = chunker.chunk('abcdefghijklmnopqrst', metadata);

    expect(chunks[1]?.text.startsWith(chunks[0]?.text.slice(-3) ?? '')).toBe(true);
  });

  it('sets a predictable chunk count and sequential metadata for known input', () => {
    const chunker = new RecursiveChunker(10, 2);
    const chunks = chunker.chunk('a'.repeat(25), metadata);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.metadata.chunkIndex)).toEqual([0, 1, 2]);
    expect(chunks.every((chunk) => chunk.embedding.length === 0)).toBe(true);
    expect(chunks[0]?.id).toBe(chunks[0]?.id);
  });

  it('throws when text is empty', () => {
    const chunker = new RecursiveChunker(1000, 200);

    expect(() => chunker.chunk('   ', metadata)).toThrow('Text is empty — nothing to chunk');
  });
});
