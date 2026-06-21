// Configuration
const API_BASE_URL = 'http://localhost:3000';

// State
let documents = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    setupEventListeners();
    refreshDocuments();
    setInterval(checkServerStatus, 30000); // Check status every 30 seconds
});

// Setup Event Listeners
function setupEventListeners() {
    // File input change
    document.getElementById('fileInput').addEventListener('change', (e) => {
        const label = document.getElementById('fileLabel');
        const fileName = e.target.files[0]?.name || 'Choose a file...';
        label.textContent = fileName;
        label.parentElement.querySelector('.file-label').classList.toggle('has-file', !!e.target.files[0]);
    });

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);

    // Query form
    document.getElementById('queryForm').addEventListener('submit', handleQuery);
}

// Check Server Status
async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();

        if (data.status === 'ok') {
            statusDot.className = 'status-dot online';
            statusText.textContent = `✅ Connected (${data.vectorStore} + ${data.embedder})`;
        } else {
            throw new Error('Unhealthy');
        }
    } catch (error) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = '❌ Server not responding';
        console.error('Health check failed:', error);
    }
}

// Handle File Upload
async function handleUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const statusDiv = document.getElementById('uploadStatus');

    if (!fileInput.files[0]) {
        showStatus(statusDiv, 'Please select a file', 'error');
        return;
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    // Show loading state
    setButtonLoading(uploadBtn, true);
    showStatus(statusDiv, 'Uploading and processing document...', 'loading');

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Upload failed: ${response.status}`);
        }

        // Success
        showStatus(statusDiv, 
            `✅ Success! Document uploaded with ${data.chunkCount} chunks`, 
            'success'
        );

        // Reset form
        fileInput.value = '';
        document.getElementById('fileLabel').textContent = 'Choose a file...';
        document.querySelector('.file-label').classList.remove('has-file');

        // Refresh documents list
        setTimeout(() => refreshDocuments(), 500);

    } catch (error) {
        showStatus(statusDiv, `❌ Error: ${error.message}`, 'error');
        console.error('Upload error:', error);
    } finally {
        setButtonLoading(uploadBtn, false);
    }
}

// Handle Query
async function handleQuery(e) {
    e.preventDefault();

    const queryInput = document.getElementById('queryInput');
    const queryBtn = document.getElementById('queryBtn');
    const statusDiv = document.getElementById('queryStatus');
    const answerSection = document.getElementById('answerSection');

    const query = queryInput.value.trim();
    if (!query) {
        showStatus(statusDiv, 'Please enter a question', 'error');
        return;
    }

    // Show loading state
    setButtonLoading(queryBtn, true);
    showStatus(statusDiv, 'Searching documents and generating answer...', 'loading');
    answerSection.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Query failed: ${response.status}`);
        }

        // Hide status, show answer
        statusDiv.style.display = 'none';
        displayAnswer(data);

    } catch (error) {
        showStatus(statusDiv, `❌ Error: ${error.message}`, 'error');
        console.error('Query error:', error);
    } finally {
        setButtonLoading(queryBtn, false);
    }
}

// Display Answer
function displayAnswer(data) {
    const answerSection = document.getElementById('answerSection');
    const answerContent = document.getElementById('answerContent');
    const sourcesList = document.getElementById('sourcesList');
    const finalQuery = document.getElementById('finalQuery');
    const rewriteCount = document.getElementById('rewriteCount');

    // Show section
    answerSection.style.display = 'block';

    // Display answer
    answerContent.textContent = data.answer;

    // Display metadata
    finalQuery.textContent = data.query;
    rewriteCount.textContent = data.rewriteCount || 0;

    // Display sources
    if (data.sources && data.sources.length > 0) {
        sourcesList.innerHTML = data.sources.map((source, index) => `
            <div class="source-item">
                <div class="source-header">
                    <span class="source-title">
                        📄 ${source.filename} (chunk ${source.chunkIndex})
                    </span>
                    <span class="source-score">
                        ${(source.score * 100).toFixed(1)}%
                    </span>
                </div>
                <div class="source-text">${escapeHtml(source.text)}</div>
            </div>
        `).join('');
    } else {
        sourcesList.innerHTML = '<p class="empty-text">No sources found</p>';
    }

    // Scroll to answer
    answerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Refresh Documents List
async function refreshDocuments() {
    const documentsList = document.getElementById('documentsList');

    documentsList.innerHTML = '<p class="loading-text">Loading documents...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/documents`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }

        documents = data.documents || [];

        if (documents.length === 0) {
            documentsList.innerHTML = '<p class="empty-text">No documents uploaded yet</p>';
            return;
        }

        documentsList.innerHTML = documents.map(doc => `
            <div class="document-item">
                <div class="document-info">
                    <div class="document-name">📄 ${escapeHtml(doc.filename)}</div>
                    <div class="document-meta">
                        ${doc.chunkCount} chunks • 
                        Uploaded ${formatDate(doc.uploadedAt)} •
                        ${doc.mimeType}
                    </div>
                </div>
                <span class="document-status status-${doc.status}">${doc.status}</span>
                <button 
                    class="btn btn-delete btn-sm" 
                    onclick="deleteDocument('${doc.id}')"
                    ${doc.status === 'processing' ? 'disabled' : ''}
                >
                    🗑️ Delete
                </button>
            </div>
        `).join('');

    } catch (error) {
        documentsList.innerHTML = '<p class="empty-text">❌ Failed to load documents</p>';
        console.error('Error fetching documents:', error);
    }
}

// Delete Document
async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete document');
        }

        // Refresh the list
        refreshDocuments();

    } catch (error) {
        alert(`Error deleting document: ${error.message}`);
        console.error('Delete error:', error);
    }
}

// Utility Functions
function showStatus(element, message, type) {
    element.className = `status-message ${type}`;
    element.style.display = type === 'loading' ? 'flex' : 'block';
    
    if (type === 'loading') {
        element.innerHTML = `
            <span class="spinner"></span>
            <span>${message}</span>
        `;
    } else {
        element.textContent = message;
    }
}

function setButtonLoading(button, isLoading) {
    const textSpan = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');

    button.disabled = isLoading;
    textSpan.style.display = isLoading ? 'none' : 'inline';
    spinner.style.display = isLoading ? 'inline-block' : 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}
