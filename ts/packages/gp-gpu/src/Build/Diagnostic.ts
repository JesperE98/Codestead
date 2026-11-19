/** A compiler message: file, line (1-based), error or warning, and the text (in English, like a real compiler). */
export class Diagnostic {
  constructor(readonly file: string, readonly line: number, readonly isError: boolean, readonly message: string) {}

  toString(): string {
    return `${this.file}:${this.line}: ${this.isError ? "error" : "warning"}: ${this.message}`;
  }
}
