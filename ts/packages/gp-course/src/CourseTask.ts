import type { TaskEdit } from "./TaskEdit.js";

/** A task of a chapter for one API: its id and the edits that solve it (from the chapter's edits.txt). */
export class CourseTask {
  constructor(
    readonly id: string,
    readonly edits: readonly TaskEdit[],
  ) {}
}
