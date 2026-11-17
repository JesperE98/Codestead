// The models of the gamification views (C#'s Controls/Game/Models: AchievementCard, AchievementSection,
// CelebrationModel, GalleryTexts, LevelModel, ProfileModel, StreakModel). The tools build these from their own game
// state (XP, achievements, streak) with every text already translated, so the views work the same in every tool and
// in the hub.

/** One achievement as a tile or a notice. */
export interface AchievementCard {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** A hidden achievement; while it is locked, its real title and description are not given. */
  hidden: boolean;
  current: number;
  /** For achievements with a counter (e.g. 25 tasks); 0 when there is none. */
  target: number;
  /** E.g. "Unlocked 3 Nov 2026"; null while locked. */
  unlockedText: string | null;
  progressText: string | null;
}

/** A group of achievements in the gallery. */
export interface AchievementSection {
  title: string;
  cards: readonly AchievementCard[];
}

/** The learner's level: number, title and how far it is to the next one. */
export class LevelModel {
  constructor(
    readonly level: number,
    readonly title: string,
    readonly xp: number,
    readonly levelStart: number,
    /** The XP where the next level starts, or null at the top level. */
    readonly nextAt: number | null,
    readonly tooltip: string,
  ) {}

  /** How far into the current level (0–1). */
  get fraction(): number {
    return this.nextAt !== null && this.nextAt > this.levelStart
      ? Math.min(1, Math.max(0, (this.xp - this.levelStart) / (this.nextAt - this.levelStart)))
      : 1;
  }
}

/** Days in a row. `today`: today already counts (the flame is lit). */
export interface StreakModel {
  days: number;
  today: boolean;
  tooltip: string;
}

/** A tool's progress as a summary (the hub's tool cards). */
export interface ProfileModel {
  level: LevelModel;
  streak: StreakModel;
  unlocked: number;
  total: number;
  achievementsText: string;
  openText: string;
}

/** Texts of the achievement gallery. */
export interface GalleryTexts {
  title: string;
  countText: string;
  streakText: string;
  close: string;
}

/** What the celebration dialog shows when a chapter, a part or an exam is done. */
export interface CelebrationModel {
  icon: string;
  title: string;
  subtitle: string | null;
  /** A whole part or an exam: the bigger, gold variant. */
  big: boolean;
  commandsHeading: string | null;
  /** The commands practised in the chapter (shown as chips). */
  commands: readonly string[];
  /** E.g. "About 12 minutes", or null. */
  timeText: string | null;
  xpText: string;
  /** The level before, to animate the bar from; equal to `level` when nothing changed. */
  levelBefore: LevelModel;
  level: LevelModel;
  /** E.g. "Level 4: Pipe fitter", or null. */
  levelUpText: string | null;
  achievementsHeading: string | null;
  achievements: readonly AchievementCard[];
  closeText: string;
  /** The label of the button to the next chapter, or null when there is none. */
  nextText: string | null;
}
