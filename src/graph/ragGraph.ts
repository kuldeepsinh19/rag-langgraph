import { END, START, StateGraph } from '@langchain/langgraph';
import type { Config } from '../common/config';
import type { IEmbeddingService } from '../embeddings';
import type { IVectorStore } from '../vectorstore/IVectorStore';
import { routeAfterGrade } from './edges';
import type { RagLLM } from './llm';
import { generateNode, gradeDocumentsNode, retrieveNode, rewriteQueryNode } from './nodes';
import { RagStateAnnotation } from './state';

export interface RagGraphDeps {
  vectorStore: IVectorStore;
  embedder: IEmbeddingService;
  config: Config;
  llm?: RagLLM;
}

export function buildRagGraph(deps: RagGraphDeps) {
  const graph = new StateGraph(RagStateAnnotation)
    .addNode('retrieve', (state) => retrieveNode(state, deps))
    .addNode('gradeDocuments', (state) => gradeDocumentsNode(state, deps))
    .addNode('rewriteQuery', (state) => rewriteQueryNode(state, deps))
    .addNode('generate', (state) => generateNode(state, deps))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'gradeDocuments')
    .addConditionalEdges('gradeDocuments', (state) => routeAfterGrade(state, deps.config), {
      rewrite: 'rewriteQuery',
      generate: 'generate',
    })
    .addEdge('rewriteQuery', 'retrieve')
    .addEdge('generate', END);

  return graph.compile();
}

export type CompiledRagGraph = ReturnType<typeof buildRagGraph>;
