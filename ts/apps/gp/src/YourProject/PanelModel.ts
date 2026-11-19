// Port of YourProject/PanelModel.cs.

import type { TaskRow } from "./TaskRow.js";

/** Everything the "Your project" panel shows, already in the learner's language where it is text. */
export interface PanelModel {
  chapterId: string;
  api: string;
  apiName: string;
  mainFile: string | null;
  fileMissing: boolean;
  hasResources: boolean;
  hasOldCode: boolean;
  checking: boolean;
  checkSummary: string | null;
  checkMessages: readonly string[];
  allPassed: boolean;
  tasks: readonly TaskRow[];
  selectedTask: number;
  lockNote: string | null;
  /** How many of the tasks are steps (the rest are exercises). */
  stepCount: number;
  questions: { done: number; total: number };
}
