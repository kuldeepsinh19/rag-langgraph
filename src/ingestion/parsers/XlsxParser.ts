import * as XLSX from 'xlsx';
import { EmptyDocumentError, ParseError } from '../../common/errors';
import type { ParsedDocument } from '../../common/types';
import type { IDocumentParser } from './IDocumentParser';
import { assertNonEmptyText, normalizeText, titleFromFilename } from './parserUtils';

export class XlsxParser implements IDocumentParser {
  readonly supportedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ] as const;

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    try {
      if (!hasSpreadsheetSignature(buffer)) {
        throw new ParseError('Spreadsheet buffer is empty or corrupt');
      }

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;

      if (sheetNames.length === 0) {
        throw new ParseError('Spreadsheet has no sheets');
      }

      const sheetTexts = sheetNames
        .map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = worksheet ? XLSX.utils.sheet_to_csv(worksheet).trim() : '';

          if (csv.length === 0) {
            return '';
          }

          return `# ${sheetName}\n${csv}`;
        })
        .filter((sheetText) => sheetText.length > 0);

      const text = normalizeText(sheetTexts.join('\n\n---\n\n'));
      assertNonEmptyText(text);

      return {
        text,
        metadata: {
          title: titleFromFilename(filename),
          sheetNames,
        },
      };
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }

      if (error instanceof EmptyDocumentError) {
        throw error;
      }

      throw new ParseError(`Unable to parse spreadsheet: ${getErrorMessage(error)}`);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown parser error';
}

function hasSpreadsheetSignature(buffer: Buffer): boolean {
  const xlsxZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const xlsOleSignature =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1;

  return xlsxZipSignature || xlsOleSignature;
}
