import type { CheckContext } from "./CheckContext.js";

/** The check of a task: true when the learner's last build solved it. */
export type TaskCheck = (c: CheckContext) => boolean;
