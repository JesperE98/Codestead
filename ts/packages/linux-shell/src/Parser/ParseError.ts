// Port of Parser/ParseError.cs – syntax error from the parser (or a note that the code is only incomplete).

export class ParseError extends Error {
  /** True when the code is only incomplete (e.g. missing "done") – the shell then shows "> " and waits for more. */
  readonly incomplete: boolean;

  constructor(message: string, incomplete = false) {
    super(message);
    this.name = "ParseError";
    this.incomplete = incomplete;
  }
}
