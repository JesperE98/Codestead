// Port of Codestead.Learning.UI/LearningWindow.SmokeTest.cs – the --smoke-test of the installation tests, run in
// the real window: every chapter renders in every language, the language and variant (API) pickers switch as a click
// does, and the first task is solved as a learner would ("Check my code" on the solution in a folder of their own),
// then the tool's own checks (GpTool.SmokeTest.ts). (The C# test lives in the shared window; the TypeScript learning
// window has no smoke test of its own yet, so the app runs it against the window's public members – as Codestead
// Linux does.)

import { Languages } from "@codestead/common";
import { LearningWindow } from "@codestead/ui";
import { flushSync } from "react-dom";
import type { RunningApp } from "./App.js";
import { gpSmokeTest } from "./GpTool.SmokeTest.js";

/** Lets React and the browser catch up (C#'s Dispatcher.UIThread.RunJobs, and a frame to paint). */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Picks an option in a &lt;select&gt; as a click does (React's onChange runs). */
function pick(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectLabelled(label: string): HTMLSelectElement {
  const el = [...document.querySelectorAll("select")].find((s) => s.getAttribute("aria-label") === label);
  if (el === undefined) throw new Error(`No picker "${label}" on screen.`);
  return el;
}

/** C#'s ApplyLanguage (private in the window): the texts in the current language, then everything re-rendered. */
function applyLanguage(w: LearningWindow): void {
  w.tool.textsApplied?.();
  w.renderAll();
}

/** Runs the checks; returns the details of "SMOKE OK …" or throws. */
export async function runSmokeTest(app: RunningApp): Promise<string> {
  const w = app.window;
  const tool = w.tool;
  const state = w.state;
  const render = (what: () => void) => {
    flushSync(what);
    if (app.renderErrors.length > 0) throw app.renderErrors[0] instanceof Error ? app.renderErrors[0] : new Error(String(app.renderErrors[0]));
  };

  // Every chapter renders in every language without throwing.
  const offered = Languages.offered;
  for (const l of offered) {
    state.lang = l.code;
    for (const ch of w.chapters) {
      state.chapter = ch.id;
      tool.chapterShown?.(ch.id);
      render(() => w.renderAll());
    }
    await settle();
  }
  // Switching language and variant in the pickers, as a click does, must not crash.
  for (const lc of [offered[1]!.code, offered[offered.length - 1]!.code, offered[0]!.code]) {
    render(() => pick(selectLabelled(w.t("lang.label")), lc));
    await settle();
    if (w.lang !== lc) throw new Error(`The language picker did not switch to ${lc}.`);
  }
  const withVariants = w.chapters.find((c) => tool.variants(c.id).reduce((n, g) => n + g.options.length, 0) > 1);
  if (withVariants !== undefined) {
    state.chapter = withVariants.id;
    tool.chapterShown?.(w.chapter.id);
    render(() => w.renderAll());
    const ids = [...selectLabelled(w.t("distro.label")).options].map((o) => o.value);
    for (const id of ids) {
      render(() => pick(selectLabelled(w.t("distro.label")), id));
      await settle();
      if (tool.currentVariant(w.chapter.id) !== id) throw new Error(`The variant picker did not switch to ${id}.`);
    }
  }
  // Solve the first task of the first chapter that has tasks, in the real workbench.
  state.lang = Languages.default;
  state.chapter = w.chapters.find((c) => tool.tasks(c.id, Languages.default).length > 0)!.id;
  tool.chapterShown?.(w.chapter.id);
  render(() => applyLanguage(w));
  const chapter = w.chapter;
  const task = tool.tasks(chapter.id, w.lang)[0]!;
  const solve = async () => {
    if (tool.solveForSmokeTest) await tool.solveForSmokeTest(task);
    else
      for (const cmd of task.solution) {
        tool.inject(cmd);
        tool.run(cmd);
      }
    render(() => w.render());
  };
  const before = state.progress.has(task.key);
  if (!w.isUnlocked(chapter)) {
    // The terminal is there from the start, but the tasks stay locked until the text is done.
    const frame = document.querySelector<HTMLElement>(".cs-workbench-frame");
    if (frame === null || frame.style.display === "none") throw new Error("The terminal of a locked lesson is hidden.");
    await solve();
    if (state.progress.has(task.key)) throw new Error("A task was checked before the lesson was unlocked.");
    for (let i = 0; i < w.checkpointCount(chapter); i++) state.checkpoints.set(LearningWindow.checkpointKey(chapter, i), true);
    if (!state.read.includes(chapter.id)) state.read.push(chapter.id);
    render(() => w.renderAll());
  }
  await solve();
  const after = state.progress.has(task.key);
  if (!before && !after) throw new Error("The first task was not completed by its solution.");
  if (state.game.xp <= 0 || !state.game.achievements.has("first-task")) throw new Error(`The game did not count the first task (XP ${state.game.xp}).`);
  // The tool's own checks (C#: GpTool.SmokeTest(); asynchronous here: the course worker builds in the simulator).
  const extra = await gpSmokeTest(app);
  return `${w.chapters.length} chapters, ${offered.length} languages` + (extra === "" ? "" : ", " + extra);
}
