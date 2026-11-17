import { ChapterKinds } from "./ChapterKinds.js";

/** A chapter of a course as the learning window sees it: its id, its part and its kind ({@link ChapterKinds}). */
export class CourseChapter {
  constructor(
    readonly id: string,
    readonly part: string,
    readonly kind: string,
  ) {}

  get isLesson(): boolean {
    return this.kind === ChapterKinds.Lesson;
  }
}
