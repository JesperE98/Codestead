import type { GameState } from "./GameState.js";
import type { ProgressView } from "./ProgressView.js";

// How much XP each kind of progress gives.

/**
 * XP rules. XP is computed from what has been done (never added up step by step), so nothing can be
 * paid twice. The whole course gives about 3 900 XP with one distribution family, more with hints
 * avoided, every family and perfect exams.
 */
export const XpRules = {
  Task: 10,
  Unaided: 5,
  Checkpoint: 2,
  Chapter: 25,
  Part: 50,
  ExamPass: 100,
  ExamPerfect: 50,

  total(g: GameState, p: ProgressView): number {
    return (
      XpRules.Task * p.tasks.length +
      XpRules.Unaided * g.unaided.length +
      XpRules.Checkpoint * p.checkpoints +
      XpRules.Chapter * g.completedChapters.length +
      XpRules.Part * g.completedParts.length +
      XpRules.ExamPass * g.examsPassed.length +
      XpRules.ExamPerfect * g.examsPerfect.length
    );
  },
} as const;
