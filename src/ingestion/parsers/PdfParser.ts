import pdfParse from 'pdf-parse';
import { EmptyDocumentError, ParseError } from '../../common/errors';
import type { ParsedDocument } from '../../common/types';
import type { IDocumentParser } from './IDocumentParser';
import { assertNonEmptyText, normalizeText, titleFromFilename } from './parserUtils';

export class PdfParser implements IDocumentParser {
  readonly supportedMimes = ['application/pdf'] as const;

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      const result = await pdfParse(buffer);
      const text = normalizeText(result.text ?? '');

      assertNonEmptyText(text);

      return {
        text,
        metadata: {
          title: titleFromFilename(filename),
          pageCount: result.numpages,
        },
      };
    } catch (error) {
      if (error instanceof EmptyDocumentError) {
        throw error;
      }

      throw new ParseError(`Unable to parse PDF document: ${getErrorMessage(error)}`);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown parser error';
}
