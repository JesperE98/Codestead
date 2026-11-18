/** A message about a check, as a user-interface text key ("ide.buildFailed", "sim.noLoop") and its arguments. */
export class CheckMessage {
  constructor(
    readonly key: string,
    readonly args: ReadonlyMap<string, string>,
    readonly isError: boolean,
  ) {}
}
