// The course's work that runs outside the window: "Check my code" (the learner's files read from disk and run in the
// simulated GPU), the expected-result pictures (the course's solution drawn by the simulated GPU) and saving files
// into a folder the learner picks. C# runs the first two on background threads (Task.Run) and the last on the UI
// thread; here all of them run in a Node worker thread of Electron's main process (electron/worker.ts), which has
// node:fs for the learner's files and the course's binary files, so the window never waits for them. What crosses
// over is plain data (structured clone): the classes of the report are rebuilt here.

import { BuildFacts, CheckMessage, CheckReport, TaskResult } from "@codestead/gp-course";

/** A {@link BuildFacts} as plain data. */
export interface BuildFactsData {
  line: string;
  output: string;
  exitCode: number;
  api: string;
  succeeded: boolean;
  showsFrames: boolean;
  drew: boolean;
  clearColor: number[] | null;
  names: string[];
  firstWords: string[];
}

/** A {@link CheckReport} as plain data. */
export interface CheckReportData {
  chapterId: string;
  api: string;
  tasks: { taskId: string; key: string; passed: boolean; checkable: boolean }[];
  messages: { key: string; args: [string, string][]; isError: boolean }[];
  facts: BuildFactsData | null;
}

export function reportToData(r: CheckReport): CheckReportData {
  const f = r.facts;
  return {
    chapterId: r.chapterId,
    api: r.api,
    tasks: r.tasks.map((t) => ({ taskId: t.taskId, key: t.key, passed: t.passed, checkable: t.checkable })),
    messages: r.messages.map((m) => ({ key: m.key, args: [...m.args], isError: m.isError })),
    facts:
      f === null
        ? null
        : {
            line: f.line,
            output: f.output,
            exitCode: f.exitCode,
            api: f.api,
            succeeded: f.succeeded,
            showsFrames: f.showsFrames,
            drew: f.drew,
            clearColor: f.clearColor === null ? null : [...f.clearColor],
            names: [...f.names],
            firstWords: [...f.firstWords],
          },
  };
}

export function reportFromData(d: CheckReportData): CheckReport {
  let facts: BuildFacts | null = null;
  if (d.facts !== null) {
    facts = new BuildFacts(d.facts);
    facts.names.push(...d.facts.names);
    facts.firstWords.push(...d.facts.firstWords);
  }
  return new CheckReport(
    d.chapterId,
    d.api,
    d.tasks.map((t) => new TaskResult(t.taskId, t.key, t.passed, t.checkable)),
    d.messages.map((m) => new CheckMessage(m.key, new Map(m.args), m.isError)),
    facts,
  );
}

/**
 * A task's expected result as drawn by the simulated GPU: the frame's BGRA pixels (top row first), or – without a
 * picture – the user-interface text key that says why ("expected.noWindow" …).
 */
export interface DrawnData {
  width: number;
  height: number;
  pixels: Uint8Array | null;
  message: string;
}

/**
 * What "Save resources…" and "Save my earlier code…" write: the chapter's resources (the course's textures, models,
 * fonts, levels – no code), or the code of the app's old built-in editor with the chapter's resources.
 */
export type FilesToSave =
  | { kind: "resources"; chapter: string; api: string }
  | { kind: "oldCode"; chapter: string; api: string; files: Record<string, string> };

/** How saving went: how many files were written and the project's main file there (if it has code), or why not. */
export type SaveResult = { count: number; mainFile: string | null } | { error: string };

/** The course's work outside the window (see the top of this file). Every call is asynchronous. */
export interface CourseHost {
  /** Checks the code around the chapter's main file (ProjectChecker). Rejects when cancelled or when it failed. */
  check(mainFile: string, chapter: string, api: string): Promise<CheckReportData>;
  /** Stops a check that is still running (its promise rejects). */
  cancelCheck(): void;
  /** Draws the expected result of a task (ExpectedResult) at a width. */
  draw(chapter: string, api: string, task: number, width: number): Promise<DrawnData>;
  /** The files that exist in the folder with other contents (StartFiles.Conflicts). */
  conflicts(folder: string, files: FilesToSave): Promise<string[]>;
  /** Writes the files into the folder (StartFiles.Copy). */
  save(folder: string, files: FilesToSave): Promise<SaveResult>;

  // ---------- The smoke test ----------

  /**
   * Writes a task's solution as a learner would have it into a temporary folder (the start files with the course's
   * solution over them, the main file renamed to src/&lt;chapter&gt;.cpp); returns that main file.
   */
  smokePrepare(chapter: string, api: string, taskIndex: number): Promise<string>;
  /** Builds the first lesson of every part in every API in the simulator; returns how many were built. */
  smokeBuilds(): Promise<number>;
  /** Checks that the course's binary files can be read (a start project's textures are not empty); returns how many. */
  smokeAssets(): Promise<number>;
  /** Removes the temporary folder of smokePrepare. */
  smokeCleanup(): Promise<void>;
}
