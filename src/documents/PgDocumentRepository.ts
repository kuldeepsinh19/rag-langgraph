import type { Pool } from 'pg';
import type { DocumentRecord } from '../common/types';
import type { IDocumentRepository } from './IDocumentRepository';

interface DocumentRow {
  id: string;
  filename: string;
  mime_type: string;
  uploaded_at: Date | string;
  chunk_count: number;
  status: DocumentRecord['status'];
}

export class PgDocumentRepository implements IDocumentRepository {
  constructor(private readonly pool: Pool) {}

  async create(filename: string, mimeType: string): Promise<DocumentRecord> {
    const result = await this.pool.query<DocumentRow>(
      `
        INSERT INTO documents (filename, mime_type)
        VALUES ($1, $2)
        RETURNING *
      `,
      [filename, mimeType],
    );

    return mapRow(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: DocumentRecord['status'],
    chunkCount?: number,
    error?: string,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE documents
        SET
          status = $2,
          chunk_count = COALESCE($3, chunk_count),
          error = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [id, status, chunkCount ?? null, error ?? null],
    );
  }

  async findAll(): Promise<DocumentRecord[]> {
    const result = await this.pool.query<DocumentRow>(
      `
        SELECT *
        FROM documents
        ORDER BY uploaded_at DESC
      `,
    );

    return result.rows.map(mapRow);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const result = await this.pool.query<DocumentRow>(
      `
        SELECT *
        FROM documents
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
  }
}

function mapRow(row: DocumentRow | undefined): DocumentRecord {
  if (!row) {
    throw new Error('Document row was not returned from the database');
  }

  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at : new Date(row.uploaded_at),
    chunkCount: row.chunk_count,
    status: row.status,
  };
}
