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
  EMBEDDER_PROVIDER: 'ollama';
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
  PORT: number;
  LOG_LEVEL: 'info' | 'debug' | 'warn' | 'error';
  MAX_FILE_SIZE_MB: number;
}

export const config: Config = {
  ...parsedEnv.data,
  EMBEDDER_PROVIDER: 'ollama',
};
