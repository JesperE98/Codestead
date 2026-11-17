import type { OutlinePart } from "./OutlinePart.js";

/**
 * What the learning engine needs to know about a course: its parts in order, the lessons of each part and which
 * parts end with an exam. A tool builds it from its own chapter definitions.
 */
export class CourseOutline {
  /** Every lesson id, in course order. */
  readonly lessons: readonly string[];

  constructor(readonly parts: readonly OutlinePart[]) {
    this.lessons = parts.flatMap((p) => p.lessons);
  }

  lessonsIn(part: string): readonly string[] {
    return this.parts.find((p) => p.id === part)?.lessons ?? [];
  }

  /** The number of exams in the course. */
  get examCount(): number {
    return this.parts.filter((p) => p.hasExam).length;
  }
}
