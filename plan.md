# RAG System — Phased Build Plan
### Stack: Node.js · TypeScript · LangGraph.js · pgvector · Qdrant · Express · Ollama (100% free, no API keys)

> **100% Free Stack — No API keys, no paid accounts**
> Embeddings: `nomic-embed-text` via Ollama (local, 768 dims, free)
> LLM (grading + generation): `llama3.2` via Ollama (local, free)
> Vector stores: pgvector (Postgres, Docker) + Qdrant (Docker)
> Only cost: your laptop's RAM (~4 GB for llama3.2 + ~500 MB for nomic-embed-text)

> **How to use this plan with Codex**
> Each phase is a self-contained Codex session. Copy the prompt block at the top of each phase into Codex. Complete all acceptance criteria before moving to the next phase. Never skip a phase — each one installs the foundation the next phase builds on.

---

## Phase overview

| # | Phase | What you build | Est. effort |
|---|-------|----------------|-------------|
| 0 | Repo scaffold & toolchain | Folder structure, tsconfig, env validation, docker-compose | 1–2 hrs |
| 1 | Document parsing layer | IDocumentParser + PDF/DOCX/XLSX/DOC parsers + factory | 2–3 hrs |
| 2 | Chunking layer | IChunker + RecursiveChunker + config | 1–2 hrs |
| 3 | Embedding layer | IEmbeddingService + OllamaEmbedder (nomic-embed-text) + factory | 1–2 hrs |
| 4 | Vector store layer | IVectorStore + pgvector adapter + Qdrant adapter + factory | 3–4 hrs |
| 5 | Document metadata layer | Documents table + repository + migrations | 1–2 hrs |
| 6 | Ingestion service | Orchestrates parse → chunk → embed → store | 2 hrs |
| 7 | LangGraph pipeline | All 4 nodes + conditional edge + compiled graph | 3–4 hrs |
| 8 | REST API | All 4 routes + middleware + error handler | 2–3 hrs |
| 9 | Error handling & validation | Full AppError hierarchy + guards | 1–2 hrs |
| 10 | Testing | Unit + integration for all layers | 3–4 hrs |
| 11 | README + polish | Architecture diagram, setup docs, .env.example | 1 hr |

---

## Pre-requisites (do this before Phase 0)

Install on your machine if not already present:

```bash
node -v        # must be >= 18
docker -v      # for postgres+pgvector and qdrant
npm -v         # >= 9
```

Accounts/keys you need before starting:
- **None.** Everything runs locally via Ollama + Docker. No paid accounts required.

You DO need Ollama installed and two models pulled:
```bash
# Install Ollama: https://ollama.com/download  (Linux/Mac/Windows)
ollama pull nomic-embed-text   # embeddings — 274 MB
ollama pull llama3.2           # LLM for grading + generation — 2 GB
ollama serve                   # starts Ollama on http://localhost:11434
```
- No Qdrant account needed — runs locally via Docker

---

## Phase 0 — Repo scaffold & toolchain

### Goal
A compiling, runnable TypeScript project with folder structure, env validation, logger, and both infrastructure services (Postgres with pgvector, Qdrant) running in Docker.

### Codex prompt
```
Create a new Node.js TypeScript project called "rag-langgraph" with the following:

1. package.json with these dev dependencies: typescript, ts-node, ts-node-dev, @types/node, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, prettier, vitest
   And these runtime dependencies: express, @types/express, dotenv, zod, pino, pino-http, multer, @types/multer

2. tsconfig.json with:
   - target: ES2022
   - module: Node16
   - moduleResolution: Node16
   - strict: true
   - outDir: ./dist
   - rootDir: ./src
   - paths alias: @/* -> src/*
   - include: ["src/**/*"]

3. The exact folder structure below (create empty index.ts placeholder in each leaf folder):
   src/
     api/routes/
     api/middleware/
     api/server.ts
     ingestion/parsers/
     ingestion/chunking/
     ingestion/IngestionService.ts
     embeddings/
     vectorstore/pgvector/
     vectorstore/qdrant/
     graph/nodes/
     graph/edges/
     graph/state.ts
     graph/ragGraph.ts
     documents/
     common/

4. src/common/config.ts that:
   - Uses zod to validate all env vars from .env
   - Exports a typed `Config` interface and a `config` singleton
   - Required vars: DATABASE_URL, VECTOR_STORE (enum: pgvector|qdrant), OLLAMA_BASE_URL (default http://localhost:11434), OLLAMA_EMBED_MODEL (default nomic-embed-text), OLLAMA_LLM_MODEL (default llama3.2), QDRANT_URL, QDRANT_COLLECTION, CHUNK_SIZE (number default 1000), CHUNK_OVERLAP (number default 200), TOP_K (number default 5), MIN_RELEVANCE_SCORE (number 0-1 default 0.7), MAX_REWRITE_RETRIES (number default 2), PORT (number default 3000), LOG_LEVEL (enum: info|debug|warn|error default info), MAX_FILE_SIZE_MB (number default 20)
   - Must throw a descriptive error at startup if any required var is missing

5. src/common/logger.ts that:
   - Uses pino with log level from config
   - Exports a typed `logger` singleton

6. src/common/errors.ts that defines:
   class AppError extends Error { statusCode: number; code: string }
   class ParseError extends AppError (statusCode 422, code PARSE_ERROR)
   class UnsupportedTypeError extends AppError (statusCode 400, code UNSUPPORTED_TYPE)
   class EmptyDocumentError extends AppError (statusCode 422, code EMPTY_DOCUMENT)
   class EmptyQueryError extends AppError (statusCode 400, code EMPTY_QUERY)
   class GraphExecutionError extends AppError (statusCode 500, code GRAPH_ERROR)
   class VectorStoreError extends AppError (statusCode 503, code VECTOR_STORE_ERROR)

7. src/common/types.ts with shared DTOs:
   VectorChunk { id: string; text: string; embedding: number[]; metadata: ChunkMetadata }
   ChunkMetadata { documentId: string; filename: string; chunkIndex: number; pageNumber?: number; sheetName?: string }
   ScoredChunk extends VectorChunk { score: number }
   SearchOpts { topK: number; minScore?: number; filter?: Record<string, unknown> }
   ParsedDocument { text: string; metadata: { title: string; pageCount?: number; sheetNames?: string[] } }
   DocumentRecord { id: string; filename: string; mimeType: string; uploadedAt: Date; chunkCount: number; status: 'processing' | 'ready' | 'failed' }

8. .env.example with all vars commented with description

9. docker-compose.yml that runs:
   - postgres:16 with pgvector extension (image: pgvector/pgvector:pg16), port 5432, volume, env POSTGRES_DB=ragdb POSTGRES_USER=raguser POSTGRES_PASSWORD=ragpass
   - qdrant/qdrant:latest, port 6333 and 6334, volume

10. A src/api/server.ts that:
    - Creates an Express app
    - Registers pino-http middleware
    - Registers express.json()
    - Has a GET /health route returning { status: 'ok', vectorStore: config.VECTOR_STORE, embedder: config.EMBEDDER_PROVIDER }
    - Starts listening on config.PORT
    - Logs startup info with logger

11. package.json scripts:
    "dev": "ts-node-dev --respawn --transpile-only src/api/server.ts"
    "build": "tsc"
    "start": "node dist/api/server.js"
    "test": "vitest run"
    "docker:up": "docker-compose up -d"
    "docker:down": "docker-compose down"
```

### Acceptance criteria — verify all before Phase 1
- [ ] `npm install` completes with no errors
- [ ] `docker-compose up -d` starts both containers (check with `docker ps`)
- [ ] `npx ts-node src/api/server.ts` starts without error
- [ ] `curl http://localhost:3000/health` returns `{ "status": "ok" }`
- [ ] `npm run build` produces `dist/` with no TypeScript errors
- [ ] Copy `.env.example` to `.env`, set DATABASE_URL — server still starts (no API keys needed)
- [ ] `ollama list` shows `nomic-embed-text` and `llama3.2` are pulled

### Files produced in this phase
```
package.json  tsconfig.json  .env.example  docker-compose.yml
src/common/config.ts  src/common/logger.ts  src/common/errors.ts  src/common/types.ts
src/api/server.ts
```

---

## Phase 1 — Document parsing layer

### Goal
A `ParserFactory` that accepts a file buffer + MIME type and returns structured text, abstracted behind `IDocumentParser`. All four file types working.

### Dependencies to install
```bash
npm install pdf-parse mammoth xlsx @types/pdf-parse @types/mammoth
```

### Codex prompt
```
In the existing project at src/ingestion/parsers/, implement the document parsing layer:

1. src/ingestion/parsers/IDocumentParser.ts:
   export interface IDocumentParser {
     parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;
     readonly supportedMimes: readonly string[];
   }
   (import ParsedDocument from @/common/types)

2. src/ingestion/parsers/PdfParser.ts:
   - Implements IDocumentParser
   - Uses pdf-parse library
   - supportedMimes: ['application/pdf']
   - Extracts text from all pages
   - Sets metadata.pageCount from pdf info
   - Throws ParseError (from @/common/errors) if pdf-parse throws or returns empty text
   - Handles encrypted/corrupt PDFs gracefully

3. src/ingestion/parsers/DocxParser.ts:
   - Implements IDocumentParser
   - Uses mammoth library (mammoth.extractRawText)
   - supportedMimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
   - Throws ParseError if mammoth throws or text is empty after trim
   - Strips excessive whitespace: replace /\n{3,}/g with '\n\n'

4. src/ingestion/parsers/DocParser.ts:
   - Implements IDocumentParser
   - supportedMimes: ['application/msword']
   - Mammoth also handles .doc files in many cases — use mammoth.extractRawText
   - If mammoth fails for .doc, throw ParseError with message mentioning that .docx is preferred

5. src/ingestion/parsers/XlsxParser.ts:
   - Implements IDocumentParser
   - Uses xlsx library (SheetJS)
   - supportedMimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
   - Reads workbook, iterates all sheets
   - For each sheet: convert to CSV using XLSX.utils.sheet_to_csv, prepend sheet name as a heading line
   - Joins all sheets with '\n\n---\n\n' separator
   - Sets metadata.sheetNames array
   - Throws ParseError if workbook has no sheets or all sheets are empty

6. src/ingestion/parsers/ParserFactory.ts:
   - Exports function getParser(mimeType: string): IDocumentParser
   - Maintains a Map<string, IDocumentParser> of all parsers
   - Throws UnsupportedTypeError (from @/common/errors) if mime type not found
   - Also export ALLOWED_MIME_TYPES: string[] for use in file validation middleware

All parsers must:
- Never return undefined or null — always return ParsedDocument or throw a typed error
- Trim the final text output
- Throw EmptyDocumentError (from @/common/errors) if text is empty after parsing succeeds
```

### Acceptance criteria
- [ ] `PdfParser` correctly parses a real PDF buffer in a quick manual test
- [ ] `DocxParser` correctly parses a .docx buffer
- [ ] `XlsxParser` returns all sheet contents separated by `---`
- [ ] `ParserFactory.getParser('application/pdf')` returns the PDF parser
- [ ] `ParserFactory.getParser('image/png')` throws `UnsupportedTypeError`
- [ ] All parsers throw `ParseError` when given a corrupt or empty buffer
- [ ] TypeScript compiles cleanly: `npm run build`

### Files produced
```
src/ingestion/parsers/IDocumentParser.ts
src/ingestion/parsers/PdfParser.ts
src/ingestion/parsers/DocxParser.ts
src/ingestion/parsers/DocParser.ts
src/ingestion/parsers/XlsxParser.ts
src/ingestion/parsers/ParserFactory.ts
```

---

## Phase 2 — Chunking layer

### Goal
A configurable recursive character text splitter that produces semantically coherent `VectorChunk[]` from raw text.

### Dependencies to install
```bash
npm install @langchain/textsplitters
# OR if you want zero extra deps, implement the recursive splitter from scratch
```

### Codex prompt
```
In src/ingestion/chunking/, implement the text chunking layer:

1. src/ingestion/chunking/IChunker.ts:
   export interface IChunker {
     chunk(text: string, metadata: Omit<ChunkMetadata, 'chunkIndex'>): VectorChunk[];
   }
   (Note: VectorChunk.embedding will be an empty array [] at this stage — embeddings are added later)

2. src/ingestion/chunking/RecursiveChunker.ts:
   - Implements IChunker
   - Constructor takes: chunkSize: number, chunkOverlap: number
   - Split strategy: try paragraph breaks (\n\n) first, then sentence breaks (. ! ?), then newlines (\n), then spaces, then characters — whichever keeps chunks under chunkSize
   - Each chunk: generate a deterministic id using crypto.randomUUID() (or hash of documentId+chunkIndex)
   - Sets chunkIndex sequentially starting from 0
   - Overlap: carry the last chunkOverlap characters of the previous chunk into the start of the next
   - Filters out chunks that are empty or whitespace-only after splitting
   - Throws Error('Text is empty — nothing to chunk') if input text is blank

3. src/ingestion/chunking/chunking.config.ts:
   - Exports function createChunker(config: Config): IChunker
   - Returns new RecursiveChunker(config.CHUNK_SIZE, config.CHUNK_OVERLAP)

4. Add a small test in src/ingestion/chunking/RecursiveChunker.test.ts:
   - Test: long text produces multiple chunks
   - Test: each chunk length is <= CHUNK_SIZE + some tolerance
   - Test: overlap characters appear at start of next chunk
   - Test: chunk count is correct for known input
   - Test: empty text throws
   - Use vitest
```

### Acceptance criteria
- [ ] A 5000-character input with chunkSize=1000, overlap=200 produces 5–6 chunks
- [ ] Each chunk's text length is within bounds
- [ ] `npm test` passes chunking tests
- [ ] TypeScript compiles cleanly

### Files produced
```
src/ingestion/chunking/IChunker.ts
src/ingestion/chunking/RecursiveChunker.ts
src/ingestion/chunking/chunking.config.ts
src/ingestion/chunking/RecursiveChunker.test.ts
```

---

## Phase 3 — Embedding layer

### Goal
An `OllamaEmbedder` that calls the local Ollama API (no key required) using `nomic-embed-text`, implementing `IEmbeddingService`. Factory pattern kept so you can add cloud embedders later without touching the pipeline.

### Dependencies to install
```bash
npm install ollama
# Ollama JS client — talks to your local ollama serve process. No API key.
```

### Codex prompt
```
In src/embeddings/, implement the embedding service layer using local Ollama (free, no API key):

1. src/embeddings/IEmbeddingService.ts:
   export interface IEmbeddingService {
     embedText(text: string): Promise<number[]>;
     embedBatch(texts: string[]): Promise<number[][]>;
     readonly dimensions: number;
     readonly model: string;
   }

2. src/embeddings/OllamaEmbedder.ts:
   - Implements IEmbeddingService
   - Constructor: baseUrl: string, model: string
   - Uses the `ollama` npm package: import { Ollama } from 'ollama'
   - client = new Ollama({ host: baseUrl })
   - embedText(text): const res = await client.embeddings({ model, prompt: text }); return res.embedding;
   - embedBatch(texts): call embedText for each text in parallel using Promise.all
     (Ollama embeddings endpoint handles one text at a time; Promise.all parallelises the calls)
   - dimensions: 768 for nomic-embed-text (hard-coded, or detect from first response length)
   - model getter: returns this._model
   - On connection error (ECONNREFUSED): throw new VectorStoreError('Ollama is not running. Start it with: ollama serve')
   - No retry needed — Ollama is local and fast; if it fails, it fails immediately

3. src/embeddings/EmbedderFactory.ts:
   - Exports function createEmbedder(config: Config): IEmbeddingService
   - For now: always return new OllamaEmbedder(config.OLLAMA_BASE_URL, config.OLLAMA_EMBED_MODEL)
   - The factory abstraction is kept so adding OpenAI/Cohere later is a one-line change
   - Log at startup: logger.info({ model: config.OLLAMA_EMBED_MODEL, baseUrl: config.OLLAMA_BASE_URL }, 'Embedder ready (Ollama)')

4. src/embeddings/embedder.test.ts (unit test — mock the ollama client):
   - vi.mock('ollama') before tests
   - Test: embedText('hello') returns a number[] of length 768
   - Test: embedBatch(['a', 'b', 'c']) returns array of 3 embeddings
   - Test: when Ollama throws ECONNREFUSED, embedText throws a descriptive error
```

### Acceptance criteria
- [ ] Unit tests pass with mocked API
- [ ] Manual smoke test: `embedText('hello world')` returns a float array of length 768
- [ ] Ollama not running → descriptive error message (not a crash)
- [ ] TypeScript compiles cleanly

### Files produced
```
src/embeddings/IEmbeddingService.ts
src/embeddings/OllamaEmbedder.ts
src/embeddings/EmbedderFactory.ts
src/embeddings/embedder.test.ts
```

---

## Phase 4 — Vector store layer

### Goal
Both `PgVectorStore` and `QdrantVectorStore` implement `IVectorStore`. Switching is a single env var change. This is the most complex phase — take your time.

### Dependencies to install
```bash
npm install pg @types/pg @qdrant/js-client-rest uuid @types/uuid
```

### Codex prompt (Part A — interface + pgvector)
```
In src/vectorstore/, implement the vector store layer. Start with the interface and pgvector adapter:

1. src/vectorstore/IVectorStore.ts:
   export interface IVectorStore {
     upsert(chunks: VectorChunk[]): Promise<void>;
     similaritySearch(embedding: number[], opts: SearchOpts): Promise<ScoredChunk[]>;
     delete(documentId: string): Promise<void>;
     healthCheck(): Promise<boolean>;
   }
   (import types from @/common/types)

2. src/vectorstore/pgvector/pgvector.schema.sql:
   Create this SQL schema file (not executed automatically, user runs it manually or via migration):
   
   CREATE EXTENSION IF NOT EXISTS vector;
   
   CREATE TABLE IF NOT EXISTS chunks (
     id          UUID PRIMARY KEY,
     document_id UUID NOT NULL,
     filename    TEXT NOT NULL,
     chunk_index INTEGER NOT NULL,
     text        TEXT NOT NULL,
     embedding   vector(768),  -- nomic-embed-text produces 768-dim vectors
     page_number INTEGER,
     sheet_name  TEXT,
     created_at  TIMESTAMPTZ DEFAULT NOW()
   );
   
   CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
   CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

3. src/vectorstore/pgvector/PgVectorStore.ts:
   - Implements IVectorStore
   - Constructor: databaseUrl: string — creates a pg Pool
   - upsert(chunks): INSERT INTO chunks (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, embedding=EXCLUDED.embedding — batch all chunks in one query using unnest
   - similaritySearch(embedding, opts): 
       SELECT id, document_id, filename, chunk_index, text, page_number, sheet_name,
              1 - (embedding <=> $1::vector) AS score
       FROM chunks
       WHERE 1 - (embedding <=> $1::vector) >= $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3
     Returns ScoredChunk[] mapped from rows
   - delete(documentId): DELETE FROM chunks WHERE document_id = $1
   - healthCheck(): SELECT 1 — return true if succeeds, false if throws
   - All methods wrap pg errors in VectorStoreError
   - Pool config: max 10 connections, connectionTimeoutMillis 5000
```

### Codex prompt (Part B — Qdrant adapter)
```
In src/vectorstore/qdrant/, implement the Qdrant vector store adapter:

1. src/vectorstore/qdrant/qdrant.init.ts:
   - Exports async function ensureQdrantCollection(client: QdrantClient, collectionName: string, dimensions: number): Promise<void>
   - Checks if collection exists (client.getCollection)
   - If not, creates it: client.createCollection with vectors config: { size: dimensions, distance: 'Cosine' }
   - Logs creation vs skipping with logger

2. src/vectorstore/qdrant/QdrantVectorStore.ts:
   - Implements IVectorStore
   - Constructor: url: string, collectionName: string, dimensions: number
   - Uses @qdrant/js-client-rest: new QdrantClient({ url })
   - Calls ensureQdrantCollection on first operation (lazy init pattern with a boolean flag)
   - upsert(chunks): client.upsert(collectionName, { points: chunks.map(c => ({ id: c.id, vector: c.embedding, payload: { documentId: c.metadata.documentId, filename: c.metadata.filename, chunkIndex: c.metadata.chunkIndex, text: c.text, pageNumber: c.metadata.pageNumber, sheetName: c.metadata.sheetName } })) })
   - similaritySearch(embedding, opts): client.search(collectionName, { vector: embedding, limit: opts.topK, score_threshold: opts.minScore, with_payload: true })
     Map results to ScoredChunk[]
   - delete(documentId): client.delete(collectionName, { filter: { must: [{ key: 'documentId', match: { value: documentId } }] } })
   - healthCheck(): client.getCollections() — return true if no throw

3. src/vectorstore/VectorStoreFactory.ts:
   - Exports function createVectorStore(config: Config, embedderDimensions: number): IVectorStore
   - switch on config.VECTOR_STORE
   - 'pgvector': return new PgVectorStore(config.DATABASE_URL)
   - 'qdrant': return new QdrantVectorStore(config.QDRANT_URL, config.QDRANT_COLLECTION, embedderDimensions)
   - Note: embedderDimensions will be 768 when using OllamaEmbedder with nomic-embed-text
   - Throws descriptive Error for unknown value
```

### Setup steps for pgvector (run after docker-compose up)
```bash
# Apply the schema
docker exec -i rag-langgraph-db-1 psql -U raguser -d ragdb < src/vectorstore/pgvector/pgvector.schema.sql
```

### Acceptance criteria
- [ ] Schema applies cleanly via psql
- [ ] `PgVectorStore.upsert([...])` inserts rows (check with `psql SELECT count(*) FROM chunks;`)
- [ ] `PgVectorStore.similaritySearch(embedding, { topK: 5 })` returns results
- [ ] `PgVectorStore.delete(documentId)` removes rows
- [ ] Switching `VECTOR_STORE=qdrant` uses Qdrant (check Qdrant dashboard at http://localhost:6333/dashboard)
- [ ] `healthCheck()` returns true when service is up
- [ ] TypeScript compiles cleanly

### Files produced
```
src/vectorstore/IVectorStore.ts
src/vectorstore/pgvector/PgVectorStore.ts
src/vectorstore/pgvector/pgvector.schema.sql
src/vectorstore/qdrant/QdrantVectorStore.ts
src/vectorstore/qdrant/qdrant.init.ts
src/vectorstore/VectorStoreFactory.ts
```

---

## Phase 5 — Document metadata layer

### Goal
A `documents` table and repository that tracks every ingested file's status, filename, chunk count, and upload time. Used by `GET /documents`.

### Codex prompt
```
In src/documents/, implement the document metadata layer:

1. Create a migration SQL file at src/documents/documents.schema.sql:
   CREATE TABLE IF NOT EXISTS documents (
     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     filename    TEXT NOT NULL,
     mime_type   TEXT NOT NULL,
     status      TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
     chunk_count INTEGER NOT NULL DEFAULT 0,
     error       TEXT,
     uploaded_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at  TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);

2. src/documents/IDocumentRepository.ts:
   export interface IDocumentRepository {
     create(filename: string, mimeType: string): Promise<DocumentRecord>;
     updateStatus(id: string, status: DocumentRecord['status'], chunkCount?: number, error?: string): Promise<void>;
     findAll(): Promise<DocumentRecord[]>;
     findById(id: string): Promise<DocumentRecord | null>;
     delete(id: string): Promise<void>;
   }

3. src/documents/PgDocumentRepository.ts:
   - Implements IDocumentRepository
   - Constructor: pool: Pool (from pg)
   - create: INSERT INTO documents (filename, mime_type) VALUES ($1, $2) RETURNING * — maps row to DocumentRecord
   - updateStatus: UPDATE documents SET status=$2, chunk_count=COALESCE($3, chunk_count), error=$4, updated_at=NOW() WHERE id=$1
   - findAll: SELECT * FROM documents ORDER BY uploaded_at DESC — maps rows to DocumentRecord[]
   - findById: SELECT * FROM documents WHERE id=$1 — returns null if not found
   - delete: DELETE FROM documents WHERE id=$1
   - Private helper: mapRow(row): DocumentRecord — maps snake_case DB columns to camelCase DTO

4. src/documents/index.ts:
   - Re-exports IDocumentRepository and PgDocumentRepository
```

### Setup step
```bash
docker exec -i rag-langgraph-db-1 psql -U raguser -d ragdb < src/documents/documents.schema.sql
```

### Acceptance criteria
- [ ] Schema applies cleanly
- [ ] `create('test.pdf', 'application/pdf')` inserts a row and returns a DocumentRecord
- [ ] `updateStatus(id, 'ready', 10)` updates the row
- [ ] `findAll()` returns all documents ordered by upload time
- [ ] TypeScript compiles cleanly

### Files produced
```
src/documents/IDocumentRepository.ts
src/documents/PgDocumentRepository.ts
src/documents/documents.schema.sql
src/documents/index.ts
```

---

## Phase 6 — Ingestion service

### Goal
`IngestionService` orchestrates the full pipeline: receive buffer → parse → chunk → embed (batched) → upsert. Creates and updates a DocumentRecord throughout.

### Codex prompt
```
Create src/ingestion/IngestionService.ts:

export class IngestionService {
  constructor(
    private readonly docRepo: IDocumentRepository,
    private readonly vectorStore: IVectorStore,
    private readonly embedder: IEmbeddingService,
    private readonly chunker: IChunker,
  ) {}

  async ingest(buffer: Buffer, filename: string, mimeType: string): Promise<{ documentId: string; chunkCount: number }> {
    // Step 1: Create document record with status 'processing'
    const doc = await this.docRepo.create(filename, mimeType);
    
    try {
      // Step 2: Parse the file
      const parser = ParserFactory.getParser(mimeType);  // may throw UnsupportedTypeError
      const parsed = await parser.parse(buffer, filename); // may throw ParseError / EmptyDocumentError
      
      // Step 3: Chunk the text
      const rawChunks = this.chunker.chunk(parsed.text, {
        documentId: doc.id,
        filename,
      });
      // rawChunks have empty embedding arrays at this point
      
      // Step 4: Embed in batches of 50
      const EMBED_BATCH_SIZE = 50;
      const embeddedChunks: VectorChunk[] = [];
      for (let i = 0; i < rawChunks.length; i += EMBED_BATCH_SIZE) {
        const batch = rawChunks.slice(i, i + EMBED_BATCH_SIZE);
        const texts = batch.map(c => c.text);
        const embeddings = await this.embedder.embedBatch(texts);
        batch.forEach((chunk, j) => {
          embeddedChunks.push({ ...chunk, embedding: embeddings[j] });
        });
        logger.debug({ batchStart: i, batchEnd: i + batch.length }, 'embedded batch');
      }
      
      // Step 5: Upsert to vector store
      await this.vectorStore.upsert(embeddedChunks);
      
      // Step 6: Update document record to 'ready'
      await this.docRepo.updateStatus(doc.id, 'ready', embeddedChunks.length);
      
      logger.info({ documentId: doc.id, chunkCount: embeddedChunks.length, filename }, 'ingestion complete');
      return { documentId: doc.id, chunkCount: embeddedChunks.length };
      
    } catch (err) {
      // Mark document as failed with error message
      await this.docRepo.updateStatus(doc.id, 'failed', 0, (err as Error).message);
      logger.error({ documentId: doc.id, filename, err }, 'ingestion failed');
      throw err; // re-throw — let the API layer handle the HTTP response
    }
  }
}

Also create src/ingestion/index.ts that exports IngestionService.
```

### Acceptance criteria
- [ ] `ingest(pdfBuffer, 'test.pdf', 'application/pdf')` works end-to-end (use a real small PDF)
- [ ] Document record status goes from `processing` → `ready`
- [ ] Chunks appear in the vector store (check via psql or Qdrant dashboard)
- [ ] Corrupt file: document status goes to `failed`, error saved
- [ ] Unsupported MIME: throws `UnsupportedTypeError`
- [ ] TypeScript compiles cleanly

### Files produced
```
src/ingestion/IngestionService.ts
src/ingestion/index.ts
```

---

## Phase 7 — LangGraph pipeline

### Goal
A compiled LangGraph graph with 4 nodes and a conditional rewrite edge. The graph receives a query string and returns an answer with cited sources.

### Dependencies to install
```bash
npm install @langchain/langgraph @langchain/ollama @langchain/core
# @langchain/ollama talks to your local Ollama server — no API key needed
```

### Codex prompt (Part A — state + nodes)
```
In src/graph/, implement the LangGraph RAG pipeline:

1. src/graph/state.ts:
   import { Annotation } from '@langchain/langgraph';
   
   export const RagStateAnnotation = Annotation.Root({
     query: Annotation<string>(),
     rewrittenQuery: Annotation<string | undefined>({ default: () => undefined }),
     retrievedChunks: Annotation<ScoredChunk[]>({ default: () => [] }),
     gradedChunks: Annotation<ScoredChunk[]>({ default: () => [] }),
     answer: Annotation<string | undefined>({ default: () => undefined }),
     sources: Annotation<ScoredChunk[]>({ default: () => [] }),
     retryCount: Annotation<number>({ default: () => 0 }),
     confidence: Annotation<'high' | 'low' | undefined>({ default: () => undefined }),
   });
   
   export type RagState = typeof RagStateAnnotation.State;

2. src/graph/nodes/retrieve.node.ts:
   export async function retrieveNode(state: RagState, deps: { vectorStore: IVectorStore; embedder: IEmbeddingService; config: Config }): Promise<Partial<RagState>> {
     // Use rewrittenQuery if available (after a rewrite), otherwise original query
     const queryToUse = state.rewrittenQuery ?? state.query;
     const embedding = await deps.embedder.embedText(queryToUse);
     const chunks = await deps.vectorStore.similaritySearch(embedding, {
       topK: deps.config.TOP_K,
       minScore: 0,  // Get all, grading will filter
     });
     logger.debug({ chunkCount: chunks.length, query: queryToUse }, 'retrieved chunks');
     return { retrievedChunks: chunks };
   }

3. src/graph/nodes/gradeDocuments.node.ts:
   - Takes state.retrievedChunks and state.query
   - For each chunk, call LLM with this prompt:
     "You are grading whether a document chunk is relevant to answer a question.
      Question: {query}
      Chunk: {chunk.text}
      Reply with only 'yes' or 'no'. Is this chunk relevant?"
   - Grade all chunks in parallel (Promise.all)
   - Collect chunks where LLM replied 'yes' as gradedChunks
   - Compute relevanceRatio = gradedChunks.length / retrievedChunks.length
   - Set confidence: if relevanceRatio >= 0.5 OR retryCount >= config.MAX_REWRITE_RETRIES → 'high', else → 'low'
   - Also apply minScore filter: filter gradedChunks where score >= config.MIN_RELEVANCE_SCORE
   - Log: how many chunks passed grading
   - Return { gradedChunks, confidence }

4. src/graph/nodes/rewriteQuery.node.ts:
   - Takes state.query and state.retryCount
   - Calls LLM with prompt:
     "The original question did not retrieve useful documents. Rewrite the question to be more specific and likely to find relevant information.
      Original question: {query}
      Rewritten question (return ONLY the rewritten question, no explanation):"
   - Returns { rewrittenQuery: llmResponse.trim(), retryCount: state.retryCount + 1 }
   - Logs: original query, rewritten query, retry count

5. src/graph/nodes/generate.node.ts:
   - Takes state.gradedChunks and state.query (or rewrittenQuery)
   - Builds context string: state.gradedChunks.map((c, i) => `[${i+1}] ${c.text}`).join('\n\n')
   - Calls LLM with prompt:
     "Answer the question using only the provided context. If the context does not contain enough information, say so clearly.
      Context:
      {context}
      
      Question: {query}
      
      Answer:"
   - Returns { answer: llmResponse, sources: state.gradedChunks }

Note: create a shared src/graph/llm.ts:
   import { ChatOllama } from '@langchain/ollama';
   export function createLLM(config: Config): BaseChatModel {
     return new ChatOllama({
       baseUrl: config.OLLAMA_BASE_URL,
       model: config.OLLAMA_LLM_MODEL,   // default: llama3.2
       temperature: 0,                    // deterministic grading
     });
   }
   // No API key. ChatOllama calls http://localhost:11434 locally.
```

### Codex prompt (Part B — edges + graph compilation)
```
Complete the LangGraph pipeline:

1. src/graph/edges/routeAfterGrade.ts:
   export function routeAfterGrade(state: RagState): 'rewrite' | 'generate' {
     if (state.confidence === 'high') return 'generate';
     if (state.retryCount >= config.MAX_REWRITE_RETRIES) return 'generate'; // safety net
     return 'rewrite';
   }

2. src/graph/ragGraph.ts:
   import { StateGraph, START, END } from '@langchain/langgraph';
   
   export function buildRagGraph(deps: { vectorStore: IVectorStore; embedder: IEmbeddingService; config: Config }) {
     const graph = new StateGraph(RagStateAnnotation)
       .addNode('retrieve', (state) => retrieveNode(state, deps))
       .addNode('gradeDocuments', (state) => gradeDocumentsNode(state, deps))
       .addNode('rewriteQuery', (state) => rewriteQueryNode(state, deps))
       .addNode('generate', (state) => generateNode(state, deps))
       .addEdge(START, 'retrieve')
       .addEdge('retrieve', 'gradeDocuments')
       .addConditionalEdges('gradeDocuments', routeAfterGrade, {
         rewrite: 'rewriteQuery',
         generate: 'generate',
       })
       .addEdge('rewriteQuery', 'retrieve')
       .addEdge('generate', END);
     
     return graph.compile();
   }
   
   export type CompiledRagGraph = ReturnType<typeof buildRagGraph>;

3. src/graph/graph.test.ts (unit test with mocked deps):
   - Mock vectorStore, embedder, and LLM calls
   - Test: high confidence path — retrieve → grade (passes) → generate, no rewrite
   - Test: low confidence path — retrieve → grade (fails) → rewrite → retrieve → grade (passes) → generate
   - Test: MAX_REWRITE_RETRIES guard prevents infinite loop — after N rewrites, force generate
   - Test: final state has answer and sources populated
```

### Acceptance criteria
- [ ] Graph compiles without TypeScript errors
- [ ] Unit tests pass with mocked deps
- [ ] Manual smoke test: `buildRagGraph(deps).invoke({ query: 'test question' })` returns state with `answer` populated
- [ ] Rewrite loop triggers when retrieval returns low-relevance chunks
- [ ] Rewrite never loops more than `MAX_REWRITE_RETRIES` times

### Files produced
```
src/graph/state.ts
src/graph/llm.ts
src/graph/nodes/retrieve.node.ts
src/graph/nodes/gradeDocuments.node.ts
src/graph/nodes/rewriteQuery.node.ts
src/graph/nodes/generate.node.ts
src/graph/edges/routeAfterGrade.ts
src/graph/ragGraph.ts
src/graph/graph.test.ts
```

---

## Phase 8 — REST API layer

### Goal
Create four REST endpoints (`/upload`, `/query`, `/documents`) with file validation, query validation, error handling, and request routing to the ingestion service and LangGraph graph.

### Dependencies to install
```bash
npm install multer express-async-errors
```

### Codex prompt — Part A: Middleware (create each file separately)

**Step 1: Create src/api/middleware/validateFile.ts**

This middleware processes uploaded files using multer and validates them:

```typescript
// Imports
import multer from 'multer';
import path from 'path';
import { AppError, UnsupportedTypeError } from '@/common/errors';
import { config } from '@/common/config';
import { ALLOWED_MIME_TYPES } from '@/ingestion/parsers/ParserFactory';
import { Request, Response, NextFunction } from 'express';

// Create multer instance
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// Export middleware function
export function validateFile(req: Request, res: Response, next: NextFunction) {
  // Step 1: Run multer parsing for single file named 'file'
  upload.single('file')(req, res, (err) => {
    // Step 2: Handle multer errors
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'FILE_TOO_LARGE', `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit`));
      }
      return next(new AppError(400, 'UPLOAD_ERROR', err.message));
    }
    
    // Step 3: Check file exists
    if (!req.file) {
      return next(new AppError(400, 'NO_FILE', 'No file was uploaded'));
    }
    
    // Step 4: Check MIME type is allowed
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return next(new UnsupportedTypeError(req.file.mimetype));
    }
    
    // Step 5: Sanitize filename to prevent path traversal
    req.file.originalname = path.basename(req.file.originalname);
    
    // Step 6: Pass to next middleware
    next();
  });
}
```

**Step 2: Create src/api/middleware/validateQuery.ts**

This middleware validates JSON POST body for /query endpoint:

```typescript
// Imports
import { EmptyQueryError, AppError } from '@/common/errors';
import { Request, Response, NextFunction } from 'express';

export function validateQuery(req: Request, res: Response, next: NextFunction) {
  // Step 1: Extract and trim query
  const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  
  // Step 2: Validate query is not empty
  if (!query) {
    return next(new EmptyQueryError());
  }
  
  // Step 3: Validate optional topK parameter if provided
  if (req.body.topK !== undefined) {
    const topK = Number(req.body.topK);
    if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
      return next(new AppError(400, 'INVALID_TOP_K', 'topK must be an integer between 1 and 20'));
    }
  }
  
  // Step 4: Validate optional minScore parameter if provided
  if (req.body.minScore !== undefined) {
    const minScore = Number(req.body.minScore);
    if (typeof minScore !== 'number' || minScore < 0 || minScore > 1) {
      return next(new AppError(400, 'INVALID_MIN_SCORE', 'minScore must be a number between 0 and 1'));
    }
  }
  
  // Step 5: Pass to next middleware
  next();
}
```

**Step 3: Create src/api/middleware/errorHandler.ts**

This is the global error handler. Register it LAST in server.ts:

```typescript
// Imports
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/common/errors';
import { logger } from '@/common/logger';
import { config } from '@/common/config';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Step 1: Log all errors
  logger.error({ err, path: req.path, method: req.method }, 'Request error');
  
  // Step 2: Check if error is an AppError (our custom error type)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Step 3: Handle specific multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'FILE_TOO_LARGE',
      message: `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit`,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Step 4: For any other error, return generic 500
  // NOTE: Never expose stack traces in production
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    // Only include stack in development
    ...(config.LOG_LEVEL === 'debug' && { stack: err.stack }),
  });
}
```

### Codex prompt — Part B: Routes (create each file separately)

**Step 4: Create src/api/routes/upload.route.ts**

POST /upload endpoint — receives file buffer and ingests it:

```typescript
// Imports
import { Router, Request, Response, NextFunction } from 'express';
import { IngestionService } from '@/ingestion/IngestionService';

export function createUploadRoute(ingestionService: IngestionService) {
  const router = Router();
  
  router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // At this point, validateFile middleware has already:
      // - Parsed the file into req.file
      // - Validated MIME type
      // - Sanitized filename
      
      // Step 1: Extract file details
      const file = req.file!; // ! because validateFile ensures it exists
      const buffer = file.buffer;
      const filename = file.originalname;
      const mimeType = file.mimetype;
      
      // Step 2: Call ingestion service
      const result = await ingestionService.ingest(buffer, filename, mimeType);
      
      // Step 3: Return success response with 201 status
      res.status(201).json({
        documentId: result.documentId,
        filename,
        chunkCount: result.chunkCount,
        message: 'File ingested successfully',
      });
    } catch (err) {
      // Pass any error to error handler middleware
      next(err);
    }
  });
  
  return router;
}
```

**Step 5: Create src/api/routes/query.route.ts**

POST /query endpoint — receives question and invokes LangGraph:

```typescript
// Imports
import { Router, Request, Response, NextFunction } from 'express';
import { CompiledRagGraph } from '@/graph/ragGraph';
import { config } from '@/common/config';
import { GraphExecutionError } from '@/common/errors';
import { logger } from '@/common/logger';

export function createQueryRoute(ragGraph: CompiledRagGraph) {
  const router = Router();
  
  router.post('/query', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // At this point, validateQuery middleware has already validated req.body.query
      
      // Step 1: Extract parameters from request body
      const query = req.body.query.trim();
      const topK = req.body.topK ?? config.TOP_K;
      const minScore = req.body.minScore ?? config.MIN_RELEVANCE_SCORE;
      
      logger.debug({ query, topK, minScore }, 'Processing query');
      
      // Step 2: Invoke LangGraph with timeout protection (30 seconds)
      let finalState;
      try {
        finalState = await Promise.race([
          ragGraph.invoke({ query, topK, minScore }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout after 30s')), 30000)
          ),
        ]);
      } catch (timeoutErr) {
        return next(new GraphExecutionError('Query timed out after 30 seconds'));
      }
      
      // Step 3: Handle case where answer is empty
      const answer = finalState.answer || 'I could not find relevant information to answer that question.';
      
      // Step 4: Format sources (trim text to 200 chars)
      const sources = (finalState.sources || []).map((chunk: any) => ({
        id: chunk.id,
        text: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
        score: chunk.score,
        documentId: chunk.metadata.documentId,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
      }));
      
      // Step 5: Return response
      res.status(200).json({
        answer,
        sources,
        rewriteCount: finalState.retryCount || 0,
        query: finalState.rewrittenQuery || query,
      });
    } catch (err) {
      next(err);
    }
  });
  
  return router;
}
```

**Step 6: Create src/api/routes/documents.route.ts**

GET /documents and DELETE /documents/:id endpoints:

```typescript
// Imports
import { Router, Request, Response, NextFunction } from 'express';
import { IDocumentRepository } from '@/documents/IDocumentRepository';
import { IVectorStore } from '@/vectorstore/IVectorStore';
import { AppError } from '@/common/errors';
import { logger } from '@/common/logger';

export function createDocumentsRoute(
  docRepo: IDocumentRepository,
  vectorStore: IVectorStore
) {
  const router = Router();
  
  // GET /documents - list all uploaded documents
  router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documents = await docRepo.findAll();
      res.status(200).json({
        documents,
        count: documents.length,
      });
    } catch (err) {
      next(err);
    }
  });
  
  // DELETE /documents/:id - remove a document and its embeddings
  router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Step 1: Check document exists
      const doc = await docRepo.findById(id);
      if (!doc) {
        return next(new AppError(404, 'NOT_FOUND', `Document ${id} not found`));
      }
      
      logger.debug({ documentId: id, filename: doc.filename }, 'Deleting document');
      
      // Step 2: Delete from vector store
      await vectorStore.delete(id);
      
      // Step 3: Delete from document repository
      await docRepo.delete(id);
      
      // Step 4: Return success
      res.status(200).json({
        message: 'Document deleted',
        documentId: id,
      });
    } catch (err) {
      next(err);
    }
  });
  
  return router;
}
```

### Codex prompt — Part C: Update server.ts

**Step 7: Update src/api/server.ts**

Wire together all routes, middleware, and dependencies:

```typescript
// At the top of server.ts, before any route registration:
import 'express-async-errors';

import express from 'express';
import { config } from '@/common/config';
import { logger } from '@/common/logger';

// Import your dependencies (to be created)
import { createEmbedder } from '@/embeddings/EmbedderFactory';
import { createVectorStore } from '@/vectorstore/VectorStoreFactory';
import { createChunker } from '@/ingestion/chunking/chunking.config';
import { PgDocumentRepository } from '@/documents/PgDocumentRepository';
import { IngestionService } from '@/ingestion/IngestionService';
import { buildRagGraph } from '@/graph/ragGraph';

// Import routes
import { createUploadRoute } from '@/api/routes/upload.route';
import { createQueryRoute } from '@/api/routes/query.route';
import { createDocumentsRoute } from '@/api/routes/documents.route';

// Import middleware
import { validateFile } from '@/api/middleware/validateFile';
import { validateQuery } from '@/api/middleware/validateQuery';
import { errorHandler } from '@/api/middleware/errorHandler';

const app = express();

// Middleware
app.use(express.json());
app.use(require('pino-http')({ logger }));

// Step 1: Initialize all dependencies
const embedder = createEmbedder(config);
const vectorStore = createVectorStore(config, embedder.dimensions);
const chunker = createChunker(config);
const docRepo = new PgDocumentRepository(/* pass pg Pool */);
const ingestionService = new IngestionService(docRepo, vectorStore, embedder, chunker);
const ragGraph = buildRagGraph({ vectorStore, embedder, config });

// Step 2: Register health check route BEFORE other routes
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

// Step 3: Register upload route with file validation middleware
app.use(validateFile, createUploadRoute(ingestionService));

// Step 4: Register query route with query validation middleware
app.use(validateQuery, createQueryRoute(ragGraph));

// Step 5: Register documents route (no middleware needed)
app.use(createDocumentsRoute(docRepo, vectorStore));

// Step 6: Register error handler LAST (must be after all routes)
app.use(errorHandler);

// Step 7: Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started');
});
```

### Acceptance criteria
- [ ] `npm run build` compiles with no errors
- [ ] `POST /upload` with a valid PDF file returns 201 with `{ documentId, chunkCount }`
- [ ] `POST /query` with body `{ "query": "test question" }` returns 200 with `{ answer, sources }`
- [ ] `GET /documents` returns 200 with list of documents
- [ ] `DELETE /documents/:id` removes the document and returns 200
- [ ] `GET /health` returns 200
- [ ] Uploading a file with unsupported MIME type returns 400 with error code `UNSUPPORTED_TYPE`
- [ ] Uploading a corrupt/empty PDF returns 422 with error code `PARSE_ERROR`
- [ ] Uploading a file > MAX_FILE_SIZE_MB returns 400 with error code `FILE_TOO_LARGE`
- [ ] POST /query with empty query body returns 400 with error code `EMPTY_QUERY`

### Files produced
```
src/api/middleware/validateFile.ts
src/api/middleware/validateQuery.ts
src/api/middleware/errorHandler.ts
src/api/routes/upload.route.ts
src/api/routes/query.route.ts
src/api/routes/documents.route.ts
src/api/server.ts  (updated)
```

---

## Phase 9 — Error handling & validation hardening

### Goal
Add startup health checks, graceful shutdown, process-level error guards, and harden graph/LLM error handling to prevent crashes and ensure clean error responses.

### Codex prompt — Part A: Add startup checks and process guards to server.ts

**Add this code AFTER app is created but BEFORE app.listen():**

```typescript
// Step 1: Add process-level error guards
process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err: any) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

// Step 2: Add startup health check function
async function checkStartupHealth() {
  try {
    // Check vector store
    const vectorStoreOk = await vectorStore.healthCheck();
    if (vectorStoreOk) {
      logger.info('Vector store health check: OK');
    } else {
      logger.warn('Vector store health check: FAILED');
    }
  } catch (err) {
    logger.warn({ err }, 'Vector store not ready yet (this is OK in dev)');
  }
}

// Step 3: Call health check before starting server
await checkStartupHealth();

// Step 4: Start HTTP server and add graceful shutdown
const httpServer = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Server started');
});

// Step 5: Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
```

### Codex prompt — Part B: Add LLM error handling in graph nodes

**Update src/graph/nodes/gradeDocuments.node.ts:**

Wrap LLM calls in try/catch so one failed grade doesn't crash the whole graph:

```typescript
// Inside gradeDocuments.node.ts, when grading chunks:

const gradingPromises = state.retrievedChunks.map(async (chunk) => {
  try {
    // Call LLM to grade this chunk
    const response = await llm.invoke(gradePrompt);
    const verdict = response.content.toLowerCase().trim();
    
    if (verdict.includes('yes')) {
      return chunk; // Include this chunk
    }
    return null; // Exclude this chunk
  } catch (err) {
    // If LLM call fails, log and exclude the chunk
    logger.warn({ chunkId: chunk.id, err }, 'Failed to grade chunk — excluding it');
    return null;
  }
});

const results = await Promise.all(gradingPromises);
const gradedChunks = results.filter((c) => c !== null) as ScoredChunk[];
```

**Update src/graph/nodes/generate.node.ts:**

Handle empty chunk list gracefully:

```typescript
// Inside generate.node.ts:

if (state.gradedChunks.length === 0) {
  // No chunks passed grading — return fallback answer
  return {
    answer: "I couldn't find relevant information to answer that question. Try rephrasing or uploading more relevant documents.",
    sources: [],
  };
}

// Otherwise, proceed with normal LLM generation...
```

### Codex prompt — Part C: Add timeout and error handling to query route

**Query timeout is already in Phase 8, but verify query.route.ts has this:**

```typescript
// The timeout was added in Phase 8's queryRoute, but verify:
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Query timeout')), 30000)
);

try {
  finalState = await Promise.race([
    ragGraph.invoke({ query }),
    timeoutPromise,
  ]);
} catch (err) {
  logger.error({ err }, 'Query failed');
  return next(new GraphExecutionError((err as Error).message));
}
```

### Codex prompt — Part D: Verify no console.log anywhere

**Run this command in terminal to find any lingering console.log:**

```bash
# Find all console.log statements (should return nothing)
grep -r "console\.log" src/ || echo "No console.log found — good!"
```

### Codex prompt — Part E: Write error middleware tests

**Create src/api/middleware/errorHandler.test.ts:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './errorHandler';
import { AppError } from '@/common/errors';
import { Request, Response, NextFunction } from 'express';

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  
  beforeEach(() => {
    req = { path: '/test', method: 'POST' };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });
  
  it('should handle AppError and return correct status code', () => {
    const err = new AppError(400, 'TEST_ERROR', 'Test error message');
    
    errorHandler(err, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'TEST_ERROR',
        message: 'Test error message',
      })
    );
  });
  
  it('should handle file size errors', () => {
    const err = { code: 'LIMIT_FILE_SIZE' };
    
    errorHandler(err, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FILE_TOO_LARGE',
      })
    );
  });
  
  it('should return 500 for unknown errors', () => {
    const err = new Error('Unknown error');
    
    errorHandler(err, req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
      })
    );
  });
});
```

### Acceptance criteria
- [ ] `npm run build` compiles with no errors
- [ ] Server starts and logs health check status (OK or warning)
- [ ] Send very large file (> 20MB default): returns 400 with `FILE_TOO_LARGE`
- [ ] POST /query with malformed JSON: returns 400
- [ ] POST /query: server doesn't hang — query completes or times out at 30s
- [ ] If gradeDocuments.node.ts has an LLM error: graph continues instead of crashing
- [ ] If gradedChunks is empty after grading: returns fallback message instead of empty answer
- [ ] Running `grep -r "console\.log" src/` returns no results
- [ ] `npm test` passes errorHandler tests

---

## Phase 10 — Testing

### Goal
Write unit tests for core logic (parsers, chunking, graph nodes) and integration tests for API endpoints with real database and vector store. Focus on critical paths first.

### Dependencies to install
```bash
npm install --save-dev supertest @types/supertest
```

### Codex prompt — Part A: Unit tests (no Docker needed)

**Step 1: Create tests/unit/parsers/ParserFactory.test.ts:**

```typescript
import { describe, it, expect } from 'vitest';
import { getParser, ALLOWED_MIME_TYPES } from '@/ingestion/parsers/ParserFactory';
import { UnsupportedTypeError } from '@/common/errors';

describe('ParserFactory', () => {
  it('should return PdfParser for PDF MIME type', () => {
    const parser = getParser('application/pdf');
    expect(parser).toBeDefined();
    expect(parser.supportedMimes).toContain('application/pdf');
  });
  
  it('should throw UnsupportedTypeError for unknown MIME type', () => {
    expect(() => getParser('image/png')).toThrow(UnsupportedTypeError);
  });
  
  it('should have all 4 MIME types in ALLOWED_MIME_TYPES', () => {
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThanOrEqual(4);
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(ALLOWED_MIME_TYPES).toContain('application/msword');
  });
});
```

**Step 2: Create tests/unit/chunking/RecursiveChunker.test.ts:**

```typescript
import { describe, it, expect } from 'vitest';
import { RecursiveChunker } from '@/ingestion/chunking/RecursiveChunker';

describe('RecursiveChunker', () => {
  const chunker = new RecursiveChunker(1000, 200); // 1000 char chunks, 200 char overlap
  
  it('should split long text into multiple chunks', () => {
    const longText = 'a'.repeat(5000);
    const metadata = { documentId: 'doc1', filename: 'test.txt' };
    
    const chunks = chunker.chunk(longText, metadata);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(6); // 5000 / 1000 ≈ 5-6 chunks
  });
  
  it('should set chunk metadata correctly', () => {
    const text = 'test';
    const metadata = { documentId: 'doc1', filename: 'test.txt' };
    
    const chunks = chunker.chunk(text, metadata);
    
    expect(chunks[0].metadata.documentId).toBe('doc1');
    expect(chunks[0].metadata.filename).toBe('test.txt');
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });
  
  it('should throw error for empty text', () => {
    const metadata = { documentId: 'doc1', filename: 'test.txt' };
    
    expect(() => chunker.chunk('', metadata)).toThrow();
    expect(() => chunker.chunk('   ', metadata)).toThrow();
  });
  
  it('should return single chunk for short text', () => {
    const text = 'short text';
    const metadata = { documentId: 'doc1', filename: 'test.txt' };
    
    const chunks = chunker.chunk(text, metadata);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
  });
});
```

**Step 3: Create tests/unit/middleware/validateQuery.test.ts:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateQuery } from '@/api/middleware/validateQuery';
import { Request, Response, NextFunction } from 'express';
import { EmptyQueryError, AppError } from '@/common/errors';

describe('validateQuery middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  
  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = vi.fn();
  });
  
  it('should pass valid query', () => {
    req.body = { query: 'what is AI?' };
    
    validateQuery(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(); // Called with no error
  });
  
  it('should reject empty query string', () => {
    req.body = { query: '' };
    
    validateQuery(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(EmptyQueryError));
  });
  
  it('should reject whitespace-only query', () => {
    req.body = { query: '   ' };
    
    validateQuery(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(EmptyQueryError));
  });
  
  it('should reject invalid topK', () => {
    req.body = { query: 'test', topK: 25 }; // > 20
    
    validateQuery(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
  
  it('should accept valid topK', () => {
    req.body = { query: 'test', topK: 5 };
    
    validateQuery(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalledWith(); // No error
  });
});
```

### Codex prompt — Part B: Graph node tests

**Step 4: Create tests/unit/graph/gradeDocuments.test.ts:**

Mock the LLM and test grading logic:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gradeDocumentsNode } from '@/graph/nodes/gradeDocuments.node';
import { RagState, RagStateAnnotation } from '@/graph/state';
import { ScoredChunk } from '@/common/types';

describe('gradeDocuments node', () => {
  let mockState: RagState;
  let mockChunk: ScoredChunk;
  
  beforeEach(() => {
    mockChunk = {
      id: 'chunk1',
      text: 'AI is artificial intelligence.',
      embedding: [],
      score: 0.9,
      metadata: { documentId: 'doc1', filename: 'test.txt', chunkIndex: 0 },
    };
    
    mockState = {
      query: 'what is AI?',
      retrievedChunks: [mockChunk],
      retryCount: 0,
    };
  });
  
  it('should include chunks where LLM says yes', async () => {
    // Mock LLM to always return 'yes'
    const mockLLM = vi.fn().mockResolvedValue({ content: 'yes' });
    const deps = { llm: mockLLM, config: { MAX_REWRITE_RETRIES: 3, MIN_RELEVANCE_SCORE: 0.7 } };
    
    const result = await gradeDocumentsNode(mockState, deps);
    
    expect(result.gradedChunks.length).toBe(1);
    expect(result.confidence).toBe('high'); // Only yes chunks + good ratio → high confidence
  });
  
  it('should exclude chunks where LLM says no', async () => {
    // Mock LLM to always return 'no'
    const mockLLM = vi.fn().mockResolvedValue({ content: 'no' });
    const deps = { llm: mockLLM, config: { MAX_REWRITE_RETRIES: 3, MIN_RELEVANCE_SCORE: 0.7 } };
    
    const result = await gradeDocumentsNode(mockState, deps);
    
    expect(result.gradedChunks.length).toBe(0);
    expect(result.confidence).toBe('low'); // No yes chunks → low confidence
  });
  
  it('should force high confidence after MAX_REWRITE_RETRIES', async () => {
    // Mock LLM to return 'no'
    const mockLLM = vi.fn().mockResolvedValue({ content: 'no' });
    
    // Set retryCount to max (no more rewrites allowed)
    mockState.retryCount = 3; // Assuming MAX_REWRITE_RETRIES = 3
    const deps = { llm: mockLLM, config: { MAX_REWRITE_RETRIES: 3, MIN_RELEVANCE_SCORE: 0.7 } };
    
    const result = await gradeDocumentsNode(mockState, deps);
    
    expect(result.confidence).toBe('high'); // Force high to prevent infinite loop
  });
});
```

### Codex prompt — Part C: Integration tests (requires Docker)

**Step 5: Create tests/integration/upload.test.ts:**

Test the full upload flow with real services:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Import your Express app (needs to be exported from server.ts)
import { app } from '@/api/server';

describe('POST /upload integration test', () => {
  let uploadedDocumentId: string;
  
  it('should upload a valid PDF file and return 201', async () => {
    // Create a minimal PDF buffer (use a real small PDF from assets, or create one)
    const pdfPath = path.join(__dirname, '../fixtures/sample.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    const response = await request(app)
      .post('/upload')
      .attach('file', pdfBuffer, 'sample.pdf');
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('documentId');
    expect(response.body).toHaveProperty('chunkCount');
    expect(response.body.chunkCount).toBeGreaterThan(0);
    
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
  
  it('should return 404 when deleting non-existent document', async () => {
    const response = await request(app)
      .delete('/documents/nonexistent-id');
    
    expect(response.status).toBe(404);
  });
  
  it('should delete uploaded document and return 200', async () => {
    if (!uploadedDocumentId) this.skip();
    
    const response = await request(app)
      .delete(`/documents/${uploadedDocumentId}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Document deleted');
  });
});

describe('GET /documents integration test', () => {
  it('should return list of documents', async () => {
    const response = await request(app).get('/documents');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('documents');
    expect(Array.isArray(response.body.documents)).toBe(true);
    expect(response.body).toHaveProperty('count');
  });
});
```

**Step 6: Create tests/integration/query.test.ts:**

Test the query endpoint with mocked LLM responses:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '@/api/server';

describe('POST /query integration test', () => {
  it('should reject empty query with 400', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: '' });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('EMPTY_QUERY');
  });
  
  it('should return answer and sources for valid query', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'what is artificial intelligence?' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('answer');
    expect(response.body).toHaveProperty('sources');
    expect(response.body).toHaveProperty('rewriteCount');
    expect(typeof response.body.answer).toBe('string');
    expect(Array.isArray(response.body.sources)).toBe(true);
  });
  
  it('should return fallback message when no documents are relevant', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'completely unrelated question' });
    
    expect(response.status).toBe(200);
    expect(response.body.answer).toBeDefined();
    // Even with no results, should return a message (not empty)
    expect(response.body.answer.length).toBeGreaterThan(0);
  });
  
  it('should accept custom topK parameter', async () => {
    const response = await request(app)
      .post('/query')
      .send({ query: 'test', topK: 3 });
    
    expect(response.status).toBe(200);
  });
});
```

### Codex prompt — Part D: Configure vitest

**Create vitest.config.ts:**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**/*.test.ts'], // Exclude integration by default
    timeout: 10000, // 10s for unit tests
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Update package.json scripts:**

```json
{
  "scripts": {
    "test": "vitest run tests/unit",
    "test:watch": "vitest tests/unit",
    "test:integration": "TEST_MODE=integration vitest run tests/integration",
    "test:all": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Acceptance criteria
- [ ] `npm test` runs all unit tests in < 10 seconds (no Docker needed)
- [ ] `npm run test:integration` passes with Docker running (Postgres + Qdrant)
- [ ] All tests pass (no `.skip()` calls left)
- [ ] No `any` type used in test files
- [ ] `npm run test:coverage` shows > 70% coverage for: parsers/, chunking/, graph/nodes/, middleware/
- [ ] Integration tests can be skipped locally with `npm test` (they only run with `npm run test:integration`)

---

## Phase 11 — README & final polish

### Goal
Professional README that lets a new developer clone the repo and have the full system running in under 10 minutes.

### Codex prompt
```
Write a complete README.md for the rag-langgraph project with these sections:

1. Header: project name, one-line description, badges (Node.js version, TypeScript, LangGraph)

2. Architecture overview with a Mermaid diagram showing:
   - REST API layer (Express)
   - Ingestion pipeline (Parser → Chunker → Embedder → VectorStore)
   - Query pipeline (LangGraph: retrieve → gradeDocuments → conditional → rewriteQuery or generate)
   - Infrastructure (pgvector / Qdrant / Ollama: nomic-embed-text + llama3.2)

3. What does each vector store do (when to use which):
   - pgvector: tight Postgres integration, relational filtering, simpler ops stack
   - Qdrant: higher scale, richer payload filtering, dedicated vector DB performance

4. Quick start (exact commands, copy-paste ready):
   git clone ...
   cp .env.example .env
   # edit .env with your API keys
   npm install
   docker-compose up -d
   # apply schemas:
   docker exec -i <postgres-container> psql -U raguser -d ragdb < src/vectorstore/pgvector/pgvector.schema.sql
   docker exec -i <postgres-container> psql -U raguser -d ragdb < src/documents/documents.schema.sql
   npm run dev
   # test:
   curl http://localhost:3000/health

5. API reference (table: method | path | body | response | errors)

6. Environment variables table (var | required | default | description)

7. Switching vector stores: one-line explanation that VECTOR_STORE=qdrant is all that's needed

8. Development commands table

9. Project structure (condensed tree, not every file)

10. Troubleshooting section:
    - pgvector extension not found
    - Qdrant connection refused
    - Embedding API rate limit
    - File parse fails

Also create .env.example with all variables with comments (regenerate from config.ts).
```

### Acceptance criteria
- [ ] A teammate can follow the README and get the system running without asking you questions
- [ ] Mermaid diagram renders on GitHub
- [ ] All curl examples in README actually work
- [ ] `.env.example` has every variable that `config.ts` references

---

## Common mistakes to avoid (senior notes)

These are the most common failure points in this type of project. Read this before each phase:

**Ollama-specific (read before Phase 3 and Phase 7)**
- `ollama serve` must be running before the app starts. Add a startup health check: `curl http://localhost:11434` should return `Ollama is running`. If it isn't, your embedder AND your LLM nodes will both fail with confusing errors.
- `nomic-embed-text` returns **768-dimension** vectors, not 1536. The pgvector schema column is `vector(768)`. If you ever switch to a different model (e.g. `mxbai-embed-large` = 1024 dims), you must DROP and recreate the chunks table and re-ingest everything — pgvector doesn't let you change column dimensions in place.
- `llama3.2` is fast enough for a dev loop but grading 6 chunks × 1 LLM call each = 6 sequential Ollama calls per query. This makes the first query feel slow (~10–20s on CPU). Use `Promise.all` in `gradeDocuments.node.ts` to parallelise all grading calls. Ollama handles concurrent requests.
- If `llama3.2` is too slow on your machine (no GPU), switch to `OLLAMA_LLM_MODEL=llama3.2:1b` (1 billion param version, ~600MB, much faster). Quality is slightly lower but fine for grading prompts.
- The Ollama JS client (`ollama` npm package) uses `client.embeddings({ model, prompt })` (singular `prompt`, not `input`). LangChain's `@langchain/ollama` `ChatOllama` uses the chat completions format. Don't mix them up.
- `ollama pull` must be run before `npm run dev`. If the model isn't pulled, Ollama returns a 404 that surfaces as a confusing TypeScript error. Add a startup check: ping `http://localhost:11434/api/tags` and verify the required models are in the list.

**Phase 4 (vector store)**
- pgvector requires the `vector` extension to be created in the DB before any CREATE TABLE runs. Always put `CREATE EXTENSION IF NOT EXISTS vector` first in your schema.
- The `<=>` operator is cosine distance (lower = more similar). To get cosine *similarity* (higher = more similar), use `1 - (embedding <=> query_vector)`. Your minScore filter must use the similarity value, not the distance.
- Qdrant UUIDs must be valid UUID v4 strings OR positive integers. Using `crypto.randomUUID()` for chunk IDs is safe.

**Phase 7 (LangGraph)**
- LangGraph `StateGraph` channels must declare their reducer. If you omit the `default` on optional fields, LangGraph will throw at runtime when those keys are undefined.
- The rewrite loop is `rewriteQuery → retrieve → gradeDocuments → conditional`. Never add an edge from `gradeDocuments` directly back to `gradeDocuments` — it creates an infinite graph.
- The `retryCount` guard (`retryCount >= MAX_REWRITE_RETRIES → force 'high' confidence`) must be checked inside `routeAfterGrade`, not inside `gradeDocuments`. Keep the routing logic in the edge function.
- LLM grading prompt must be strict: only respond 'yes' or 'no'. Add `.toLowerCase().trim()` to the response before comparing.

**Phase 8 (API)**
- Import `express-async-errors` at the very top of `server.ts` before any route registration. If you import it after, async errors in routes won't be caught.
- Multer's `memoryStorage()` holds the entire file in RAM. For files > 50MB, switch to disk storage. With the 20MB default limit this is fine.
- Always call `path.basename(req.file.originalname)` to sanitize the filename. Never use the raw filename from a multipart upload to write to disk or build a file path.

**General TypeScript**
- Never use `as any` to escape type errors. If you hit a typing wall, fix the type — don't suppress it.
- All async functions that can fail must be wrapped in try/catch or the caller must handle rejection. `express-async-errors` handles Express routes but not background tasks.
- Keep all external service calls (Ollama, pgvector, Qdrant) in their respective adapter classes. Graph nodes should never import `pg`, `ollama`, or `@qdrant/js-client-rest` directly — they talk to the interface only.

---

## Phase validation checklist (run before every phase commit)

```bash
npm run build          # zero TypeScript errors
npm test               # all unit tests green
curl http://localhost:3000/health  # 200 ok
docker ps              # both containers running
```

If any of these fail, do not proceed to the next phase.

---

## Suggested commit strategy

One commit per phase, with a clear message:

```
feat(phase-0): project scaffold, toolchain, docker-compose
feat(phase-1): document parsing layer (PDF, DOCX, XLSX)
feat(phase-2): recursive text chunking layer
feat(phase-3): embedding service (Ollama / nomic-embed-text — free, local)
feat(phase-4): vector store adapters (pgvector + Qdrant)
feat(phase-5): document metadata repository
feat(phase-6): ingestion service orchestration
feat(phase-7): LangGraph RAG pipeline with rewrite loop
feat(phase-8): REST API routes and middleware
feat(phase-9): error handling hardening
feat(phase-10): test suite (unit + integration)
docs(phase-11): README, architecture diagram, polish
```

This makes it easy to `git bisect` if something breaks across phases.
