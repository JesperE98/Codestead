/** One command line run in a sandbox terminal. */
export class SandboxRun {
  constructor(
    readonly line: string,
    /** The output without colours. */
    readonly output: string,
    readonly exitCode: number,
    /** False while the command waits for more input (a password, an unfinished line). */
    readonly finished: boolean,
  ) {}
}
