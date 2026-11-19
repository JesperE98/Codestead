import type { CourseOutline } from "../CourseOutline.js";
import type { CommandFacts } from "./CommandFacts.js";
import type { GameState } from "./GameState.js";
import { Levels } from "./Levels.js";
import type { ProgressView } from "./ProgressView.js";
import { XpRules } from "./XpRules.js";

// What an achievement's check can look at.

/** Everything an achievement can look at when it is checked. */
export class AchievementContext {
  constructor(
    /** The course (parts, lessons, exams). */
    readonly course: CourseOutline,
    readonly game: GameState,
    readonly progress: ProgressView,
    /** The command just run, if the check comes from a command (the tool's own subclass). */
    readonly command: CommandFacts | null,
    /** Tasks solved by that command. */
    readonly solvedNow: readonly string[],
    /** Local time. */
    readonly now: Date,
  ) {}

  get level(): number {
    return Levels.levelOf(XpRules.total(this.game, this.progress));
  }
}
