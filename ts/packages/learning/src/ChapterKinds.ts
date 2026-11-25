// The kinds of chapter: lesson, summary, exam and project.

export const ChapterKinds = {
  Lesson: "lesson",
  Summary: "summary",
  Exam: "exam",
  /** An optional project after a main chapter's exam: a brief and milestones that use what the part taught. */
  Project: "project",
} as const;
