import type { Config } from '../../common/config';
import { logger } from '../../common/logger';
import type { IEmbeddingService } from '../../embeddings';
import type { IVectorStore } from '../../vectorstore/IVectorStore';
import { createLLM, invokeWithTimeout, llmResponseToText, type RagLLM } from '../llm';
import type { RagState } from '../state';

const KNOWN_TECH_TERMS = [
  'React.js',
  'Next.js',
  'Node.js',
  'Express.js',
  'JavaScript',
  'TypeScript',
  'MongoDB',
  'MySQL',
  'PostgreSQL',
  'AWS',
  'OpenSearch',
  'LangChain',
  'LangGraph',
  'Gemini',
  'Vertex AI',
  'JWT',
  'OAuth 2.0',
  'REST APIs',
  'Microservices',
  'Serverless',
  'RAG',
  'MERN',
];

export async function generateNode(
  state: RagState,
  deps: {
    vectorStore: IVectorStore;
    embedder: IEmbeddingService;
    config: Config;
    llm?: RagLLM;
  },
): Promise<Partial<RagState>> {
  if (state.gradedChunks.length === 0) {
    logger.warn('No relevant chunks found for generation');
    return {
      answer:
        "I couldn't find relevant information to answer that question. Try rephrasing or uploading more relevant documents.",
      sources: [],
    };
  }

  const llm = deps.llm ?? createLLM(deps.config);
  const context = state.gradedChunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join('\n\n');
  const queryToUse = state.rewrittenQuery ?? state.query;
  const prompt = `Answer the question using only the provided context.
Rules:
- Be concise.
- Default to 1-2 short sentences.
- For "tech stack", "skills", or similar questions, return a short comma-separated list.
- Include only the most relevant information.
- If the context does not contain enough information, say so clearly.

Context:
${context}

Question: ${queryToUse}

Answer:`;

  try {
    const response = await invokeWithTimeout(llm, prompt);
    return { answer: llmResponseToText(response).trim(), sources: state.gradedChunks };
  } catch (err) {
    logger.warn({ err, query: queryToUse }, 'LLM generation failed or timed out, using extractive fallback');
    return {
      answer: buildExtractiveFallback(state),
      sources: state.gradedChunks,
    };
  }
}

function buildExtractiveFallback(state: RagState): string {
  const query = (state.rewrittenQuery ?? state.query).toLowerCase();

  if (isTechStackQuestion(query)) {
    const techs = extractTechnologies(state.gradedChunks.map((chunk) => chunk.text).join(' '));
    if (techs.length > 0) {
      return `Tech stack: ${techs.join(', ')}`;
    }
  }

  const sentences = state.gradedChunks
    .flatMap((chunk) => splitIntoSentences(chunk.text))
    .map((sentence) => normalizeFallbackSentence(sentence))
    .filter((sentence) => sentence.length > 20);

  const readableSentences = sentences.filter((sentence) => /^[A-Z0-9]/.test(sentence));
  const fallbackSentences = readableSentences.length > 0 ? readableSentences : sentences;

  const excerpt = fallbackSentences.slice(0, 2).join(' ');
  if (!excerpt) {
    return "I couldn't find relevant information to answer that question.";
  }

  if (isDocumentAboutQuestion(query)) {
    const concise = excerpt.length <= 220 ? excerpt : `${excerpt.slice(0, 217).trim()}...`;
    return `This document appears to be about ${lowercaseFirst(concise)}`;
  }

  return excerpt.length <= 280 ? excerpt : `${excerpt.slice(0, 277).trim()}...`;
}

function isDocumentAboutQuestion(query: string): boolean {
  return /what.*doc.*about|what.*document.*about|document.*about|doc.*about/.test(query);
}

function isTechStackQuestion(query: string): boolean {
  return /tech\s*stack|technology|technologies|skills|experience.*stack|stack.*experience/.test(query);
}

function extractTechnologies(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ');
  return KNOWN_TECH_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  });
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function normalizeFallbackSentence(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  const withoutPartialPrefix = compact.replace(/^[a-z]{1,3}(?=[A-Z])/, '');
  const readableStart =
    withoutPartialPrefix.match(/[A-Z][^]*$/)?.[0] ??
    withoutPartialPrefix.match(/[A-Za-z][^]*$/)?.[0] ??
    withoutPartialPrefix;

  return readableStart
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lowercaseFirst(text: string): string {
  if (!text) {
    return text;
  }

  return text.charAt(0).toLowerCase() + text.slice(1);
}
