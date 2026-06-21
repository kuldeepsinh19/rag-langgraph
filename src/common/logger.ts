import pino, { type Logger } from 'pino';
import { config } from './config';

export const logger: Logger = pino({
  level: config.LOG_LEVEL,
});
