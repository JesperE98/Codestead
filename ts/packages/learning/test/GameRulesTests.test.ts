import { describe, expect, it } from "vitest";
import {
  Achievement,
  AchievementCategory,
  CommandFacts,
  CommonAchievements,
  CourseOutline,
  DateOnly,
  GameRules,
  GameState,
  type GameStats,
  OutlinePart,
  ProgressView,
  SolvedTask,
  XpRules,
} from "../src/index.js";

const { firstTask, firstChapter, tasksAll, partDone, examFirst, examPerfect, examAll, examComeback, streak, levelMax } = CommonAchievements;

/**
 * The learning engine on a made-up course with nothing of Linux in it: a tool such as a future Codestead C++
 * gets XP, levels, the streak and the common achievements just by describing its course.
 */
describe("GameRulesTests", () => {
  const noon = new Date(2026, 10, 3, 12, 0, 0);
  const addDays = (t: Date, days: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + days, t.getHours(), t.getMinutes());

  /** Two parts: "basics" (two lessons, an exam) and "pointers" (one lesson, no exam). */
  const course = new CourseOutline([new OutlinePart("basics", ["hello", "variables"], true), new OutlinePart("pointers", ["addresses"], false)]);

  /** A tool's own command facts: counts compiler runs in the statistics. */
  class CompileFacts extends CommandFacts {
    override countInto(stats: GameStats): void {
      stats.scripts++;
    }
  }

  const rules = () =>
    new GameRules(course, [
      firstTask,
      firstChapter,
      tasksAll,
      partDone("basics", "🧱"),
      partDone("pointers", "📍"),
      examFirst,
      examPerfect,
      examAll,
      examComeback,
      streak(3, "🌱"),
      levelMax,
      new Achievement("first-compile", "⚙️", AchievementCategory.Terminal, (c) => c.command instanceof CompileFacts),
    ]);

  const P = (tasks: string[] = [], complete: string[] = [], exams: Record<string, number> = {}, total = 10) =>
    new ProgressView(tasks, 0, new Map(Object.entries(exams)), new Set(complete), tasks.length, total);

  it("lektioner och delar räknas från kursens disposition", () => {
    const r = rules();
    const g = new GameState();
    const ev = r.sync(g, P(["hello/t1"], ["hello", "variables"]), noon);
    expect(ev.chaptersCompleted).toEqual(["hello", "variables"]);
    expect(ev.partsCompleted).toEqual(["basics"]);
    expect(ev.achievements).toContain("part-basics");
    expect(ev.achievements).not.toContain("part-pointers");
    expect(ev.xpGained).toBe(XpRules.Task + XpRules.Unaided * 0 + 2 * XpRules.Chapter + XpRules.Part);
    expect(r.sync(g, P(["hello/t1"], ["hello", "variables"]), noon).changed).toBe(false);
  });

  it("proven: alla prov enligt dispositionen, comeback efter underkänt", () => {
    const r = rules();
    const g = new GameState();
    r.onExam(g, P([], [], { basics: 40 }), "basics", 40, noon);
    const passed = r.onExam(g, P([], [], { basics: 100 }), "basics", 100, noon);
    expect(passed.examPassed).toBe("basics");
    expect(passed.examPerfect).toBe(true);
    // One exam in the whole course, so passing it is all of them.
    expect(passed.achievements).toContain("exam-all");
    expect(passed.achievements).toContain("exam-comeback");
  });

  it("verktygets egna kommandofakta räknas och kan ge utmärkelser", () => {
    const r = rules();
    const g = new GameState();
    const facts = new CompileFacts({ line: "g++ main.cpp" });
    facts.names.push("g++");
    const ev = r.onCommand(g, P(["hello/t1"]), facts, "hello", [new SolvedTask("hello/t1", false)], noon);
    expect(g.stats.commands).toBe(1);
    expect(g.stats.commandNames).toEqual(["g++"]);
    expect(g.stats.scripts).toBe(1);
    expect(ev.achievements).toContain("first-compile");
    expect(ev.achievements).toContain("first-task");
    expect(ev.streakExtendedTo).toBe(1);
  });

  it("dagar i rad och hela kursens uppgifter", () => {
    const r = rules();
    const g = new GameState();
    for (let day = 0; day < 3; day++) r.onCheckpoint(g, P(), addDays(noon, day));
    expect([...g.achievements.keys()]).toContain("streak-3");
    expect(GameRules.streakAt(g, DateOnly.fromDate(addDays(noon, 3)))).toEqual({ shown: 3, today: false });
    r.sync(g, P(["a", "b"], [], {}, 2), noon);
    expect([...g.achievements.keys()]).toContain("tasks-all");
    expect(r.find("first-compile")).toBeDefined();
  });
});
