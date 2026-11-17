// Port of Types/Part.cs – a main chapter ("part") of the course.

/** A main chapter ("part"), e.g. "The basics". Its sub-chapters are the {@link Chapter}s with this part id. */
export interface Part {
  id: string;
  title: string;
  /**
   * The only main chapter where the student picks a distribution. Everywhere else the terminal runs
   * {@link ChaptersLib.DefaultDistro}, so the basics are learnt without distribution differences.
   */
  distroChoice?: boolean;
}
