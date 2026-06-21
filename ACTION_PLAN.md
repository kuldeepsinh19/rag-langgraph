# Action Plan - What To Do Next

## 🚨 URGENT: Run These Commands First

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Run complete automated setup
npm run setup
```

**Wait Time:** 30-60 seconds for services to start

If setup succeeds, skip to **"First Time Model Setup"** below.

---

## 🔧 If Setup Fails: Manual Troubleshooting

### Step 1: Start Docker Services
```bash
npm run docker:up
# Wait 10-15 seconds
```

**Verify:** Run `docker ps` - should show 3 containers running

### Step 2: Wait for Services
```bash
npm run services:wait
```

**If this fails:**
- PostgreSQL: Check logs `docker-compose logs postgres`
- Qdrant: Check logs `docker-compose logs qdrant`
- Ollama: Check logs `docker-compose logs ollama`

### Step 3: Initialize Database
```bash
npm run db:init
```

**If this fails:**
- Ensure PostgreSQL is running: `docker ps | findstr postgres`
- Check DATABASE_URL in `.env` file
- Try: `docker-compose restart postgres`

### Step 4: Validate Models (will fail first time - that's OK)
```bash
npm run ollama:validate
```

**Expected first time:** ❌ Models not found (continue to next section)

---

## 📦 First Time Model Setup (One-Time, ~3GB Download)

### Pull Required Models

```bash
# Embedding model (~274 MB, required)
docker exec -it rag-langgraph-ollama-1 ollama pull nomic-embed-text

# LLM model - choose ONE:

# Option A: llama3.2 (~2 GB, faster, recommended for development)
docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2

# Option B: mistral (~4 GB, more capable, for production)
docker exec -it rag-langgraph-ollama-1 ollama pull mistral
```

**Wait Time:** 
- nomic-embed-text: 1-2 minutes
- llama3.2: 5-10 minutes
- mistral: 10-15 minutes

### Update Configuration (if you chose mistral)

```bash
# Edit .env file and change:
OLLAMA_LLM_MODEL=mistral
```

### Validate Models
```bash
npm run ollama:validate
```

**Expected:** ✅ All Ollama models validated and ready!

---

## 🚀 Start the Application

```bash
npm run dev
```

**Expected Output:**
```
Server started on port 3000
All services initialized
```

**Access:** http://localhost:3000

---

## 🧪 Test It Works

### Terminal 1: Keep server running
```bash
npm run dev
```

### Terminal 2: Test commands

#### 1. Health Check
```bash
curl http://localhost:3000/health
```

**Expected:**
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

#### 2. Create a test file
```bash
echo "This is a test document about artificial intelligence and machine learning." > test.txt
```

#### 3. Upload the file
```bash
curl -F "file=@test.txt" http://localhost:3000/upload
```

**Expected:** Success with documentId and chunkCount

#### 4. Query the system
```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What is this about?\"}"
```

**Expected:** Answer about AI and machine learning

---

## ✅ Success Checklist

Complete this checklist to verify everything works:

- [ ] `docker ps` shows 3 containers running
- [ ] `npm run services:wait` completes successfully
- [ ] `npm run db:init` completes without errors
- [ ] `npm run ollama:validate` shows both models ready
- [ ] `npm run dev` starts server on port 3000
- [ ] `curl http://localhost:3000/health` returns status "ok"
- [ ] File upload succeeds
- [ ] Query returns relevant answer
- [ ] `npm test` shows 45 tests passing

---

## 🐛 Common Issues & Fixes

### Issue: "Docker not found"
```bash
# Install Docker Desktop from: https://www.docker.com/products/docker-desktop
```

### Issue: "Port 5432 already in use"
```bash
# Stop existing PostgreSQL
# Windows: Stop PostgreSQL service from Services panel
# OR change port in docker-compose.yml
```

### Issue: "ECONNREFUSED localhost:11434"
```bash
# Restart Ollama container
docker-compose restart ollama

# Check logs
docker-compose logs ollama
```

### Issue: "Model not found" during validation
```bash
# Pull the model
docker exec -it rag-langgraph-ollama-1 ollama pull nomic-embed-text
docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2
```

### Issue: "Table does not exist"
```bash
# Re-run database initialization
npm run db:init
```

### Issue: "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 What Each Script Does

| Command | Purpose | Duration |
|---------|---------|----------|
| `npm run docker:up` | Start all Docker services | ~5s |
| `npm run services:wait` | Wait for services to be healthy | ~10-30s |
| `npm run db:init` | Create database tables | ~2s |
| `npm run ollama:validate` | Check models are ready | ~5s |
| `npm run setup` | All of the above in one command | ~20-40s |
| `npm run dev` | Start development server | Continuous |

---

## 🎯 Development Workflow

### Daily Development
```bash
# Start services (if not running)
docker-compose up -d

# Start dev server
npm run dev

# Make changes to code - server auto-reloads
```

### After Git Pull
```bash
# Update dependencies
npm install

# Rebuild if needed
npm run build
```

### Before Git Commit
```bash
# Run tests
npm test

# Check TypeScript
npx tsc --noEmit

# Check formatting (if using prettier)
npm run format  # (if configured)
```

### Stopping Development
```bash
# Stop server: Ctrl+C in terminal

# Stop Docker (optional, can leave running)
docker-compose down
```

---

## 📚 Documentation Quick Reference

1. **Quick Start:** This file (ACTION_PLAN.md)
2. **Setup Details:** SETUP_FIXED.md
3. **What Was Fixed:** FIXES_SUMMARY.md
4. **Deep Analysis:** SENIOR_ENGINEERING_REVIEW.md
5. **Architecture:** README.md
6. **API Reference:** README.md (API Endpoints section)

---

## 🚀 Production Deployment

**Before deploying to production, read:**
- SENIOR_ENGINEERING_REVIEW.md (Production Readiness section)
- SETUP_FIXED.md (Production Deployment Checklist)

**Key production steps:**
1. Set up managed database (not Docker)
2. Set up managed vector store (Qdrant Cloud or hosted)
3. Add authentication/authorization
4. Add rate limiting
5. Configure monitoring
6. Set up SSL/TLS
7. Use production-grade Ollama hosting

---

## 💡 Pro Tips

1. **Keep Docker running:** Services start faster if you don't stop Docker between sessions
2. **Use llama3.2 for dev:** It's faster than mistral, use mistral for production
3. **Watch logs:** Run `docker-compose logs -f` in separate terminal to debug issues
4. **Test with small files first:** Upload a text file before trying large PDFs
5. **Check health frequently:** `curl localhost:3000/health` is your friend

---

## ⚡ Quick Commands Reference

```bash
# Setup
npm run setup                 # Complete automated setup
npm run docker:up             # Start Docker services
npm run services:wait         # Wait for services
npm run db:init              # Initialize database
npm run ollama:validate      # Validate models

# Development
npm run dev                   # Start dev server
npm test                      # Run tests
npm run test:watch           # Run tests in watch mode

# Docker
docker ps                     # List running containers
docker-compose logs          # View all logs
docker-compose logs -f       # Follow logs
docker-compose restart       # Restart all services
docker-compose down          # Stop all services

# Debugging
curl localhost:3000/health   # Check API health
docker exec -it rag-langgraph-postgres-1 psql -U raguser -d ragdb # Access DB
docker exec -it rag-langgraph-ollama-1 ollama list # List models
```

---

## 🎉 You're Ready!

If you've completed the checklist above, your RAG system is running and ready for development!

**Next Steps:**
1. Try uploading different document types (PDF, DOCX, XLSX)
2. Experiment with different queries
3. Review the code in `src/` to understand the architecture
4. Read SENIOR_ENGINEERING_REVIEW.md for best practices
5. Run tests: `npm test`

---

**Last Updated:** June 21, 2026  
**Status:** ✅ All critical fixes applied
