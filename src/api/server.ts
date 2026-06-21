// Import this at the very top before any route registration
import 'express-async-errors';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { Pool } from 'pg';
import { config } from '../common/config';
import { logger } from '../common/logger';

// Import route factories
import { createUploadRoute } from './routes/upload.route';
import { createQueryRoute } from './routes/query.route';
import { createDocumentsRoute } from './routes/documents.route';

// Import middleware
import { errorHandler } from './middleware';

// Import service factories
import { createEmbedder } from '../embeddings/EmbedderFactory';
import { createVectorStore } from '../vectorstore/VectorStoreFactory';
import { createChunker } from '../ingestion/chunking/chunking.config';
import { PgDocumentRepository } from '../documents/PgDocumentRepository';
import { IngestionService } from '../ingestion/IngestionService';
import { buildRagGraph } from '../graph/ragGraph';

// Create Express app
const app = express();

// ============================================================================
// CORS Configuration (Enable frontend access)
// ============================================================================
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5500'],
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(pinoHttp({ logger }));
app.use(express.json());

// ============================================================================
// PHASE 8 & 9: Initialize all dependencies
// ============================================================================

// Step 1: Create database pool for document repository
const pgPool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Step 2: Create services
const embedder = createEmbedder(config);
const vectorStore = createVectorStore(config, embedder.dimensions);
const chunker = createChunker(config);
const docRepo = new PgDocumentRepository(pgPool);
const ingestionService = new IngestionService(docRepo, vectorStore, embedder, chunker);
const ragGraph = buildRagGraph({ vectorStore, embedder, config });

logger.info('All services initialized');

// ============================================================================
// PHASE 9: Process-level error guards (Step 1)
// ============================================================================

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err: any) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

// ============================================================================
// PHASE 9: Startup health checks (Step 2)
// ============================================================================

async function checkStartupHealth() {
  try {
    // Check vector store
    const vectorStoreOk = await vectorStore.healthCheck();
    if (vectorStoreOk) {
      logger.info('Vector store health check: OK');
    } else {
      logger.warn('Vector store health check: FAILED (continuing in dev mode)');
    }
  } catch (err) {
    logger.warn({ err }, 'Vector store not ready yet (this is OK in dev)');
  }
}

// ============================================================================
// PHASE 8: Register routes
// ============================================================================

// Health check route
app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vectorStoreHealthy = await vectorStore.healthCheck();
    res.status(200).json({
      status: 'ok',
      vectorStore: config.VECTOR_STORE,
      embedder: 'ollama',
      services: { vectorStore: vectorStoreHealthy },
    });
  } catch (err) {
    next(err);
  }
});

// Register routes with their specific middleware
app.use(createUploadRoute(ingestionService));  // Upload route has /upload path
app.use(createQueryRoute(ragGraph));  // Query route has /query path
app.use(createDocumentsRoute(docRepo, vectorStore));  // Documents route has /documents path

// Error handler MUST be registered last
app.use(errorHandler);

// ============================================================================
// PHASE 9: Start server with graceful shutdown (Step 3)
// ============================================================================

export async function startServer() {
  // Run health checks before starting
  await checkStartupHealth();

  const httpServer = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Server started');
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down gracefully');
    httpServer.close(() => {
      logger.info('HTTP server closed');
      pgPool.end().then(() => {
        logger.info('Database pool closed');
        process.exit(0);
      });
    });
  });

  return httpServer;
}

// Start server if this is the main module
if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export { app };
