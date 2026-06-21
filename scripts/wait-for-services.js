#!/usr/bin/env node
/**
 * Wait for all required services to be healthy before starting the application
 * Services: PostgreSQL, Qdrant (optional), Ollama
 */

require('dotenv/config');
const http = require('http');
const { Pool } = require('pg');

const MAX_WAIT_TIME_SECONDS = 60;
const RETRY_INTERVAL_MS = 2000;

const config = {
  database: process.env.DATABASE_URL,
  vectorStore: process.env.VECTOR_STORE || 'pgvector',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
};

async function waitForServices() {
  console.log('⏳ Waiting for services to be ready...\n');
  
  const startTime = Date.now();

  try {
    // 1. PostgreSQL (always required)
    await waitForPostgres();
    
    // 2. Qdrant (only if using Qdrant)
    if (config.vectorStore === 'qdrant') {
      await waitForQdrant();
    } else {
      console.log('⏭️  Qdrant: Skipped (using pgvector)');
    }
    
    // 3. Ollama (always required for embeddings and LLM)
    await waitForOllama();
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ All services ready! (took ${elapsedSeconds}s)`);
    console.log('\n📋 Service status:');
    console.log('   ✅ PostgreSQL: Ready');
    if (config.vectorStore === 'qdrant') {
      console.log('   ✅ Qdrant: Ready');
    }
    console.log('   ✅ Ollama: Ready');
    
  } catch (err) {
    console.error(`\n❌ Service health check failed: ${err.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Run: docker-compose up -d');
    console.error('   - Check logs: docker-compose logs');
    console.error('   - Verify .env configuration');
    process.exit(1);
  }
}

async function waitForPostgres() {
  const maxAttempts = Math.ceil(MAX_WAIT_TIME_SECONDS * 1000 / RETRY_INTERVAL_MS);
  const pool = new Pool({
    connectionString: config.database,
    max: 1,
    connectionTimeoutMillis: 2000,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      await pool.end();
      console.log('✅ PostgreSQL: Ready');
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(`PostgreSQL not ready after ${MAX_WAIT_TIME_SECONDS}s`);
      }
      process.stdout.write(`⏳ PostgreSQL: Waiting... (attempt ${attempt}/${maxAttempts})\r`);
      await sleep(RETRY_INTERVAL_MS);
    }
  }
}

async function waitForQdrant() {
  const url = new URL(config.qdrantUrl);
  const maxAttempts = Math.ceil(MAX_WAIT_TIME_SECONDS * 1000 / RETRY_INTERVAL_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await httpGet(url.hostname, parseInt(url.port) || 6333, '/healthz');
      console.log('✅ Qdrant: Ready');
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(`Qdrant not ready after ${MAX_WAIT_TIME_SECONDS}s`);
      }
      process.stdout.write(`⏳ Qdrant: Waiting... (attempt ${attempt}/${maxAttempts})\r`);
      await sleep(RETRY_INTERVAL_MS);
    }
  }
}

async function waitForOllama() {
  const url = new URL(config.ollamaUrl);
  const maxAttempts = Math.ceil(MAX_WAIT_TIME_SECONDS * 1000 / RETRY_INTERVAL_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await httpGet(url.hostname, parseInt(url.port) || 11434, '/');
      console.log('✅ Ollama: Ready');
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(`Ollama not ready after ${MAX_WAIT_TIME_SECONDS}s`);
      }
      process.stdout.write(`⏳ Ollama: Waiting... (attempt ${attempt}/${maxAttempts})\r`);
      await sleep(RETRY_INTERVAL_MS);
    }
  }
}

function httpGet(hostname, port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        resolve();
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if called directly
if (require.main === module) {
  waitForServices();
}

module.exports = { waitForServices };
