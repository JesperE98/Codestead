// Port of Types/IO.cs – the streams of a command: output, error, stdin and whether it is a terminal.

import type { Reader } from "./Reader.js";
import { Sink } from "./Sink.js";

export class IO extends Sink {
  /** Input from a pipe or file. null means "the keyboard" (nothing to read). */
  stdin: string | null;
  /** The same input as a reader with a position – shared between commands in a loop. */
  reader: Reader | null;
  /** True when output goes straight to the terminal (not to a pipe or file). */
  isTTY: boolean;

  /** { ...io } – a copy with the same streams. */
  constructor(io: IO);
  constructor(out: (s: string) => void, err: (s: string) => void, stdin?: string | null, isTTY?: boolean, reader?: Reader | null);
  constructor(
    outOrIo: ((s: string) => void) | IO,
    err?: (s: string) => void,
    stdin: string | null = null,
    isTTY = false,
    reader: Reader | null = null,
  ) {
    if (outOrIo instanceof IO) {
      super(outOrIo.outFn, outOrIo.errFn);
      this.stdin = outOrIo.stdin;
      this.isTTY = outOrIo.isTTY;
      this.reader = outOrIo.reader;
      return;
    }
    super(outOrIo, err!);
    this.stdin = stdin;
    this.isTTY = isTTY;
    this.reader = reader;
  }
}
