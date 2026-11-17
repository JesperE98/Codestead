// Port of Commands/Awk/AwkSyntaxError.cs – awk: a syntax error found by the tokenizer or parser.

import type { AwkUnsupported } from "./AwkUnsupported.js";

export class AwkSyntaxError extends Error {
  readonly pos: number;
  /** Set when the construct exists in real awk but not in the simulator. */
  readonly unsupported: AwkUnsupported | null;

  constructor(message: string, pos: number, unsupported: AwkUnsupported | null = null) {
    super(message);
    this.name = "AwkSyntaxError";
    this.pos = pos;
    this.unsupported = unsupported;
  }
}
