// Port of Types/Chapter.cs – a chapter (lesson, summary or exam) and its tasks.

import { ChapterKinds } from "@codestead/learning";
import type { ChapterTask } from "./ChapterTask.js";

/** The properties a chapter is created with (C#'s object initializer). */
export interface ChapterInit {
  id: string;
  part: string;
  title?: string;
  tasks?: ChapterTask[];
  kind?: string;
  family?: string | null;
}

export class Chapter {
  id: string;
  part: string;
  /** Title in Swedish. Other languages are in i18n/&lt;lang&gt;/&lt;id&gt;.json. */
  title: string;
  tasks: ChapterTask[];
  /**
   * "lesson" (text, checkpoints, tasks and terminal), "summary" (recap of a main chapter, text only)
   * or "exam" (the test at the end of a main chapter).
   */
  kind: string;
  /**
   * A chapter about one distribution family ("debian", "arch", "redhat") runs on a distribution of
   * that family; null means any (the student's choice in the distro main chapter, Ubuntu elsewhere).
   */
  family: string | null;

  constructor(init: ChapterInit) {
    this.id = init.id;
    this.part = init.part;
    this.title = init.title ?? "";
    this.tasks = init.tasks ?? [];
    this.kind = init.kind ?? ChapterKinds.Lesson;
    this.family = init.family ?? null;
  }
}
