# RAG System with LangGraph.js

A production-ready Retrieval-Augmented Generation (RAG) system built with TypeScript, LangGraph.js, Express, Gemini embeddings, PostgreSQL (pgvector), and Qdrant.

## Quick Start

### Prerequisites
- Node.js 22.10+
- Docker & Docker Compose
- npm 10+
- Google Gemini API key for embeddings

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Infrastructure
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** (pgvector extension) on port 5432
- **Qdrant** vector database on port 6333
- **Ollama** LLM service on port 11434

### 3. Initialize Database
```bash
# Create schema and tables
npm run db:init
```

### 4. Pull LLM Model (Ollama)
```bash
docker compose exec ollama ollama pull llama3.2
```

### 5. Set Environment Variables
Create `.env` file in project root:
```env
# Database
DATABASE_URL=postgres://raguser:ragpass@localhost:5432/ragdb

# Vector Store (pgvector or qdrant)
VECTOR_STORE=pgvector
QDRANT_URL=http://localhost:6333

# Embeddings & LLM
EMBEDDER_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_EMBED_MODEL=gemini-embedding-2
GEMINI_EMBED_DIMENSIONS=768
GEMINI_EMBED_CONCURRENCY=1
GEMINI_EMBED_DELAY_MS=1000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_LLM_MODEL=llama3.2

# API
PORT=3000
LOG_LEVEL=debug

# File Upload
MAX_FILE_SIZE_MB=20

# Graph
MAX_REWRITE_RETRIES=2
MIN_RELEVANCE_SCORE=0.5
```

Validate Gemini embeddings after adding your real key:
```bash
npm run gemini:validate
```

If this project already contains Ollama-generated vectors, clear them before re-ingesting documents. For pgvector, delete existing rows from `chunks`; for Qdrant, recreate the collection. Do not mix Ollama and Gemini embeddings in the same vector store.

### 6. Run Development Server
```bash
npm run dev
```

Server starts on http://localhost:3000

## API Endpoints

### POST /upload
Upload a document for ingestion
```bash
curl -F "file=@document.pdf" http://localhost:3000/upload
```

**Response:**
```json
{
  "documentId": "uuid",
  "filename": "document.pdf",
  "chunkCount": 15,
  "message": "File ingested successfully"
}
```

### POST /query
Ask a question about uploaded documents
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the main topic?",
    "topK": 5,
    "minScore": 0.5
  }'
```

**Response:**
```json
{
  "answer": "The main topic is...",
  "sources": [
    {
      "id": "chunk-id",
      "documentId": "doc-uuid",
      "text": "..."
    }
  ],
  "rewriteCount": 0
}
```

### GET /documents
List all uploaded documents
```bash
curl http://localhost:3000/documents
```

### DELETE /documents/:id
Remove a document and its embeddings
```bash
curl -X DELETE http://localhost:3000/documents/uuid
```

### GET /health
Health check
```bash
curl http://localhost:3000/health
```

## Testing

### Unit Tests (38 tests)
```bash
npm test
```

Tests included for:
- Parser factory (PDF, DOCX, DOC, XLSX)
- Query validation
- File validation
- Error handling
- Graph nodes (grade documents)
- Embeddings
- Document chunking

### Integration Tests (16 tests)
```bash
npm run test:integration
```

Tests included for:
- File upload with various formats
- Query execution end-to-end
- Document retrieval and deletion

### Coverage Report
```bash
npm run test:coverage
```

Target: 70% coverage on all metrics

## Project Structure

```
src/
├── api/                      # REST API layer
│   ├── server.ts            # Express app initialization
│   ├── middleware/          # Request validation & error handling
│   │   ├── validateFile.ts  # Multer file upload validation
│   │   ├── validateQuery.ts # Query parameter validation
│   │   └── errorHandler.ts  # Global error handler
│   └── routes/              # Route factories
│       ├── upload.route.ts  # POST /upload
│       ├── query.route.ts   # POST /query
│       └── documents.route.ts # GET/DELETE /documents

├── graph/                    # LangGraph RAG pipeline
│   ├── ragGraph.ts          # Graph definition & compilation
│   ├── state.ts             # State schema
│   ├── llm.ts               # LLM wrapper
│   ├── edges/               # Conditional routing
│   └── nodes/               # Graph nodes
│       ├── retrieve.node.ts         # Vector search
│       ├── gradeDocuments.node.ts   # LLM-based relevance grading
│       ├── rewriteQuery.node.ts     # Query rewriting
│       └── generate.node.ts         # Final answer generation

├── ingestion/               # Document processing pipeline
│   ├── IngestionService.ts  # Orchestration
│   ├── chunking/            # Text splitting
│   │   ├── RecursiveChunker.ts
│   │   └── chunking.config.ts
│   └── parsers/             # Multi-format document parsing
│       ├── PdfParser.ts
│       ├── DocxParser.ts
│       ├── DocParser.ts
│       ├── XlsxParser.ts
│       └── ParserFactory.ts

├── vectorstore/             # Embedding storage & retrieval
│   ├── IVectorStore.ts      # Interface
│   ├── VectorStoreFactory.ts # Factory
│   ├── pgvector/            # PostgreSQL backend
│   └── qdrant/              # Qdrant backend

├── embeddings/              # Embedding generation
│   ├── EmbedderFactory.ts   # Factory
│   ├── OllamaEmbedder.ts    # Ollama backend
│   └── IEmbeddingService.ts # Interface

├── documents/               # Document metadata storage
│   ├── IDocumentRepository.ts
│   ├── PgDocumentRepository.ts
│   └── documents.schema.sql

└── common/                  # Shared utilities
    ├── config.ts            # Environment & validation
    ├── logger.ts            # Pino logging
    ├── errors.ts            # Custom error types
    └── types.ts             # TypeScript interfaces

tests/
├── unit/                    # Unit tests
│   ├── graph/
│   ├── parsers/
│   └── routes/
└── integration/             # Integration tests
    ├── upload.test.ts
    └── query.test.ts
```

## Key Architecture Decisions

### 1. Service Injection Pattern
Dependencies are created in `server.ts` and passed as plain objects through route and node factories. This avoids global state and makes testing trivial.

### 2. Middleware Chain
- `express-async-errors` imported at top (CRITICAL - catches async route errors)
- `validateFile` + `validateQuery` run before routes
- `errorHandler` registered last (4-arg middleware signature)

### 3. Error Resilience (Phase 9)
- LLM calls wrapped in try/catch in graph nodes
- Graceful degradation: failed grades excluded, empty chunks return fallback message
- Process error guards: unhandledRejection, uncaughtException handlers
- Graceful shutdown on SIGTERM with resource cleanup

### 4. RAG Graph Flow
```
retrieve → gradeDocuments ─┐
                           ├─→ (low confidence + retries left) → rewriteQuery → retrieve
                           ├─→ (high confidence OR max retries) → generate → END
                           └─ (always) → generate → END
```

### 5. Document Processing
- Recursive text splitting with configurable chunk size/overlap
- Multi-format support: PDF, DOCX, DOC, XLSX
- Automatic vector embedding on ingestion
- Metadata tracking: filename, chunk index, upload timestamp

## Supported Document Formats

| Format | Parser | Supported |
|--------|--------|-----------|
| PDF    | pdf-parse | ✅ |
| DOCX   | mammoth | ✅ |
| DOC    | mammoth | ✅ |
| XLSX   | xlsx | ✅ |
| TXT    | (built-in) | ✅ |

Max file size: 20MB (configurable)

## Configuration

All configuration is validated at startup with Zod. See `src/common/config.ts` for schema.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `LOG_LEVEL` | info | Pino log level |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `VECTOR_STORE` | pgvector | pgvector or qdrant |
| `QDRANT_URL` | http://localhost:6333 | Qdrant endpoint |
| `EMBEDDER_PROVIDER` | gemini | gemini or ollama |
| `GEMINI_API_KEY` | - | Gemini API key for embeddings |
| `GEMINI_EMBED_MODEL` | gemini-embedding-2 | Gemini embedding model |
| `GEMINI_EMBED_DIMENSIONS` | 768 | Gemini output dimensions |
| `GEMINI_EMBED_CONCURRENCY` | 1 | Concurrent Gemini embedding requests |
| `GEMINI_EMBED_DELAY_MS` | 1000 | Delay between Gemini embedding requests per worker |
| `GEMINI_EMBED_MAX_RETRIES` | 3 | Retries for transient Gemini quota/rate-limit responses |
| `OLLAMA_LLM_MODEL` | llama3.2 | Ollama LLM model |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama endpoint |
| `MAX_FILE_SIZE_MB` | 20 | File upload limit |
| `MAX_REWRITE_RETRIES` | 2 | Query rewrite attempts |
| `MAX_CONTEXT_CHARS` | 12000 | Max retrieved context sent to the LLM |
| `MAX_CHUNKS_PER_DOCUMENT` | 500 | Ingestion guardrail for oversized documents |
| `INGEST_EMBED_BATCH_SIZE` | 25 | Number of chunks processed per ingestion batch |
| `MIN_RELEVANCE_SCORE` | 0.5 | Vector search threshold |
| `TOP_K` | 5 | Default documents to retrieve |

## Performance Tuning

### Database Pool
- Max connections: 10
- Idle timeout: 30s
- Connection timeout: 5s

### Query Execution
- Graph timeout: 30s (configurable in routes)
- Parallel grading: All chunks graded concurrently
- Vector search: Top-K filtering + minimum score threshold

### Embedding Cache
- Embeddings computed once during ingestion
- Reused for all queries via vector search

## Development

### Watch Mode
```bash
npm run dev        # Auto-restart on file changes
```

### Build & Run (Production)
```bash
npm run build
npm start
```

### Code Quality
```bash
npm run lint       # ESLint (if configured)
npm run format     # Prettier (if configured)
```

## Troubleshooting

### Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ Run `docker-compose up` and wait 5-10s for PostgreSQL to be ready

### Ollama Model Not Found
```
Error: model not found
```
→ Pull model: `docker compose exec ollama ollama pull <model-name>`

### Vector Store Health Check Fails
```
Health check warning in logs
```
→ This is OK in development. Qdrant may take 10-15s to start.

### File Upload Fails with 413
```
413 Payload Too Large
```
→ Increase `MAX_FILE_SIZE_MB` in `.env`

### Out of Memory During Chunking
```
JavaScript heap out of memory
```
→ Use disk-based storage instead of memory storage in multer. See `src/api/middleware/validateFile.ts`

## Production Deployment

### Environment Setup
1. Create `.env.production` with secure values
2. Use managed PostgreSQL (RDS, Neon, etc.)
3. Use managed Qdrant (Qdrant Cloud) or self-hosted
4. Use managed Ollama or local GPU instance

### Docker Image
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production && npm run build
CMD ["npm", "start"]
```

### Deployment Checklist
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Vector store healthy
- [ ] LLM model loaded
- [ ] Monitoring configured
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] SSL/TLS enabled

## License

MIT
