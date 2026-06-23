# 🚀 Start Everything - Complete System

This guide shows you how to start the complete RAG system with both backend and frontend.

## ⚡ Quick Start (Two Commands)

### Terminal 1: Backend
```bash
npm run dev
```

### Terminal 2: Frontend
```bash
npm run frontend
```

**Then open:** http://localhost:8080

---

## 📋 Step-by-Step Guide

### 1. Prerequisites Check

Make sure you've completed the setup:
```bash
# Should show 3 containers running
docker ps

# Should show both models
npm run gemini:validate
```

If not done yet, run:
```bash
npm run setup
```

### 2. Start Backend

```bash
# In first terminal
npm run dev
```

**Wait for these log messages:**
```
✓ Embedder ready (Ollama)
✓ All services initialized
✓ Vector store health check: OK
✓ Server started on port 3000
```

**Test it:**
```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok",...}`

### 3. Start Frontend

```bash
# In second terminal (keep first terminal running!)
npm run frontend
```

**Wait for:**
```
🚀 RAG Frontend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running at: http://localhost:8080
✅ Ready! Open http://localhost:8080 in your browser
```

### 4. Open Browser

Navigate to: **http://localhost:8080**

You should see:
- ✅ Green status indicator at top
- Upload document section
- Query interface
- Document list

---

## 🎯 Full Test Workflow

### Upload a Document

1. Click "Choose a file..." in the Upload section
2. Select `test-document.txt` (or any PDF, DOCX)
3. Click "Upload & Process"
4. Wait for success message
5. See document appear in "Uploaded Documents" list

### Ask a Question

1. Type in query box: `"What is artificial intelligence?"`
2. Keep default parameters (Results: 5, Min Score: 0.7)
3. Click "Ask Question"
4. Wait 5-10 seconds
5. See answer with source citations

### View Results

The answer section shows:
- Generated answer text
- Source documents with relevance scores
- Query metadata (rewrites, final query)

---

## 🔧 Troubleshooting

### Backend Won't Start

**Error:** `ECONNREFUSED` or `Cannot find module`

**Fix:**
```bash
# Check Docker services
docker ps

# Should show: postgres, qdrant, ollama
# If not:
npm run docker:up
npm run services:wait

# Reinstall dependencies
npm install
```

### Frontend Shows "Server not responding"

**Cause:** Backend not running or wrong URL

**Fix:**
1. Check backend terminal - should show "Server started"
2. Test: `curl http://localhost:3000/health`
3. If fails, restart backend: `npm run dev`

### Upload Fails

**Error:** `Unsupported document type`

**Fix:**
- Only use: PDF, DOCX, DOC, XLSX, TXT
- Max size: 20 MB
- Check backend logs for specific error

### Query Returns No Answer

**Cause:** No relevant documents or score too high

**Fix:**
1. Ensure documents are uploaded and status = "READY"
2. Lower "Min Score" slider to 0.5 or lower
3. Make question more specific
4. Check backend terminal for LLM errors

### CORS Error in Browser Console

**Error:** `Access-Control-Allow-Origin`

**Should not happen** - CORS is configured in backend

**If it does:**
1. Check backend server.ts has `app.use(cors({...}))`
2. Restart backend
3. Hard refresh browser (Ctrl+Shift+R)

---

## 🎮 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Browser                         │
│                     (localhost:8080)                        │
│                                                             │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   Upload   │  │   Query     │  │   Documents      │   │
│  │  Document  │  │  Interface  │  │   Management     │   │
│  └────────────┘  └─────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP + CORS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Backend API                       │
│                     (localhost:3000)                        │
│                                                             │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │ POST       │  │ POST        │  │ GET/DELETE       │   │
│  │ /upload    │  │ /query      │  │ /documents       │   │
│  └────────────┘  └─────────────┘  └──────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           RAG Pipeline (LangGraph)                    │ │
│  │  Retrieve → Grade → Rewrite → Generate               │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌──────────────────┐  ┌────────────┐  ┌────────────┐
│   PostgreSQL     │  │   Qdrant   │  │   Ollama   │
│   (pgvector)     │  │  (vectors) │  │   (LLM)    │
│   port 5432      │  │  port 6333 │  │ port 11434 │
└──────────────────┘  └────────────┘  └────────────┘
         Docker               Docker          Docker
```

---

## 📊 Monitoring

### Backend Logs

Watch Terminal 1 for:
- ✅ `Server started` - Backend ready
- 📤 `Starting ingestion` - File upload started
- 📥 `Ingestion complete` - File processed
- 🔍 `Processing query` - Question received
- ⚠️ Any errors in red

### Frontend Logs

Browser console (F12) shows:
- API requests
- Response data
- Any JavaScript errors

### Docker Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ollama
docker-compose logs -f postgres
docker-compose logs -f qdrant
```

---

## 🛑 Stopping Everything

### Stop Frontend
Press `Ctrl+C` in Terminal 2

### Stop Backend
Press `Ctrl+C` in Terminal 1

### Stop Docker (Optional)
```bash
npm run docker:down

# Or keep running for next time:
# Docker services can stay running between sessions
```

---

## 🔄 Restarting

If you need to restart:

```bash
# Quick restart (Docker stays running)
# Terminal 1
npm run dev

# Terminal 2  
npm run frontend

# Full restart (including Docker)
npm run docker:down
npm run setup
npm run dev        # Terminal 1
npm run frontend   # Terminal 2
```

---

## 💾 Data Persistence

**Your data persists between restarts:**
- 📚 **Documents** - Stored in PostgreSQL
- 🔢 **Embeddings** - Stored in pgvector/Qdrant
- 📊 **Metadata** - Stored in documents table

**To clear everything:**
```bash
npm run docker:down
docker volume rm $(docker volume ls -q | findstr rag-langgraph)
npm run setup
```

---

## ✅ System Health Checklist

Before starting work:

- [ ] Docker running: `docker ps` shows 3 containers
- [ ] Gemini embeddings: `npm run gemini:validate` passes
- [ ] Ollama LLM model is pulled with `docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2`
- [ ] Backend starts: `npm run dev` shows "Server started"
- [ ] Frontend accessible: http://localhost:8080 opens
- [ ] Status indicator: Green dot at top of page
- [ ] Health endpoint: `curl localhost:3000/health` returns OK

---

## 🎉 You're All Set!

Your complete RAG system is now running:

1. **Backend** → http://localhost:3000 (API)
2. **Frontend** → http://localhost:8080 (UI)
3. **Database** → localhost:5432 (PostgreSQL)
4. **Qdrant** → http://localhost:6333 (Vector DB)
5. **Ollama** → http://localhost:11434 (LLM)

**Start testing:** Upload documents and ask questions!

---

## 📚 More Info

- **Frontend Guide:** `FRONTEND_GUIDE.md`
- **Setup Guide:** `SETUP_FIXED.md`
- **API Documentation:** `README.md`
- **Architecture:** `SENIOR_ENGINEERING_REVIEW.md`

**Have fun with your RAG system! 🚀**
