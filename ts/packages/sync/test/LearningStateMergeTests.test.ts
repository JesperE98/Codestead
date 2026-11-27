import { toSavedJson } from "@codestead/common";
import { LearningState } from "@codestead/learning";
import { describe, expect, it } from "vitest";
import { mergeLearningState } from "../src/index.js";

/** A saved state.json, built like the apps build it. */
function saved(edit: (s: LearningState) => void = () => {}): string {
  const s = new LearningState();
  s.lang = "sv";
  s.variant = "opengl";
  s.chapter = "hello-window";
  s.progress.set("intro/a@opengl", true);
  s.game.version = 1;
  s.game.achievements.set("first-task", "2026-11-20T10:00");
  s.game.completedChapters.push("intro");
  s.game.lastActiveDay = "2026-11-20";
  s.game.streak = 1;
  s.game.bestStreak = 3;
  s.game.stats.commands = 10;
  edit(s);
  return toSavedJson(s);
}

const read = (json: string) => LearningState.fromJson(JSON.parse(json))!;

describe("LearningStateMergeTests", () => {
  it("två datorer som klarat olika uppgifter offline får båda med sig allt", () => {
    const base = saved();
    const local = saved((s) => {
      s.progress.set("hello-window/viewport@opengl", true);
      s.read.push("ide-setup");
      s.attempts.set("hello-window/input@opengl", 2);
      s.exams.set("getting-started", 60);
    });
    const remote = saved((s) => {
      s.progress.set("hello-triangle/vao@opengl", true);
      s.hintSeen.push("hello-triangle/vao@opengl");
      s.attempts.set("hello-window/input@opengl", 5);
      s.exams.set("getting-started", 80);
    });

    const m = read(mergeLearningState(base, local, remote, "local"));

    expect([...m.progress.keys()]).toEqual(["intro/a@opengl", "hello-window/viewport@opengl", "hello-triangle/vao@opengl"]);
    expect(m.read).toEqual(["ide-setup"]);
    expect(m.hintSeen).toEqual(["hello-triangle/vao@opengl"]);
    expect(m.attempts.get("hello-window/input@opengl")).toBe(5);
    expect(m.exams.get("getting-started")).toBe(80);
  });

  it("första synken på en dator (ingen bas) slår ihop allt från båda sidor", () => {
    const local = saved((s) => s.progress.set("local/x@opengl", true));
    const remote = saved((s) => {
      s.progress.delete("intro/a@opengl");
      s.progress.set("remote/y@opengl", true);
    });

    const m = read(mergeLearningState(null, local, remote, "remote"));

    expect([...m.progress.keys()].sort()).toEqual(["intro/a@opengl", "local/x@opengl", "remote/y@opengl"]);
  });

  it("'Radera alla framsteg' på en dator sprids, men det som är nytt på den andra finns kvar", () => {
    const base = saved((s) => s.exams.set("getting-started", 90));
    const local = toSavedJson(Object.assign(new LearningState(), { lang: "sv", variant: "opengl", chapter: "hello-window" }));
    const remoteUnchanged = base;
    const remoteWithNewWork = saved((s) => {
      s.exams.set("getting-started", 90);
      s.progress.set("textures/wrap@opengl", true);
      s.game.completedChapters.push("textures");
    });

    const reset = read(mergeLearningState(base, local, remoteUnchanged, "local"));
    expect(reset.progress.size).toBe(0);
    expect(reset.exams.size).toBe(0);
    expect(reset.game.achievements.size).toBe(0);
    expect(reset.game.completedChapters).toEqual([]);
    expect(reset.game.bestStreak).toBe(0);
    expect(reset.game.stats.commands).toBe(0);

    const withNew = read(mergeLearningState(base, local, remoteWithNewWork, "local"));
    expect([...withNew.progress.keys()]).toEqual(["textures/wrap@opengl"]);
    expect(withNew.game.completedChapters).toEqual(["textures"]);
  });

  it("utmärkelser slås ihop, och vid krock gäller det tidigaste datumet", () => {
    const base = saved();
    const local = saved((s) => {
      s.game.achievements.set("streak-3", "2026-11-22T09:00");
      s.game.achievements.set("exam-first", "2026-11-23T12:00");
    });
    const remote = saved((s) => {
      s.game.achievements.set("streak-3", "2026-11-21T18:30");
      s.game.achievements.set("night-owl", "2026-11-21T23:50");
    });

    const m = read(mergeLearningState(base, local, remote, "local"));

    expect(Object.fromEntries(m.game.achievements)).toEqual({
      "first-task": "2026-11-20T10:00",
      "streak-3": "2026-11-21T18:30",
      "exam-first": "2026-11-23T12:00",
      "night-owl": "2026-11-21T23:50",
    });
  });

  it("dagar i rad följer den senaste aktiva dagen, och bästa antal är det högsta", () => {
    const base = saved();
    const local = saved((s) => {
      s.game.lastActiveDay = "2026-11-24";
      s.game.streak = 1;
      s.game.bestStreak = 4;
    });
    const remote = saved((s) => {
      s.game.lastActiveDay = "2026-11-23";
      s.game.streak = 4;
      s.game.bestStreak = 5;
    });

    const m = read(mergeLearningState(base, local, remote, "remote"));

    expect(m.game.lastActiveDay).toBe("2026-11-24");
    expect(m.game.streak).toBe(1);
    expect(m.game.bestStreak).toBe(5);
  });

  it("räknare lägger ihop det båda sidor räknat sedan basen, även efter en återställning", () => {
    const base = saved((s) => s.game.stats.chapterSeconds.set("intro", 100));
    const local = saved((s) => {
      s.game.stats.commands = 15;
      s.game.stats.chapterSeconds.set("intro", 160);
    });
    const remote = saved((s) => {
      s.game.stats.commands = 13;
      s.game.stats.chapterSeconds.set("intro", 130);
      s.game.stats.chapterSeconds.set("shaders", 40);
    });
    const m = read(mergeLearningState(base, local, remote, "local"));
    expect(m.game.stats.commands).toBe(18);
    expect(Object.fromEntries(m.game.stats.chapterSeconds)).toEqual({ intro: 190, shaders: 40 });

    const resetLocal = saved((s) => (s.game.stats.commands = 2));
    expect(read(mergeLearningState(base, resetLocal, remote, "local")).game.stats.commands).toBe(5);
  });

  it("språk, tema och kapitel tas från den sida som sparades sist när båda ändrats", () => {
    const base = saved();
    const local = saved((s) => {
      s.lang = "en";
      s.chapter = "shaders";
    });
    const remote = saved((s) => {
      s.lang = "de";
      s.theme = "dark";
    });

    const m = read(mergeLearningState(base, local, remote, "remote"));

    expect(m.lang).toBe("de");
    expect(m.theme).toBe("dark");
    expect(m.chapter).toBe("shaders");
  });

  it("fält som en nyare version lagt till behålls, och fältens ordning är den lokala filens", () => {
    const base = saved();
    const local = saved((s) => s.progress.set("a/b@opengl", true));
    const remote = JSON.stringify({ ...JSON.parse(base), futureField: { x: 1 } });

    const merged = mergeLearningState(base, local, remote, "local");

    expect(JSON.parse(merged).futureField).toEqual({ x: 1 });
    expect(Object.keys(JSON.parse(merged))).toEqual([...Object.keys(JSON.parse(local)), "futureField"]);
  });

  it("tre lika versioner ger exakt samma fil tillbaka", () => {
    const s = saved((x) => x.progress.set("hello-window/viewport@opengl", true));
    expect(mergeLearningState(s, s, s, "local")).toBe(s);
    expect(mergeLearningState(null, s, s, "remote")).toBe(s);
  });

  it("en sida som inte är JSON förlorar mot den andra", () => {
    const good = saved();
    expect(mergeLearningState(null, "{trasig", good, "local")).toBe(good);
    expect(mergeLearningState(null, good, "", "remote")).toBe(good);
  });
});
