/** An IDE the course has instructions for: its id (as in ":::ide vs rider"), name and build system. */
export class IdeInfo {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly usesCMake: boolean,
  ) {}
}
