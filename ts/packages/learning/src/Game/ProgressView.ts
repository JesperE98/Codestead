// The learner's course progress as the gamification sees it.

/** The learner's progress as the app sees it (built by the app; tests build it directly). */
export class ProgressView {
  constructor(
    /** Done task keys, every family. */
    readonly tasks: readonly string[],
    /** Questions answered in the lessons. */
    readonly checkpoints: number,
    /** Best percentage per main chapter. */
    readonly exams: ReadonlyMap<string, number>,
    /** Lessons that are complete (all tasks done and the chapter unlocked). */
    readonly completeLessons: ReadonlySet<string>,
    /** Tasks done as the progress meter counts them. */
    readonly tasksDone: number,
    /** All tasks as the progress meter counts them (the optional projects' milestones are not among them). */
    readonly tasksTotal: number,
    /** The parts whose optional project is complete (every milestone done). */
    readonly completeProjects: ReadonlySet<string> = new Set(),
  ) {}
}
