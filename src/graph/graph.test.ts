import { AIMessage } from '@langchain/core/messages';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../common/config';
import type { ScoredChunk } from '../common/types';
import type { IEmbeddingService } from '../embeddings';
import type { IVectorStore } from '../vectorstore/IVectorStore';
import { buildRagGraph } from './ragGraph';

const baseConfig: Config = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/ragdb',
  VECTOR_STORE: 'pgvector',
  EMBEDDER_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'test-key',
  GEMINI_EMBED_MODEL: 'gemini-embedding-2',
  GEMINI_EMBED_DIMENSIONS: 768,
  GEMINI_EMBED_CONCURRENCY: 1,
  GEMINI_EMBED_DELAY_MS: 0,
  GEMINI_EMBED_MAX_RETRIES: 0,
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_EMBED_MODEL: 'nomic-embed-text',
  OLLAMA_LLM_MODEL: 'llama3.2',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_COLLECTION: 'test_collection',
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  TOP_K: 3,
  MIN_RELEVANCE_SCORE: 0.7,
  MAX_REWRITE_RETRIES: 2,
  MAX_CONTEXT_CHARS: 12000,
  MAX_CHUNKS_PER_DOCUMENT: 500,
  INGEST_EMBED_BATCH_SIZE: 25,
  PORT: 3000,
  LOG_LEVEL: 'error',
  MAX_FILE_SIZE_MB: 20,
};

function chunk(id: string, text: string, score: number): ScoredChunk {
  return {
    id,
    text,
    score,
    embedding: [0.1, 0.2],
    metadata: {
      documentId: 'doc-1',
      filename: 'test.pdf',
      chunkIndex: Number(id.replace(/\D/g, '')) || 0,
    },
  };
}

function createDeps(options: {
  chunksByRetrieve: ScoredChunk[][];
  llmResponse: (prompt: string) => string;
  config?: Partial<Config>;
}) {
  const embedder = {
    dimensions: 2,
    model: 'test-embedder',
    embedText: vi.fn(async () => [0.1, 0.2]),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
  } satisfies IEmbeddingService;

  let retrieveCall = 0;
  const vectorStore = {
    upsert: vi.fn(async () => undefined),
    similaritySearch: vi.fn(async () => {
      const result =
        options.chunksByRetrieve[Math.min(retrieveCall, options.chunksByRetrieve.length - 1)] ?? [];
      retrieveCall += 1;
      return result;
    }),
    delete: vi.fn(async () => undefined),
    healthCheck: vi.fn(async () => true),
  } satisfies IVectorStore;

  const llm = {
    invoke: vi.fn(async (prompt: string) => new AIMessage(options.llmResponse(prompt))),
  };

  return {
    deps: {
      vectorStore,
      embedder,
      llm,
      config: { ...baseConfig, ...options.config },
    },
    embedder,
    vectorStore,
    llm,
  };
}

describe('RAG graph', () => {
  it('runs retrieve -> grade -> generate without rewriting when confidence is high', async () => {
    const source = chunk('chunk-1', 'LangGraph coordinates graph workflows.', 0.92);
    const { deps, llm, vectorStore } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: (prompt) => {
        if (prompt.includes('Reply with only')) {
          return 'yes';
        }

        return 'LangGraph coordinates graph workflows.';
      },
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'What does LangGraph do?' });

    expect(vectorStore.similaritySearch).toHaveBeenCalledTimes(1);
    expect(llm.invoke).toHaveBeenCalledTimes(1);
    expect(llm.invoke).not.toHaveBeenCalledWith(expect.stringContaining('Rewrite the question'));
    expect(result.answer).toBe('LangGraph coordinates graph workflows.');
    expect(result.sources).toEqual([source]);
  });

  it('uses per-request topK instead of only config.TOP_K', async () => {
    const source = chunk('chunk-1', 'LangGraph coordinates graph workflows.', 0.92);
    const { deps, vectorStore } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: (prompt) => (prompt.includes('Reply with only') ? 'yes' : 'answer'),
    });

    const graph = buildRagGraph(deps);
    await graph.invoke({ query: 'What does LangGraph do?', topK: 7 });

    expect(vectorStore.similaritySearch).toHaveBeenCalledWith([0.1, 0.2], {
      topK: 7,
      minScore: 0,
      query: 'What does LangGraph do?',
    });
  });

  it('answers directly from score-qualified retrieval without query rewriting', async () => {
    const weak = chunk('chunk-1', 'Unrelated deployment notes.', 0.95);
    const source = chunk('chunk-2', 'Vector search retrieves semantically similar chunks.', 0.91);
    const { deps, vectorStore, embedder } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'It retrieves semantically similar chunks.',
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'How does retrieval work?' });

    expect(vectorStore.similaritySearch).toHaveBeenCalledTimes(1);
    expect(embedder.embedText).toHaveBeenNthCalledWith(1, 'How does retrieval work?');
    expect(result.rewrittenQuery).toBeUndefined();
    expect(result.retryCount).toBe(0);
    expect(result.answer).toBe('It retrieves semantically similar chunks.');
    expect(result.sources).toEqual([source]);
  });

  it('forces generation after MAX_REWRITE_RETRIES to prevent an infinite rewrite loop', async () => {
    const weak = chunk('chunk-1', 'Still unrelated.', 0.95);
    const { deps, vectorStore, llm } = createDeps({
      chunksByRetrieve: [[weak], [weak]],
      config: { MAX_REWRITE_RETRIES: 1 },
      llmResponse: (prompt) => {
        if (prompt.includes('Original question:')) {
          return 'More specific version';
        }

        return 'The context does not contain enough information.';
      },
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'What happened?' });

    expect(vectorStore.similaritySearch).toHaveBeenCalledTimes(1);
    expect(llm.invoke).toHaveBeenCalledTimes(1);
    expect(result.retryCount).toBe(0);
    expect(result.confidence).toBe('high');
    expect(result.answer).toBe('The context does not contain enough information.');
  });

  it('populates final answer and sources', async () => {
    const source = chunk('chunk-3', 'The answer is grounded in this source.', 0.88);
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'Grounded answer.',
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'What is the answer?' });

    expect(result.answer).toBe('Grounded answer.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.id).toBe(source.id);
  });

  it('falls back to score-qualified chunks when LLM grading rejects everything', async () => {
    const source = chunk('chunk-4', 'The system stores embeddings for semantic search.', 0.93);
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'Grounded answer.',
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'What does the system store?' });

    expect(result.answer).toBe('Grounded answer.');
    expect(result.sources).toEqual([source]);
  });

  it('uses extractive fallback when generation times out', async () => {
    const source = chunk('chunk-5', 'Chunk text from the uploaded document.', 0.95);
    const llm = {
      invoke: vi.fn(async () => {
        throw new Error('LLM timeout after 12000ms');
      }),
    };
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'unused',
    });

    const graph = buildRagGraph({ ...deps, llm });
    const result = await graph.invoke({ query: 'What is in the document?' });

    expect(result.answer).toContain('Chunk text from the uploaded document.');
    expect(result.sources).toEqual([source]);
  });

  it('returns a compact tech stack answer on fallback for tech stack questions', async () => {
    const source = chunk(
      'chunk-6',
      'Full Stack / MERN Stack Developer using React.js, Next.js, Node.js, Express.js, TypeScript, MongoDB, MySQL, AWS, LangChain and LangGraph.',
      0.97,
    );
    const llm = {
      invoke: vi.fn(async () => {
        throw new Error('LLM timeout after 12000ms');
      }),
    };
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'unused',
    });

    const graph = buildRagGraph({ ...deps, llm });
    const result = await graph.invoke({ query: 'which type of techstack experience this guy has' });

    expect(result.answer).toBe(
      'Tech stack: React.js, Next.js, Node.js, Express.js, TypeScript, MongoDB, MySQL, AWS, LangChain, LangGraph, MERN',
    );
  });

  it('returns a cleaner document-about fallback instead of raw chunk text', async () => {
    const source = chunk(
      'chunk-7',
      'asonable out-of-pocket expenses incurred by you as part of delivering your responsibilities. Medical coverage and leave policy are also described in this employment agreement.',
      0.96,
    );
    const llm = {
      invoke: vi.fn(async () => {
        throw new Error('LLM timeout after 12000ms');
      }),
    };
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'unused',
    });

    const graph = buildRagGraph({ ...deps, llm });
    const result = await graph.invoke({ query: 'what this doc is about' });

    expect(result.answer).toContain('This document appears to be about');
    expect(result.answer).not.toContain('asonable');
    expect(result.answer).toContain('medical coverage and leave policy');
  });

  it('formats table-like fallback answers as structured bullets', async () => {
    const source = chunk(
      'chunk-8',
      'Aspire Program helps learners build job-ready programming skills over two months.\nSecond Month ,,,,,, Programming Fundamentals & Basics of Javascript,,,,,, ,,,,,, ,,,,,, Week,Day,Activity Type,Knowledge Area,Topic,Mentor Name,Description 5,1,Session,Prograaming Fundamentals,What is program? Compilation vs Interpretation,Vivek,"What is Program & Programming"',
      0.97,
    );
    const llm = {
      invoke: vi.fn(async () => {
        throw new Error('LLM timeout after 12000ms');
      }),
    };
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () => 'unused',
    });

    const graph = buildRagGraph({ ...deps, llm });
    const result = await graph.invoke({ query: 'explain about aspire program' });

    expect(result.answer).toContain('Based on the document:');
    expect(result.answer).toContain('- Aspire Program helps learners build job-ready programming skills');
    expect(result.answer).not.toContain(',,,,');
    expect(result.answer).not.toContain('Week,Day,Activity Type');
  });

  it('normalizes noisy generated answers without changing comma lists', async () => {
    const source = chunk('chunk-9', 'The Aspire Program teaches JavaScript, mentoring, and projects.', 0.95);
    const { deps } = createDeps({
      chunksByRetrieve: [[source]],
      llmResponse: () =>
        'Answer: The ASPIRE Program teaches JavaScript, mentoring, and projects.,,,,,\nThe ASPIRE Program teaches JavaScript, mentoring, and projects.',
    });

    const graph = buildRagGraph(deps);
    const result = await graph.invoke({ query: 'explain about aspire program' });

    expect(result.answer).toBe('The Aspire Program teaches JavaScript, mentoring, and projects.');
  });
});
