import type { Config } from '../../common/config';
import type { IChunker } from './IChunker';
import { RecursiveChunker } from './RecursiveChunker';

export function createChunker(config: Config): IChunker {
  return new RecursiveChunker(config.CHUNK_SIZE, config.CHUNK_OVERLAP);
}
