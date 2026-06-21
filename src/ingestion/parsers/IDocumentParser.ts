import type { ParsedDocument } from '@/common/types';

export interface IDocumentParser {
  parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;
  readonly supportedMimes: readonly string[];
}
