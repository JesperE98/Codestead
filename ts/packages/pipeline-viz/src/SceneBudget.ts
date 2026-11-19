// How many scenes may run at once. Every running scene has a WebGL context of its own, and Chromium allows only a few
// (16; the oldest is lost beyond that), so a long chapter keeps at most a couple running: a scene that wants to start
// when there is no room stops another – one out of sight if there is one, else (when the one starting is on screen)
// the one used longest ago; a scene only near the screen never stops one on screen. A stopped scene starts again (at
// the step it showed) when it comes near the screen again or the learner asks for it. Pure, tested in
// test/VizSource.test.ts.

export interface BudgetEntry {
  /** Is the scene on screen now? */
  visible: boolean;
  /** Stops the scene (it then releases its place). */
  evict(): void;
}

export class SceneBudget {
  private readonly live = new Map<BudgetEntry, number>();
  private clock = 0;

  constructor(readonly max: number) {}

  /** The scenes running. */
  get size(): number {
    return this.live.size;
  }

  has(entry: BudgetEntry): boolean {
    return this.live.has(entry);
  }

  /** A place for `entry`, making room first. Returns false when there is none (every other scene is more needed). */
  acquire(entry: BudgetEntry): boolean {
    if (this.live.has(entry)) {
      this.touch(entry);
      return true;
    }
    while (this.live.size >= this.max) {
      const victim = this.victim(entry);
      if (victim === null) return false;
      this.live.delete(victim);
      victim.evict();
    }
    this.live.set(entry, ++this.clock);
    return true;
  }

  /** The learner used the scene (it is the last to be stopped). */
  touch(entry: BudgetEntry): void {
    if (this.live.has(entry)) this.live.set(entry, ++this.clock);
  }

  release(entry: BudgetEntry): void {
    this.live.delete(entry);
  }

  /** The one to stop for `wanting`: out of sight before on screen, and the one used longest ago. */
  private victim(wanting: BudgetEntry): BudgetEntry | null {
    let best: BudgetEntry | null = null;
    let bestKey = Infinity;
    for (const [entry, used] of this.live) {
      if (entry.visible && !wanting.visible) continue;
      const key = (entry.visible ? 1e12 : 0) + used;
      if (key < bestKey) {
        bestKey = key;
        best = entry;
      }
    }
    return best;
  }
}

/** The app's budget: two scenes running at once. */
export const sceneBudget = new SceneBudget(2);
