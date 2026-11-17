/** A main chapter ("part") of a {@link CourseOutline}: its lesson ids in order, and whether it ends with an exam. */
export class OutlinePart {
  constructor(
    readonly id: string,
    readonly lessons: readonly string[],
    readonly hasExam: boolean,
  ) {}
}
