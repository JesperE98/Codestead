import { toSavedJson } from "@codestead/common";
import { describe, expect, it } from "vitest";
import { CommandFacts, CommonAchievements, CourseOutline, GameRules, LearningState, OutlinePart, ProgressView, SolvedTask } from "../src/index.js";

/**
 * state.json as Codestead.Learning (C#) writes it with JsonDefaults.Options, for the same steps as `sameSteps` below
 * (made with a small program that serialised a LearningState; lastCommandAt is 2026-11-03 12:34:42 in UTC).
 */
const fromCSharp =
  '{"lang":"sv","distro":"debian","chapter":"files","progress":{"intro/pwd":true,"files/ls@arch":true},"checkpoints":{"intro#0":true},"read":["intro"],"attempts":{"files/cp":2},"hintSeen":["files/cp"],"exams":{"basics":85},"game":{"version":0,"xp":117,"achievements":{"first-task":"2026-11-03T12:34"},"completedChapters":[],"completedParts":[],"examsPassed":["basics"],"examsPerfect":[],"examsFailed":[],"unaided":["intro/pwd"],"solutionSeen":[],"lastActiveDay":"2026-11-03","streak":1,"bestStreak":1,"stats":{"commands":2,"commandNames":["pwd"],"manPages":[],"pipes":0,"longestPipe":0,"redirects":0,"loops":0,"scripts":0,"sudo":0,"chapterSeconds":{"intro":42},"lastCommandAt":1793709282000,"lastCommandChapter":"intro"}}}';

function sameSteps(): LearningState {
  const s = new LearningState();
  s.lang = "sv";
  s.variant = "debian";
  s.chapter = "files";
  s.progress.set("intro/pwd", true);
  s.progress.set("files/ls@arch", true);
  s.checkpoints.set("intro#0", true);
  s.read.push("intro");
  s.attempts.set("files/cp", 2);
  s.hintSeen.push("files/cp");
  s.exams.set("basics", 85);
  const rules = new GameRules(new CourseOutline([new OutlinePart("basics", ["intro", "files"], true)]), [CommonAchievements.firstTask, CommonAchievements.streak(3, "🌱")]);
  const noon = new Date(2026, 10, 3, 12, 34, 0);
  const facts = new CommandFacts({ line: "pwd" });
  facts.names.push("pwd");
  const view = () => new ProgressView(["intro/pwd"], 1, s.exams, new Set(), 1, 4);
  rules.onCommand(s.game, view(), facts, "intro", [new SolvedTask("intro/pwd", false)], noon);
  rules.onCommand(s.game, view(), facts, "intro", [], new Date(noon.getTime() + 42_000));
  return s;
}

describe("state.json som C#-apparna", () => {
  it("en sparad fil från C#-appen läses och skrivs tillbaka likadant", () => {
    const state = LearningState.fromJson(JSON.parse(fromCSharp))!;
    expect(state.variant).toBe("debian");
    expect([...state.progress.keys()]).toEqual(["intro/pwd", "files/ls@arch"]);
    expect(state.game.achievements.get("first-task")).toBe("2026-11-03T12:34");
    expect(state.game.stats.chapterSeconds.get("intro")).toBe(42);
    expect(toSavedJson(state)).toBe(fromCSharp);
  });

  it("samma steg ger samma fil som i C#", () => {
    const state = sameSteps();
    // The time of the last command depends on the time zone the test runs in.
    const json = fromCSharp.replace("1793709282000", String(new Date(2026, 10, 3, 12, 34, 42).getTime()));
    expect(toSavedJson(state)).toBe(json);
  });

  it("en trasig eller främmande fil ger standardvärden", () => {
    expect(LearningState.fromJson("text")).toBeNull();
    expect(LearningState.fromJson([])).toBeNull();
    const s = LearningState.fromJson({ lang: 3, progress: { a: true, b: "yes" }, game: { xp: "many", achievements: null } })!;
    expect(s.lang).toBeNull();
    expect([...s.progress.keys()]).toEqual(["a"]);
    expect(s.game.xp).toBe(0);
    expect(s.game.achievements.size).toBe(0);
  });
});
