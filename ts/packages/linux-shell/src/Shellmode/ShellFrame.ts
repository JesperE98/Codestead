// Port of Shellmode/ShellFrame.cs – shell stack: a shell (zsh, fish, bash) started on top of the first bash shell.

import type { Obj } from "../Js.js";
import type { ShellFrameSaved } from "./ShellFrameSaved.js";

/** "bash" | "zsh" | "fish" (a plain string in C#, a global alias for the TypeScript string union). */
export type ShellMode = string;

/** A shell started on top of the first bash shell. */
export interface ShellFrame {
  mode: ShellMode;
  pid: number;
  /** Number of logged-in users (userStack) when the shell started. */
  userDepth: number;
  /** Settings made with setopt (zsh), e.g. autocd. */
  options: Obj<boolean>;
  /** The parent shell's state, restored on exit. */
  saved: ShellFrameSaved;
  /** The shell was started with sudo – exit also leaves root. */
  pushedUser?: boolean | null;
}
