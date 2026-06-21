# RAG LangGraph Project Deep Dive

This file explains the whole project in one place so you can understand the codebase and explain it clearly to someone else.

## 1. One-Line Explanation

This is a local document question-answering system built with TypeScript, Express, LangGraph, Ollama, PostgreSQL/pgvector, and a simple web UI.

Users upload documents, the backend extracts and chunks the text, creates embeddings, stores them in a vector database, and answers questions by retrieving relevant chunks and sending them to a local LLM.

## 2. What Problem This Project Solves

Normal LLMs do not know the content of your private documents.

This project solves that by using RAG, which means Retrieval-Augmented Generation.

Instead of asking the LLM directly, the system:

1. Searches uploaded documents for relevant text.
2. Sends only that relevant text to the LLM.
3. Generates an answer based on the retrieved context.
4. Shows source chunks so the user can verify where the answer came from.

In practical terms, this is a "chat with your documents" application.

## 3. Main Tech Stack

Backend:

- TypeScript
- Node.js
- Express.js
- LangGraph.js
- LangChain/Ollama integration
- PostgreSQL
- pgvector
- Optional Qdrant support
- Multer for file upload
- Zod for environment validation
- Pino for logging
- Vitest for tests

Frontend:

- HTML
- CSS
- Vanilla JavaScript
- Simple Node HTTP static server

AI and RAG:

- Ollama for local model serving
- `nomic-embed-text` for embeddings
- `llama3.2` or configured Ollama model for answer generation
- LangGraph for query workflow orchestration

Infrastructure:

- Docker Compose
- PostgreSQL with pgvector extension
- Qdrant vector database
- Ollama service

## 4. Project Structure

```text
rag-langgraph/
  frontend/
    index.html
    app.js
    styles.css
    server.js

  scripts/
    init-db.js
    wait-for-services.js
    validate-ollama-models.js

  src/
    api/
      server.ts
      middleware/
      routes/

    common/
      config.ts
      errors.ts
      logger.ts
      types.ts

    documents/
      documents.schema.sql
      IDocumentRepository.ts
      PgDocumentRepository.ts

    embeddings/
      EmbedderFactory.ts
      IEmbeddingService.ts
      OllamaEmbedder.ts

    graph/
      ragGraph.ts
      state.ts
      llm.ts
      edges/
      nodes/

    ingestion/
      IngestionService.ts
      chunking/
      parsers/

    vectorstore/
      IVectorStore.ts
      VectorStoreFactory.ts
      pgvector/
      qdrant/
```

## 5. Runtime Services

The project uses these services:

```text
Frontend:   http://localhost:8080
Backend:    http://localhost:3000
Postgres:   localhost:5432
Qdrant:     localhost:6333
Ollama:     localhost:11434
```

Docker Compose starts:

- `postgres`: PostgreSQL with pgvector
- `qdrant`: vector database alternative
- `ollama`: local LLM and embedding server

File:

```text
docker-compose.yml
```

## 6. How To Run The Project

Install dependencies:

```bash
npm install
```

Start infrastructure:

```bash
npm run docker:up
```

Initialize database:

```bash
npm run db:init
```

Start backend:

```bash
npm run dev
```

Start frontend:

```bash
npm run frontend
```

Run tests:

```bash
npm test
```

Build TypeScript:

```bash
npm run build
```

## 7. Important Package Scripts

From `package.json`:

```text
npm run dev              Starts backend in development mode
npm run build            Compiles TypeScript
npm start                Starts compiled backend from dist
npm test                 Runs unit tests
npm run test:watch       Runs tests in watch mode
npm run test:integration Runs integration tests
npm run docker:up        Starts Docker services
npm run docker:down      Stops Docker services
npm run db:init          Creates database tables/extensions
npm run setup            Runs infrastructure setup flow
npm run frontend         Starts frontend static server
```

## 8. Environment Configuration

Main file:

```text
src/common/config.ts
```

Environment files:

```text
.env
.env.example
```

Important variables:

```text
DATABASE_URL
VECTOR_STORE
OLLAMA_BASE_URL
OLLAMA_EMBED_MODEL
OLLAMA_LLM_MODEL
QDRANT_URL
QDRANT_COLLECTION
CHUNK_SIZE
CHUNK_OVERLAP
TOP_K
MIN_RELEVANCE_SCORE
MAX_REWRITE_RETRIES
PORT
LOG_LEVEL
MAX_FILE_SIZE_MB
```

Current important values:

```text
CHUNK_SIZE=3000
CHUNK_OVERLAP=300
TOP_K=8
MIN_RELEVANCE_SCORE=0.3
MAX_FILE_SIZE_MB=20
```

What each important value means:

```text
CHUNK_SIZE
  Maximum text size for one chunk.

CHUNK_OVERLAP
  Number of characters repeated between neighboring chunks.

TOP_K
  Number of chunks retrieved for a question.

MIN_RELEVANCE_SCORE
  Minimum similarity score used during grading.

MAX_REWRITE_RETRIES
  Maximum query rewrite attempts if retrieval fails.

MAX_FILE_SIZE_MB
  Maximum file upload size.

VECTOR_STORE
  Chooses pgvector or qdrant.
```

## 9. Backend Entry Point

Main file:

```text
src/api/server.ts
```

This file does the following:

1. Creates the Express app.
2. Enables CORS for frontend origins.
3. Adds JSON parsing.
4. Adds request logging using Pino.
5. Creates database pool.
6. Creates embedder.
7. Creates vector store.
8. Creates chunker.
9. Creates document repository.
10. Creates ingestion service.
11. Builds the LangGraph RAG graph.
12. Registers routes.
13. Registers global error handler.
14. Starts HTTP server.
15. Handles graceful shutdown.

Important code concept:

```text
server.ts wires all dependencies together.
```

It is the composition root of the backend.

## 10. API Endpoints

Health:

```text
GET /health
```

Checks whether backend and vector store are available.

Upload:

```text
POST /upload
```

Uploads and processes a document.

Query:

```text
POST /query
```

Asks a question against uploaded documents.

Documents:

```text
GET /documents
```

Lists uploaded documents.

Delete:

```text
DELETE /documents/:id
```

Deletes document metadata and its chunks/embeddings.

## 11. Frontend Flow

Frontend files:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
frontend/server.js
```

The frontend is simple vanilla JavaScript.

It does:

1. Calls `/health` to show server status.
2. Lets user upload a file.
3. Calls `/upload`.
4. Lists uploaded documents using `/documents`.
5. Lets user delete documents using `DELETE /documents/:id`.
6. Lets user ask a question.
7. Calls `/query`.
8. Displays answer and source chunks.

API base URL:

```js
const API_BASE_URL = 'http://localhost:3000';
```

Frontend server:

```text
frontend/server.js
```

This is a tiny static file server using Node's built-in `http`, `fs`, and `path` modules.

## 12. Upload Flow In Detail

Main route:

```text
src/api/routes/upload.route.ts
```

Middleware:

```text
src/api/middleware/validateFile.ts
```

Service:

```text
src/ingestion/IngestionService.ts
```

Full upload flow:

1. User selects a file in UI.
2. Frontend sends `FormData` to `POST /upload`.
3. `validateFile` uses Multer to parse the file.
4. File is stored in memory as a buffer.
5. File size is checked.
6. MIME type is checked.
7. Filename is sanitized using `path.basename`.
8. Backend creates a document row with status `processing`.
9. Parser extracts text from file.
10. Chunker splits extracted text.
11. Ollama embedder creates embeddings for each chunk.
12. Vector store saves chunks and embeddings.
13. Document row is updated to status `ready`.
14. API returns document id and chunk count.

Upload success response:

```json
{
  "documentId": "uuid",
  "filename": "example.pdf",
  "chunkCount": 10,
  "message": "File ingested successfully"
}
```

## 13. Supported File Types

Parser factory:

```text
src/ingestion/parsers/ParserFactory.ts
```

Supported parsers:

```text
PdfParser.ts
DocxParser.ts
DocParser.ts
XlsxParser.ts
TxtParser.ts
```

Supported UI labels:

```text
PDF
DOCX
DOC
XLSX
TXT
```

The parser is selected by MIME type.

If the MIME type is not supported, the system throws `UnsupportedTypeError`.

## 14. Document Parsing

Parsing means extracting plain text from uploaded files.

Examples:

```text
PDF  -> extract PDF text
DOCX -> extract Word document text
XLSX -> extract sheet/cell text
TXT  -> read plain text
```

Why parsing matters:

The RAG pipeline cannot work directly on binary PDF/DOCX/XLSX files. It needs readable text.

## 15. Chunking

Chunker:

```text
src/ingestion/chunking/RecursiveChunker.ts
```

Chunking means splitting large document text into smaller pieces.

Why this is needed:

1. LLMs have context limits.
2. Embedding very large text is inefficient.
3. Retrieval works better on focused text blocks.
4. Sources become easier to show.

The chunker recursively tries to split by:

```text
paragraphs
sentences
lines
words
characters
```

Each chunk gets metadata:

```text
documentId
filename
chunkIndex
pageNumber if available
sheetName if available
```

Each chunk also gets a deterministic UUID-style id based on:

```text
documentId + chunkIndex + chunkText
```

## 16. Chunk Overlap

Overlap means each chunk can include the last part of the previous chunk.

Example:

```text
Chunk 1: ... JavaScript generators are special functions
Chunk 2: functions that can pause and resume execution ...
```

Without overlap, context may break.

With overlap:

```text
Chunk 2 includes some ending text from Chunk 1.
```

Current overlap:

```text
CHUNK_OVERLAP=300
```

## 17. Embeddings

Embedder:

```text
src/embeddings/OllamaEmbedder.ts
```

Embedding means converting text into a numeric vector.

Example concept:

```text
"generator function in JavaScript"
```

becomes:

```text
[0.12, -0.04, 0.87, ...]
```

Vectors allow semantic search.

If two pieces of text have similar meaning, their vectors should be close.

This project uses:

```text
Ollama
nomic-embed-text
768-dimensional vectors
```

The embedder also includes:

1. Retry handling for temporary network errors.
2. Parallel embedding with limited concurrency.
3. Clear error if Ollama is not running.

## 18. Vector Store

Interface:

```text
src/vectorstore/IVectorStore.ts
```

Factory:

```text
src/vectorstore/VectorStoreFactory.ts
```

Implementations:

```text
src/vectorstore/pgvector/PgVectorStore.ts
src/vectorstore/qdrant/QdrantVectorStore.ts
```

The vector store handles:

1. Saving embedded chunks.
2. Searching similar chunks.
3. Deleting chunks for a document.
4. Health checks.

## 19. pgvector Storage

Schema:

```text
src/vectorstore/pgvector/pgvector.schema.sql
```

Table:

```text
chunks
```

Columns:

```text
id
document_id
filename
chunk_index
text
embedding
page_number
sheet_name
created_at
```

The embedding column is:

```sql
embedding vector(768)
```

The vector index uses:

```sql
ivfflat
vector_cosine_ops
```

Cosine similarity is used to compare embeddings.

## 20. Document Metadata Storage

Repository:

```text
src/documents/PgDocumentRepository.ts
```

Schema:

```text
src/documents/documents.schema.sql
```

Table:

```text
documents
```

Columns:

```text
id
filename
mime_type
status
chunk_count
error
uploaded_at
updated_at
```

Status values:

```text
processing
ready
failed
```

The UI reads this table to show uploaded documents.

## 21. Query Flow In Detail

Route:

```text
src/api/routes/query.route.ts
```

Graph:

```text
src/graph/ragGraph.ts
```

Full query flow:

1. User enters a question in UI.
2. Frontend sends JSON to `POST /query`.
3. Query middleware validates the request.
4. Route invokes LangGraph.
5. Retrieve node embeds the question.
6. Vector store searches relevant chunks.
7. Grade node filters or keeps useful chunks.
8. Route edge decides whether to generate or rewrite.
9. Generate node builds a prompt.
10. Ollama LLM generates an answer.
11. API returns answer and sources.
12. UI displays answer and sources.

Query response:

```json
{
  "answer": "Short answer here",
  "sources": [
    {
      "id": "chunk-id",
      "text": "source preview",
      "score": 0.91,
      "documentId": "document-id",
      "filename": "file.pdf",
      "chunkIndex": 3
    }
  ],
  "rewriteCount": 0,
  "query": "final query"
}
```

## 22. LangGraph

Main file:

```text
src/graph/ragGraph.ts
```

LangGraph turns the RAG process into a graph.

Graph:

```text
START
  -> retrieve
  -> gradeDocuments
  -> generate
  -> END
```

Optional route:

```text
gradeDocuments
  -> rewriteQuery
  -> retrieve
```

Why LangGraph is used:

1. Makes the pipeline explicit.
2. Separates each step into a node.
3. Allows conditional routing.
4. Makes testing easier.
5. Supports future improvements like retries, tools, or human approval.

## 23. Graph State

State file:

```text
src/graph/state.ts
```

Graph state stores:

```text
query
topK
minScore
rewrittenQuery
retrievedChunks
gradedChunks
answer
sources
retryCount
confidence
```

Each node reads state and returns partial updates.

Example:

```text
retrieve node writes retrievedChunks
grade node writes gradedChunks and confidence
generate node writes answer and sources
```

## 24. Retrieve Node

File:

```text
src/graph/nodes/retrieve.node.ts
```

Responsibilities:

1. Choose original or rewritten query.
2. Generate embedding for the query.
3. Call vector store search.
4. Return retrieved chunks.

Important:

The retrieve node passes the original text query to the vector store too.

This enables hybrid search in pgvector:

```text
semantic vector search + lexical keyword search
```

## 25. Grade Documents Node

File:

```text
src/graph/nodes/gradeDocuments.node.ts
```

Responsibilities:

1. Filter chunks by relevance score.
2. If score filtering removes everything, keep best available chunks.
3. Set confidence to `high` or `low`.

Why this was changed:

Earlier the app could say:

```text
I couldn't find relevant information...
```

even when chunks existed.

Now the system avoids throwing away all retrieved chunks too aggressively.

## 26. Route After Grade

File:

```text
src/graph/edges/routeAfterGrade.ts
```

Responsibilities:

1. If confidence is high, generate answer.
2. If chunks were retrieved, generate answer.
3. If no chunks and retry count allows, rewrite query.
4. Otherwise generate fallback answer.

This prevents slow rewrite loops and reduces timeout issues.

## 27. Rewrite Query Node

File:

```text
src/graph/nodes/rewriteQuery.node.ts
```

Purpose:

If retrieval fails, the system can rewrite the question into a better search query.

Example:

```text
Original: "what about this?"
Rewritten: "summary of uploaded document"
```

This is useful for vague questions.

## 28. Generate Node

File:

```text
src/graph/nodes/generate.node.ts
```

Responsibilities:

1. Build context from selected chunks.
2. Create a prompt.
3. Ask the LLM to answer.
4. Return answer and sources.
5. Use fallback if LLM times out.

Prompt rules include:

```text
Be concise.
Default to 1-2 short sentences.
For tech stack questions, return a short comma-separated list.
Use only provided context.
If context is insufficient, say so.
```

## 29. LLM Wrapper

File:

```text
src/graph/llm.ts
```

Responsibilities:

1. Create ChatOllama model.
2. Convert LLM response to text.
3. Add timeout protection.

Important:

```text
temperature=0
```

This makes answers more deterministic.

LLM timeout:

```text
12000 ms
```

Route timeout:

```text
30000 ms
```

## 30. Hybrid Search

File:

```text
src/vectorstore/pgvector/PgVectorStore.ts
```

Earlier the system used only vector similarity.

Problem:

Short queries like:

```text
generator function
```

could retrieve nearby but wrong JavaScript concepts like hoisting.

Fix:

pgvector now uses hybrid search:

```text
vector similarity + PostgreSQL full-text lexical search
```

Practical meaning:

If the user asks about `generator function`, chunks containing those words are preferred.

Technical meaning:

The SQL combines:

```text
vector_results
lexical_results
deduped result set
```

Then it orders by lexical score and vector score.

## 31. Error Handling

Common error classes:

```text
src/common/errors.ts
```

Global error handler:

```text
src/api/middleware/errorHandler.ts
```

Handled cases:

```text
Unsupported file type
File too large
Parser error
Vector store error
Graph execution error
Unknown server error
```

Upload failures are persisted:

```text
document status = failed
error = actual error message
```

## 32. Logging

Logger:

```text
src/common/logger.ts
```

The project uses Pino.

Logs include:

```text
request completed
document parsed and chunked
embedded batch
ingestion complete
retrieved chunks with scores
grading complete
LLM timeout fallback
```

Why logs matter:

They help debug upload slowness, retrieval mistakes, and timeout issues.

## 33. Testing

Test command:

```bash
npm test
```

Build command:

```bash
npm run build
```

Test framework:

```text
Vitest
```

Tests cover:

```text
file validation
query validation
error handling
parser factory
chunking
embedding retry behavior
ingestion failure handling
graph behavior
grade document logic
```

## 34. Why Upload Can Be Slow

Upload processing includes:

1. Parsing file.
2. Chunking text.
3. Calling Ollama embedding model for every chunk.
4. Saving vectors to database.

The slowest part is usually:

```text
embedding generation
```

Large documents create many chunks.

Example:

```text
232-page PDF -> many chunks -> many embedding calls -> slower upload
```

The project now improves speed by:

```text
larger chunk size
batch processing
limited embedding concurrency
bulk upsert
```

## 35. Why Query Can Timeout

Possible causes:

1. Ollama LLM is slow.
2. Model is too heavy for local machine.
3. Too many chunks are passed.
4. Query rewrite loops.
5. Vector database is slow.

Fixes already added:

```text
LLM timeout
extractive fallback
avoid unnecessary rewrite loops
lower min relevance score
hybrid retrieval
concise prompt
```

## 36. Why Wrong Answers Can Happen

Common reasons:

```text
wrong chunks retrieved
question too vague
document text extraction quality is poor
chunk has broken text
LLM ignores instructions
embedding model confuses similar concepts
```

Example:

Question:

```text
generator function
```

Wrong retrieval:

```text
hoisting chunk
```

Reason:

```text
pure vector search matched a nearby JavaScript concept
```

Fix:

```text
hybrid retrieval prefers exact lexical matches
```

## 37. What Happens When User Deletes A Document

Route:

```text
DELETE /documents/:id
```

Flow:

1. Check document exists.
2. Delete chunks from vector store.
3. Delete document row from PostgreSQL.
4. Return success response.

This prevents deleted documents from appearing in future answers.

## 38. What Happens On Health Check

Route:

```text
GET /health
```

It returns:

```json
{
  "status": "ok",
  "vectorStore": "pgvector",
  "embedder": "ollama",
  "services": {
    "vectorStore": true
  }
}
```

The frontend uses this to show connected/offline status.

## 39. Important Interfaces

Vector store interface:

```text
src/vectorstore/IVectorStore.ts
```

Embedding interface:

```text
src/embeddings/IEmbeddingService.ts
```

Document repository interface:

```text
src/documents/IDocumentRepository.ts
```

Chunker interface:

```text
src/ingestion/chunking/IChunker.ts
```

Parser interface:

```text
src/ingestion/parsers/IDocumentParser.ts
```

Why interfaces matter:

They make the system modular. You can replace pgvector with Qdrant, or replace Ollama with another embedding provider, without rewriting the whole app.

## 40. Architecture Pattern

The code follows dependency injection manually.

Example:

```text
server.ts creates dependencies
dependencies are passed into services/routes/graph
```

This makes testing easier because tests can pass fake vector stores, fake embedders, or fake LLMs.

The system is separated into layers:

```text
frontend
api
ingestion
embedding
vector store
documents repository
graph
common utilities
```

## 41. Practical Explanation For Non-Technical Person

You can say:

This app lets users upload documents and ask questions about them. When a document is uploaded, the app reads its text and breaks it into smaller pieces. It stores those pieces in a searchable way. When the user asks a question, the app finds the most relevant pieces and gives them to an AI model to create a short answer.

## 42. Technical Explanation For Interview

You can say:

This project is a TypeScript-based RAG application. The backend is built with Express and uses LangGraph to orchestrate the query pipeline. Documents are uploaded through Multer, parsed based on MIME type, chunked with a recursive chunker, embedded using Ollama's embedding model, and stored in pgvector or Qdrant. During query time, the question is embedded, relevant chunks are retrieved using vector similarity and hybrid lexical search, filtered by a grading node, and passed to ChatOllama for concise answer generation. The frontend is a vanilla JavaScript UI that supports upload, document listing, deletion, and question answering.

## 43. RAG Explanation

RAG means Retrieval-Augmented Generation.

Retrieval:

```text
Find relevant document chunks.
```

Augmented:

```text
Add those chunks as context to the prompt.
```

Generation:

```text
LLM writes answer using that context.
```

Why RAG is useful:

```text
It lets an LLM answer from private or fresh documents without retraining the model.
```

## 44. Embedding Explanation

Embedding is a numeric representation of text.

Example:

```text
"React is a frontend library"
```

and

```text
"React is used to build user interfaces"
```

should have similar vectors.

That is why semantic search works.

## 45. Vector Search Explanation

Vector search compares the query vector with stored chunk vectors.

If vectors are close, the chunk is considered relevant.

This project uses cosine similarity for pgvector.

High score means:

```text
chunk is likely relevant
```

Low score means:

```text
chunk is probably unrelated
```

## 46. Hybrid Search Explanation

Hybrid search combines:

```text
semantic matching
exact keyword matching
```

This improves results for technical terms.

Example:

```text
generator function
```

The system should prefer chunks containing those exact words.

## 47. Prompt Engineering

The generation prompt tells the LLM:

```text
Use only provided context.
Be concise.
Default to 1-2 sentences.
For tech stack questions, use comma-separated list.
Say clearly if context is insufficient.
```

Why this matters:

Without strict prompt rules, the model may generate long or unrelated answers.

## 48. Source Attribution

The API returns source chunks with:

```text
chunk id
filename
chunk index
score
text preview
document id
```

The frontend shows these below the answer.

Why this matters:

The user can verify which document content was used.

## 49. Current Strengths

Strengths:

```text
local AI support
multiple document formats
modular backend
LangGraph workflow
pgvector and Qdrant support
source-backed answers
document management
timeout handling
fallback generation
hybrid retrieval
unit tests
simple UI
```

## 50. Current Limitations

Limitations:

```text
large uploads can still take time
local LLM speed depends on machine
PDF text extraction may be imperfect
DOC support can be weaker than DOCX
no authentication
no multi-user separation
frontend is basic vanilla JS
no streaming responses
no background job queue
no exact page citation for every format
```

## 51. Production Improvements

If this were production, useful improvements would be:

```text
authentication
user-specific document isolation
background upload jobs
job progress polling
streaming answer responses
better PDF page mapping
reranking model
deduplication
document update/versioning
rate limiting
structured observability
Docker image for backend
cloud deployment pipeline
```

## 52. Common Questions And Answers

Question:

```text
Why use LangGraph?
```

Answer:

```text
LangGraph lets us model the RAG pipeline as nodes and conditional edges. It makes retrieval, grading, query rewriting, and generation explicit and easier to test or extend.
```

Question:

```text
Why use pgvector?
```

Answer:

```text
pgvector lets PostgreSQL store and search vector embeddings. It keeps document metadata and vector chunks close together and avoids needing a separate vector database for simple deployments.
```

Question:

```text
Why also support Qdrant?
```

Answer:

```text
Qdrant is a dedicated vector database. The project supports it through a vector store interface, so the backend can switch between pgvector and Qdrant by configuration.
```

Question:

```text
Why use Ollama?
```

Answer:

```text
Ollama lets the system run embeddings and LLM generation locally without external API keys.
```

Question:

```text
Why chunk documents?
```

Answer:

```text
Chunks make retrieval accurate and efficient. Instead of sending a whole document to the LLM, we retrieve only the most relevant pieces.
```

Question:

```text
What happens if no relevant chunk is found?
```

Answer:

```text
The graph may rewrite the query and try retrieval again. If useful chunks still are not found, it returns a clear insufficient-information message.
```

Question:

```text
What happens if the LLM times out?
```

Answer:

```text
The generate node uses an extractive fallback based on retrieved chunks instead of failing completely.
```

Question:

```text
Why was hybrid search added?
```

Answer:

```text
Pure vector search can retrieve semantically similar but wrong chunks. Hybrid search improves technical-topic matching by combining exact keyword search with vector similarity.
```

## 53. End-To-End Example

User uploads:

```text
javascript-interview.pdf
```

System:

```text
validates file
parses PDF text
splits text into chunks
creates embeddings
stores chunks in pgvector
marks document ready
```

User asks:

```text
what is generator function in javascript?
```

System:

```text
embeds the question
searches chunks using hybrid search
retrieves generator-function chunks
filters/grades chunks
sends context to LLM
returns concise answer
shows source chunks
```

Expected answer style:

```text
A generator function is a JavaScript function declared with function* that can pause and resume execution using yield.
```

## 54. Mental Model

Think of the system as two pipelines.

Upload pipeline:

```text
File -> Parser -> Text -> Chunker -> Embeddings -> Vector DB
```

Question pipeline:

```text
Question -> Embedding -> Retrieval -> Relevant Chunks -> LLM -> Answer
```

## 55. Files To Read In Order

If you want to understand the codebase by reading code, follow this order:

```text
1. package.json
2. docker-compose.yml
3. src/common/config.ts
4. src/api/server.ts
5. src/api/routes/upload.route.ts
6. src/ingestion/IngestionService.ts
7. src/ingestion/parsers/ParserFactory.ts
8. src/ingestion/chunking/RecursiveChunker.ts
9. src/embeddings/OllamaEmbedder.ts
10. src/vectorstore/VectorStoreFactory.ts
11. src/vectorstore/pgvector/PgVectorStore.ts
12. src/documents/PgDocumentRepository.ts
13. src/graph/ragGraph.ts
14. src/graph/state.ts
15. src/graph/nodes/retrieve.node.ts
16. src/graph/nodes/gradeDocuments.node.ts
17. src/graph/edges/routeAfterGrade.ts
18. src/graph/nodes/generate.node.ts
19. src/api/routes/query.route.ts
20. frontend/app.js
```

## 56. Short Final Explanation To Memorize

This project is a local RAG-based document QA application. It uses Express and TypeScript for the API, LangGraph to orchestrate the question-answering workflow, Ollama for local embeddings and LLM generation, and pgvector or Qdrant to store and retrieve document chunks. On upload, documents are parsed, chunked, embedded, and stored. On query, the question is embedded, relevant chunks are retrieved using hybrid search, and the LLM generates a concise answer using only those chunks as context.

