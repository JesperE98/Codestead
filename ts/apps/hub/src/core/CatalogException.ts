// The error for a catalog that cannot be used.

export class CatalogException extends Error {
  constructor(message: string, inner?: unknown) {
    super(message, inner === undefined ? undefined : { cause: inner });
    this.name = "CatalogException";
  }
}
