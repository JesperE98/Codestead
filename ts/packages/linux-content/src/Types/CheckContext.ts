// Port of Types/CheckContext.cs – what a task's check gets to look at after each command.

import type { Distro, Shell } from "@codestead/linux-shell";

/** What a task may look at after each command. (TS: CheckCtx) */
export interface CheckContext {
  readonly sh: Shell;
  readonly distro: Distro;
  /** The command line that was run (without leading/trailing spaces). */
  readonly line: string;
  /** Output without colour codes. */
  readonly output: string;
  readonly exitCode: number;
}
