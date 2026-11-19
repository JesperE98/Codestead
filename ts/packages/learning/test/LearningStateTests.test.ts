import { describe, expect, it } from "vitest";
import { LearningState } from "../src/index.js";

describe("LearningStateTests", () => {
  it("sparade framsteg följer med uppgifter som flyttat till ett annat kapitel", () => {
    const state = new LearningState();
    state.progress.set("old/task", true);
    state.progress.set("old/other", true);
    state.progress.set("old/fam@debian", true);
    state.attempts.set("old/task", 2);
    state.hintSeen.push("old/task");
    state.game.solutionSeen.push("old/fam@debian");
    const moved = new Map([
      ["old/task", "new/task"],
      ["old/fam", "new/fam"],
    ]);

    expect(state.moveTasks(moved)).toBe(true);
    expect([...state.progress.keys()]).toEqual(["old/other", "new/task", "new/fam@debian"]);
    expect(state.attempts.get("new/task")).toBe(2);
    expect(state.hintSeen).toEqual(["new/task"]);
    expect(state.game.solutionSeen).toEqual(["new/fam@debian"]);
    // Running it again (every start) changes nothing.
    expect(state.moveTasks(moved)).toBe(false);
  });
});
