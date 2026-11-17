// Port of Progress.cs (src/content/progress.ts) – evaluates tasks after each command and keeps track of progress.
// TS: Completed = Record<string, true> → Map<string, boolean> (a key counts when its value is true).

import { type Distro, type ExecResult, type Shell, UtilCmd } from "@codestead/linux-shell";
import * as ChaptersLib from "./Chapters.js";
import type { Chapter } from "./Types/Chapter.js";
import type { CheckContext } from "./Types/CheckContext.js";

function isDone(completed: ReadonlyMap<string, boolean>, key: string): boolean {
  return completed.get(key) === true;
}

/** Returns the keys of the tasks in the chapter that were just completed. */
export function evaluateTasks(chapter: Chapter, sh: Shell, result: ExecResult, completed: ReadonlyMap<string, boolean>): string[] {
  if (result.pending || result.incomplete) return [];
  const distro = sh.distro;
  const ctx: CheckContext = {
    sh,
    distro,
    line: result.line.trim(),
    output: UtilCmd.stripAnsi(result.output),
    exitCode: result.exitCode,
  };
  const done: string[] = [];
  for (const task of chapter.tasks) {
    const key = ChaptersLib.taskKey(chapter.id, task.id, task.perFamily, distro.family);
    if (isDone(completed, key)) continue;
    try {
      if (task.check(ctx)) done.push(key);
    } catch {
      // A check that crashes counts as "not done".
    }
  }
  return done;
}

/** How many of the chapter's tasks are done (C#: a (Done, Total) tuple). */
export interface ProgressCount {
  done: number;
  total: number;
}

export function chapterProgress(chapter: Chapter, completed: ReadonlyMap<string, boolean>, distro: Distro): ProgressCount {
  const total = chapter.tasks.length;
  const done = chapter.tasks.filter((t) => isDone(completed, ChaptersLib.taskKey(chapter.id, t.id, t.perFamily, distro.family))).length;
  return { done, total };
}

export function totalProgress(completed: ReadonlyMap<string, boolean>, distro: Distro): ProgressCount {
  let done = 0;
  let total = 0;
  for (const ch of ChaptersLib.chapters) {
    const p = chapterProgress(ch, completed, distro);
    done += p.done;
    total += p.total;
  }
  return { done, total };
}
