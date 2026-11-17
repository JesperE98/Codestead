// Port of Commands/Awk/AwkIO.cs – awk: where the interpreter writes output and reads input.

import type { AwkInput } from "./AwkInput.js";

export interface AwkIO {
  out: (s: string) => void;
  /** Reads a file; returns null (and prints the error itself) if that failed. */
  readInput: (name: string) => AwkInput | null;
  /** Like mawk: toupper/tolower only change a-z (not å, ä, ö). */
  asciiCase?: boolean;
}
