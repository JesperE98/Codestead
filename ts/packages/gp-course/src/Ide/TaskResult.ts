/**
 * A task's check on the learner's code: its id, progress key, whether it passed, and whether it can be checked at all
 * (an exercise without a check is ticked by the learner).
 */
export class TaskResult {
  constructor(
    readonly taskId: string,
    readonly key: string,
    readonly passed: boolean,
    readonly checkable = true,
  ) {}
}
