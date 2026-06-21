import { Pool } from 'pg';
import { VectorStoreError } from '../../common/errors';
import type { ScoredChunk, SearchOpts, VectorChunk } from '../../common/types';
import type { IVectorStore } from '../IVectorStore';

interface ChunkRow {
  id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  text: string;
  embedding?: string | number[];
  page_number: number | null;
  sheet_name: string | null;
  score: string | number;
}

export class PgVectorStore implements IVectorStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }

  async upsert(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const query = `
      INSERT INTO chunks (
        id,
        document_id,
        filename,
        chunk_index,
        text,
        embedding,
        page_number,
        sheet_name
      )
      SELECT
        id,
        document_id,
        filename,
        chunk_index,
        text,
        embedding::vector,
        page_number,
        sheet_name
      FROM unnest(
        $1::uuid[],
        $2::uuid[],
        $3::text[],
        $4::integer[],
        $5::text[],
        $6::text[],
        $7::integer[],
        $8::text[]
      ) AS source (
        id,
        document_id,
        filename,
        chunk_index,
        text,
        embedding,
        page_number,
        sheet_name
      )
      ON CONFLICT (id) DO UPDATE SET
        text = EXCLUDED.text,
        embedding = EXCLUDED.embedding,
        filename = EXCLUDED.filename,
        chunk_index = EXCLUDED.chunk_index,
        page_number = EXCLUDED.page_number,
        sheet_name = EXCLUDED.sheet_name
    `;

    try {
      await this.pool.query(query, [
        chunks.map((chunk) => chunk.id),
        chunks.map((chunk) => chunk.metadata.documentId),
        chunks.map((chunk) => chunk.metadata.filename),
        chunks.map((chunk) => chunk.metadata.chunkIndex),
        chunks.map((chunk) => chunk.text),
        chunks.map((chunk) => formatVector(chunk.embedding)),
        chunks.map((chunk) => chunk.metadata.pageNumber ?? null),
        chunks.map((chunk) => chunk.metadata.sheetName ?? null),
      ]);
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to upsert chunks into pgvector');
    }
  }

  async similaritySearch(embedding: number[], opts: SearchOpts): Promise<ScoredChunk[]> {
    const minScore = opts.minScore ?? 0;
    const lexicalQuery = opts.query?.trim();

    if (lexicalQuery) {
      return this.hybridSearch(embedding, minScore, opts.topK, lexicalQuery);
    }

    const query = `
      SELECT
        id,
        document_id,
        filename,
        chunk_index,
        text,
        embedding::text AS embedding,
        page_number,
        sheet_name,
        1 - (embedding <=> $1::vector) AS score
      FROM chunks
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    try {
      const result = await this.pool.query<ChunkRow>(query, [
        formatVector(embedding),
        minScore,
        opts.topK,
      ]);

      return result.rows.map(rowToScoredChunk);
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to search chunks in pgvector');
    }
  }

  private async hybridSearch(
    embedding: number[],
    minScore: number,
    topK: number,
    lexicalQuery: string,
  ): Promise<ScoredChunk[]> {
    const query = `
      WITH vector_results AS (
        SELECT
          id,
          document_id,
          filename,
          chunk_index,
          text,
          embedding::text AS embedding,
          page_number,
          sheet_name,
          1 - (embedding <=> $1::vector) AS vector_score,
          0::real AS lexical_score
        FROM chunks
        WHERE 1 - (embedding <=> $1::vector) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT GREATEST($3 * 4, 20)
      ),
      lexical_results AS (
        SELECT
          id,
          document_id,
          filename,
          chunk_index,
          text,
          embedding::text AS embedding,
          page_number,
          sheet_name,
          1 - (embedding <=> $1::vector) AS vector_score,
          ts_rank_cd(to_tsvector('english', text), plainto_tsquery('english', $4)) AS lexical_score
        FROM chunks
        WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $4)
        ORDER BY lexical_score DESC, embedding <=> $1::vector
        LIMIT GREATEST($3 * 4, 20)
      ),
      combined AS (
        SELECT * FROM vector_results
        UNION ALL
        SELECT * FROM lexical_results
      ),
      deduped AS (
        SELECT DISTINCT ON (id)
          id,
          document_id,
          filename,
          chunk_index,
          text,
          embedding,
          page_number,
          sheet_name,
          vector_score,
          lexical_score
        FROM combined
        ORDER BY id, lexical_score DESC, vector_score DESC
      )
      SELECT
        id,
        document_id,
        filename,
        chunk_index,
        text,
        embedding,
        page_number,
        sheet_name,
        GREATEST(vector_score, LEAST(1, 0.8 + lexical_score)) AS score
      FROM deduped
      ORDER BY lexical_score DESC, score DESC
      LIMIT $3
    `;

    try {
      const result = await this.pool.query<ChunkRow>(query, [
        formatVector(embedding),
        minScore,
        topK,
        lexicalQuery,
      ]);

      return result.rows.map(rowToScoredChunk);
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to hybrid search chunks in pgvector');
    }
  }

  async delete(documentId: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
    } catch (error) {
      throw toVectorStoreError(error, 'Failed to delete chunks from pgvector');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function parseVector(value: string | number[] | undefined): number[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .filter((part) => part.length > 0)
    .map(Number);
}

function rowToScoredChunk(row: ChunkRow): ScoredChunk {
  return {
    id: row.id,
    text: row.text,
    embedding: parseVector(row.embedding),
    score: Number(row.score),
    metadata: {
      documentId: row.document_id,
      filename: row.filename,
      chunkIndex: row.chunk_index,
      pageNumber: row.page_number ?? undefined,
      sheetName: row.sheet_name ?? undefined,
    },
  };
}

function toVectorStoreError(error: unknown, fallbackMessage: string): VectorStoreError {
  const message = error instanceof Error ? `${fallbackMessage}: ${error.message}` : fallbackMessage;
  return new VectorStoreError(message);
}
