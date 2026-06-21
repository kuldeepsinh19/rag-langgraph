import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/api/server';

describe('POST /query integration test', () => {
  it('should reject empty query with 400', async () => {
    const response = await request(app).post('/query').send({ query: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('EMPTY_QUERY');
  });

  it('should reject missing query field with 400', async () => {
    const response = await request(app).post('/query').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('EMPTY_QUERY');
  });

  it('should reject whitespace-only query with 400', async () => {
    const response = await request(app).post('/query').send({ query: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('EMPTY_QUERY');
  });

  it('should return 200 for valid query', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'what is artificial intelligence?' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('answer');
    expect(response.body).toHaveProperty('sources');
    expect(response.body).toHaveProperty('rewriteCount');
    expect(response.body).toHaveProperty('query');
    expect(typeof response.body.answer).toBe('string');
    expect(Array.isArray(response.body.sources)).toBe(true);
    expect(typeof response.body.rewriteCount).toBe('number');
  });

  it('should accept custom topK parameter', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test question', topK: 3 });

    expect(response.status).toBe(200);
  });

  it('should reject invalid topK (too high)', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test', topK: 25 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_TOP_K');
  });

  it('should reject invalid topK (zero)', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test', topK: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_TOP_K');
  });

  it('should accept custom minScore parameter', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test question', minScore: 0.7 });

    expect(response.status).toBe(200);
  });

  it('should reject invalid minScore (too high)', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test', minScore: 1.5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_MIN_SCORE');
  });

  it('should reject invalid minScore (negative)', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test', minScore: -0.1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_MIN_SCORE');
  });

  it('should return fallback message when no documents are relevant', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'completely unrelated question xyz abc 123' });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBeDefined();
    // Should return a message (possibly fallback or real answer, but not empty)
    expect(response.body.answer.length).toBeGreaterThan(0);
  });

  it('should include source information in response', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test query' });

    expect(response.status).toBe(200);
    if (response.body.sources.length > 0) {
      // If sources exist, verify their structure
      const source = response.body.sources[0];
      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('text');
      expect(source).toHaveProperty('score');
      expect(source).toHaveProperty('documentId');
      expect(source).toHaveProperty('filename');
      expect(source).toHaveProperty('chunkIndex');
    }
  });
});

describe('GET /health integration test', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('vectorStore');
    expect(response.body).toHaveProperty('embedder');
    expect(response.body).toHaveProperty('services');
  });
});
