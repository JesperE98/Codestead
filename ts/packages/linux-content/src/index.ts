// Codestead Linux's course: chapters, task checks, progress and the game. Port of Codestead.Content; see
// docs/TYPESCRIPT-MIGRATION.md. The course texts are read from src/Linux/content (see Resources.ts).
//
// Types and classes are exported by name; the static C# classes (ChaptersLib, ProgressLib, I18nLib …) as namespaces,
// so that code reads like the C#: ChaptersLib.chapters, ProgressLib.evaluateTasks(...).

export type { Lang, Language } from "./Language.js";
export * as LanguagesLib from "./LanguagesLib.js";
export * as UiStrings from "./UiStrings.js";
export * as I18nLib from "./I18n.js";
export * as RenderLib from "./Render.js";
export * as ChaptersLib from "./Chapters.js";
export * as ProgressLib from "./Progress.js";
export type { ProgressCount } from "./Progress.js";

export { Chapter, type ChapterInit } from "./Types/Chapter.js";
export type { ChapterStrings } from "./Types/ChapterStrings.js";
export { ChapterTask, type ChapterTaskInit } from "./Types/ChapterTask.js";
export type { ChapterTaskStrings } from "./Types/ChapterTaskStrings.js";
export type { CheckContext } from "./Types/CheckContext.js";
export { FamilyText } from "./Types/FamilyText.js";
export type { Part } from "./Types/Part.js";
export { PerDistro } from "./Types/PerDistro.js";
export * as TypesLib from "./Types/TypesLib.js";

export { CommandInfo } from "./Game/CommandInfo.js";
export * as AchievementsLib from "./Game/AchievementsLib.js";
export * as LinuxGame from "./Game/LinuxGame.js";
