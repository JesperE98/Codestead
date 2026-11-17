// What changed in the game state, for notices and celebrations.

/** What changed – the app turns it into notices and celebrations. */
export class GameEvents {
  xpBefore = 0;
  xpAfter = 0;
  levelBefore = 0;
  levelAfter = 0;
  /** New achievements, in catalogue order. */
  readonly achievements: string[] = [];
  readonly chaptersCompleted: string[] = [];
  readonly partsCompleted: string[] = [];
  /** The main chapter whose exam was just passed (first time). */
  examPassed: string | null = null;
  /** The exam was just done with 100 % (first time). */
  examPerfect = false;
  /** Set on the first solve of a new day: the streak is now this many days. */
  streakExtendedTo: number | null = null;
  /** Something changed that should be saved. */
  changed = false;

  get xpGained(): number {
    return this.xpAfter - this.xpBefore;
  }

  get levelUp(): boolean {
    return this.levelAfter > this.levelBefore;
  }

  get celebrate(): boolean {
    return this.chaptersCompleted.length > 0 || this.partsCompleted.length > 0 || this.examPassed !== null;
  }
}
