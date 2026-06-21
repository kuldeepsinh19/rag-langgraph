import mammoth from 'mammoth';
import { EmptyDocumentError, ParseError } from '../../common/errors';
import type { ParsedDocument } from '../../common/types';
import type { IDocumentParser } from './IDocumentParser';
import { assertNonEmptyText, normalizeText, titleFromFilename } from './parserUtils';

export class DocxParser implements IDocumentParser {
  readonly supportedMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const;

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = normalizeText(result.value.replace(/\n{3,}/g, '\n\n'));

      assertNonEmptyText(text);

      return {
        text,
        metadata: {
          title: titleFromFilename(filename),
        },
      };
    } catch (error) {
      if (error instanceof EmptyDocumentError) {
        throw error;
      }

      throw new ParseError(`Unable to parse DOCX document: ${getErrorMessage(error)}`);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown parser error';
}
