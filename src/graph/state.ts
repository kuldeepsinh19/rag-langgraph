import { Annotation } from '@langchain/langgraph';
import type { ScoredChunk } from '../common/types';

const replace = <T>(_: T, next: T) => next;

export const RagStateAnnotation = Annotation.Root({
  query: Annotation<string>(),
  topK: Annotation<number | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
  minScore: Annotation<number | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
  rewrittenQuery: Annotation<string | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
  retrievedChunks: Annotation<ScoredChunk[]>({
    reducer: replace,
    default: () => [],
  }),
  gradedChunks: Annotation<ScoredChunk[]>({
    reducer: replace,
    default: () => [],
  }),
  answer: Annotation<string | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
  sources: Annotation<ScoredChunk[]>({
    reducer: replace,
    default: () => [],
  }),
  retryCount: Annotation<number>({
    reducer: replace,
    default: () => 0,
  }),
  confidence: Annotation<'high' | 'low' | undefined>({
    reducer: replace,
    default: () => undefined,
  }),
});

export type RagState = typeof RagStateAnnotation.State;
