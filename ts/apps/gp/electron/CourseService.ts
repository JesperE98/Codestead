// The course's work outside the window (see src/CourseHost.ts), as plain functions of Node: run in the course worker
// (electron/worker.ts) of the Electron app, and directly by the tests. Port of the parts of GpTool.Project.cs
// (StartCheck's background part), GpTool.Files.cs (Save, SaveFilesTo), YourProject/ExpectedPicture.cs (Render) and
// GpTool.SmokeTest.cs (SolveForSmokeTest's files, SmokeTest's simulated builds) that run off the UI thread or touch
// the disk. The learner's files and the course's binary files are read with node:fs (the course's default
// FileSystem and Resources.readBytes).

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ExpectedResult, GpCourse, isIoError, ProjectChecker, StartFiles } from "@codestead/gp-course";
import { Apis, Rasterizer, Simulator } from "@codestead/gp-gpu";
import type { CheckReportData, DrawnData, FilesToSave, SaveResult } from "../src/CourseHost.js";
import { reportToData } from "../src/CourseHost.js";
import { projectToSave } from "../src/ProjectResources.js";

let smokeDir: string | null = null;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const CourseService = {
  /** "Check my code": the code around the main file, checked with the course's task checks. */
  check(mainFile: string, chapter: string, api: string): CheckReportData {
    return reportToData(ProjectChecker.check(mainFile, chapter, api));
  },

  /** The expected result of a task, drawn at a width (C#'s ExpectedPicture.Render, without the cache: the window keeps it). */
  draw(chapter: string, api: string, task: number, width: number): DrawnData {
    const none = (key: string): DrawnData => ({ width: 0, height: 0, pixels: null, message: key });
    try {
      const scene = ExpectedResult.scene(chapter, api, task);
      if (scene === null) return none("expected.none");
      if (!scene.windowCreated) return none("expected.noWindow");
      if (!scene.renderLoop) return none("expected.closed");
      if (!scene.presents) return none("expected.nothing");
      const frame = Rasterizer.render(scene, width);
      return { width: frame.width, height: frame.height, pixels: frame.pixels, message: "" };
    } catch {
      return none("expected.none");
    }
  },

  conflicts(folder: string, files: FilesToSave): string[] {
    return StartFiles.conflicts(folder, projectToSave(files));
  },

  /** Writes the files; the main file is the project's when it has code (the learner's earlier code is then checked). */
  save(folder: string, files: FilesToSave): SaveResult {
    const project = projectToSave(files);
    try {
      const count = StartFiles.copy(folder, project);
      const main = project.files.size > 0 ? path.join(folder, project.mainFile) : null;
      return { count, mainFile: main !== null && fs.existsSync(main) ? main : null };
    } catch (e) {
      if (!isIoError(e)) throw e;
      return { error: message(e) };
    }
  },

  smokePrepare(chapter: string, api: string, taskIndex: number): string {
    smokeDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "codestead-gp-smoke-"));
    const dir = path.join(smokeDir, api, chapter);
    fs.mkdirSync(dir, { recursive: true });
    const solution = ExpectedResult.project(chapter, api, Math.max(0, taskIndex));
    StartFiles.copy(dir, GpCourse.startProject(chapter, api));
    StartFiles.copy(dir, solution);
    // The learner's own layout: the main file is src/<chapter>.cpp, the other files stay beside src/.
    const main = path.join(dir, "src", chapter + ".cpp");
    fs.mkdirSync(path.dirname(main), { recursive: true });
    fs.renameSync(path.join(dir, solution.mainFile), main);
    return main;
  },

  smokeBuilds(): number {
    let builds = 0;
    for (const part of GpCourse.parts) {
      const first = GpCourse.lessonsIn(part)[0];
      if (first === undefined) continue;
      for (const api of Apis.all) {
        const result = Simulator.build(GpCourse.startProject(first.id, api.id), api.id);
        if (result.scene?.showsFrames === true) Rasterizer.render(result.scene, 64);
        builds++;
      }
    }
    return builds;
  },

  smokeAssets(): number {
    let n = 0;
    for (const lesson of GpCourse.chapters.filter((c) => c.isLesson))
      for (const [name, bytes] of GpCourse.startProject(lesson.id, Apis.OpenGL).assets) {
        if (bytes.length === 0) throw new Error(`The course's file ${name} (${lesson.id}) cannot be read.`);
        n++;
      }
    if (n === 0) throw new Error("The course has no images, models or fonts.");
    return n;
  },

  smokeCleanup(): void {
    if (smokeDir === null) return;
    try {
      fs.rmSync(smokeDir, { recursive: true, force: true });
    } catch {
      // Best effort, as in C#.
    }
    smokeDir = null;
  },
};

/** The operations a worker request can name. */
export type CourseOp = keyof typeof CourseService;
