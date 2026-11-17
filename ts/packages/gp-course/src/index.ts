// Codestead GP's course: chapters, tasks and exercises with their checks, texts per language and API, the starting
// projects, "Check my code" and the game. Port of Codestead.GP.Course; see docs/TYPESCRIPT-MIGRATION.md.
export type { ApiReference } from "./ApiReference.js";
export { ChapterStrings, type PerApiText } from "./ChapterStrings.js";
export { CheckContext, between, given, type Rgba } from "./CheckContext.js";
export { CourseTask } from "./CourseTask.js";
export { CourseText } from "./CourseText.js";
export { EditState } from "./EditState.js";
export { Edits } from "./Edits.js";
export { GpCourse } from "./GpCourse.js";
export type { TaskCheck } from "./TaskCheck.js";
export { TaskEdit } from "./TaskEdit.js";
export { UiStrings } from "./UiStrings.js";
export { preloadBytes } from "./Resources.js";

export { TaskChecks } from "./Checks/TaskChecks.js";

export { BuildFacts, type BuildFactsInit } from "./Game/BuildFacts.js";
export { GpAchievements } from "./Game/GpAchievements.js";
export { GpGame } from "./Game/GpGame.js";

export { CheckMessage } from "./Ide/CheckMessage.js";
export { CheckReport } from "./Ide/CheckReport.js";
export { ExpectedResult } from "./Ide/ExpectedResult.js";
export { IOException, defaultFileSystem, isIoError, nodeFileSystem, setFileSystem, type DirEntry, type FileSystem } from "./Ide/FileSystem.js";
export { IdeInfo } from "./Ide/IdeInfo.js";
export { Ides } from "./Ide/Ides.js";
export { ProjectChecker } from "./Ide/ProjectChecker.js";
export { ProjectFiles } from "./Ide/ProjectFiles.js";
export { ProjectRead } from "./Ide/ProjectRead.js";
export { ProjectReader } from "./Ide/ProjectReader.js";
export { StartFiles } from "./Ide/StartFiles.js";
export { TaskResult } from "./Ide/TaskResult.js";

export { MainFiles, type MainFileChoices } from "./YourProject/MainFiles.js";
