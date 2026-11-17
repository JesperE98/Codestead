// Port of tests/Linux/Codestead.Content.Tests/GameTests.cs – XP, levels, the streak, achievements and the command
// analysis, with the Linux course's rules (LinuxGame.rules).

import {
  AchievementContext,
  ChapterKinds,
  Checkpoint,
  DateOnly,
  type GameEvents,
  GameRules,
  GameState,
  Levels,
  ProgressView,
  SolvedTask,
  XpRules,
} from "@codestead/learning";
import { IndexCmd, Shell } from "@codestead/linux-shell";
import { describe, expect, it } from "vitest";
import { AchievementsLib, ChaptersLib, CommandInfo, I18nLib, LinuxGame } from "../src/index.js";

const noon = new Date(2026, 10, 3, 12, 0, 0);

/** DateTime.AddDays / AddHours / AddSeconds (local wall-clock time, like an unspecified C# DateTime). */
const addDays = (t: Date, days: number) =>
  new Date(t.getFullYear(), t.getMonth(), t.getDate() + days, t.getHours(), t.getMinutes(), t.getSeconds());
const addHours = (t: Date, hours: number) => new Date(t.getTime() + hours * 3_600_000);
const addSeconds = (t: Date, seconds: number) => new Date(t.getTime() + seconds * 1000);

interface PInit {
  tasks?: Iterable<string>;
  checkpoints?: number;
  exams?: Record<string, number>;
  complete?: Iterable<string>;
  done?: number;
  total?: number;
}

function P(init: PInit = {}): ProgressView {
  const t = [...(init.tasks ?? [])];
  return new ProgressView(t, init.checkpoints ?? 0, new Map(Object.entries(init.exams ?? {})), new Set(init.complete ?? []), init.done ?? t.length, init.total ?? 1000);
}

function keys(n: number, suffix = ""): string[] {
  return Array.from({ length: n }, (_, i) => `ch/t${i}${suffix}`);
}

interface RunInit {
  output?: string;
  exit?: number;
  p?: ProgressView;
  now?: Date;
  solved?: readonly SolvedTask[];
}

function run(g: GameState, line: string, init: RunInit = {}): GameEvents {
  return LinuxGame.rules.onCommand(g, init.p ?? P(), CommandInfo.analyze(line, init.output ?? "", init.exit ?? 0), "ch", init.solved ?? [], init.now ?? noon);
}

function part(g: GameState, partId: string): void {
  LinuxGame.rules.sync(g, P({ complete: ChaptersLib.lessonsIn(partId).map((c) => c.id) }), noon);
}

function days(g: GameState, n: number): void {
  for (let i = 0; i < n; i++) LinuxGame.rules.onCheckpoint(g, P(), addDays(noon, i));
}

/** For every achievement: something that unlocks it. */
const witnesses = new Map<string, (g: GameState) => void>([
  ["first-task", (g) => void LinuxGame.rules.sync(g, P({ tasks: keys(1) }), noon)],
  ["first-chapter", (g) => void LinuxGame.rules.sync(g, P({ complete: [ChaptersLib.lessonsIn("grunder")[0]!.id] }), noon)],
  ["tasks-25", (g) => void LinuxGame.rules.sync(g, P({ tasks: keys(25) }), noon)],
  ["tasks-100", (g) => void LinuxGame.rules.sync(g, P({ tasks: keys(100) }), noon)],
  ["tasks-all", (g) => void LinuxGame.rules.sync(g, P({ tasks: keys(5), done: 5, total: 5 }), noon)],
  ["part-grunder", (g) => part(g, "grunder")],
  ["part-system", (g) => part(g, "system")],
  ["part-distro", (g) => part(g, "distro")],
  ["part-admin", (g) => part(g, "admin")],
  ["part-natverk", (g) => part(g, "natverk")],
  ["part-skript", (g) => part(g, "skript")],
  ["part-verktyg", (g) => part(g, "verktyg")],
  ["all-families", (g) => void LinuxGame.rules.sync(g, P({ tasks: ["a/x@debian", "b/x@arch", "c/x@redhat"] }), noon)],
  ["checkpoints-50", (g) => void LinuxGame.rules.sync(g, P({ checkpoints: 50 }), noon)],
  ["exam-first", (g) => void LinuxGame.rules.onExam(g, P({ exams: { grunder: 80 } }), "grunder", 80, noon)],
  ["exam-perfect", (g) => void LinuxGame.rules.onExam(g, P({ exams: { grunder: 100 } }), "grunder", 100, noon)],
  [
    "exam-all",
    (g) =>
      void LinuxGame.rules.sync(
        g,
        P({ exams: Object.fromEntries(ChaptersLib.chapters.filter((c) => c.kind === ChapterKinds.Exam).map((c) => [c.part, 85])) }),
        noon,
      ),
  ],
  [
    "exam-comeback",
    (g) => {
      LinuxGame.rules.onExam(g, P({ exams: { system: 10 } }), "system", 10, noon);
      LinuxGame.rules.onExam(g, P({ exams: { system: 80 } }), "system", 80, noon);
    },
  ],
  ["sudo-first", (g) => void run(g, "sudo apt update")],
  ["pipe-first", (g) => void run(g, "ls | wc -l")],
  ["pipe-long", (g) => void run(g, "cat f | sort | uniq -c | sort -n")],
  ["redirect-first", (g) => void run(g, "echo hi > notes.txt")],
  ["loop-first", (g) => void run(g, "for i in 1 2 3; do echo $i; done")],
  ["script-first", (g) => void run(g, "./backup.sh")],
  [
    "commands-25",
    (g) => {
      for (const name of [...IndexCmd.commands().keys()].slice(0, 25)) run(g, name);
    },
  ],
  [
    "commands-500",
    (g) => {
      for (let i = 0; i < 500; i++) run(g, "pwd");
    },
  ],
  ["unaided-10", (g) => void run(g, "ls", { p: P({ tasks: keys(10) }), solved: keys(10).map((k) => new SolvedTask(k, false)) })],
  ["unaided-50", (g) => void run(g, "ls", { p: P({ tasks: keys(50) }), solved: keys(50).map((k) => new SolvedTask(k, false)) })],
  ["streak-3", (g) => days(g, 3)],
  ["streak-7", (g) => days(g, 7)],
  ["streak-30", (g) => days(g, 30)],
  ["level-max", (g) => void LinuxGame.rules.sync(g, P({ tasks: keys(370) }), noon)],
  ["rm-rf-root", (g) => void run(g, "sudo rm -rf /", { exit: 1 })],
  ["cowsay", (g) => void run(g, "cowsay moo")],
  ["rtfm", (g) => void run(g, "man ls")],
  [
    "commands-50",
    (g) => {
      for (const name of [...IndexCmd.commands().keys()].slice(0, 50)) run(g, name);
    },
  ],
  ["sandwich", (g) => void run(g, "sudo make me a sandwich", { exit: 127 })],
  ["vim-quit", (g) => void run(g, ":q", { exit: 127 })],
  ["sl", (g) => void run(g, "sl", { exit: 127 })],
  ["hello-world", (g) => void run(g, "echo 'Hello, World!'", { output: "Hello, World!\n" })],
  ["answer-42", (g) => void run(g, "echo $((6*7))", { output: "42\n" })],
  ["night-owl", (g) => void run(g, "ls", { p: P({ tasks: keys(1) }), now: new Date(2026, 10, 3, 2, 30, 0), solved: [new SolvedTask("ch/t0", true)] })],
]);

describe("GameTests", () => {
  // ---------- XP and levels ----------

  it("Xp_is_derived_from_progress", () => {
    const g = new GameState();
    g.unaided.push("ch/t0");
    g.completedChapters.push("a");
    g.completedParts.push("b");
    g.examsPassed.push("c");
    g.examsPerfect.push("c");
    const p = P({ tasks: keys(3), checkpoints: 4 });
    expect(XpRules.total(g, p)).toBe(3 * 10 + 5 + 4 * 2 + 25 + 50 + 100 + 50);
  });

  it.each([
    [0, 1],
    [59, 1],
    [60, 2],
    [399, 3],
    [3699, 9],
    [3700, 10],
    [99999, 10],
  ])("Levels_follow_the_thresholds(%i, %i)", (xp, level) => {
    expect(Levels.levelOf(xp)).toBe(level);
    const { level: l, start, next } = Levels.progress(xp);
    expect(l).toBe(level);
    expect(start <= xp).toBe(true);
    if (next !== null) expect(xp < next).toBe(true);
    else expect(level).toBe(Levels.max);
  });

  it("The_whole_course_reaches_the_top_level_without_bonuses", () => {
    // One distribution family, every hint used, no perfect exams: the least XP a finished course gives.
    const lessons = ChaptersLib.chapters.filter((c) => c.kind === ChapterKinds.Lesson);
    const tasks = lessons.reduce((n, c) => n + c.tasks.length, 0);
    const checkpoints = lessons.reduce((n, c) => n + Checkpoint.parseAll(I18nLib.chapterMarkdown(c, "en")).length, 0);
    const parts = ChaptersLib.parts.filter((p) => ChaptersLib.lessonsIn(p.id).length > 0).length;
    const exams = ChaptersLib.chapters.filter((c) => c.kind === ChapterKinds.Exam).length;
    const min = XpRules.Task * tasks + XpRules.Checkpoint * checkpoints + XpRules.Chapter * lessons.length + XpRules.Part * parts + XpRules.ExamPass * exams;
    const top = Levels.thresholds[Levels.thresholds.length - 1]!;
    expect(min >= top, `The course gives at least ${min} XP, the top level needs ${top}`).toBe(true);
  });

  // ---------- streak ----------

  it("Streak_counts_days_in_a_row", () => {
    const g = new GameState();
    const day = new Date(2026, 10, 1, 20, 0, 0);
    expect(LinuxGame.rules.onCheckpoint(g, P(), day).streakExtendedTo).toBe(1);
    expect(LinuxGame.rules.onCheckpoint(g, P(), addHours(day, 1)).streakExtendedTo).toBeNull(); // same day
    expect(LinuxGame.rules.onCheckpoint(g, P(), addDays(day, 1)).streakExtendedTo).toBe(2);
    expect(LinuxGame.rules.onCheckpoint(g, P(), addDays(day, 2)).streakExtendedTo).toBe(3);
    expect(LinuxGame.rules.onCheckpoint(g, P(), addDays(day, 1)).streakExtendedTo).toBeNull(); // clock went back
    expect(g.streak).toBe(3);
    expect(LinuxGame.rules.onCheckpoint(g, P(), addDays(day, 5)).streakExtendedTo).toBe(1); // a gap
    expect(g.streak).toBe(1);
    expect(g.bestStreak).toBe(3);
  });

  it("Streak_is_shown_until_a_day_is_missed", () => {
    const g = new GameState();
    g.lastActiveDay = "2026-11-02";
    g.streak = 4;
    expect(GameRules.streakAt(g, DateOnly.of(2026, 11, 2))).toEqual({ shown: 4, today: true });
    expect(GameRules.streakAt(g, DateOnly.of(2026, 11, 3))).toEqual({ shown: 4, today: false });
    expect(GameRules.streakAt(g, DateOnly.of(2026, 11, 4))).toEqual({ shown: 0, today: false });
    expect(GameRules.streakAt(new GameState(), DateOnly.of(2026, 11, 4))).toEqual({ shown: 0, today: false });
  });

  it("Only_a_solved_task_counts_for_the_streak", () => {
    const g = new GameState();
    expect(run(g, "ls").streakExtendedTo).toBeNull();
    expect(run(g, "ls", { p: P({ tasks: keys(1) }), solved: [new SolvedTask("ch/t0", false)] }).streakExtendedTo).toBe(1);
  });

  // ---------- sync and events ----------

  it("Sync_gives_an_old_save_what_it_earned_and_is_idempotent", () => {
    const lessons = ChaptersLib.lessonsIn("grunder");
    const p = P({ tasks: keys(30), checkpoints: 10, exams: { grunder: 100 }, complete: lessons.map((c) => c.id) });
    const g = new GameState();
    const first = LinuxGame.rules.sync(g, p, noon);
    expect(first.changed).toBe(true);
    expect(g.version).toBe(GameState.CurrentVersion);
    expect([...g.achievements.keys()]).toContain("tasks-25");
    expect([...g.achievements.keys()]).toContain("part-grunder");
    expect([...g.achievements.keys()]).toContain("exam-perfect");
    expect(g.xp).toBe(XpRules.total(g, p));
    expect(g.unaided).toHaveLength(0); // never backfilled

    const again = LinuxGame.rules.sync(g, p, addDays(noon, 1));
    expect(again.changed).toBe(false);
    expect(again.xpGained).toBe(0);
    expect(again.achievements).toHaveLength(0);
  });

  it("Completing_a_chapter_and_a_part_is_reported_once", () => {
    const lessons = ChaptersLib.lessonsIn("start");
    const g = new GameState();
    LinuxGame.rules.sync(g, P(), noon);
    const ev = run(g, "ls", { p: P({ tasks: keys(1), complete: lessons.map((c) => c.id) }), solved: [new SolvedTask("ch/t0", false)] });
    expect(ev.celebrate).toBe(true);
    expect(ev.chaptersCompleted).toEqual(lessons.map((c) => c.id));
    expect(ev.partsCompleted).toEqual(["start"]);
    expect(ev.achievements).toContain("first-task");
    expect(ev.xpGained).toBe(10 + 5 + 25 * lessons.length + 50);

    // Lost again (e.g. another distro) and back: nothing new.
    run(g, "ls", { p: P({ tasks: keys(1) }) });
    const back = run(g, "ls", { p: P({ tasks: keys(1), complete: lessons.map((c) => c.id) }) });
    expect(back.celebrate).toBe(false);
    expect(back.xpGained).toBe(0);
  });

  it("A_task_solved_after_the_solution_was_shown_is_not_unaided", () => {
    const g = new GameState();
    GameRules.onSolutionShown(g, "ch/t0");
    run(g, "ls", { p: P({ tasks: keys(2) }), solved: [new SolvedTask("ch/t0", false), new SolvedTask("ch/t1", false)] });
    expect(g.unaided).toEqual(["ch/t1"]);
    run(g, "ls", { p: P({ tasks: keys(3) }), solved: [new SolvedTask("ch/t2", true)] });
    expect(g.unaided).toEqual(["ch/t1"]);
  });

  it("Exams_report_pass_and_perfect_the_first_time", () => {
    const g = new GameState();
    const failed = LinuxGame.rules.onExam(g, P({ exams: { grunder: 60 } }), "grunder", 60, noon);
    expect(failed.examPassed).toBeNull();
    expect(g.examsFailed).toContain("grunder");
    const passed = LinuxGame.rules.onExam(g, P({ exams: { grunder: 90 } }), "grunder", 90, noon);
    expect(passed.examPassed).toBe("grunder");
    expect(passed.examPerfect).toBe(false);
    expect(passed.achievements).toContain("exam-comeback");
    expect(passed.celebrate).toBe(true);
    const perfect = LinuxGame.rules.onExam(g, P({ exams: { grunder: 100 } }), "grunder", 100, noon);
    expect(perfect.examPassed).toBeNull();
    expect(perfect.examPerfect).toBe(true);
    expect(perfect.xpGained).toBe(50);
  });

  it("Active_time_per_chapter_has_a_cap_between_commands", () => {
    const g = new GameState();
    LinuxGame.rules.onCommand(g, P(), CommandInfo.analyze("ls", "", 0), "a", [], noon);
    LinuxGame.rules.onCommand(g, P(), CommandInfo.analyze("ls", "", 0), "a", [], addSeconds(noon, 40));
    LinuxGame.rules.onCommand(g, P(), CommandInfo.analyze("ls", "", 0), "a", [], addHours(noon, 2));
    LinuxGame.rules.onCommand(g, P(), CommandInfo.analyze("ls", "", 0), "b", [], addSeconds(addHours(noon, 2), 30));
    expect(g.stats.chapterSeconds.get("a")).toBe(40 + GameRules.MaxPauseSeconds);
    expect(g.stats.chapterSeconds.has("b")).toBe(false);
    expect(g.stats.commands).toBe(4);
  });

  it("Chapter_commands_come_from_the_solutions", () => {
    const ch = ChaptersLib.chapters.find((c) => c.kind === ChapterKinds.Lesson && c.tasks.length > 0)!;
    const sh = Shell.create(ChaptersLib.DefaultDistro, "en");
    const names = LinuxGame.chapterCommands(ch, sh.distro, sh.world);
    expect(names).not.toHaveLength(0);
    for (const n of names) expect(IndexCmd.commands().has(n), n).toBe(true);
    expect(names).toEqual([...new Set(names)]);
  });

  // ---------- achievements ----------

  it("Achievements_have_unique_ids_and_a_fresh_state_has_none", () => {
    expect(new Set(AchievementsLib.all.map((a) => a.id)).size).toBe(AchievementsLib.all.length);
    const hidden = AchievementsLib.all.filter((a) => a.hidden).length;
    const shown = AchievementsLib.all.filter((a) => !a.hidden).length;
    expect(hidden >= 8 && hidden <= 12, `${hidden} hidden`).toBe(true);
    expect(shown >= 28 && shown <= 36, `${shown} not hidden`).toBe(true);
    const g = new GameState();
    LinuxGame.rules.sync(g, P(), noon);
    expect(g.achievements.size).toBe(0);
    run(g, "ls");
    run(g, "echo hi");
    expect(g.achievements.size).toBe(0);
  });

  it.each(AchievementsLib.all.map((a) => a.id))("Every_achievement_can_be_unlocked(%s)", (id) => {
    const witness = witnesses.get(id);
    expect(witness !== undefined, `No witness for ${id}`).toBe(true);
    const g = new GameState();
    witness!(g);
    expect(g.achievements.has(id), `${id} was not unlocked; got: ${[...g.achievements.keys()].join(", ")}`).toBe(true);
    const a = AchievementsLib.find(id)!;
    if (a.counter !== null) {
      const { current, target } = a.counter(new AchievementContext(LinuxGame.outline, new GameState(), P(), null, [], noon));
      expect(current < target || target === 0, `${id} counter on a fresh state: ${current}/${target}`).toBe(true);
    }
  });

  it.each(["rm -rf /tmp/x", "rm /", "echo rm -rf /"])("Rm_root_needs_the_real_thing(%s)", (line) => {
    const g = new GameState();
    run(g, line);
    expect(g.achievements.has("rm-rf-root")).toBe(false);
  });

  // ---------- command analysis ----------

  it("Command_analysis_finds_names_through_wrappers", () => {
    const c = CommandInfo.analyze("sudo -u root env A=1 nohup ls -l | xargs -n1 wc -l > out.txt", "", 0);
    expect(c.names).toEqual(["sudo", "env", "nohup", "ls", "xargs", "wc"]);
    expect(c.usesSudo).toBe(true);
    expect(c.hasRedirect).toBe(true);
    expect(c.maxPipeline).toBe(2);
    expect(c.hasLoop).toBe(false);
  });

  it("Command_analysis_sees_loops_scripts_man_and_assignments", () => {
    expect(CommandInfo.analyze("while true; do date; done", "", 0).hasLoop).toBe(true);
    expect(CommandInfo.analyze("bash deploy.sh", "", 0).isScriptRun).toBe(true);
    expect(CommandInfo.analyze("man 1 grep", "", 0).manPage).toBe("grep");
    const a = CommandInfo.analyze("LANG=C sort file", "", 0);
    expect(a.names).toEqual(["sort"]);
    expect(CommandInfo.analyze("echo x", "\u001b[1mx\u001b[0m", 0).output).toBe("x");
  });

  it("Command_analysis_survives_lines_that_do_not_parse", () => {
    const c = CommandInfo.analyze("echo 'unterminated", "", 2);
    expect(c.firstWords).toEqual(["echo"]);
    const empty = CommandInfo.analyze("   ", "", 0);
    expect(empty.names).toHaveLength(0);
  });
});
