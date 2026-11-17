import type { BuildFacts } from "../Game/BuildFacts.js";
import type { CheckMessage } from "./CheckMessage.js";
import type { TaskResult } from "./TaskResult.js";

/**
 * The checks of a chapter's tasks on the learner's code: each task's result, what is wrong with the code as a whole
 * (a compile error, a missing render loop …) and the facts the game counts.
 */
export class CheckReport {
  constructor(
    readonly chapterId: string,
    readonly api: string,
    readonly tasks: readonly TaskResult[],
    readonly messages: readonly CheckMessage[],
    readonly facts: BuildFacts | null,
  ) {}

  get passedKeys(): string[] {
    return this.tasks.filter((t) => t.passed).map((t) => t.key);
  }
}
