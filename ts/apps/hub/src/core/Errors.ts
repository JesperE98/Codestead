// The .NET exception types the hub's logic throws and catches, so callers (and the tests) can tell them apart the way
// the C# code does: IOException, InvalidDataException, ArgumentException, InvalidOperationException and
// HttpRequestException. CatalogException has its own file, as in C#.

/** .NET's IOException: a file or folder could not be read, written, moved or deleted. */
export class IOError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "IOException";
  }
}

/** .NET's InvalidDataException: a download or package that is not what the catalog says. */
export class InvalidDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InvalidDataException";
  }
}

/** .NET's ArgumentException. */
export class ArgumentError extends Error {
  constructor(
    message: string,
    readonly paramName?: string,
  ) {
    super(message);
    this.name = "ArgumentException";
  }
}

/** .NET's InvalidOperationException. */
export class InvalidOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperationException";
  }
}

/** .NET's HttpRequestException: the server could not be reached or did not answer with success. */
export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "HttpRequestException";
  }
}

/** The message of anything thrown (Exception.Message). */
export function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
