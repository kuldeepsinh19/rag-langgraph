import type { BaseMessage, BaseMessageChunk } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';
import type { Config } from '../common/config';

export interface RagLLM {
  invoke(input: string): Promise<BaseMessage | BaseMessageChunk>;
}

const DEFAULT_LLM_TIMEOUT_MS = 12000;

export function createLLM(config: Config): BaseChatModel {
  return new ChatOllama({
    baseUrl: config.OLLAMA_BASE_URL,
    model: config.OLLAMA_LLM_MODEL,
    temperature: 0,
  });
}

export function llmResponseToText(response: BaseMessage | BaseMessageChunk): string {
  if (typeof response.content === 'string') {
    return response.content;
  }

  return response.content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if ('text' in part && typeof part.text === 'string') {
        return part.text;
      }

      return '';
    })
    .join('');
}

export async function invokeWithTimeout(
  llm: RagLLM,
  input: string,
  timeoutMs = DEFAULT_LLM_TIMEOUT_MS,
): Promise<BaseMessage | BaseMessageChunk> {
  return Promise.race([
    llm.invoke(input),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
