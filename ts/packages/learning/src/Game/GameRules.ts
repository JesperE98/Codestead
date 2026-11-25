import type { CourseOutline } from "../CourseOutline.js";
import { DateOnly, stamp } from "../DateOnly.js";
import type { Achievement } from "./Achievement.js";
import { AchievementContext } from "./AchievementContext.js";
import type { CommandFacts } from "./CommandFacts.js";
import { GameEvents } from "./GameEvents.js";
import { GameState } from "./GameState.js";
import type { GameStats } from "./GameStats.js";
import { Levels } from "./Levels.js";
import type { ProgressView } from "./ProgressView.js";
import type { SolvedTask } from "./SolvedTask.js";
import { XpRules } from "./XpRules.js";

/** The streak as it should be shown. */
export interface StreakShown {
  shown: number;
  /** Today already counts. */
  today: boolean;
}

/**
 * Updates the {@link GameState} after something happened (a command, a question, an exam) and says
 * what changed. Pure functions of the state and a {@link ProgressView} – the app shows the result.
 * A tool creates one with its course and its list of achievements.
 */
export class GameRules {
  /** An exam is passed at this percentage. */
  static readonly ExamPassPercent = 80;

  /** The longest pause between two commands that still counts as time spent in a chapter. */
  static readonly MaxPauseSeconds = 300;

  constructor(
    readonly course: CourseOutline,
    /** The tool's achievements, in gallery order. */
    readonly achievements: readonly Achievement[],
  ) {}

  find(id: string): Achievement | undefined {
    return this.achievements.find((a) => a.id === id);
  }

  /**
   * Brings the state up to date with the progress, e.g. when the app starts. An old save (from before the
   * gamification) gets the XP and achievements its progress already earned. Nothing here is celebrated.
   */
  sync(g: GameState, p: ProgressView, now: Date): GameEvents {
    const ev = this.evaluate(g, p, null, [], now);
    if (g.version !== GameState.CurrentVersion) {
      g.version = GameState.CurrentVersion;
      ev.changed = true;
    }
    return ev;
  }

  /** After a command in the main terminal. `solved`: the tasks it solved. */
  onCommand(g: GameState, p: ProgressView, cmd: CommandFacts | null, chapterId: string, solved: readonly SolvedTask[], now: Date): GameEvents {
    if (cmd !== null) GameRules.count(g.stats, cmd, chapterId, now);
    for (const task of solved)
      if (!task.aided && !g.solutionSeen.includes(task.key) && !g.unaided.includes(task.key)) g.unaided.push(task.key);
    const streak = solved.length > 0 ? GameRules.touch(g, DateOnly.fromDate(now)) : null;
    const ev = this.evaluate(
      g,
      p,
      cmd,
      solved.map((s) => s.key),
      now,
    );
    ev.streakExtendedTo = streak;
    ev.changed ||= cmd !== null || solved.length > 0;
    return ev;
  }

  /** After a question in a lesson was answered correctly (it counts for the streak too). */
  onCheckpoint(g: GameState, p: ProgressView, now: Date): GameEvents {
    const streak = GameRules.touch(g, DateOnly.fromDate(now));
    const ev = this.evaluate(g, p, null, [], now);
    ev.streakExtendedTo = streak;
    ev.changed = true;
    return ev;
  }

  /** After an exam was handed in. `p` already holds the new best result. */
  onExam(g: GameState, p: ProgressView, part: string, percent: number, now: Date): GameEvents {
    if (percent < GameRules.ExamPassPercent && !g.examsFailed.includes(part)) g.examsFailed.push(part);
    const passedBefore = g.examsPassed.includes(part);
    const perfectBefore = g.examsPerfect.includes(part);
    const ev = this.evaluate(g, p, null, [], now);
    if (!passedBefore && g.examsPassed.includes(part)) ev.examPassed = part;
    ev.examPerfect = !perfectBefore && g.examsPerfect.includes(part);
    ev.changed = true;
    return ev;
  }

  /** The solution of a task was shown: solving it no longer counts as "without help". */
  static onSolutionShown(g: GameState, taskKey: string): void {
    if (!g.solutionSeen.includes(taskKey)) g.solutionSeen.push(taskKey);
  }

  /**
   * The streak as it should be shown today: it stays while yesterday was active (today not yet), and is
   * 0 after a gap. `today`: today already counts.
   */
  static streakAt(g: GameState, today: DateOnly): StreakShown {
    const last = DateOnly.tryParseExact(g.lastActiveDay);
    if (last === null) return { shown: 0, today: false };
    if (last.compareTo(today) >= 0) return { shown: g.streak, today: true };
    if (last.equals(today.addDays(-1))) return { shown: g.streak, today: false };
    return { shown: 0, today: false };
  }

  /** Counts a solve or a question for today. Returns the streak when this was the first of a new day. */
  private static touch(g: GameState, today: DateOnly): number | null {
    const last = DateOnly.tryParseExact(g.lastActiveDay);
    if (last !== null && last.compareTo(today) >= 0) return null; // the same day, or the clock went back
    g.streak = last !== null && last.equals(today.addDays(-1)) ? g.streak + 1 : 1;
    g.lastActiveDay = today.toString();
    g.bestStreak = Math.max(g.bestStreak, g.streak);
    return g.streak;
  }

  private static count(s: GameStats, cmd: CommandFacts, chapterId: string, now: Date): void {
    if (cmd.line.length === 0) return;
    s.commands++;
    for (const name of cmd.names) if (!s.commandNames.includes(name)) s.commandNames.push(name);
    cmd.countInto(s);

    const ms = now.getTime();
    if (s.lastCommandChapter === chapterId && s.lastCommandAt > 0 && ms > s.lastCommandAt) {
      // C#: (int)Math.Min((ms - last) / 1000, MaxPauseSeconds) with long division.
      const seconds = Math.min(Math.trunc((ms - s.lastCommandAt) / 1000), GameRules.MaxPauseSeconds);
      s.chapterSeconds.set(chapterId, (s.chapterSeconds.get(chapterId) ?? 0) + seconds);
    }
    s.lastCommandAt = ms;
    s.lastCommandChapter = chapterId;
  }

  private static addNew(into: string[], items: Iterable<string>, added?: string[]): void {
    for (const item of items)
      if (!into.includes(item)) {
        into.push(item);
        added?.push(item);
      }
  }

  /** Updates the sticky sets from the progress, recomputes XP and unlocks achievements. */
  private evaluate(g: GameState, p: ProgressView, cmd: CommandFacts | null, solvedNow: readonly string[], now: Date): GameEvents {
    const ev = new GameEvents();
    ev.xpBefore = g.xp;
    ev.levelBefore = Levels.levelOf(g.xp);
    GameRules.addNew(
      g.completedChapters,
      this.course.lessons.filter((l) => p.completeLessons.has(l)),
      ev.chaptersCompleted,
    );
    GameRules.addNew(
      g.completedParts,
      this.course.parts.filter((part) => part.lessons.length > 0 && part.lessons.every((l) => g.completedChapters.includes(l))).map((part) => part.id),
      ev.partsCompleted,
    );
    GameRules.addNew(
      g.completedProjects,
      this.course.parts.filter((part) => part.hasProject && p.completeProjects.has(part.id)).map((part) => part.id),
      ev.projectsCompleted,
    );
    GameRules.addNew(g.examsPassed, [...p.exams].filter(([, v]) => v >= GameRules.ExamPassPercent).map(([k]) => k));
    GameRules.addNew(g.examsPerfect, [...p.exams].filter(([, v]) => v >= 100).map(([k]) => k));

    // Achievements can depend on the level, and the level on nothing but XP, so one pass is enough.
    const ctx = new AchievementContext(this.course, g, p, cmd, solvedNow, now);
    for (const a of this.achievements) {
      if (g.achievements.has(a.id)) continue;
      let done: boolean;
      try {
        done = a.done(ctx);
      } catch {
        done = false;
      }
      if (!done) continue;
      g.achievements.set(a.id, stamp(now));
      ev.achievements.push(a.id);
    }

    g.xp = XpRules.total(g, p);
    ev.xpAfter = g.xp;
    ev.levelAfter = Levels.levelOf(g.xp);
    ev.changed = ev.xpGained !== 0 || ev.achievements.length > 0 || ev.chaptersCompleted.length > 0 || ev.partsCompleted.length > 0 || ev.projectsCompleted.length > 0;
    return ev;
  }
}
