# Project Explanation Guide

This guide explains the current implementation of this repository. It is based on the code in `src/`, `frontend/`, `scripts/`, `docker-compose.yml`, `.env.example`, `package.json`, and tests.

Important discrepancy note: older docs in this repo still describe some stale behavior, including Ollama as the main/default embedding provider, LLM-based document grading, frontend controls for `topK` and `minScore`, and older default chunk settings. The current code uses Gemini embeddings by default, still supports Ollama embeddings, uses score-based grading, and the current frontend does not expose `topK` or `minScore` controls.

## 1. Project Elevator Pitch

This project is a document question-answering application built with Retrieval-Augmented Generation (RAG).
Users upload documents such as PDF, Word, Excel, or text files.
The backend extracts text, splits it into chunks, generates embeddings, and stores those chunks in a vector store.
When a user asks a question, the system retrieves the most relevant chunks and sends them to a local Ollama LLM.
LangGraph coordinates the query workflow: retrieval, grading, optional rewriting, and answer generation.
The answer is returned with source chunks so users can verify where the response came from.
It is built as a practical TypeScript/Express backend with a simple vanilla HTML/CSS/JavaScript frontend.

## 2. Problem Statement

Normal LLMs are powerful, but they do not automatically know the private documents a user uploads to this app. Even if an LLM knows general facts, it cannot reliably answer questions about a user's specific PDF, resume, agreement, spreadsheet, or notes unless that content is provided to it.

RAG solves this by making the LLM answer in an "open-book" way. The system first searches the uploaded documents, finds the most relevant chunks, and then asks the LLM to answer using only that context.

A normal LLM alone is not enough because:

- It may not know private or newly uploaded information.
- It may hallucinate when asked about content it has not seen.
- It cannot cite which part of the uploaded document supports the answer.
- Sending entire documents directly to the LLM is slow, expensive, and limited by context windows.

RAG is used because it separates "finding information" from "writing an answer." Vector search finds the relevant document pieces, and the LLM turns those pieces into a readable answer.

## 3. Non-Technical Explanation

Think of this app as a smart assistant for uploaded documents.

The user uploads a document. The system reads the document and breaks it into smaller searchable pieces. It stores the meaning of those pieces, not just the exact words. When the user asks a question, the system searches for the most relevant parts of the uploaded documents. Then it gives those parts to an AI model, which writes an answer. The app also shows the source pieces, so the user can check where the answer came from.

In simple terms:

```text
Upload file -> Read text -> Store searchable meaning -> Ask question -> Find relevant parts -> AI answers with sources
```

## 4. Technical Architecture Overview

The project has five main layers:

- Frontend: static HTML/CSS/JavaScript in `frontend/`.
- Backend API: Express server in `src/api/server.ts`.
- Ingestion pipeline: parsers, chunker, embedder, vector storage, and metadata storage.
- Query pipeline: LangGraph workflow for retrieval and generation.
- Infrastructure: PostgreSQL with pgvector, optional Qdrant, Ollama, and external Gemini embeddings.

ASCII architecture:

```text
                         Browser
                           |
                           | HTTP
                           v
          +----------------------------------+
          | Frontend: frontend/index.html    |
          | app.js calls backend REST APIs   |
          +----------------------------------+
                           |
                           v
          +----------------------------------+
          | Express API: src/api/server.ts   |
          | /health /upload /query           |
          | /documents /documents/:id        |
          +----------------------------------+
             |                         |
             | upload flow             | query flow
             v                         v
 +------------------------+   +---------------------------+
 | IngestionService       |   | LangGraph RAG workflow    |
 | parser -> chunker      |   | retrieve -> grade         |
 | embed -> vector upsert |   | rewrite? -> generate      |
 +------------------------+   +---------------------------+
             |                         |
             v                         v
 +------------------------+   +---------------------------+
 | Gemini or Ollama       |   | Gemini or Ollama embedder |
 | embedding provider     |   | creates query embedding   |
 +------------------------+   +---------------------------+
             |                         |
             v                         v
 +--------------------------------------------------------+
 | Vector store abstraction                               |
 | pgvector default/support OR Qdrant support             |
 +--------------------------------------------------------+
             |                         |
             v                         v
 +------------------------+   +---------------------------+
 | PostgreSQL documents   |   | Ollama Chat LLM           |
 | metadata table         |   | final answer generation   |
 +------------------------+   +---------------------------+
```

Current code behavior:

- Frontend calls backend at `http://localhost:3000`.
- Backend runs on `PORT`, default `3000`.
- PostgreSQL stores document metadata and, when `VECTOR_STORE=pgvector`, chunk vectors.
- `pgvector` is the default vector store in `.env.example`.
- Qdrant is supported through `QdrantVectorStore`.
- Gemini is the default embedding provider and requires `GEMINI_API_KEY`.
- Ollama embeddings are still supported when `EMBEDDER_PROVIDER=ollama`.
- Ollama is always used for answer generation through `ChatOllama`.
- Docker Compose starts PostgreSQL, Qdrant, and Ollama.

## 5. Tech Stack Deep Dive

| Technology | What it is | Where used | Why used | If it fails | Simple explanation |
|---|---|---|---|---|---|
| TypeScript | Typed JavaScript | `src/**/*.ts` | Safer backend contracts and interfaces | Build/test errors or runtime bugs if types are bypassed | JavaScript with guardrails |
| Node.js | JavaScript runtime | Backend, scripts, frontend server | Runs Express API and tooling | Server cannot start | The engine running the app |
| Express | HTTP API framework | `src/api/server.ts`, `src/api/routes/` | Simple REST API for upload/query/docs | Routes fail or return 500 | The web server layer |
| Multer | File upload middleware | `src/api/middleware/validateFile.ts` | Parses multipart uploads into memory buffers | Uploads fail, file too large errors | Receives files from the browser |
| Zod | Runtime validation library | `src/common/config.ts` | Validates environment configuration at startup | App refuses to start with invalid config | Checks settings before the app runs |
| Pino | Structured logger | `src/common/logger.ts`, `pino-http` | Fast logs for requests and pipeline events | Harder debugging; app may fail if logger config invalid | The app's event recorder |
| LangGraph | Graph workflow library | `src/graph/ragGraph.ts` | Makes query flow explicit and extendable | `/query` can fail with graph errors | A workflow controller |
| LangChain/Ollama | LLM integration | `src/graph/llm.ts` | Calls local Ollama chat model | Generation times out or falls back | Connects the app to the local AI model |
| Gemini embeddings | Google embedding API | `src/embeddings/GeminiEmbedder.ts` | Default embedding provider with configurable 768 dimensions | Upload/query embedding fails; 429 quota errors possible | Turns text into meaning coordinates using Gemini |
| Ollama embeddings | Local embedding model support | `src/embeddings/OllamaEmbedder.ts` | Offline/local embedding alternative | Fails if Ollama or model is missing | Local text-to-vector option |
| PostgreSQL | Relational database | `documents` table, pgvector backend | Stores document metadata and optionally vectors | Upload/list/delete and pgvector search fail | The main database |
| pgvector | PostgreSQL vector extension | `src/vectorstore/pgvector/` | Stores/searches embeddings in Postgres | Similarity search fails; schema init fails | Semantic search inside PostgreSQL |
| Qdrant | Dedicated vector DB | `src/vectorstore/qdrant/` | Optional vector store for larger vector workloads | Qdrant mode cannot upsert/search/delete | Specialized semantic search database |
| Docker Compose | Local service orchestration | `docker-compose.yml` | Starts Postgres, Qdrant, Ollama | Local dependencies unavailable | Starts the support services together |
| Vitest | Test framework | `tests/`, `src/**/*.test.ts` | Unit/integration test runner | Bugs become harder to catch | Automated code checks |
| HTML/CSS/JavaScript | Vanilla frontend | `frontend/` | No build step, simple demo UI | Browser app cannot upload/query | A lightweight web page |

## 6. Folder And File Walkthrough

Project folders:

| Path | Responsibility |
|---|---|
| `src/api/` | Express server, routes, validation middleware, error handler |
| `src/common/` | Config, shared types, custom errors, logger |
| `src/documents/` | PostgreSQL document metadata repository and schema |
| `src/embeddings/` | Gemini and Ollama embedding implementations |
| `src/graph/` | LangGraph RAG workflow, nodes, edges, LLM wrapper |
| `src/ingestion/` | Upload processing: parse, chunk, embed, store |
| `src/vectorstore/` | Vector store interface plus pgvector and Qdrant implementations |
| `frontend/` | Static browser UI and simple Node static server |
| `scripts/` | Database initialization and service validation scripts |
| `tests/` | Unit and integration tests outside `src/` |

Important files:

| File | Responsibility |
|---|---|
| `package.json` | Scripts and dependencies |
| `.env.example` | Example runtime configuration |
| `docker-compose.yml` | Local Postgres, Qdrant, and Ollama services |
| `src/common/config.ts` | Zod environment validation and defaults |
| `src/api/server.ts` | Backend composition root |
| `src/api/routes/upload.route.ts` | `POST /upload` |
| `src/api/routes/query.route.ts` | `POST /query` |
| `src/api/routes/documents.route.ts` | document list and delete endpoints |
| `src/ingestion/IngestionService.ts` | Upload orchestration |
| `src/ingestion/parsers/ParserFactory.ts` | MIME type to parser selection |
| `src/ingestion/chunking/RecursiveChunker.ts` | Recursive text chunking |
| `src/embeddings/GeminiEmbedder.ts` | Gemini embedding calls, retries, throttling |
| `src/embeddings/OllamaEmbedder.ts` | Local Ollama embedding calls |
| `src/vectorstore/pgvector/PgVectorStore.ts` | pgvector upsert/search/delete |
| `src/vectorstore/qdrant/QdrantVectorStore.ts` | Qdrant upsert/search/delete |
| `src/documents/PgDocumentRepository.ts` | CRUD for document metadata |
| `src/graph/ragGraph.ts` | LangGraph graph definition |
| `src/graph/nodes/*.ts` | Retrieve, grade, rewrite, generate nodes |
| `frontend/app.js` | Browser-side API calls |

Best order to read the code:

1. `package.json`
2. `.env.example`
3. `docker-compose.yml`
4. `src/common/config.ts`
5. `src/api/server.ts`
6. `src/api/routes/upload.route.ts`
7. `src/ingestion/IngestionService.ts`
8. `src/ingestion/parsers/ParserFactory.ts`
9. `src/ingestion/chunking/RecursiveChunker.ts`
10. `src/embeddings/EmbedderFactory.ts`
11. `src/vectorstore/VectorStoreFactory.ts`
12. `src/vectorstore/pgvector/PgVectorStore.ts`
13. `src/documents/PgDocumentRepository.ts`
14. `src/graph/ragGraph.ts`
15. `src/graph/nodes/retrieve.node.ts`
16. `src/graph/nodes/gradeDocuments.node.ts`
17. `src/graph/edges/routeAfterGrade.ts`
18. `src/graph/nodes/generate.node.ts`
19. `src/api/routes/query.route.ts`
20. `frontend/app.js`

## 7. Runtime Services

| Service | Purpose | Port | Started by | Depends on it | Failure symptoms |
|---|---|---:|---|---|---|
| Backend API | REST API and RAG orchestration | `3000` default | `npm run dev` or `npm start` | Frontend, curl clients | `/health` unavailable, upload/query fail |
| Frontend | Browser UI | `8080` default | `npm run frontend` | User browser | UI not reachable |
| PostgreSQL | Metadata DB and pgvector store | `5432` | `docker-compose up -d` | document repo, pgvector mode | DB init fails, list/delete fail, pgvector search fails |
| pgvector | Vector extension inside Postgres | `5432` | Postgres image `pgvector/pgvector:pg16` | pgvector vector store | schema or vector queries fail |
| Qdrant | Optional vector DB | `6333`, `6334` | `docker-compose up -d` | Qdrant mode only | Qdrant health false, upsert/search/delete fail |
| Ollama | Local chat LLM and optional embeddings | `11434` | `docker-compose up -d` plus model pull | generation always; embeddings only when selected | LLM timeout, model not found, Ollama connection errors |
| Gemini API | External embedding provider | HTTPS external API | configured by API key | default embedding mode | upload/query embedding failures, quota/rate limit errors |

## 8. Environment Configuration

The schema is in `src/common/config.ts`. `.env.example` shows recommended local values. Required configuration is validated on startup.

| Variable | Controls | Code default | Example | If wrong |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | required | `postgresql://raguser:ragpass@localhost:5432/ragdb` | backend startup or DB operations fail |
| `VECTOR_STORE` | vector backend | required enum | `pgvector` | app startup fails if not `pgvector` or `qdrant` |
| `EMBEDDER_PROVIDER` | embedding provider | `gemini` | `gemini` | startup fails if invalid; Gemini needs key |
| `GEMINI_API_KEY` | Gemini auth | empty string | `AIza...` | startup fails when Gemini provider is active |
| `GEMINI_EMBED_MODEL` | Gemini model | `gemini-embedding-2` | `gemini-embedding-2` | embedding calls fail if unavailable |
| `GEMINI_EMBED_DIMENSIONS` | output vector size | `768` | `768` | must match vector schema/collection |
| `GEMINI_EMBED_CONCURRENCY` | concurrent Gemini workers | `1` | `1` | too high can hit quota/rate limits |
| `GEMINI_EMBED_DELAY_MS` | delay between Gemini calls | `1000` | `1000` | too low can hit 429s |
| `GEMINI_EMBED_MAX_RETRIES` | retry count for Gemini rate limits | `3` | `3` | low values fail faster |
| `OLLAMA_BASE_URL` | Ollama endpoint | `http://localhost:11434` | same | generation or Ollama embeddings fail |
| `OLLAMA_EMBED_MODEL` | Ollama embedding model | `nomic-embed-text` | `nomic-embed-text` | Ollama embedding mode fails if model missing |
| `OLLAMA_LLM_MODEL` | Ollama chat model | `llama3.2` | `llama3.2` | generation fails if model missing |
| `QDRANT_URL` | Qdrant endpoint | `http://localhost:6333` | same | Qdrant mode fails |
| `QDRANT_COLLECTION` | Qdrant collection | `rag_chunks` | `rag_chunks` | data stored/searched in wrong collection |
| `CHUNK_SIZE` | max chars per base chunk | `3000` in code, `8000` in `.env.example` | `8000` | too small creates many chunks; too large reduces precision |
| `CHUNK_OVERLAP` | repeated chars between chunks | `300` in code, `800` in `.env.example` | `800` | must be less than `CHUNK_SIZE` |
| `TOP_K` | chunks retrieved by default | `8` | `8` | too high increases context and latency |
| `MIN_RELEVANCE_SCORE` | score threshold for grading | `0.3` | `0.3` | too high can filter useful chunks, though fallback keeps retrieved chunks |
| `MAX_REWRITE_RETRIES` | rewrite attempts when no chunks retrieved | `2` | `2` | too high can add latency |
| `MAX_CONTEXT_CHARS` | max context sent to LLM | `12000` | `12000` | too high can slow/timeout generation |
| `MAX_CHUNKS_PER_DOCUMENT` | ingestion guardrail | `500` | `500` | large docs rejected if chunk count exceeds it |
| `INGEST_EMBED_BATCH_SIZE` | chunks embedded/upserted per batch | `25` | `25` | too high can increase memory/API pressure |
| `PORT` | backend port | `3000` | `3000` | frontend CORS/API URL may not match |
| `LOG_LEVEL` | Pino log level | `info` | `debug` | too noisy or not enough logs |
| `MAX_FILE_SIZE_MB` | Multer upload limit | `20` | `20` | large files rejected |

## 9. Upload / Ingestion Flow

Technical flow:

1. Browser sends `multipart/form-data` to `POST /upload` with field name `file`.
2. `validateFile` uses Multer memory storage to read the file into `req.file.buffer`.
3. Multer enforces `MAX_FILE_SIZE_MB`.
4. MIME type must be in `ALLOWED_MIME_TYPES` from `ParserFactory`.
5. Filename is sanitized with `path.basename`.
6. `upload.route.ts` calls `IngestionService.ingest(buffer, filename, mimeType)`.
7. `PgDocumentRepository.create` inserts a `documents` row with status `processing`.
8. `getParser(mimeType)` selects a parser:
   - `PdfParser` for `application/pdf`
   - `DocxParser` for DOCX
   - `DocParser` for legacy DOC
   - `XlsxParser` for XLS/XLSX
   - `TxtParser` for plain text
9. Parser extracts normalized non-empty text.
10. `RecursiveChunker` splits text by paragraphs, sentences, lines, words, then characters.
11. Each chunk gets deterministic UUID-style `id`, text, empty embedding, and metadata.
12. If chunk count exceeds `MAX_CHUNKS_PER_DOCUMENT`, ingestion fails with `TOO_MANY_CHUNKS`.
13. Chunks are processed in batches of `INGEST_EMBED_BATCH_SIZE`.
14. Embedder creates embeddings using Gemini or Ollama.
15. Vector store upserts embedded chunks into pgvector or Qdrant.
16. Document status updates to `ready` with final chunk count.
17. API returns `201` with `documentId`, `filename`, `chunkCount`, and message.
18. On error, partial vectors are deleted, document status becomes `failed`, and the original error is rethrown.

Non-technical flow:

```text
The app receives the file, checks that it is safe and supported, reads the text, breaks the text into smaller pieces, turns each piece into searchable meaning, stores those pieces, and marks the document ready. If something fails, it cleans up partial data and marks the document failed.
```

## 10. Query / RAG Flow

Technical flow:

1. Browser sends JSON to `POST /query`, usually `{ "query": "..." }`.
2. `validateQuery` rejects empty queries.
3. Optional `topK` must be integer `1..20`.
4. Optional `minScore` must be `0..1`.
5. `query.route.ts` invokes the compiled LangGraph with `{ query, topK, minScore }`.
6. Route enforces a 30 second graph timeout.
7. `retrieveNode` chooses `rewrittenQuery` if present, otherwise original `query`.
8. Embedder creates a query embedding.
9. Vector store runs similarity search.
10. pgvector mode uses hybrid search when a text query is provided: vector results plus PostgreSQL full-text search.
11. Qdrant mode uses vector search only.
12. `gradeDocumentsNode` filters chunks by `minScore`.
13. If no chunks pass the threshold but chunks were retrieved, it keeps the retrieved chunks as a fallback.
14. `routeAfterGrade` usually routes to `generate` if any chunks were retrieved.
15. It routes to `rewriteQuery` only when confidence is low, no chunks were retrieved, and retry count is below `MAX_REWRITE_RETRIES`.
16. `rewriteQueryNode` asks Ollama to rewrite the question, then loops back to retrieval.
17. `generateNode` builds a context string capped by `MAX_CONTEXT_CHARS`.
18. `generateNode` prompts Ollama to answer only from the context and ignore instructions inside retrieved documents.
19. If LLM generation fails or times out after 12 seconds, an extractive fallback answer is built from retrieved chunks.
20. API returns answer, source previews, rewrite count, and final query.

Non-technical flow:

```text
The app turns your question into searchable meaning, finds the closest document pieces, asks the AI to answer using those pieces, and shows the pieces it used as sources.
```

## 11. LangGraph Workflow Deep Dive

LangGraph is used because the query process is not just one function call. It has steps, state, conditional routing, retry behavior, and fallback behavior.

Graph definition in `src/graph/ragGraph.ts`:

```text
START
  -> retrieve
  -> gradeDocuments
  -> routeAfterGrade
       -> rewriteQuery -> retrieve
       -> generate
  -> END
```

Graph state in `src/graph/state.ts`:

| Field | Purpose |
|---|---|
| `query` | original user question |
| `topK` | optional per-request retrieval count |
| `minScore` | optional per-request relevance threshold |
| `rewrittenQuery` | LLM-rewritten query after failed retrieval |
| `retrievedChunks` | chunks returned by vector store |
| `gradedChunks` | chunks selected for generation |
| `answer` | final answer text |
| `sources` | chunks used as citations |
| `retryCount` | number of query rewrites |
| `confidence` | `high` when chunks are available, `low` when none are |

Nodes:

| Node | File | What it does |
|---|---|---|
| `retrieve` | `src/graph/nodes/retrieve.node.ts` | embeds query and searches vector store |
| `gradeDocuments` | `src/graph/nodes/gradeDocuments.node.ts` | score-filters chunks, with fallback to best available retrieved chunks |
| `rewriteQuery` | `src/graph/nodes/rewriteQuery.node.ts` | uses Ollama to rewrite the query after empty retrieval |
| `generate` | `src/graph/nodes/generate.node.ts` | prompts Ollama or returns extractive fallback |

Edges and routes:

- `START -> retrieve`
- `retrieve -> gradeDocuments`
- `gradeDocuments -> generate` when confidence is high, chunks exist, or retries are exhausted
- `gradeDocuments -> rewriteQuery` only when no chunks were retrieved and retries remain
- `rewriteQuery -> retrieve`
- `generate -> END`

Retry behavior:

- Controlled by `MAX_REWRITE_RETRIES`.
- Rewriting is not used for low-scoring results if any chunks are returned.
- This prevents slow rewrite loops and makes query latency more predictable.

Why better than a single function:

- Each step can be tested independently.
- Routing logic is explicit.
- Query rewriting can be added without mixing it into retrieval.
- Fallback generation is isolated from search logic.
- Future nodes such as reranking, moderation, or source verification can be added cleanly.

## 12. Data Model And Storage

Document metadata table from `src/documents/documents.schema.sql`:

| Column | Type | Purpose |
|---|---|---|
| `id` | `UUID` | document identifier |
| `filename` | `TEXT` | sanitized uploaded filename |
| `mime_type` | `TEXT` | uploaded MIME type |
| `status` | `TEXT` | `processing`, `ready`, or `failed` |
| `chunk_count` | `INTEGER` | number of embedded chunks |
| `error` | `TEXT` | ingestion error message |
| `uploaded_at` | `TIMESTAMPTZ` | upload time |
| `updated_at` | `TIMESTAMPTZ` | last status update |

Chunks table from `src/vectorstore/pgvector/pgvector.schema.sql`:

| Column | Type | Purpose |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | deterministic chunk id |
| `document_id` | `UUID` | owning document id |
| `filename` | `TEXT` | source filename |
| `chunk_index` | `INTEGER` | chunk order inside document |
| `text` | `TEXT` | chunk text |
| `embedding` | `vector(768)` | semantic embedding |
| `page_number` | `INTEGER` | optional page metadata, currently not populated by parsers |
| `sheet_name` | `TEXT` | optional sheet metadata, currently chunker metadata does not attach sheet names |
| `created_at` | `TIMESTAMPTZ` | insertion time |

Indexes:

- `documents_status_idx` on document status.
- `chunks_document_id_idx` for delete/filter by document.
- `chunks_embedding_idx` using `ivfflat` and `vector_cosine_ops`.
- `chunks_text_fts_idx` using PostgreSQL full-text search.

Similarity search:

- pgvector computes score as `1 - (embedding <=> queryEmbedding)`.
- `<=>` is cosine distance when using `vector_cosine_ops`.
- Hybrid search combines semantic vector matches with lexical full-text matches.

Qdrant:

- Collection name is `QDRANT_COLLECTION`.
- Collection vector size is based on `embedder.dimensions`.
- Distance metric is cosine.
- Payload stores `documentId`, `filename`, `chunkIndex`, `text`, `pageNumber`, and `sheetName`.

Delete behavior:

- `DELETE /documents/:id` first checks metadata exists.
- It deletes vector chunks from the active vector store.
- It then deletes the document row from PostgreSQL.

## 13. API Reference

Base URL locally: `http://localhost:3000`

### `GET /health`

Purpose: check backend and vector store status.

Response:

```json
{
  "status": "ok",
  "vectorStore": "pgvector",
  "embedder": "gemini",
  "embeddingModel": "gemini-embedding-2",
  "services": { "vectorStore": true }
}
```

Common errors: vector store error can be passed to global error handler.

Curl:

```bash
curl http://localhost:3000/health
```

### `POST /upload`

Purpose: upload and synchronously ingest a document.

Request: `multipart/form-data` with field `file`.

Success `201`:

```json
{
  "documentId": "uuid",
  "filename": "document.pdf",
  "chunkCount": 12,
  "message": "File ingested successfully"
}
```

Common errors:

- `NO_FILE`
- `FILE_TOO_LARGE`
- `UNSUPPORTED_TYPE`
- `EMPTY_DOCUMENT`
- `PARSE_ERROR`
- `TOO_MANY_CHUNKS`
- `VECTOR_STORE_ERROR`

Curl:

```bash
curl -F "file=@document.pdf" http://localhost:3000/upload
```

### `POST /query`

Purpose: ask a question about uploaded documents.

Request body:

```json
{
  "query": "What is this document about?",
  "topK": 8,
  "minScore": 0.3
}
```

`topK` and `minScore` are optional.

Success `200`:

```json
{
  "answer": "The document is about...",
  "sources": [
    {
      "id": "chunk-id",
      "text": "First 200 characters...",
      "score": 0.91,
      "documentId": "document-id",
      "filename": "document.pdf",
      "chunkIndex": 0
    }
  ],
  "rewriteCount": 0,
  "query": "What is this document about?"
}
```

Common errors:

- `EMPTY_QUERY`
- `INVALID_TOP_K`
- `INVALID_MIN_SCORE`
- `GRAPH_ERROR`
- `VECTOR_STORE_ERROR`

Curl:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"What is the main topic?\",\"topK\":5,\"minScore\":0.3}"
```

### `GET /documents`

Purpose: list uploaded documents.

Success `200`:

```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "document.pdf",
      "mimeType": "application/pdf",
      "uploadedAt": "2026-06-23T00:00:00.000Z",
      "chunkCount": 12,
      "status": "ready"
    }
  ],
  "count": 1
}
```

Curl:

```bash
curl http://localhost:3000/documents
```

### `DELETE /documents/:id`

Purpose: delete document metadata and vectors.

Success `200`:

```json
{
  "message": "Document deleted",
  "documentId": "uuid"
}
```

Common errors:

- `NOT_FOUND`
- `VECTOR_STORE_ERROR`

Curl:

```bash
curl -X DELETE http://localhost:3000/documents/00000000-0000-0000-0000-000000000000
```

## 14. Frontend Explanation

Frontend code lives in:

- `frontend/index.html`
- `frontend/styles.css`
- `frontend/app.js`
- `frontend/server.js`

It is a static vanilla JavaScript app. There is no bundler or frontend framework.

How it communicates:

- `API_BASE_URL` in `frontend/app.js` is `http://localhost:3000`.
- `checkServerStatus()` calls `GET /health`.
- `handleUpload()` sends `POST /upload`.
- `handleQuery()` sends `POST /query`.
- `refreshDocuments()` calls `GET /documents`.
- `deleteDocument()` calls `DELETE /documents/:id`.

UI features:

- Health status indicator.
- File upload form.
- Uploaded document list.
- Delete button for documents.
- Query form.
- Answer display.
- Source list with filename, chunk index, score, and text preview.

Error handling:

- Shows upload/query status messages.
- Uses backend error messages when available.
- Shows offline status if `/health` fails.

Current limitation: older frontend docs mention sliders or adjustable controls for `topK` and `minScore`, but current `frontend/index.html` and `frontend/app.js` do not implement those controls. The browser query request currently sends only `{ query }`.

## 15. Testing Strategy

Test framework: Vitest.

Commands:

```bash
npm test
npm run test:integration
npm run test:all
npm run test:coverage
```

Configuration: `vitest.config.ts`.

Covered areas:

- Parser factory MIME routing.
- Query validation.
- File validation.
- Error handler behavior.
- Recursive chunking.
- Gemini and Ollama embedder behavior.
- Ingestion batching and cleanup.
- Graph routing and fallback generation.
- Document route behavior.
- Integration tests for upload, query, documents, and health.

Not fully covered yet:

- Real external Gemini API behavior beyond validation script.
- Real local Ollama generation quality.
- Browser UI tests.
- Real PDF page-level citation mapping.
- Multi-user/security behavior.
- Load/performance tests.

## 16. Error Handling And Logging

Custom errors in `src/common/errors.ts`:

| Error | HTTP | Code | Used for |
|---|---:|---|---|
| `AppError` | variable | variable | base application error |
| `ParseError` | 422 | `PARSE_ERROR` | document parsing failure |
| `UnsupportedTypeError` | 400 | `UNSUPPORTED_TYPE` | unsupported upload MIME |
| `EmptyDocumentError` | 422 | `EMPTY_DOCUMENT` | parsed text is empty |
| `EmptyQueryError` | 400 | `EMPTY_QUERY` | blank query |
| `GraphExecutionError` | 500 | `GRAPH_ERROR` | graph timeout/failure |
| `VectorStoreError` | 503 | `VECTOR_STORE_ERROR` | vector store or embedding failure |

Error strategy:

- Validation errors are returned as structured JSON with timestamp.
- Upload errors are caught by ingestion cleanup.
- Partial vectors are deleted on ingestion failure.
- Failed documents are marked `failed` with the error message.
- LLM generation failures fall back to extractive answers.
- Unknown errors return `INTERNAL_ERROR`.
- Stack traces are only returned when `LOG_LEVEL=debug`.

Logging:

- Pino logger in `src/common/logger.ts`.
- `pino-http` logs HTTP requests.
- Ingestion logs parse/chunk/embedding timings.
- Retrieval logs chunk counts and scores.
- Generation logs timeout/fallback behavior.

## 17. Performance And Scaling

Current bottlenecks:

- Upload processing is synchronous, so the request waits for parsing, embedding, and storage.
- Multer uses memory storage, so large files consume backend memory.
- Gemini embedding quotas/rate limits can slow or fail large uploads.
- Ollama generation latency depends heavily on local hardware and model size.
- `MAX_CONTEXT_CHARS` helps, but large retrieved context still slows generation.
- pgvector `ivfflat` is good for moderate scale but needs tuning for larger datasets.
- The app does not stream responses.

Production improvements:

1. Move ingestion to a queue and background workers.
2. Return `202 Accepted` for upload and expose document processing progress.
3. Store original files in object storage instead of memory-only upload handling.
4. Use managed PostgreSQL with migrations.
5. Use managed Qdrant or tuned pgvector depending on scale.
6. Add embedding cache/deduplication.
7. Add response streaming for query answers.
8. Add authentication and per-user document isolation.
9. Add rate limiting.
10. Add structured observability: metrics, traces, dashboards, alerting.
11. Add reranking for better retrieval precision.
12. Add pagination for documents.

## 18. Security Considerations

Current protections:

- Upload MIME type allowlist.
- File size limit.
- Filename path traversal mitigation with `path.basename`.
- Zod environment validation.
- Query validation.
- CORS allowlist for local frontend origins.
- Prompt tells the LLM to treat context as untrusted document text.
- Delete endpoint removes vectors and metadata for a document.

Risks and improvements:

- MIME type alone is not enough for production file validation; add file signature/content scanning.
- `multer.memoryStorage()` is risky for larger files; use disk/object storage plus antivirus scanning.
- Documents can contain prompt injection; the prompt mitigates but does not eliminate it.
- No authentication or authorization exists.
- No multi-user isolation exists.
- No rate limiting exists.
- No CSRF protection exists.
- API keys must stay in `.env` or a secret manager and never be committed.
- CORS is local-development focused.

## 19. Common Technical Interview Questions And Answers

1. Why RAG?

RAG lets the system answer from uploaded private documents without retraining the LLM. Retrieval finds relevant chunks, and generation turns those chunks into a useful answer.

2. Why LangGraph?

The query flow has multiple steps: retrieve, grade, maybe rewrite, and generate. LangGraph makes those steps explicit, testable, and easier to extend than one large function.

3. Why embeddings?

Embeddings convert text into vectors that capture meaning. This lets the app find relevant chunks even when the user's wording differs from the document wording.

4. Why pgvector?

pgvector stores vectors inside PostgreSQL, so metadata and semantic search can live in one database. It is a practical default for local and moderate-scale deployments.

5. Why Qdrant?

Qdrant is a dedicated vector database. The project supports it behind the same `IVectorStore` interface for cases where vector search needs to scale independently.

6. Why PostgreSQL?

PostgreSQL stores reliable document metadata and can also host vectors through pgvector. It is mature, transactional, and easy to run locally with Docker.

7. Why Gemini embeddings?

Current code defaults to Gemini embeddings because they provide a hosted embedding model with configurable 768-dimensional output. The project also adds throttling and retry controls for quota limits.

8. Why Ollama?

Ollama runs the chat LLM locally, so answer generation can work without sending document context to a hosted LLM. It is also still supported as an embedding provider.

9. How does chunking work?

`RecursiveChunker` trims text, recursively splits by paragraphs, sentences, lines, words, then characters, packs pieces into chunks, and adds overlap from the previous chunk.

10. Why chunk overlap?

Overlap preserves context across chunk boundaries. If an important sentence spans two chunks, overlap reduces the chance that retrieval loses the surrounding meaning.

11. What is vector similarity?

It compares the query embedding with stored chunk embeddings. In pgvector, the code uses cosine distance and converts it to a score with `1 - distance`.

12. What is hybrid search?

In pgvector mode, search combines vector similarity with PostgreSQL full-text search. This helps technical terms and exact keywords rank better.

13. How are sources returned?

The generate node returns the chunks used for context. The API maps them into source objects with id, text preview, score, document id, filename, and chunk index.

14. How do you prevent hallucination?

The prompt tells the LLM to use only provided context and say when context is insufficient. The API also returns sources for verification. This reduces hallucination but does not fully eliminate it.

15. How do you handle large documents?

The code limits file size, chunks text, batches embeddings, caps max chunks per document, and caps context sent to the LLM. Production should move ingestion to workers.

16. How would you scale ingestion?

Use a queue, background workers, object storage, retry policies, progress statuses, and embedding cache. The upload endpoint should return quickly instead of waiting.

17. How would you improve latency?

Stream LLM output, cache embeddings, reduce `TOP_K`, tune `MAX_CONTEXT_CHARS`, use a faster model, add reranking, and keep vector indexes optimized.

18. How would you add authentication?

Add JWT or session auth middleware, attach `userId` to documents and chunks, enforce ownership checks on query/list/delete, and store secrets in a manager.

19. How would you support multiple users?

Add user and organization IDs to document metadata and vector payloads. Filter every retrieval and delete operation by owner or tenant.

20. How would you deploy this?

Package the backend as a Docker image, run managed Postgres, choose pgvector or Qdrant, run Ollama on a GPU-capable host or replace it with a hosted LLM, and serve the static frontend behind HTTPS.

21. How would you monitor it?

Track request latency, upload duration, chunk count, embedding failures, vector search latency, LLM timeout rate, document status counts, and error codes.

22. What are the main tradeoffs?

Local Ollama improves privacy but can be slow. Gemini embeddings improve quality/convenience but need an external API key and quota. pgvector is simple; Qdrant is more specialized.

23. What are the project limitations?

No auth, no multi-user isolation, synchronous ingestion, basic frontend, no streaming, limited citation metadata, and no production-grade file scanning.

24. What would you improve next?

First add auth and user isolation, then background ingestion, then streaming responses, then reranking and observability.

25. Explain the project in 2 minutes.

This is a TypeScript RAG document QA app. The frontend lets users upload documents and ask questions. The Express backend validates uploaded files, extracts text with format-specific parsers, chunks the text, creates embeddings through Gemini by default or Ollama if configured, and stores chunks in pgvector or Qdrant. PostgreSQL stores document metadata and status. At query time, LangGraph embeds the question, retrieves relevant chunks, filters them by score, optionally rewrites the query if nothing was found, and generates an answer with a local Ollama chat model. The response includes source chunks so the answer can be verified.

## 20. Common Non-Technical Questions And Answers

1. What does this app do?

It lets you upload documents and ask questions about them.

2. Can it read any document?

It supports PDF, Word, Excel, and plain text files, but very complex or scanned documents may not extract perfectly.

3. Does it know everything?

No. It mainly answers from the documents you upload.

4. Why do we upload files?

The AI needs access to your specific content before it can answer questions about it.

5. Why does it show sources?

Sources let you verify which document parts were used for the answer.

6. Can it make mistakes?

Yes. It can retrieve the wrong section, misunderstand messy text, or generate an imperfect answer.

7. Is it searching Google?

No. It searches the documents uploaded into this system.

8. Is my data stored?

Yes. Document metadata and searchable chunks are stored in the database/vector store.

9. Can I delete documents?

Yes. The UI and API support deleting a document and its stored chunks.

10. Why can upload take time?

The system reads the file, splits it, creates embeddings for each chunk, and stores them.

11. Why can answering take time?

The system searches documents and waits for the local AI model to generate the answer.

12. What happens if the AI service is down?

Embeddings or answer generation can fail. For generation failures, the app may return a fallback based on retrieved text.

13. Can this be used by a company?

The architecture is a good starting point, but production use needs authentication, user isolation, monitoring, and stronger file security.

14. What makes this useful?

It helps people get answers from long documents without manually searching through every page.

15. Explain it to a school student.

Imagine giving a book to a smart helper. When you ask a question, the helper first finds the right pages, then explains the answer and shows where it found it.

## 21. End-To-End Example

Example: upload `employee-handbook.pdf`, then ask "What is the leave policy?"

Upload flow:

```text
1. Browser sends employee-handbook.pdf to POST /upload.
2. Multer reads the file into memory and checks size.
3. MIME type selects PdfParser.
4. PdfParser extracts text and page count.
5. RecursiveChunker splits text into overlapping chunks.
6. GeminiEmbedder creates 768-dimensional embeddings.
7. PgVectorStore writes chunks to the chunks table.
8. PgDocumentRepository marks the document ready.
```

Query flow:

```text
1. Browser sends POST /query with "What is the leave policy?"
2. Retrieve node embeds the question.
3. pgvector hybrid search finds chunks mentioning leave policy.
4. Grade node keeps score-qualified chunks or best available chunks.
5. Generate node builds context and asks Ollama for an answer.
6. API returns answer plus source previews.
```

Example response structure:

```json
{
  "answer": "The handbook says employees are eligible for ...",
  "sources": [
    {
      "id": "chunk-id",
      "text": "Leave policy excerpt...",
      "score": 0.89,
      "documentId": "document-id",
      "filename": "employee-handbook.pdf",
      "chunkIndex": 4
    }
  ],
  "rewriteCount": 0,
  "query": "What is the leave policy?"
}
```

## 22. Mental Models

- RAG as an open-book exam: the LLM answers after being given the relevant pages.
- Embeddings as meaning coordinates: each chunk gets a location in meaning space.
- Vector DB as semantic search engine: it finds chunks by meaning, not just exact words.
- LangGraph as workflow controller: it decides which step runs next.

## 23. Current Strengths

- Clear modular TypeScript architecture.
- Express API with focused routes.
- Multiple document parser support.
- Configurable Gemini or Ollama embeddings.
- pgvector and Qdrant vector store abstraction.
- PostgreSQL metadata repository.
- Hybrid search in pgvector mode.
- LangGraph workflow with explicit nodes and routing.
- Source-backed responses.
- Ingestion cleanup on failure.
- LLM timeout and extractive fallback.
- Simple frontend for demos and manual testing.
- Unit and integration test coverage across important components.

## 24. Current Limitations

- No authentication or authorization.
- No multi-user document isolation.
- Upload ingestion is synchronous.
- File uploads are stored in memory during processing.
- No streaming query responses.
- No background worker or queue.
- No production file scanning.
- No exact page citations in returned API sources.
- Parser metadata such as `pageNumber` and `sheetName` is not fully propagated to chunks.
- Qdrant search does not implement hybrid lexical search.
- Frontend is basic and does not expose `topK` or `minScore` even though the API supports them.
- Local Ollama generation speed depends on hardware.
- Gemini embeddings depend on external API quota and key validity.

## 25. Future Roadmap

Priority order:

1. Add authentication.
2. Add user/tenant isolation for documents, chunks, and queries.
3. Move ingestion to a background queue and return processing status.
4. Add persistent object storage for original files.
5. Add streaming answers.
6. Add frontend controls for `topK` and `minScore` or remove stale docs mentioning them.
7. Add reranking after vector retrieval.
8. Improve parser metadata propagation for page/sheet citations.
9. Add migration tooling instead of ad hoc schema scripts.
10. Add rate limiting and request size hardening.
11. Add observability: metrics, traces, dashboards, alerts.
12. Add browser UI tests.
13. Add deployment Dockerfile and production Compose/Kubernetes examples.

## 26. Short Versions To Memorize

30-second explanation:

This is a RAG document Q&A app. Users upload PDF, Word, Excel, or text files. The backend extracts text, chunks it, embeds it with Gemini by default, stores vectors in pgvector or Qdrant, and uses LangGraph plus Ollama to answer questions with sources.

2-minute explanation:

This project lets users chat with uploaded documents. The frontend is a simple vanilla JavaScript app, and the backend is TypeScript with Express. On upload, the backend validates the file, parses the text, splits it into overlapping chunks, creates embeddings using Gemini or Ollama, and stores the chunks in pgvector or Qdrant. PostgreSQL stores document metadata and status. On query, LangGraph runs a RAG workflow: retrieve chunks, grade them by score, optionally rewrite the query if retrieval found nothing, and generate an answer with a local Ollama model. The response includes source chunks so users can verify the answer.

Technical 5-minute explanation:

The application is structured around a TypeScript Express API. `server.ts` is the composition root: it creates the database pool, embedder, vector store, chunker, document repository, ingestion service, and compiled LangGraph. Uploads go through Multer memory storage and MIME validation, then `IngestionService` creates a `documents` row, selects a parser by MIME type, extracts text, chunks it recursively, embeds chunks in batches, writes them to pgvector or Qdrant, and marks the document `ready`. On failure it deletes partial vectors and marks the document `failed`.

For queries, `POST /query` validates input and invokes LangGraph with a 30 second timeout. The graph starts at `retrieve`, which embeds the query and calls the vector store. pgvector uses hybrid semantic plus full-text search; Qdrant uses vector search. `gradeDocuments` filters by score but keeps retrieved chunks as a fallback. Routing goes to `generate` if chunks exist, or to `rewriteQuery` only when retrieval returned nothing and retries remain. `generate` builds bounded context, prompts Ollama through LangChain, and returns sources. If Ollama fails or times out, it returns an extractive fallback. The design is modular through interfaces like `IEmbeddingService`, `IVectorStore`, `IDocumentRepository`, and `IChunker`.

Non-technical explanation:

This app is like a smart assistant for your files. You upload documents, it reads and stores them in a searchable way, and then you can ask questions. It finds the most relevant parts of your documents, asks AI to write an answer from those parts, and shows the sources so you can check the result.

