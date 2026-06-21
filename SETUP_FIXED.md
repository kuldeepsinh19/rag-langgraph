# Fixed Setup Guide - RAG LangGraph Project

This guide includes all the fixes from the senior engineering review.

## 🚀 Complete Setup (One Command)

```bash
# Run this single command to set up everything:
npm run setup
```

This will:
1. Start Docker services (PostgreSQL, Qdrant, Ollama)
2. Wait for all services to be healthy
3. Initialize database schemas
4. Validate Ollama models are pulled

## 📋 Manual Setup (Step by Step)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Environment File
```bash
# Copy the example
cp .env.example .env

# The .env is already configured with correct defaults
# Edit if you need custom configuration
```

### 3. Start Docker Services
```bash
npm run docker:up
# OR: docker-compose up -d
```

### 4. Wait for Services to Be Ready
```bash
npm run services:wait
```

This will check:
- ✅ PostgreSQL (port 5432)
- ✅ Qdrant (port 6333) - if VECTOR_STORE=qdrant
- ✅ Ollama (port 11434)

### 5. Initialize Database
```bash
npm run db:init
```

This creates:
- `chunks` table (for vector embeddings)
- `documents` table (for document metadata)
- pgvector extension

### 6. Pull Ollama Models
```bash
# Embedding model (274 MB)
docker exec -it rag-langgraph-ollama-1 ollama pull nomic-embed-text

# LLM model (2 GB) - choose ONE:
docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2
# OR
docker exec -it rag-langgraph-ollama-1 ollama pull mistral

# Update .env with your chosen model:
# OLLAMA_LLM_MODEL=llama3.2  (or mistral)
```

### 7. Validate Ollama Models
```bash
npm run ollama:validate
```

This checks:
- ✅ Embedding model is pulled and working
- ✅ LLM model is pulled and working
- ✅ Test embedding generation succeeds

### 8. Start Development Server
```bash
npm run dev
```

Server will start on http://localhost:3000

---

## 🧪 Testing the Setup

### Check Health
```bash
curl http://localhost:3000/health
```

Expected response:
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

### Upload a Document
```bash
curl -F "file=@test.pdf" http://localhost:3000/upload
```

### Query
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is this document about?"}'
```

---

## 📊 Available NPM Scripts

### Production
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (requires `npm run build` first)

### Development
- `npm run dev` - Start development server with auto-reload
- `npm run setup` - Complete automated setup

### Docker
- `npm run docker:up` - Start all Docker services
- `npm run docker:down` - Stop all Docker services

### Database
- `npm run db:init` - Initialize database schemas

### Services
- `npm run services:wait` - Wait for services to be ready
- `npm run ollama:validate` - Validate Ollama models

### Testing
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:integration` - Run integration tests (requires Docker)
- `npm run test:all` - Run all tests
- `npm run test:coverage` - Run tests with coverage report

---

## 🔧 Troubleshooting

### "ECONNREFUSED" Error

**Problem:** Cannot connect to database/services

**Solution:**
```bash
# Check services are running
docker ps

# Should show 3 containers:
# - rag-langgraph-postgres-1
# - rag-langgraph-qdrant-1
# - rag-langgraph-ollama-1

# If not running:
docker-compose up -d

# Wait for services
npm run services:wait
```

### "Model not found" Error

**Problem:** Ollama models not pulled

**Solution:**
```bash
# Check which models you need
cat .env | grep OLLAMA

# Pull the models
docker exec -it rag-langgraph-ollama-1 ollama pull nomic-embed-text
docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2

# Validate
npm run ollama:validate
```

### "Table does not exist" Error

**Problem:** Database not initialized

**Solution:**
```bash
npm run db:init
```

### "CHUNK_OVERLAP must be less than CHUNK_SIZE" Error

**Problem:** Invalid configuration

**Solution:**
Edit `.env` and ensure:
```env
CHUNK_SIZE=1000
CHUNK_OVERLAP=200  # Must be < CHUNK_SIZE
```

### Docker Services Won't Start

**Problem:** Port conflicts or Docker issues

**Solution:**
```bash
# Check what's using the ports
netstat -ano | findstr "5432"  # PostgreSQL
netstat -ano | findstr "6333"  # Qdrant
netstat -ano | findstr "11434" # Ollama

# Stop conflicting services or change ports in docker-compose.yml
```

---

## 🎯 Configuration Reference

### Required Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `VECTOR_STORE` | `pgvector` | Vector store backend: `pgvector` or `qdrant` |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
| `OLLAMA_LLM_MODEL` | `llama3.2` | Ollama LLM model |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint (if using Qdrant) |
| `QDRANT_COLLECTION` | `rag_chunks` | Qdrant collection name |
| `CHUNK_SIZE` | `1000` | Maximum characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlapping characters between chunks |
| `TOP_K` | `5` | Number of chunks to retrieve |
| `MIN_RELEVANCE_SCORE` | `0.7` | Minimum similarity score (0-1) |
| `MAX_REWRITE_RETRIES` | `2` | Query rewrite attempts |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Log level: `info`, `debug`, `warn`, `error` |
| `MAX_FILE_SIZE_MB` | `20` | Maximum upload size in MB |

---

## 🔐 Production Deployment Checklist

Before deploying to production, complete these items:

### Security
- [ ] Add rate limiting middleware (express-rate-limit)
- [ ] Add CORS configuration with whitelist
- [ ] Add authentication/authorization (JWT)
- [ ] Enable HTTPS/TLS
- [ ] Set `LOG_LEVEL=warn` or `error`
- [ ] Remove unnecessary error details from responses

### Database
- [ ] Use managed PostgreSQL (RDS, Neon, etc.)
- [ ] Set up automated backups
- [ ] Configure connection pooling limits
- [ ] Set up read replicas if needed

### Monitoring
- [ ] Set up Prometheus metrics
- [ ] Configure Grafana dashboards
- [ ] Set up error tracking (Sentry)
- [ ] Add request ID tracking
- [ ] Configure health check endpoints for load balancer

### Performance
- [ ] Add Redis caching layer
- [ ] Implement async job queue (BullMQ)
- [ ] Load test with 100+ concurrent requests
- [ ] Optimize database indexes
- [ ] Configure CDN for static assets

### Infrastructure
- [ ] Use managed Qdrant Cloud or self-hosted
- [ ] Use managed Ollama or GPU instance
- [ ] Set up auto-scaling
- [ ] Configure backup and disaster recovery
- [ ] Set up CI/CD pipeline

---

## 📚 Next Steps

After setup is complete:

1. **Read the architecture guide** - See `README.md` for detailed architecture
2. **Run the tests** - `npm test` to verify everything works
3. **Try the API** - Use the examples in QUICKSTART.md
4. **Review the code** - Start with `src/api/server.ts`
5. **Read the engineering review** - See `SENIOR_ENGINEERING_REVIEW.md` for best practices

---

## 🐛 Known Issues

### Issue: Docker on Windows may have volume permission issues
**Workaround:** Run Docker Desktop as Administrator

### Issue: Ollama may be slow on first model pull
**Expected:** First pull of llama3.2 takes 5-10 minutes (2GB download)

### Issue: pgvector extension may require superuser
**Workaround:** Connect as superuser or grant CREATE EXTENSION permission

---

## 📞 Support

If you encounter issues not covered here:

1. Check logs: `docker-compose logs`
2. Review: `SENIOR_ENGINEERING_REVIEW.md`
3. Check TypeScript compilation: `npx tsc --noEmit`
4. Validate configuration: `node -e "require('./src/common/config')"`

---

**Last Updated:** June 21, 2026  
**Version:** 1.0 (Post-Review)
