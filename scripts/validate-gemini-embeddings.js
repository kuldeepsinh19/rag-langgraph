#!/usr/bin/env node
/**
 * Validate Gemini embedding configuration and API access.
 */

require('dotenv/config');
const { GoogleGenAI } = require('@google/genai');

const config = {
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2',
  dimensions: Number(process.env.GEMINI_EMBED_DIMENSIONS || 768),
};

async function validateGeminiEmbeddings() {
  console.log('Validating Gemini embeddings...\n');

  if (!config.apiKey) {
    console.error('GEMINI_API_KEY is required.');
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.embedContent({
      model: config.model,
      contents: ['task: question answering | query: test'],
      config: { outputDimensionality: config.dimensions },
    });

    const embedding = response.embeddings && response.embeddings[0] && response.embeddings[0].values;
    if (!embedding || embedding.length !== config.dimensions) {
      throw new Error(
        `Expected ${config.dimensions} dimensions but received ${embedding ? embedding.length : 0}`,
      );
    }

    console.log(`Gemini embedding model: ${config.model}`);
    console.log(`Embedding test successful (${embedding.length} dimensions)`);
  } catch (err) {
    console.error(`Gemini embedding validation failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  validateGeminiEmbeddings();
}

module.exports = { validateGeminiEmbeddings };
