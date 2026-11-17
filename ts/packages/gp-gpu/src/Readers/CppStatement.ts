/**
 * A simple statement of a function body (without the ';'), where it starts, and whether it runs every frame.
 * `kind`: "stmt"; "loop-start"/"loop-end" around the render loop's body; "for" with the loop's header in `text`
 * ("init; condition; step") and its statements in `body`.
 * `else_`: "if" (a condition on one variable, in `text`): the statements of its else branch, if any. (A C# record; its
 * init-only `End` is the trailing options object.)
 */
export class CppStatement {
  /** A "for": the offset just past its body (the loop's whole text is code[offset..end]); -1 when not known. */
  readonly end: number;

  constructor(
    readonly text: string,
    readonly offset: number,
    readonly kind: string = "stmt",
    readonly body: readonly CppStatement[] | null = null,
    readonly else_: readonly CppStatement[] | null = null,
    o: { end?: number } = {},
  ) {
    this.end = o.end ?? -1;
  }

  get isStatement(): boolean {
    return this.kind === "stmt";
  }
}
