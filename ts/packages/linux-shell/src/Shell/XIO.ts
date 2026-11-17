// Port of Shell/XIO.cs – the internal IO object used while the shell runs code (stdin is a shared reader).

import type { Reader } from "../Types/Reader.js";
import { Sink } from "../Types/Sink.js";

/** Internal IO object while code runs: stdin is a shared reader. */
export class XIO extends Sink {
  constructor(
    out: (s: string) => void,
    err: (s: string) => void,
    public stdin: Reader | null,
    public tty: boolean,
  ) {
    super(out, err);
  }
}
