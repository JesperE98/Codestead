// Port of Chapters.cs (src/content/chapters.ts) – all chapters and their tasks.
// The text is in src/Linux/content/chapters/<lang>/*.md; the tasks and their checks are here
// (the chapter definitions are in ChapterDefinitions.ts and Chapters/<part>/<id>.ts, the check helpers in Checks.ts).

import { ChapterKinds } from "@codestead/learning";
import { type Distro, DistrosLib, type Family } from "@codestead/linux-shell";
import { defineChapters } from "./ChapterDefinitions.js";
import * as Resources from "./Resources.js";
import { Chapter } from "./Types/Chapter.js";
import type { Part } from "./Types/Part.js";

// ---------- Parts and chapters ----------

/** The distribution the terminal runs outside the "distro" main chapter. */
export const DefaultDistro = "ubuntu";

/**
 * The main chapters in order. The fundamentals come first and are the same on every distribution;
 * distributions and package managers get their own main chapter (the only one with a distro choice).
 */
export const parts: Part[] = [
  { id: "start", title: "Kom igång" },
  { id: "grunder", title: "Grunderna" },
  { id: "system", title: "Systemet" },
  { id: "distro", title: "Distributioner och paket", distroChoice: true },
  { id: "admin", title: "Systemadministration" },
  { id: "natverk", title: "Nätverk" },
  { id: "skript", title: "Skript och automatisering" },
  { id: "verktyg", title: "Fler verktyg" },
];

function withSummariesAndExams(lessons: Chapter[]): Chapter[] {
  const list = [...lessons];
  for (const part of parts) {
    const last = list.findLastIndex((c) => c.part === part.id);
    if (last < 0) continue;
    const extra: Chapter[] = [];
    for (const kind of [ChapterKinds.Summary, ChapterKinds.Exam]) {
      const id = `${part.id}-${kind}`;
      if (Resources.read(`chapters/en/${id}.md`) === null) continue;
      extra.push(new Chapter({ id, part: part.id, kind }));
    }
    list.splice(last + 1, 0, ...extra);
  }
  return list;
}

/**
 * All chapters, shown in the same order as the parts in {@link parts}
 * (a stable sort keeps the order within a part). Each main chapter ends with a summary and an exam
 * when their texts exist (src/Linux/content/chapters/&lt;lang&gt;/&lt;part&gt;-summary.md and -exam.md).
 */
export const chapters: Chapter[] = withSummariesAndExams(defineChapters())
  .map((ch) => ({ ch, order: parts.findIndex((p) => p.id === ch.part) }))
  .sort((a, b) => a.order - b.order)
  .map((x) => x.ch);

export function partOf(chapter: Chapter): Part {
  const p = parts.find((p) => p.id === chapter.part);
  if (p === undefined) throw new Error(`No part ${chapter.part}`);
  return p;
}

/**
 * The distribution a chapter runs on: outside the distro main chapter always {@link DefaultDistro};
 * inside it the student's choice – limited to the chapter's family for a family chapter
 * (the family's first distribution if the choice belongs to another family).
 */
export function distroFor(chapter: Chapter, chosenDistroId: string): string {
  if (!partOf(chapter).distroChoice) return DefaultDistro;
  const choices = distrosFor(chapter);
  return choices.find((d) => d.id === chosenDistroId)?.id ?? choices[0]!.id;
}

/** The distributions the student can choose between in a chapter (one = no choice). */
export function distrosFor(chapter: Chapter): Distro[] {
  return !partOf(chapter).distroChoice
    ? [DistrosLib.getDistro(DefaultDistro)]
    : chapter.family === null
      ? [...DistrosLib.distros]
      : DistrosLib.distros.filter((d) => d.family === chapter.family);
}

/** The lesson chapters of a main chapter (not the summary and exam). */
export function lessonsIn(partId: string): Chapter[] {
  return chapters.filter((c) => c.part === partId && c.kind === ChapterKinds.Lesson);
}

/** Planned chapters – shown in the menu as "coming soon". */
export const upcoming: string[] = [];

export function taskKey(chapterId: string, taskId: string, perFamily: boolean | null | undefined, family: Family | string): string {
  return perFamily === true ? `${chapterId}/${taskId}@${family}` : `${chapterId}/${taskId}`;
}
