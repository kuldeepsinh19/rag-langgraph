import 'dotenv/config';
import { z } from 'zod';

const numberFromEnv = (defaultValue: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === '') {
        return defaultValue;
      }

      if (typeof value === 'string') {
        return Number(value);
      }

      return value;
    },
    z.number().finite(),
  );

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    VECTOR_STORE: z.enum(['pgvector', 'qdrant']),
    EMBEDDER_PROVIDER: z.enum(['gemini', 'ollama']).default('gemini'),
    GEMINI_API_KEY: z.string().default(''),
    GEMINI_EMBED_MODEL: z.string().min(1).default('gemini-embedding-2'),
    GEMINI_EMBED_DIMENSIONS: numberFromEnv(768).pipe(z.number().int().positive()),
    GEMINI_EMBED_CONCURRENCY: numberFromEnv(1).pipe(z.number().int().positive()),
    GEMINI_EMBED_DELAY_MS: numberFromEnv(1000).pipe(z.number().int().min(0)),
    GEMINI_EMBED_MAX_RETRIES: numberFromEnv(3).pipe(z.number().int().min(0)),
    OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
    OLLAMA_EMBED_MODEL: z.string().min(1).default('nomic-embed-text'),
    OLLAMA_LLM_MODEL: z.string().min(1).default('llama3.2'),
    // Qdrant fields are optional and only validated when VECTOR_STORE=qdrant
    QDRANT_URL: z.string().url().default('http://localhost:6333'),
    QDRANT_COLLECTION: z.string().min(1).default('rag_chunks'),
    CHUNK_SIZE: numberFromEnv(3000).pipe(z.number().int().positive()),
    CHUNK_OVERLAP: numberFromEnv(300).pipe(z.number().int().min(0)),
    TOP_K: numberFromEnv(8).pipe(z.number().int().positive()),
    MIN_RELEVANCE_SCORE: numberFromEnv(0.3).pipe(z.number().min(0).max(1)),
    MAX_REWRITE_RETRIES: numberFromEnv(2).pipe(z.number().int().min(0)),
    MAX_CONTEXT_CHARS: numberFromEnv(12000).pipe(z.number().int().positive()),
    MAX_CHUNKS_PER_DOCUMENT: numberFromEnv(500).pipe(z.number().int().positive()),
    INGEST_EMBED_BATCH_SIZE: numberFromEnv(25).pipe(z.number().int().positive()),
    PORT: numberFromEnv(3000).pipe(z.number().int().positive()),
    LOG_LEVEL: z.enum(['info', 'debug', 'warn', 'error']).default('info'),
    MAX_FILE_SIZE_MB: numberFromEnv(20).pipe(z.number().positive()),
  })
  .refine(
    (data) => {
      // Validate chunk overlap is less than chunk size
      if (data.CHUNK_OVERLAP >= data.CHUNK_SIZE) {
        throw new Error('CHUNK_OVERLAP must be less than CHUNK_SIZE');
      }
      if (data.EMBEDDER_PROVIDER === 'gemini' && !data.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required when EMBEDDER_PROVIDER=gemini');
      }
      return true;
    },
    {
      message: 'CHUNK_OVERLAP must be less than CHUNK_SIZE',
    },
  );

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration: ${details}`);
}

export interface Config {
  DATABASE_URL: string;
  VECTOR_STORE: 'pgvector' | 'qdrant';
  EMBEDDER_PROVIDER: 'gemini' | 'ollama';
  GEMINI_API_KEY: string;
  GEMINI_EMBED_MODEL: string;
  GEMINI_EMBED_DIMENSIONS: number;
  GEMINI_EMBED_CONCURRENCY: number;
  GEMINI_EMBED_DELAY_MS: number;
  GEMINI_EMBED_MAX_RETRIES: number;
  OLLAMA_BASE_URL: string;
  OLLAMA_EMBED_MODEL: string;
  OLLAMA_LLM_MODEL: string;
  QDRANT_URL: string;
  QDRANT_COLLECTION: string;
  CHUNK_SIZE: number;
  CHUNK_OVERLAP: number;
  TOP_K: number;
  MIN_RELEVANCE_SCORE: number;
  MAX_REWRITE_RETRIES: number;
  MAX_CONTEXT_CHARS: number;
  MAX_CHUNKS_PER_DOCUMENT: number;
  INGEST_EMBED_BATCH_SIZE: number;
  PORT: number;
  LOG_LEVEL: 'info' | 'debug' | 'warn' | 'error';
  MAX_FILE_SIZE_MB: number;
}

export const config: Config = {
  ...parsedEnv.data,
};
