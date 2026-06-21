# Quick Start Guide

## 60-Second Setup

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Start Infrastructure
```bash
docker-compose up -d
```

### 3. Wait for Services
```bash
# Wait 15-30s for services to be ready
# Ollama will download the first time (5-10 minutes for mistral)
```

### 4. Download LLM Model (One-time, ~4GB)
```bash
docker exec -it rag-langgraph-ollama-1 ollama pull mistral
```

### 5. Create .env File
```bash
cat > .env << 'EOF'
DATABASE_URL=postgres://raguser:ragpass@localhost:5432/ragdb
VECTOR_STORE=qdrant
QDRANT_URL=http://localhost:6333
EMBEDDINGS_MODEL=nomic-embed-text
LLM_MODEL=mistral
OLLAMA_BASE_URL=http://localhost:11434
PORT=3000
LOG_LEVEL=debug
MAX_FILE_SIZE_MB=20
MAX_REWRITE_RETRIES=2
MIN_RELEVANCE_SCORE=0.5
EOF
```

### 6. Run Server
```bash
npm run dev
```

Server running on **http://localhost:3000** ✅

---

## Test It Out

### Upload a Document
```bash
curl -F "file=@your-file.pdf" http://localhost:3000/upload
```

### Ask a Question
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the main topic?"}'
```

### List Documents
```bash
curl http://localhost:3000/documents
```

---

## Run Tests

```bash
# Unit tests (fast, ~2s)
npm test

# Integration tests (requires Docker services)
npm run test:integration

# All tests + coverage
npm run test:all
npm run test:coverage
```

---

## Stop Services
```bash
docker-compose down
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED 5432` | Run `docker-compose up -d` |
| `Model not found` | Run `docker exec -it rag-langgraph-ollama-1 ollama pull mistral` |
| `File upload fails` | Check `.env` has `MAX_FILE_SIZE_MB` |
| `Module not found` | Run `npm install` |

For detailed info, see [README.md](./README.md)
