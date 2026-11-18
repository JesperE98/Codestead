// TaskTests.cs: every task of every chapter in every API – starting from the chapter's project and applying the tasks'
// solutions in order, each task is solved by its own solution, and not before. The end result is the chapter's
// solution/. Heavy: CI runs the parts in parallel jobs (CODESTEAD_GP_PARTS="lighting,pbr"); for a quick run
// CODESTEAD_GP_CHAPTERS="textures,camera". A case whose API's reader is not registered yet is skipped.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Apis, NoteLevel, Simulator } from "@codestead/gp-gpu";
import { describe, expect } from "vitest";
import { CheckContext, Edits, GpCourse, TaskChecks } from "../src/index.js";
import { Repo, itNeeds } from "./Repo.js";

/** A whole chapter in one API can take minutes (the frames of every step, several times). */
const Timeout = 60 * 60 * 1000;

function envSet(name: string): ReadonlySet<string> | null {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? new Set(v.split(",").map((s) => s.trim()).filter((s) => s.length > 0)) : null;
}

/** The course parts to test, from CODESTEAD_GP_PARTS ("lighting,pbr"); unset: all. */
export const partsToTest = (): ReadonlySet<string> | null => envSet("CODESTEAD_GP_PARTS");

/** For a quick run while writing a chapter: CODESTEAD_GP_CHAPTERS ("textures,camera"); unset: every chapter. */
export const chaptersToTest = (): ReadonlySet<string> | null => envSet("CODESTEAD_GP_CHAPTERS");

function lessons() {
  const parts = partsToTest();
  const only = chaptersToTest();
  return GpCourse.chapters.filter((c) => c.isLesson && (parts === null || parts.has(c.part)) && (only === null || only.has(c.id)));
}

function chaptersAndApis(): [string, string][] {
  const data: [string, string][] = [];
  for (const api of Apis.all) for (const chapter of lessons()) if (existsSync(join(Repo.content, "projects", api.id, chapter.id))) data.push([api.id, chapter.id]);
  return data;
}

function chaptersWithExercises(): [string, string][] {
  const data: [string, string][] = [];
  for (const api of Apis.all) for (const chapter of lessons()) if (GpCourse.exercises(chapter.id, api.id).length > 0) data.push([api.id, chapter.id]);
  return data;
}

/** Math.Round(v, 2) for the failure message (only shown, so the last digit's rounding does not matter). */
const round2 = (v: number): number => Number(v.toFixed(2));

function report(c: CheckContext): string {
  const f = c.frame;
  return (
    c.build.diagnostics.map((d) => d.toString()).join("\n") +
    "\n" +
    (c.scene?.notes.map((n) => `note ${n.key} ${[...n.args].map(([k, v]) => k + "=" + v).join(", ")}`).join("\n") ?? "") +
    (f !== null ? `\nframe errors: ${f.errors.join("; ")}\ncentre: ${f.atRelative(0.5, 0.55).map(round2).join(",")}` : "\n(no frame)")
  );
}

function filesUnder(dir: string): string[] {
  const list: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) list.push(...filesUnder(path));
    else list.push(path);
  }
  return list;
}

describe("TaskTests", () => {
  const cases = chaptersAndApis();
  for (const [api, chapter] of cases)
    itNeeds([api], `varje uppgift löses av sin lösning, och inte före (${api}, ${chapter})`, () => {
      const project = GpCourse.startProject(chapter, api);
      const tasks = GpCourse.tasks(chapter, api);
      const start = new CheckContext(api, project.clone(), Simulator.build(project, api));
      expect(start.built, `${api}/${chapter}: the start project does not build:\n${report(start)}`).toBe(true);
      for (const task of tasks) {
        const check = TaskChecks.for(chapter, task.id);
        expect(check !== null, `${api}/${chapter}: no check for task '${task.id}'`).toBe(true);
        if (task.edits.length > 0) {
          const before = new CheckContext(api, project.clone(), Simulator.build(project, api));
          expect(check!(before), `${api}/${chapter}/${task.id}: already solved before its solution is applied`).toBe(false);
        }
        for (const edit of task.edits)
          expect(Edits.apply(project, edit) !== null, `${api}/${chapter}/${task.id}: the edit's 'find' text is not in ${edit.file}:\n${edit.find}`).toBe(true);
        const after = new CheckContext(api, project.clone(), Simulator.build(project, api));
        expect(check!(after), `${api}/${chapter}/${task.id}: not solved by its solution\n${report(after)}`).toBe(true);
      }
      // The end result is the chapter's solution/.
      const solutionDir = join(Repo.content, "projects", api, chapter, "solution");
      for (const file of filesUnder(solutionDir)) {
        const name = relative(solutionDir, file).replaceAll("\\", "/");
        if (GpCourse.isAsset(name)) {
          const bytes = project.assets.get(name);
          expect(bytes !== undefined && Buffer.from(bytes).equals(readFileSync(file)), `${api}/${chapter}: the image ${name} differs from start/`).toBe(true);
          continue;
        }
        expect(project.files.has(name), `${api}/${chapter}: ${name} is missing`).toBe(true);
        expect(project.files.get(name)).toBe(readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
      }
    }, Timeout);

  for (const [api, chapter] of chaptersWithExercises())
    itNeeds([api], `varje övning byggs rent; en övning med kontroll löses av sin lösning och inte av kapitlets program (${api}, ${chapter})`, () => {
      const solved = GpCourse.solutionProject(chapter, api);
      const before = new CheckContext(api, solved.clone(), Simulator.build(solved, api));
      for (const exercise of GpCourse.exercises(chapter, api)) {
        const check = TaskChecks.for(chapter, exercise.id);
        if (check !== null) expect(check(before), `${api}/${chapter}/${exercise.id}: the chapter's program already solves it`).toBe(false);
        const project = solved.clone();
        for (const edit of exercise.edits)
          expect(Edits.apply(project, edit) !== null, `${api}/${chapter}/${exercise.id}: the edit's 'find' text is not in ${edit.file}:\n${edit.find}`).toBe(true);
        const after = new CheckContext(api, project.clone(), Simulator.build(project, api));
        expect(after.built, `${api}/${chapter}/${exercise.id}: does not build\n${report(after)}`).toBe(true);
        const bad = after.scene!.notes.filter((n) => n.level !== NoteLevel.Info);
        expect(bad.length === 0, `${api}/${chapter}/${exercise.id}:\n${report(after)}`).toBe(true);
        if (check !== null) expect(check(after), `${api}/${chapter}/${exercise.id}: not solved by its solution\n${report(after)}`).toBe(true);
      }
    }, Timeout);

  for (const [api, chapter] of cases)
    itNeeds([api], `lösningen bygger och körs utan anmärkningar (${api}, ${chapter})`, () => {
      const project = GpCourse.startProject(chapter, api);
      for (const edit of GpCourse.tasks(chapter, api).flatMap((t) => t.edits)) Edits.apply(project, edit);
      const c = new CheckContext(api, project, Simulator.build(project, api));
      expect(c.built, report(c)).toBe(true);
      // Before Hello Window there is no render loop yet: the window closing at once is expected there.
      const bad = c.scene!.notes.filter((n) => n.level !== NoteLevel.Info && !(chapter === "creating-a-window" && n.key === "noLoop"));
      expect(bad.length === 0, `${api}/${chapter}:\n${report(c)}`).toBe(true);
      const f = c.frame;
      if (f !== null) expect(f.errors.length === 0, f.errors.join("\n")).toBe(true);
    }, Timeout);
});
