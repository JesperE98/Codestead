// A task solved by a command.

/** A task solved by a command. `aided`: a hint or the solution had been shown. */
export class SolvedTask {
  constructor(
    readonly key: string,
    readonly aided: boolean,
  ) {}
}
