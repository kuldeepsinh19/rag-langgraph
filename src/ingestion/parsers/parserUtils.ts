import path from 'node:path';
import { EmptyDocumentError } from '../../common/errors';

export function titleFromFilename(filename: string): string {
  const parsed = path.parse(filename);
  return parsed.name || filename;
}

export function normalizeText(text: string): string {
  return text.trim();
}

export function assertNonEmptyText(text: string): void {
  if (text.trim().length === 0) {
    throw new EmptyDocumentError();
  }
}
