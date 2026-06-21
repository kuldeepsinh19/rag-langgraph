import { UnsupportedTypeError } from '../../common/errors';
import { DocParser } from './DocParser';
import { DocxParser } from './DocxParser';
import type { IDocumentParser } from './IDocumentParser';
import { PdfParser } from './PdfParser';
import { TxtParser } from './TxtParser';
import { XlsxParser } from './XlsxParser';

const parsers: IDocumentParser[] = [
  new PdfParser(),
  new DocxParser(),
  new DocParser(),
  new XlsxParser(),
  new TxtParser(),
];

const parserByMime = new Map<string, IDocumentParser>();

for (const parser of parsers) {
  for (const mimeType of parser.supportedMimes) {
    parserByMime.set(mimeType, parser);
  }
}

export const ALLOWED_MIME_TYPES = Array.from(parserByMime.keys());

export function getParser(mimeType: string): IDocumentParser {
  const parser = parserByMime.get(mimeType);

  if (!parser) {
    throw new UnsupportedTypeError(`Unsupported document type: ${mimeType}`);
  }

  return parser;
}
