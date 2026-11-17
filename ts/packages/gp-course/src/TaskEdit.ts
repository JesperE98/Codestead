/** One edit of a task's solution: in {@link file}, {@link find} becomes {@link replace}. */
export class TaskEdit {
  constructor(
    readonly file: string,
    readonly find: string,
    readonly replace: string,
  ) {}
}
