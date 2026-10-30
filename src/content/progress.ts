// Utvärderar uppgifter efter varje kommando och håller reda på framsteg.

import type { Distro } from '../shell/distros';
import type { ExecResult, Shell } from '../shell/shell';
import { stripAnsi } from '../shell/commands/util';
import { CHAPTERS, taskKey } from './chapters';
import type { Chapter, CheckCtx } from './types';

export type Completed = Record<string, true>;

/** Returnerar nycklarna för uppgifter i kapitlet som just blev klara. */
export function evaluateTasks(chapter: Chapter, sh: Shell, result: ExecResult, completed: Completed): string[] {
  if (result.pending) return [];
  const distro: Distro = sh.distro;
  const ctx: CheckCtx = {
    sh,
    distro,
    line: result.line.trim(),
    output: stripAnsi(result.output),
    exitCode: result.exitCode,
  };
  const done: string[] = [];
  for (const task of chapter.tasks) {
    const key = taskKey(chapter.id, task.id, task.perFamily, distro.family);
    if (completed[key]) continue;
    try {
      if (task.check(ctx)) done.push(key);
    } catch {
      // En kontroll som kraschar räknas som "inte klar".
    }
  }
  return done;
}

export function chapterProgress(chapter: Chapter, completed: Completed, distro: Distro): { done: number; total: number } {
  const total = chapter.tasks.length;
  const done = chapter.tasks.filter((t) => completed[taskKey(chapter.id, t.id, t.perFamily, distro.family)]).length;
  return { done, total };
}

export function totalProgress(completed: Completed, distro: Distro): { done: number; total: number } {
  return CHAPTERS.reduce(
    (acc, ch) => {
      const p = chapterProgress(ch, completed, distro);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
}
