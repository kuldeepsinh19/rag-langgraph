#!/usr/bin/env node
/**
 * Database initialization script
 * Applies all schema migrations to set up the RAG database
 */

require('dotenv/config');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('   Please create a .env file with DATABASE_URL or set it in your environment');
  process.exit(1);
}

async function initDatabase() {
  console.log('🚀 Initializing database...');
  console.log(`   Database: ${DATABASE_URL.split('@')[1] || 'hidden'}`);
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connection
    console.log('\n📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // 1. Create pgvector extension and chunks table
    console.log('\n📦 Creating pgvector extension and chunks table...');
    const pgvectorSchemaPath = path.join(__dirname, '../src/vectorstore/pgvector/pgvector.schema.sql');
    
    if (!fs.existsSync(pgvectorSchemaPath)) {
      throw new Error(`Schema file not found: ${pgvectorSchemaPath}`);
    }
    
    const pgvectorSchema = fs.readFileSync(pgvectorSchemaPath, 'utf8');
    await pool.query(pgvectorSchema);
    console.log('✅ pgvector schema applied');

    // 2. Create documents table
    console.log('\n📄 Creating documents metadata table...');
    const documentsSchemaPath = path.join(__dirname, '../src/documents/documents.schema.sql');
    
    if (!fs.existsSync(documentsSchemaPath)) {
      throw new Error(`Schema file not found: ${documentsSchemaPath}`);
    }
    
    const documentsSchema = fs.readFileSync(documentsSchemaPath, 'utf8');
    await pool.query(documentsSchema);
    console.log('✅ documents schema applied');

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('chunks', 'documents')
      ORDER BY table_name
    `);

    console.log('   Tables found:');
    rows.forEach(row => console.log(`   - ${row.table_name}`));

    if (rows.length !== 2) {
      throw new Error('Expected 2 tables (chunks, documents) but found ' + rows.length);
    }

    console.log('\n✅ Database initialization complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start Ollama and pull models:');
    console.log('      docker exec -it rag-langgraph-ollama-1 ollama pull nomic-embed-text');
    console.log('      docker exec -it rag-langgraph-ollama-1 ollama pull llama3.2');
    console.log('   2. Start the server:');
    console.log('      npm run dev');

  } catch (err) {
    console.error('\n❌ Database initialization failed:');
    console.error('   Error:', err.message);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Is PostgreSQL running? Try: docker-compose up -d');
      console.error('   - Is DATABASE_URL correct in your .env file?');
    } else if (err.message.includes('permission denied')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Database user may not have CREATE EXTENSION permission');
      console.error('   - Try connecting as superuser or grant permissions');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
