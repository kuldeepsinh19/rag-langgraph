# RAG System Frontend

A minimal, clean frontend for testing the RAG LangGraph system.

## Features

- ✅ **Health Status Indicator** - Real-time server connection status
- 📤 **Document Upload** - Drag & drop or click to upload (PDF, DOCX, DOC, XLSX, TXT)
- 📚 **Documents List** - View all uploaded documents with status
- 💬 **Query Interface** - Ask questions about your documents
- 🎯 **Configurable Parameters** - Adjust topK and minScore
- 💡 **Answer Display** - See answers with source citations
- 🗑️ **Document Management** - Delete documents when needed

## Quick Start

### Option 1: Simple HTTP Server (Recommended)

```bash
# Using Python (if installed)
cd frontend
python -m http.server 8080

# OR using Node.js (if installed)
cd frontend
npx http-server -p 8080

# OR using PHP (if installed)
cd frontend
php -S localhost:8080
```

Then open: http://localhost:8080

### Option 2: Open Directly

Simply open `index.html` in your web browser. 

**Note:** Some browsers may block CORS requests when opening files directly. Use Option 1 if you encounter issues.

### Option 3: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

## Usage

### 1. Check Server Status
The status indicator at the top shows if the backend is running:
- ✅ Green = Connected
- ❌ Red = Disconnected

### 2. Upload a Document
1. Click "Choose a file..." or drag & drop
2. Select PDF, DOCX, DOC, XLSX, or TXT file (max 20MB)
3. Click "Upload & Process"
4. Wait for processing to complete

### 3. Ask Questions
1. Type your question in the text area
2. Optionally adjust:
   - **Results (topK)**: Number of chunks to retrieve (1-10)
   - **Min Score**: Minimum similarity threshold (0-1)
3. Click "Ask Question"
4. View the answer and source citations

### 4. Manage Documents
- View all uploaded documents in the list
- See status: Ready, Processing, or Failed
- Delete documents by clicking the 🗑️ button

## Configuration

### Change Backend URL

Edit `app.js` line 2:

```javascript
const API_BASE_URL = 'http://localhost:3000';  // Change port if needed
```

### CORS Setup

If you get CORS errors, you need to enable CORS in the backend.

Add to `src/api/server.ts`:

```typescript
import cors from 'cors';

// After creating the app
app.use(cors({
  origin: 'http://localhost:8080',  // Your frontend URL
  credentials: true,
}));
```

Install cors package:
```bash
npm install cors @types/cors
```

## File Structure

```
frontend/
├── index.html       # Main HTML page
├── styles.css       # All styling
├── app.js           # All JavaScript logic
└── README.md        # This file
```

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Troubleshooting

### Server Not Responding
- Ensure backend is running: `npm run dev` in rag-langgraph folder
- Check backend URL in `app.js`
- Verify port 3000 is accessible

### CORS Errors
- Use a local HTTP server (Option 1 above)
- Enable CORS in backend (see Configuration section)
- Check browser console for specific error

### Upload Fails
- Check file size (max 20MB)
- Verify file type is supported
- Check backend logs for errors

### No Answer Returned
- Ensure documents are uploaded and status is "Ready"
- Try lowering Min Score threshold
- Check if question is relevant to uploaded documents

## Development

### Running with Auto-Reload

Using browser-sync:
```bash
npm install -g browser-sync
cd frontend
browser-sync start --server --files "*.html, *.css, *.js"
```

### Customization

**Colors:** Edit CSS variables in `styles.css`:
```css
:root {
    --primary: #3b82f6;        /* Main color */
    --success: #10b981;         /* Success messages */
    --error: #ef4444;           /* Error messages */
    /* ... */
}
```

**API Endpoints:** All API calls are in `app.js`:
- `checkServerStatus()` - GET /health
- `handleUpload()` - POST /upload
- `handleQuery()` - POST /query
- `refreshDocuments()` - GET /documents
- `deleteDocument()` - DELETE /documents/:id

## Performance

- Minimal bundle size (~15KB total)
- No build step required
- No dependencies (vanilla JavaScript)
- Fast load times
- Responsive design

## Security Notes

⚠️ **This is a development frontend for testing purposes**

For production use:
- Add authentication
- Implement rate limiting on frontend
- Validate all inputs
- Add CSRF protection
- Use HTTPS
- Add proper error handling
- Implement session management

## License

Same as parent project (MIT)

## Support

For issues related to:
- **Frontend:** Check browser console
- **Backend:** Check backend logs with `npm run dev`
- **CORS:** See Configuration section above
