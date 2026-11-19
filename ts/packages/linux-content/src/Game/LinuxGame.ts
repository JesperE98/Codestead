// Port of Game/LinuxGame.cs – the learning engine set up for the Linux course: its outline and its achievements.

import { ChapterKinds, CourseOutline, GameRules, OutlinePart } from "@codestead/learning";
import type { Distro, World } from "@codestead/linux-shell";
import * as ChaptersLib from "../Chapters.js";
import type { Chapter } from "../Types/Chapter.js";
import * as AchievementsLib from "./AchievementsLib.js";
import { CommandInfo } from "./CommandInfo.js";

/** The parts, lessons and exams of the Linux course, for the engine. */
export const outline: CourseOutline = new CourseOutline(
  ChaptersLib.parts.map(
    (p) =>
      new OutlinePart(
        p.id,
        ChaptersLib.lessonsIn(p.id).map((l) => l.id),
        ChaptersLib.chapters.some((c) => c.part === p.id && c.kind === ChapterKinds.Exam),
      ),
  ),
);

export const rules: GameRules = new GameRules(outline, AchievementsLib.all);

/** The commands practised in a chapter: the ones in its tasks' solutions, in order. */
export function chapterCommands(ch: Chapter, d: Distro, w: World): string[] {
  const names: string[] = [];
  for (const task of ch.tasks) {
    let lines: string[];
    try {
      lines = task.solutionFor(d, w);
    } catch {
      continue;
    }
    for (const line of lines) for (const name of CommandInfo.analyze(line, "", 0).names) if (!names.includes(name)) names.push(name);
  }
  return names;
}
