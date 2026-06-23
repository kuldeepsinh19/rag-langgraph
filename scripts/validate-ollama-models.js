#!/usr/bin/env node
/**
 * Validate that the local Ollama LLM model is pulled and ready.
 */

require('dotenv/config');
const { Ollama } = require('ollama');

const config = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  llmModel: process.env.OLLAMA_LLM_MODEL || 'llama3.2',
};

async function validateModels() {
  console.log('Validating Ollama LLM model...\n');

  try {
    const ollama = new Ollama({ host: config.baseUrl });
    const response = await ollama.list();
    const availableModels = response.models.map((model) => model.name);

    console.log('Available models:');
    availableModels.forEach((model) => console.log(`   - ${model}`));
    console.log('');

    const hasLlmModel = availableModels.some(
      (model) => model === config.llmModel || model.startsWith(`${config.llmModel}:`),
    );

    if (!hasLlmModel) {
      console.error(`LLM model "${config.llmModel}" not found`);
      console.error('\nTo fix, run:');
      console.error(`   docker exec -it rag-langgraph-ollama-1 ollama pull ${config.llmModel}`);
      console.error(`   OR: ollama pull ${config.llmModel}  (if running locally)`);
      process.exit(1);
    }

    console.log(`LLM model ready: ${config.llmModel}`);
  } catch (err) {
    console.error(`\nOllama validation failed: ${err.message}`);

    if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
      console.error('\nOllama is not running. Start it with:');
      console.error('   docker-compose up -d ollama');
      console.error('   OR: ollama serve  (if installed locally)');
    }

    process.exit(1);
  }
}

if (require.main === module) {
  validateModels();
}

module.exports = { validateModels };
