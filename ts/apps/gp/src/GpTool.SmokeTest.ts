// Port of GpTool.SmokeTest.cs's SmokeTest() – the tool's own checks after the window's in --smoke-test (the
// installation tests): every chapter's start project is in the installed app in every API, the first lesson of every
// part builds in the simulator, the IDE picker switches the texts, and the expected result of the first task with a
// picture is drawn. (SolveForSmokeTest is GpTool.solveForSmokeTest.) The course's binary files are read too, which
// C# needs no check for (they are embedded): here the worker reads them from the content folder.

import { GpCourse } from "@codestead/gp-course";
import { Apis } from "@codestead/gp-gpu";
import type { RunningApp } from "./App.js";

/** Picks an option in a &lt;select&gt; as a click does (React's onChange runs). */
function pick(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Runs the checks; returns the details for "SMOKE OK (…)" or throws. */
export async function gpSmokeTest(app: RunningApp): Promise<string> {
  const { tool, window: w } = app;
  const course = tool.host.course;
  let projects = 0;
  for (const lesson of GpCourse.chapters.filter((c) => c.isLesson))
    for (const api of Apis.all) {
      if (GpCourse.startProject(lesson.id, api.id).files.size === 0) throw new Error(`The ${api.id} project of ${lesson.id} is missing.`);
      projects++;
    }
  // In the course worker (C#: side by side on the thread pool).
  const builds = await course.smokeBuilds();
  await course.smokeAssets();
  // The IDE picker switches the texts, as a click does (Setting up your IDE has steps per IDE).
  w.navigate("ide-setup");
  await settle();
  const picker = document.querySelector<HTMLSelectElement>("select.cs-gp-ide");
  if (picker === null) throw new Error("No IDE picker on screen.");
  const ideIds = [...picker.options].map((o) => o.value);
  for (const id of [...ideIds, ideIds[0]!]) {
    pick(document.querySelector<HTMLSelectElement>("select.cs-gp-ide")!, id);
    await settle();
    if (tool.ide !== id) throw new Error(`The IDE picker did not switch to ${id}.`);
  }
  // The first task with a picture (Creating a window's first tasks open a window that closes again at once).
  const api = tool.shown.api;
  let pictured = false;
  for (const c of GpCourse.chapters.filter((x) => x.isLesson).slice(0, 8)) {
    for (let i = 0; i < GpCourse.allTasks(c.id, api).length && !pictured; i++) pictured = (await course.draw(c.id, api, i, 64)).pixels !== null;
    if (pictured) break;
  }
  if (!pictured) throw new Error("No expected result for the first tasks of the course.");
  await course.smokeCleanup();
  return `${projects} projects, ${builds} simulated builds, ${ideIds.length} IDEs, ${tool.smokeCheckCount} checks of the learner's code`;
}
