import { describe, it, expect, vi } from 'vitest';
import { UnsupportedTypeError } from '../../../src/common/errors';

// Mock all parsers before importing the factory
vi.mock('../../../src/ingestion/parsers/PdfParser', () => ({
  PdfParser: class MockPdfParser {
    supportedMimes = ['application/pdf'];
  },
}));

vi.mock('../../../src/ingestion/parsers/DocxParser', () => ({
  DocxParser: class MockDocxParser {
    supportedMimes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  },
}));

vi.mock('../../../src/ingestion/parsers/DocParser', () => ({
  DocParser: class MockDocParser {
    supportedMimes = ['application/msword'];
  },
}));

vi.mock('../../../src/ingestion/parsers/XlsxParser', () => ({
  XlsxParser: class MockXlsxParser {
    supportedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
  },
}));

// Now import the factory after mocks are set up
import { getParser, ALLOWED_MIME_TYPES } from '../../../src/ingestion/parsers/ParserFactory';

describe('ParserFactory', () => {
  it('should return PdfParser for PDF MIME type', () => {
    const parser = getParser('application/pdf');
    expect(parser).toBeDefined();
    expect(parser.supportedMimes).toContain('application/pdf');
  });

  it('should return DocxParser for Word MIME type', () => {
    const parser = getParser(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(parser).toBeDefined();
  });

  it('should return XlsxParser for Excel MIME types', () => {
    const parser1 = getParser('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(parser1).toBeDefined();

    const parser2 = getParser('application/vnd.ms-excel');
    expect(parser2).toBeDefined();
  });

  it('should return DocParser for legacy Word MIME type', () => {
    const parser = getParser('application/msword');
    expect(parser).toBeDefined();
  });

  it('should throw UnsupportedTypeError for unknown MIME type', () => {
    expect(() => getParser('image/png')).toThrow(UnsupportedTypeError);
    expect(() => getParser('video/mp4')).toThrow(UnsupportedTypeError);
    expect(() => getParser('application/json')).toThrow(UnsupportedTypeError);
  });

  it('should have all 4+ MIME types in ALLOWED_MIME_TYPES', () => {
    expect(ALLOWED_MIME_TYPES.length).toBeGreaterThanOrEqual(4);
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
    expect(ALLOWED_MIME_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(ALLOWED_MIME_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(ALLOWED_MIME_TYPES).toContain('application/msword');
  });

  it('should have consistent MIME types between getParser and ALLOWED_MIME_TYPES', () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(() => getParser(mimeType)).not.toThrow();
    }
  });
});
