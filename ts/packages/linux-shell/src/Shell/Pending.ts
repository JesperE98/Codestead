// Port of Shell/Pending.cs – a question the shell is waiting for the user to answer (yes/no or a line of text).

import type { Sink } from "../Types/Sink.js";
import type { XIO } from "./XIO.js";

export interface Pending {
  question: string;
  defaultYes: boolean;
  user: string;
  line: string;
  onAnswer: (yes: boolean, io: Sink, text: string) => number;
  /** The rest of the command line, run when the question has been answered. (internal in C#) */
  resume?: ((io: XIO) => number) | null;
  /** The answer is secret (a password): the terminal does not show what is typed. */
  secret?: boolean;
}
