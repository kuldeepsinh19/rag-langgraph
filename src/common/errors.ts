export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ParseError extends AppError {
  constructor(message = 'Unable to parse document') {
    super(message, 422, 'PARSE_ERROR');
  }
}

export class UnsupportedTypeError extends AppError {
  constructor(message = 'Unsupported document type') {
    super(message, 400, 'UNSUPPORTED_TYPE');
  }
}

export class EmptyDocumentError extends AppError {
  constructor(message = 'Document is empty') {
    super(message, 422, 'EMPTY_DOCUMENT');
  }
}

export class EmptyQueryError extends AppError {
  constructor(message = 'Query is empty') {
    super(message, 400, 'EMPTY_QUERY');
  }
}

export class GraphExecutionError extends AppError {
  constructor(message = 'Graph execution failed') {
    super(message, 500, 'GRAPH_ERROR');
  }
}

export class VectorStoreError extends AppError {
  constructor(message = 'Vector store operation failed') {
    super(message, 503, 'VECTOR_STORE_ERROR');
  }
}
