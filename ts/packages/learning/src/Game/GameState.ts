import { isObject, mapToJson, readInt, readMap, readString, readStringList } from "../SavedJson.js";
import { GameStats } from "./GameStats.js";

// The gamification: XP and levels, achievements, a day streak and some lifetime counters.
// Everything is saved in the tool's state (LearningState.game); see GameRules for how it changes.

/** XP, achievements, streak and lifetime counters. Saved inside the app state. */
export class GameState {
  static readonly CurrentVersion = 1;

  /** 0 = saved by a version without gamification: {@link GameRules.sync} brings it up to date quietly. */
  version = 0;

  /** The XP last computed (to show "+n XP"). XP itself is always derived, see {@link XpRules}. */
  xp = 0;

  /** Unlocked achievements: id → when (local time, "yyyy-MM-ddTHH:mm"). */
  achievements = new Map<string, string>();

  // Things that count once and stay counted (a chapter done, then undone by a distro switch, is not paid twice).
  completedChapters: string[] = [];
  completedParts: string[] = [];
  examsPassed: string[] = [];
  examsPerfect: string[] = [];
  examsFailed: string[] = [];
  /** Parts whose optional project was completed. */
  completedProjects: string[] = [];
  /** Tasks solved without a hint or the solution. */
  unaided: string[] = [];
  /** Tasks whose solution was shown before they were solved. */
  solutionSeen: string[] = [];

  // The streak: local calendar days ("yyyy-MM-dd") with at least one solved task or question.
  lastActiveDay: string | null = null;
  streak = 0;
  bestStreak = 0;

  stats = new GameStats();

  /** Reads the saved form (see SavedJson). */
  static fromJson(v: unknown): GameState {
    const g = new GameState();
    if (!isObject(v)) return g;
    g.version = readInt(v.version);
    g.xp = readInt(v.xp);
    g.achievements = readMap(v.achievements, readString);
    g.completedChapters = readStringList(v.completedChapters);
    g.completedParts = readStringList(v.completedParts);
    g.examsPassed = readStringList(v.examsPassed);
    g.examsPerfect = readStringList(v.examsPerfect);
    g.examsFailed = readStringList(v.examsFailed);
    g.completedProjects = readStringList(v.completedProjects);
    g.unaided = readStringList(v.unaided);
    g.solutionSeen = readStringList(v.solutionSeen);
    g.lastActiveDay = readString(v.lastActiveDay);
    g.streak = readInt(v.streak);
    g.bestStreak = readInt(v.bestStreak);
    g.stats = GameStats.fromJson(v.stats);
    return g;
  }

  /** The saved form, in the C# property order (nulls are left out by toSavedJson). */
  toJSON(): Record<string, unknown> {
    return {
      version: this.version,
      xp: this.xp,
      achievements: mapToJson(this.achievements),
      completedChapters: this.completedChapters,
      completedParts: this.completedParts,
      examsPassed: this.examsPassed,
      examsPerfect: this.examsPerfect,
      examsFailed: this.examsFailed,
      // Left out while empty, so a state without projects is saved exactly as the C# apps saved it.
      completedProjects: this.completedProjects.length > 0 ? this.completedProjects : null,
      unaided: this.unaided,
      solutionSeen: this.solutionSeen,
      lastActiveDay: this.lastActiveDay,
      streak: this.streak,
      bestStreak: this.bestStreak,
      stats: this.stats,
    };
  }
}
