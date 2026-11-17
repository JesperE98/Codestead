// Port of Shell/ExecResult.cs – what Shell.execute returns for one typed line: output, exit code and terminal flags.

export interface ExecResult {
  /** The command line that ran (when answering a question: the original line). */
  line: string;
  output: string;
  exitCode: number;
  clear: boolean;
  /** True if a command waits for an answer (e.g. "Do you want to continue? [Y/n]"). */
  pending: boolean;
  /** True if the line was not finished (e.g. a for loop without "done") – the shell waits for more lines. */
  incomplete: boolean;
}
