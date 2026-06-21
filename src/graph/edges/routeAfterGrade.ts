import { config as defaultConfig, type Config } from '../../common/config';
import type { RagState } from '../state';

export function routeAfterGrade(
  state: RagState,
  config: Pick<Config, 'MAX_REWRITE_RETRIES'> = defaultConfig,
): 'rewrite' | 'generate' {
  if (state.confidence === 'high') {
    return 'generate';
  }

  if (state.retrievedChunks.length > 0) {
    return 'generate';
  }

  if (state.retryCount >= config.MAX_REWRITE_RETRIES) {
    return 'generate';
  }

  return 'rewrite';
}
