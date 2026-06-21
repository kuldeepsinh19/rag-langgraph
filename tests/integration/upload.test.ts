import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../../../src/api/server';

describe('POST /upload integration test', () => {
  let uploadedDocumentId: string;

  // Create a minimal PDF buffer for testing
  const createMinimalPdfBuffer = (): Buffer => {
    const pdfHeader = '%PDF-1.4\n';
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000219 00000 n 
0000000317 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
396
%%EOF`;

    return Buffer.from(pdfContent, 'utf8');
  };

  it('should upload a valid PDF file and return 201', async () => {
    const pdfBuffer = createMinimalPdfBuffer();

    const response = await request(app)
      .post('/upload')
      .attach('file', pdfBuffer, 'test.pdf');

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('documentId');
    expect(response.body).toHaveProperty('chunkCount');
    expect(response.body).toHaveProperty('filename');
    expect(response.body.filename).toBe('test.pdf');
    expect(response.body.chunkCount).toBeGreaterThanOrEqual(0);

    uploadedDocumentId = response.body.documentId;
  });

  it('should reject unsupported file type with 400', async () => {
    const imageBuffer = Buffer.from('fake image data');

    const response = await request(app)
      .post('/upload')
      .attach('file', imageBuffer, 'image.png');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UNSUPPORTED_TYPE');
  });

  it('should reject missing file with 400', async () => {
    const response = await request(app).post('/upload').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('NO_FILE');
  });

  it('should handle file with path traversal attempt in name', async () => {
    const pdfBuffer = createMinimalPdfBuffer();

    const response = await request(app)
      .post('/upload')
      .attach('file', pdfBuffer, '../../../etc/passwd.pdf');

    expect(response.status).toBe(201);
    // Filename should be sanitized to just "passwd.pdf"
    expect(response.body.filename).toBe('passwd.pdf');
  });

  describe('GET /documents', () => {
    it('should return list of documents', async () => {
      const response = await request(app).get('/documents');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documents');
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(response.body.documents.length);
    });
  });

  describe('DELETE /documents/:id', () => {
    it('should delete uploaded document and return 200', async () => {
      if (!uploadedDocumentId) {
        console.log('Skipping: no uploaded document');
        return;
      }

      const response = await request(app).delete(`/documents/${uploadedDocumentId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Document deleted');
      expect(response.body.documentId).toBe(uploadedDocumentId);
    });

    it('should return 404 when deleting non-existent document', async () => {
      const response = await request(app).delete('/documents/nonexistent-id-12345');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });
});
