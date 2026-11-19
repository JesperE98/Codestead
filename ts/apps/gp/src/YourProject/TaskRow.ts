// Port of YourProject/TaskRow.cs.

import type { TaskState } from "./TaskState.js";

/** A task in the panel's status list: its number, a short title, its state and why it is not done yet. */
export interface TaskRow {
  index: number;
  title: string;
  state: TaskState;
  messages: readonly string[];
}
