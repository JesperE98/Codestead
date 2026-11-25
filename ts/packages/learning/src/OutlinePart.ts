/**
 * A main chapter ("part") of a {@link CourseOutline}: its lesson ids in order, whether it ends with an exam, and whether
 * an optional project follows the exam.
 */
export class OutlinePart {
  constructor(
    readonly id: string,
    readonly lessons: readonly string[],
    readonly hasExam: boolean,
    readonly hasProject: boolean = false,
  ) {}
}
