// Port of YourProject/TaskState.cs.

/** Where a task stands in the "Your project" panel. */
export const TaskState = {
  /** The text comes first. */
  Locked: "locked",
  /** Not done: the learner ticks it, or checks their code. */
  Open: "open",
  Checking: "checking",
  /** The last check of the code did not pass it. */
  NotYet: "notYet",
  Done: "done",
} as const;

export type TaskState = (typeof TaskState)[keyof typeof TaskState];
