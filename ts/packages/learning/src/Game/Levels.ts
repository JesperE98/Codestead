/** A level, where it starts and where the next one starts (null at the top). */
export interface LevelProgress {
  level: number;
  start: number;
  next: number | null;
}

const thresholds: readonly number[] = [0, 60, 200, 400, 700, 1100, 1600, 2200, 2900, 3700];

/** Ten levels, from Guest to root. The titles are the UI strings level.1 … level.10. */
export const Levels = {
  /** The XP where each level starts. */
  thresholds,

  get max(): number {
    return thresholds.length;
  },

  levelOf(xp: number): number {
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) if (xp >= thresholds[i]!) level = i + 1;
    return level;
  },

  /** The level, where it starts and where the next one starts (null at the top). */
  progress(xp: number): LevelProgress {
    const level = Levels.levelOf(xp);
    return { level, start: thresholds[level - 1]!, next: level < Levels.max ? thresholds[level]! : null };
  },

  titleKey(level: number): string {
    return `level.${level}`;
  },
};
