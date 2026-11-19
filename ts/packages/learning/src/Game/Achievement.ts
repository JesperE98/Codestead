import { AchievementCategory } from "./AchievementCategory.js";
import type { AchievementContext } from "./AchievementContext.js";

// One achievement: id, icon, category, check and counter.

/** The progress of a counting achievement ("62 / 100"). */
export interface AchievementCount {
  current: number;
  target: number;
}

/**
 * An achievement. Title and description are the UI strings ach.&lt;id&gt;.title and ach.&lt;id&gt;.desc. Hidden ones
 * are shown as "???" until found. {@link counter} gives the progress ("62 / 100") of counting ones.
 */
export class Achievement {
  constructor(
    readonly id: string,
    readonly icon: string,
    readonly category: AchievementCategory,
    readonly done: (c: AchievementContext) => boolean,
    readonly counter: ((c: AchievementContext) => AchievementCount) | null = null,
  ) {}

  get hidden(): boolean {
    return this.category === AchievementCategory.Hidden;
  }

  get titleKey(): string {
    return `ach.${this.id}.title`;
  }

  get descKey(): string {
    return `ach.${this.id}.desc`;
  }
}
