import { EmptyDocumentError } from '../../common/errors';
import type { ParsedDocument } from '../../common/types';
import type { IDocumentParser } from './IDocumentParser';
import { assertNonEmptyText, normalizeText, titleFromFilename } from './parserUtils';

export class TxtParser implements IDocumentParser {
  readonly supportedMimes = ['text/plain'] as const;

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const text = normalizeText(buffer.toString('utf-8'));
    assertNonEmptyText(text);

    return {
      text,
      metadata: {
        title: titleFromFilename(filename),
      },
    };
  }
}
