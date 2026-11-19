import { Achievement } from "./Achievement.js";
import type { AchievementContext } from "./AchievementContext.js";
import { AchievementCategory } from "./AchievementCategory.js";
import { Levels } from "./Levels.js";
import { XpRules } from "./XpRules.js";

/** An achievement with a counter: done when `current` reaches `target`. */
function count(id: string, icon: string, cat: AchievementCategory, current: (c: AchievementContext) => number, target: number): Achievement {
  return new Achievement(
    id,
    icon,
    cat,
    (c) => current(c) >= target,
    (c) => ({ current: Math.min(current(c), target), target }),
  );
}

/**
 * Achievements every course can have – learning, exams and habits. A tool puts them in its own list (in the order
 * its gallery should show) next to achievements of its own.
 */
export const CommonAchievements = {
  /** An achievement with a counter: done when `current` reaches `target`. */
  count,

  get firstTask(): Achievement {
    return count("first-task", "👋", AchievementCategory.Learning, (c) => c.progress.tasks.length, 1);
  },

  get firstChapter(): Achievement {
    return count("first-chapter", "📗", AchievementCategory.Learning, (c) => c.game.completedChapters.length, 1);
  },

  tasks(n: number, icon: string): Achievement {
    return count(`tasks-${n}`, icon, AchievementCategory.Learning, (c) => c.progress.tasks.length, n);
  },

  get tasksAll(): Achievement {
    return new Achievement(
      "tasks-all",
      "🏁",
      AchievementCategory.Learning,
      (c) => c.progress.tasksTotal > 0 && c.progress.tasksDone >= c.progress.tasksTotal,
      (c) => ({ current: c.progress.tasksDone, target: c.progress.tasksTotal }),
    );
  },

  /** Every lesson of a part done. */
  partDone(part: string, icon: string): Achievement {
    return new Achievement(
      `part-${part}`,
      icon,
      AchievementCategory.Learning,
      (c) => c.game.completedParts.includes(part),
      (c) => {
        const lessons = c.course.lessonsIn(part);
        return { current: lessons.filter((l) => c.game.completedChapters.includes(l)).length, target: lessons.length };
      },
    );
  },

  checkpoints(n: number, icon: string): Achievement {
    return count(`checkpoints-${n}`, icon, AchievementCategory.Learning, (c) => c.progress.checkpoints, n);
  },

  get examFirst(): Achievement {
    return count("exam-first", "🎓", AchievementCategory.Exams, (c) => c.game.examsPassed.length, 1);
  },

  get examPerfect(): Achievement {
    return count("exam-perfect", "⭐", AchievementCategory.Exams, (c) => c.game.examsPerfect.length, 1);
  },

  get examAll(): Achievement {
    return new Achievement(
      "exam-all",
      "🏆",
      AchievementCategory.Exams,
      (c) => c.game.examsPassed.length >= c.course.examCount,
      (c) => ({ current: c.game.examsPassed.length, target: c.course.examCount }),
    );
  },

  get examComeback(): Achievement {
    return new Achievement("exam-comeback", "💪", AchievementCategory.Exams, (c) =>
      c.game.examsPassed.some((e) => c.game.examsFailed.includes(e)),
    );
  },

  unaided(n: number, icon: string): Achievement {
    return count(`unaided-${n}`, icon, AchievementCategory.Habits, (c) => c.game.unaided.length, n);
  },

  streak(days: number, icon: string): Achievement {
    return count(`streak-${days}`, icon, AchievementCategory.Habits, (c) => c.game.bestStreak, days);
  },

  get levelMax(): Achievement {
    const top = Levels.thresholds[Levels.thresholds.length - 1]!;
    return new Achievement(
      "level-max",
      "👑",
      AchievementCategory.Habits,
      (c) => c.level >= Levels.max,
      (c) => ({ current: Math.min(XpRules.total(c.game, c.progress), top), target: top }),
    );
  },
};
