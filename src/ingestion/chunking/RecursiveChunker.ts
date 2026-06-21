import { createHash } from 'node:crypto';
import type { ChunkMetadata, VectorChunk } from '../../common/types';
import type { IChunker } from './IChunker';

type Splitter = (text: string) => string[];

const splitters: Splitter[] = [
  (text) => text.split(/\n{2,}/),
  (text) => text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text],
  (text) => text.split(/\n/),
  (text) => text.split(/ /),
];

export class RecursiveChunker implements IChunker {
  constructor(
    private readonly chunkSize: number,
    private readonly chunkOverlap: number,
  ) {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error('chunkSize must be a positive integer');
    }

    if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0) {
      throw new Error('chunkOverlap must be a non-negative integer');
    }

    if (chunkOverlap >= chunkSize) {
      throw new Error('chunkOverlap must be smaller than chunkSize');
    }
  }

  chunk(text: string, metadata: Omit<ChunkMetadata, 'chunkIndex'>): VectorChunk[] {
    const normalizedText = text.trim();

    if (normalizedText.length === 0) {
      throw new Error('Text is empty — nothing to chunk');
    }

    const pieces = this.splitRecursively(normalizedText).filter((piece) => piece.trim().length > 0);
    const chunkTexts = this.packPieces(pieces);

    return chunkTexts.map((chunkText, chunkIndex) => ({
      id: createChunkId(metadata.documentId, chunkIndex, chunkText),
      text: chunkText,
      embedding: [],
      metadata: {
        ...metadata,
        chunkIndex,
      },
    }));
  }

  private splitRecursively(text: string, splitterIndex = 0): string[] {
    const trimmedText = text.trim();

    if (trimmedText.length <= this.chunkSize) {
      return [trimmedText];
    }

    const splitter = splitters[splitterIndex];

    if (!splitter) {
      return splitByCharacters(trimmedText, this.chunkSize);
    }

    const parts = splitter(trimmedText)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length <= 1) {
      return this.splitRecursively(trimmedText, splitterIndex + 1);
    }

    return parts.flatMap((part) => this.splitRecursively(part, splitterIndex + 1));
  }

  private packPieces(pieces: string[]): string[] {
    const chunksWithoutOverlap: string[] = [];
    let current = '';

    for (const piece of pieces) {
      if (piece.length > this.chunkSize) {
        throw new Error('Internal chunking error: split piece exceeds chunkSize');
      }

      if (current.length === 0) {
        current = piece;
        continue;
      }

      const separator = needsSpace(current, piece) ? ' ' : '';
      const candidate = `${current}${separator}${piece}`;

      if (candidate.length <= this.chunkSize) {
        current = candidate;
        continue;
      }

      chunksWithoutOverlap.push(current);
      current = piece;
    }

    if (current.length > 0) {
      chunksWithoutOverlap.push(current);
    }

    return chunksWithoutOverlap
      .map((chunk, index) => {
        if (index === 0 || this.chunkOverlap === 0) {
          return chunk;
        }

        const overlap = chunksWithoutOverlap[index - 1]?.slice(-this.chunkOverlap) ?? '';
        const shouldAddSeparator =
          needsSpace(overlap, chunk) && overlap.length + 1 + chunk.length <= this.chunkSize + this.chunkOverlap;
        const separator = shouldAddSeparator ? ' ' : '';
        return `${overlap}${separator}${chunk}`;
      })
      .filter((chunk) => chunk.trim().length > 0);
  }
}

function splitByCharacters(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

function needsSpace(left: string, right: string): boolean {
  return left.length > 0 && right.length > 0 && !/\s$/.test(left) && !/^\s/.test(right);
}

function createChunkId(documentId: string, chunkIndex: number, text: string): string {
  const hash = createHash('sha256').update(`${documentId}:${chunkIndex}:${text}`).digest('hex');
  const uuidHex = `${hash.slice(0, 12)}4${hash.slice(13, 16)}8${hash.slice(17, 32)}`;

  return [
    uuidHex.slice(0, 8),
    uuidHex.slice(8, 12),
    uuidHex.slice(12, 16),
    uuidHex.slice(16, 20),
    uuidHex.slice(20, 32),
  ].join('-');
}
