#!/usr/bin/env node
/**
 * Validate that required Ollama models are pulled and ready
 */

require('dotenv/config');
const { Ollama } = require('ollama');

const config = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  llmModel: process.env.OLLAMA_LLM_MODEL || 'llama3.2',
};

async function validateModels() {
  console.log('🔍 Validating Ollama models...\n');
  
  try {
    const ollama = new Ollama({ host: config.baseUrl });
    
    // List available models
    const response = await ollama.list();
    const availableModels = response.models.map(m => m.name);
    
    console.log('📦 Available models:');
    availableModels.forEach(model => console.log(`   - ${model}`));
    console.log('');
    
    // Check embedding model
    const hasEmbedModel = availableModels.some(m => 
      m === config.embedModel || m.startsWith(config.embedModel + ':')
    );
    
    if (!hasEmbedModel) {
      console.error(`❌ Embedding model "${config.embedModel}" not found`);
      console.error(`\n💡 To fix, run:`);
      console.error(`   docker exec -it rag-langgraph-ollama-1 ollama pull ${config.embedModel}`);
      console.error(`   OR: ollama pull ${config.embedModel}  (if running locally)`);
      process.exit(1);
    }
    console.log(`✅ Embedding model: ${config.embedModel}`);
    
    // Check LLM model
    const hasLlmModel = availableModels.some(m => 
      m === config.llmModel || m.startsWith(config.llmModel + ':')
    );
    
    if (!hasLlmModel) {
      console.error(`❌ LLM model "${config.llmModel}" not found`);
      console.error(`\n💡 To fix, run:`);
      console.error(`   docker exec -it rag-langgraph-ollama-1 ollama pull ${config.llmModel}`);
      console.error(`   OR: ollama pull ${config.llmModel}  (if running locally)`);
      process.exit(1);
    }
    console.log(`✅ LLM model: ${config.llmModel}`);
    
    // Test embedding generation
    console.log('\n🧪 Testing embedding generation...');
    const embedResult = await ollama.embeddings({
      model: config.embedModel,
      prompt: 'test',
    });
    
    if (!embedResult.embedding || embedResult.embedding.length === 0) {
      throw new Error('Embedding generation failed - no embedding returned');
    }
    
    console.log(`✅ Embedding test successful (${embedResult.embedding.length} dimensions)`);
    
    console.log('\n✅ All Ollama models validated and ready!');
    
  } catch (err) {
    console.error(`\n❌ Ollama validation failed: ${err.message}`);
    
    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Ollama is not running. Start it with:');
      console.error('   docker-compose up -d ollama');
      console.error('   OR: ollama serve  (if installed locally)');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  validateModels();
}

module.exports = { validateModels };
