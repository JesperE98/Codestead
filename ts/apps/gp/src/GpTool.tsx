/// <reference types="vite/client" />
// Port of Codestead.GP/GpTool.cs, GpTool.Ide.cs, GpTool.Project.cs and GpTool.Files.cs (one class here; the React
// parts are GpTool.Ide.tsx – the IDE picker –, GpTool.Solution.tsx and YourProject/). NoSandbox.cs is at the end.
//
// Codestead GP in the shared learning window: the course, its texts, the graphics APIs (OpenGL, Vulkan, DirectX 12)
// as variants, and "Your project" as the workbench: the learner's own code, built and run in their IDE; tasks ticked
// by hand or by "Check my code".
//
// What C# runs on background threads – the check of the learner's code, the expected-result pictures – and what
// touches the disk – reading the learner's files, saving files – runs in the course worker of the main process
// (GpHost.course, see CourseHost.ts); the window only asks it and waits without blocking.

import type { ProductMeta } from "@codestead/common";
import { Languages } from "@codestead/common";
import { type CheckMessage, type CheckReport, CourseText, type FileSystem, GpCourse, GpGame, Ides, MainFiles, UiStrings } from "@codestead/gp-course";
import { Apis } from "@codestead/gp-gpu";
import type { CommandFacts, CourseChapter, GameRules, Reference } from "@codestead/learning";
import {
  Changelog,
  type ChangelogEntry,
  type ISandbox,
  type LearningTool,
  type MarkdownPicture,
  type LearningWindow,
  loadJson,
  RanEvent,
  SandboxRun,
  saveJson,
  type SelfUpdate,
  Store,
  type TaskInfo,
  useStore,
  type VariantGroup,
  type VariantOption,
} from "@codestead/ui";
import type { ReactNode } from "react";
import changelogJson from "../../../../src/GP/changelog.json?raw";
import iconUrl from "../../../../src/GP/Codestead.GP/Assets/icon.png";
import type { FileFilter } from "../electron/api.js";
import { type CourseHost, type FilesToSave, reportFromData } from "./CourseHost.js";
import { IdePicker } from "./GpTool.Ide.js";
import { SolutionView } from "./GpTool.Solution.js";
import { NoUpdates } from "./NoUpdates.js";
import { ProductInfo } from "./ProductInfo.js";
import { resources } from "./ProjectResources.js";
import { vizScene } from "./VizScene.js";
import { Large } from "./YourProject/ExpectedPicture.js";
import type { PanelModel } from "./YourProject/PanelModel.js";
import { ProjectPanel } from "./YourProject/ProjectPanel.js";
import { StatusLine } from "./YourProject/ProjectPanel.Tasks.js";
import type { TaskRow } from "./YourProject/TaskRow.js";
import { TaskState } from "./YourProject/TaskState.js";

/** What the tool needs from the app around it (the Electron host, or the tests). */
export interface GpHost {
  /** The course's work outside the window: checks, pictures, saving files. */
  readonly course: CourseHost;
  /** Paths and whether files exist (MainFiles, the main file, the pickers' start folder). */
  readonly fs: FileSystem;
  /** Lets the learner pick a file; null when cancelled. */
  pickFile(title: string, filters: FileFilter[], startFolder: string | null): Promise<string | null>;
  /** Lets the learner pick a folder; null when cancelled. */
  pickFolder(title: string, startFolder: string | null): Promise<string | null>;
  /** Puts text on the clipboard (rejects when there is none). */
  copyText(text: string): Promise<void>;
}

/** The window's "command line" for a task ticked by hand (no check, no statistics). */
const MarkDoneLine = "mark-done";
const IdeFile = "ide";
const SourceFiles: FileFilter = { name: "C/C++", extensions: ["cpp", "cc", "cxx", "c"] };
const AllFiles: FileFilter = { name: "*", extensions: ["*"] };

/** The chapters' pictures ("images/[<lang>/]name.webp"): their URLs in the built app (Vite copies them). */
const pictureUrls = new Map(
  Object.entries(import.meta.glob<string>("../../../../src/GP/content/images/**/*.{png,webp,gif,jpg}", { query: "?url", import: "default", eager: true })).map(
    ([path, url]) => [path.slice(path.indexOf("/content/") + "/content/".length), url] as const,
  ),
);

let changelogEntries: ChangelogEntry[] | null = null;

/** A task's text as a short plain title: the first sentence, without markdown. */
export function taskTitle(markdown: string): string {
  let plain = markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replaceAll("**", "").replaceAll("`", "").replaceAll("\n", " ");
  const end = /[.:](?:\s|$)|[。：]/.exec(plain);
  if (end !== null && end.index > 0) plain = plain.slice(0, end.index);
  return plain.length > 90 ? plain.slice(0, 87).trimEnd() + "…" : plain.trim();
}

/** C#'s DateTime.ToString("HH:mm", InvariantCulture). */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The panel's own changes (a check started or ended, a task selected …): it is drawn again. */
class PanelStore extends Store {
  render(): void {
    this.changed();
  }
}

/**
 * Codestead GP in the shared learning window: the course, its texts, the graphics APIs (OpenGL, Vulkan,
 * DirectX 12) as variants, and "Your project" as the workbench: the learner's own code, built and run in their IDE;
 * tasks ticked by hand or by "Check my code".
 */
export class GpTool implements LearningTool {
  window?: LearningWindow;

  /** The "Your project" panel is drawn again when this changes (C#: RenderPanel). */
  readonly panel = new PanelStore();
  private readonly ran = new RanEvent();
  private mainFilesValue: MainFiles | null = null;
  private chapter = "";
  private shownApi = "";
  private mainFile: string | null = null;
  private hasResources = false;
  private report: CheckReport | null = null;
  private checkedAt = new Date(0);
  private checking = false;
  private generation = 0;
  /** Bumped by every check started: an older one's result is dropped (C#: its cancellation). */
  private checkId = 0;
  private selectedTask = -1;
  private markedDone: string | null = null;
  private ideValue: string | null = null;
  private smokeChecks = 0;

  /**
   * @param host The course's work and the files outside the window.
   * @param selfUpdate The app's own updates (C#'s LearningWindow makes a Velopack SelfUpdate; the app passes the preload's).
   */
  constructor(
    readonly host: GpHost,
    readonly selfUpdate: SelfUpdate = NoUpdates,
  ) {}

  private get w(): LearningWindow {
    if (this.window === undefined) throw new Error("The tool is not in a window yet.");
    return this.window;
  }

  get product(): ProductMeta {
    return ProductInfo.meta;
  }

  readonly iconUrl: string = iconUrl;

  get changelog(): readonly ChangelogEntry[] {
    return (changelogEntries ??= Changelog.parse(changelogJson));
  }

  translate(lang: string, key: string, args?: Readonly<Record<string, unknown>>): string {
    return UiStrings.translate(lang, key, args);
  }

  /** The API the learner chose. */
  private get api(): string {
    return Apis.get(this.w.chosenVariant).id;
  }

  // ---------- The course ----------

  get parts(): readonly string[] {
    return GpCourse.parts;
  }

  get chapters(): readonly CourseChapter[] {
    return GpCourse.chapters;
  }

  chapterTitle(chapterId: string, lang: string): string {
    return CourseText.title(chapterId, lang, this.api);
  }

  languagesWithText(chapterId: string): readonly string[] {
    return CourseText.languagesWithText(chapterId);
  }

  /**
   * The text for the chosen API: its checkpoints are what the window counts, so every API's version of a chapter
   * has the same number of questions (the tests check it).
   */
  rawText(chapterId: string, lang: string): string {
    return CourseText.preprocess(CourseText.raw(chapterId, lang), this.api, this.ide);
  }

  /** The text for the chosen API and IDE. */
  lessonText(chapterId: string, lang: string): string {
    return this.withIdeHint(chapterId, CourseText.lesson(chapterId, lang, this.api, this.ide));
  }

  /**
   * A picture of the chapters' texts: the one for the language (images/sv/pipeline.webp) if there is one, else the
   * shared one – as GpCourse.picture finds it, but as the URL of the built app's copy instead of its bytes (the window
   * has no node:fs, and only the pictures shown are loaded).
   */
  picture(path: string, lang: string): string | null {
    const prefix = "images/";
    if (!path.startsWith(prefix) || path.includes("..")) return null;
    const name = path.slice(prefix.length);
    for (const l of Languages.fallbackChain(lang)) {
      const own = pictureUrls.get(`${prefix}${l}/${name}`);
      if (own !== undefined) return own;
    }
    return pictureUrls.get(path) ?? null;
  }

  /** A scene of the Render Pipeline Visualizer (`![alt](viz:buffers "caption")`), live in the chosen API. */
  pictureView(picture: MarkdownPicture, lang: string): ReactNode | null {
    return vizScene({ api: this.api, lang, t: (key, args) => this.w.t(key, args), picture: (path, l) => this.picture(path, l) }, picture);
  }

  references(chapterId: string): readonly Reference[] {
    return CourseText.references(chapterId, this.api);
  }

  taskKeys(chapterId: string): readonly string[] {
    const api = this.api;
    return GpCourse.allTasks(chapterId, api).map((t) => GpCourse.taskKey(chapterId, t.id, api));
  }

  /** The solution of a task that needs no code: build and run it in the IDE. */
  private get buildRunSolution(): string {
    return "▶ " + this.w.t("yourProject.buildRunSolution");
  }

  /** The chapter's steps (following the text) and then its exercises, under headings when there are exercises. */
  tasks(chapterId: string, lang: string): readonly TaskInfo[] {
    const api = this.api;
    const sections = GpCourse.exercises(chapterId, api).length > 0;
    return GpCourse.allTasks(chapterId, api).map((task) => {
      // The same task in the other APIs, as chips (done in OpenGL ✓, Vulkan, DirectX 12).
      const chips = Apis.all
        .filter((a) => GpCourse.allTasks(chapterId, a.id).some((t) => t.id === task.id))
        .map((a) => ({ label: a.name, key: GpCourse.taskKey(chapterId, task.id, a.id), current: a.id === api }));
      // The solution's code is copied to the clipboard when clicked; a task without code is solved in the IDE.
      const solution = task.edits.length > 0 ? task.edits.map((e) => e.replace) : [this.buildRunSolution];
      return {
        key: GpCourse.taskKey(chapterId, task.id, api),
        text: CourseText.taskText(chapterId, task.id, lang, api),
        hint: CourseText.taskHint(chapterId, task.id, lang, api),
        solution,
        chips: chips.length > 1 ? chips : [],
        section: !sections ? null : this.w.t(GpCourse.isExercise(task.id) ? "yourProject.exercises" : "yourProject.steps"),
      };
    });
  }

  get rules(): GameRules {
    return GpGame.rules;
  }

  chapterCommands(chapterId: string): readonly string[] {
    return GpCourse.functions(chapterId, this.api);
  }

  progressTitle(done: number, total: number): string {
    return this.w.t("progress.title", { done, total, api: Apis.get(this.api).name });
  }

  // ---------- The APIs as variants ----------

  variants(_chapterId: string): readonly VariantGroup[] {
    return [{ label: this.w.t("api.group"), options: Apis.all.map((a) => ({ id: a.id, name: a.name })) }];
  }

  currentVariant(_chapterId: string): string {
    return this.api;
  }

  normalizeVariant(chosen: string | null): string | null {
    return Apis.get(chosen).id;
  }

  variantChosen(_variantId: string): void {
    // The window saves the choice and calls chapterShown, which shows the chapter's main file for the new API.
  }

  get allVariants(): readonly VariantOption[] {
    return Apis.all.map((a) => ({ id: a.id, name: a.name }));
  }

  // ---------- The IDE (GpTool.Ide.cs) ----------
  // The IDE picker in the top bar, next to the API: the chapters' ":::ide" blocks follow it. One choice for the whole
  // course, saved in ide.json; until the learner chooses, Visual Studio on Windows and CLion elsewhere (and Setting
  // up your IDE asks them to choose).

  topBarExtra(): ReactNode {
    return <IdePicker tool={this} />;
  }

  /** The IDE the texts follow. */
  get ide(): string {
    if (this.ideValue === null) {
      const saved = loadJson(this.w.storage, IdeFile);
      const id = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>)["ide"] : undefined;
      this.ideValue = typeof id === "string" && Ides.isKnown(id) ? id : Ides.default;
    }
    return this.ideValue;
  }

  /** Has the learner chosen an IDE (or is it still the default)? */
  private get ideChosen(): boolean {
    return this.w.storage.loadText(IdeFile) !== null;
  }

  /** The learner chose an IDE: saved, and the texts and the panel shown again for it. */
  chooseIde(id: string): void {
    if (!Ides.isKnown(id) || (id === this.ide && this.ideChosen)) return;
    this.ideValue = id;
    saveJson(this.w.storage, IdeFile, { ide: id });
    this.w.refresh();
  }

  /** Setting up your IDE asks the learner to choose until they have. */
  private withIdeHint(chapterId: string, text: string): string {
    return chapterId === "ide-setup" && !this.ideChosen ? `> ${this.w.t("ide.chooseHint", { ide: Ides.get(this.ide).name })}\n\n${text}` : text;
  }

  // ---------- Your project (GpTool.Project.cs) ----------
  // The learner writes, builds and runs the chapter's program in their own IDE, organised as they like. A task is
  // ticked by hand ("Mark as done"), or by "Check my code": the chapter's main file, which the learner picks, and the
  // files around it are checked in the background with the course's task checks (ProjectChecker), and the result
  // goes to the window as a finished "build" – the window ticks the tasks, counts XP and achievements as it always has.

  workbench(): ReactNode {
    return <ProjectPanelView tool={this} />;
  }

  readonly onRan = this.ran.listen;

  private get mainFiles(): MainFiles {
    return (this.mainFilesValue ??= new MainFiles(this.w.storage, this.host.fs));
  }

  /** A solution or a code block was clicked: the code goes to the clipboard, to paste in the IDE. */
  inject(command: string): void {
    if (command === this.buildRunSolution) {
      this.w.toast(this.w.t("yourProject.buildRunToast"));
      return;
    }
    void this.copyToClipboard(command);
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await this.host.copyText(text);
      this.w.toast(this.w.t("yourProject.copiedCode"));
    } catch {
      // No clipboard (a headless session): nothing to do.
    }
  }

  focusWorkbench(): void {}

  /** Nothing runs inside the app: the learner runs the program in the IDE. */
  run(_command: string): void {}

  /** Shows the chapter's main file for the chosen API (summaries and exams keep the last one). */
  chapterShown(chapterId: string): void {
    if (!GpCourse.chapter(chapterId).isLesson) return;
    if (chapterId === this.chapter && this.api === this.shownApi) return;
    this.chapter = chapterId;
    this.shownApi = this.api;
    this.selectedTask = -1;
    this.hasResources = resources(this.chapter, this.shownApi).assets.size > 0;
    this.useFile(this.mainFiles.get(this.shownApi, this.chapter, GpCourse.startProject(this.chapter, this.shownApi).mainFile));
  }

  private useFile(path: string | null): void {
    this.generation++;
    if (this.checking) this.host.course.cancelCheck();
    this.checking = false;
    this.report = null;
    this.mainFile = path;
    this.renderPanel();
  }

  /** The chapter's main file (also used by the smoke test). */
  setMainFile(path: string): void {
    this.mainFiles.set(this.shownApi, this.chapter, path);
    this.useFile(this.mainFiles.get(this.shownApi, this.chapter, GpCourse.startProject(this.chapter, this.shownApi).mainFile));
    this.w.refreshGame();
  }

  /** The main file "Check my code" reads now (null: none picked yet). */
  get currentMainFile(): string | null {
    return this.mainFile;
  }

  /**
   * Checks the code around the main file in the course worker; the result is handed to the window. Resolves with the
   * report, or null when there was nothing to check, or the check was overtaken (another file, chapter or check) or
   * failed.
   */
  async startCheck(): Promise<CheckReport | null> {
    if (this.mainFile === null) return null;
    if (this.checking) this.host.course.cancelCheck();
    const id = ++this.checkId;
    this.checking = true;
    const gen = this.generation;
    const [f, c, api] = [this.mainFile, this.chapter, this.shownApi];
    this.renderPanel();
    let report: CheckReport;
    try {
      report = reportFromData(await this.host.course.check(f, c, api));
    } catch {
      // Stopped (a newer check, another file) or failed: only the check of now may change the panel.
      if (gen === this.generation && id === this.checkId) {
        this.checking = false;
        this.renderPanel();
      }
      return null;
    }
    if (gen !== this.generation || id !== this.checkId) return null;
    this.checking = false;
    this.report = report;
    this.checkedAt = this.w.now();
    this.hand(report);
    this.renderPanel();
    return report;
  }

  /** Hands a check to the window as a finished build: it ticks the passing tasks (if they are unlocked). */
  private hand(r: CheckReport): void {
    const errors = r.messages.filter((m) => m.isError).map((m) => this.w.t(m.key, args(m)));
    this.ran.raise(new SandboxRun("build", errors.join("\n"), errors.length === 0 ? 0 : 1, true));
  }

  /** "Mark as done": the learner says the task is solved; the window ticks it like a solved one. */
  markDone(index: number): void {
    const tasks = GpCourse.allTasks(this.chapter, this.shownApi);
    if (index < 0 || index >= tasks.length || !this.w.isChapterUnlocked(this.chapter)) return;
    this.markedDone = GpCourse.taskKey(this.chapter, tasks[index]!.id, this.shownApi);
    try {
      this.ran.raise(new SandboxRun(MarkDoneLine, "", 0, true));
    } finally {
      this.markedDone = null;
    }
    this.renderPanel();
  }

  /** A check made while the tasks were locked counts once they are unlocked. */
  tasksUnlocked(chapterId: string): void {
    const r = this.report;
    if (chapterId === this.chapter && r !== null && r.chapterId === this.chapter && r.api === this.api) this.hand(r);
    this.renderPanel();
  }

  evaluate(chapterId: string, run: SandboxRun, completed: ReadonlyMap<string, boolean>): readonly string[] {
    if (run.line === MarkDoneLine) return this.markedDone !== null && !completed.has(this.markedDone) ? [this.markedDone] : [];
    const r = this.report;
    if (r === null || r.chapterId !== chapterId || r.api !== this.api) return [];
    return r.passedKeys.filter((k) => !completed.has(k));
  }

  /** A check counts for the statistics and achievements; a task ticked by hand does not. */
  analyze(run: SandboxRun): CommandFacts | null {
    return run.line === MarkDoneLine ? null : (this.report?.facts ?? null);
  }

  sandbox(_chapterId: string): ISandbox {
    return NoSandbox;
  }

  rendered(): void {
    this.renderPanel();
  }

  /** The tasks live in the "Your project" panel, each with its state under it. */
  readonly hostsTasks = true;

  taskStatus(_task: TaskInfo, index: number): ReactNode {
    const rows = this.rows();
    const row = rows[index];
    if (row === undefined) return null;
    return <StatusLine row={row} selected={index === this.selected(rows)} t={(k, a) => this.w.t(k, a)} onSelect={(i) => this.selectTask(i)} onMarkDone={(i) => this.markDone(i)} />;
  }

  /** The learner clicked a task's state: its expected result is shown. */
  selectTask(index: number): void {
    this.selectedTask = index;
    this.renderPanel();
  }

  /** C#'s RenderPanel: the panel is drawn again (with the window's task list in it, whose states change with it). */
  private renderPanel(): void {
    this.panel.render();
  }

  /** What the panel shows now (null before the first lesson). */
  panelModel(): PanelModel | null {
    if (this.chapter === "" || this.window === undefined) return null;
    const w = this.w;
    const rows = this.rows();
    const unlocked = w.isChapterUnlocked(this.chapter);
    // Until the text is done the tasks are locked: say what unlocks them (the panel has no "read first" card above it).
    const questions = w.checkpointProgress(this.chapter);
    const lockNote =
      unlocked || rows.length === 0
        ? null
        : questions.total > 0
          ? w.t("yourProject.lockedQuestions", { done: questions.done, total: questions.total })
          : w.t("yourProject.lockedRead");
    let summary: string | null = null;
    const messages: string[] = [];
    let allPassed = false;
    const r = this.report;
    if (r !== null && r.chapterId === this.chapter && r.api === this.shownApi) {
      summary = w.t("yourProject.checked", { time: hhmm(this.checkedAt), passed: r.tasks.filter((x) => x.passed).length, total: r.tasks.length });
      messages.push(...r.messages.map((m) => w.t(m.key, args(m))).slice(0, 3));
      allPassed = r.tasks.length > 0 && r.tasks.every((x) => x.passed);
    }
    return {
      chapterId: this.chapter,
      api: this.shownApi,
      apiName: Apis.get(this.shownApi).fullName,
      mainFile: this.mainFile,
      fileMissing: this.mainFile !== null && !this.host.fs.fileExists(this.mainFile),
      hasResources: this.hasResources,
      hasOldCode: this.hasOldCode(),
      checking: this.checking,
      checkSummary: summary,
      checkMessages: messages,
      allPassed,
      tasks: rows,
      selectedTask: this.selected(rows),
      lockNote,
      stepCount: GpCourse.tasks(this.chapter, this.shownApi).length,
      questions,
    };
  }

  /** The task whose expected result the panel shows: the one clicked, else the first not done. */
  private selected(rows: readonly TaskRow[]): number {
    if (this.selectedTask >= 0 && this.selectedTask < rows.length) return this.selectedTask;
    const first = rows.findIndex((r) => r.state !== TaskState.Done);
    return first >= 0 ? first : Math.max(0, rows.length - 1);
  }

  /** Every task's state: done, locked, being checked, not passed by the last check, or open. */
  private rows(): TaskRow[] {
    const w = this.w;
    const tasks = GpCourse.allTasks(this.chapter, this.shownApi);
    const unlocked = w.isChapterUnlocked(this.chapter);
    const r0 = this.report;
    const current = r0 !== null && r0.chapterId === this.chapter && r0.api === this.shownApi ? r0 : null;
    return tasks.map((task, i) => {
      const key = GpCourse.taskKey(this.chapter, task.id, this.shownApi);
      const result = current?.tasks.find((x) => x.key === key);
      const messages: string[] = [];
      let state: TaskState;
      if (w.isTaskDone(key)) state = TaskState.Done;
      else if (!unlocked) state = TaskState.Locked;
      else if (this.checking) state = TaskState.Checking;
      else if (result !== undefined && !result.passed && result.checkable) {
        state = TaskState.NotYet;
        messages.push(w.t("yourProject.notYetHelp"));
      } else state = TaskState.Open;
      return { index: i, title: taskTitle(CourseText.taskText(this.chapter, task.id, w.lang, this.shownApi)), state, messages };
    });
  }

  // ---------- The panel's buttons (GpTool.Files.cs) ----------
  // "Check my code" (asks for the chapter's main file the first time; "Change file…" asks again) and "Save
  // resources…" (the course's own textures, models, fonts and levels, into a folder the learner picks – the app never
  // writes code into the learner's files).

  async checkMyCode(pickAgain: boolean): Promise<void> {
    if (pickAgain || this.mainFile === null || !this.host.fs.fileExists(this.mainFile)) {
      const picked = await this.pickMainFile();
      if (picked === null) return;
      this.setMainFile(picked);
    }
    await this.startCheck();
  }

  private pickMainFile(): Promise<string | null> {
    const title = this.w.t("yourProject.pickTitle", { chapter: this.chapterTitle(this.chapter, this.w.lang), api: Apis.get(this.shownApi).name });
    return this.host.pickFile(title, [SourceFiles, AllFiles], this.startFolder());
  }

  /** The pickers start in the main file's folder, else where the last one was. */
  private startFolder(): string | null {
    const fs = this.host.fs;
    let near = this.mainFile !== null ? fs.directoryName(this.mainFile) : this.mainFiles.lastFolder;
    while (near !== null && !fs.directoryExists(near)) near = fs.directoryName(near);
    return near;
  }

  /** "Save resources…": the chapter's files of the course's own. */
  saveResources(): Promise<void> {
    return this.saveFiles({ kind: "resources", chapter: this.chapter, api: this.shownApi });
  }

  /** Saves files into a folder the learner picks, asking first when that would overwrite other contents. */
  private async saveFiles(files: FilesToSave): Promise<void> {
    const title = this.w.t("yourProject.saveFolderTitle", { chapter: this.chapterTitle(this.chapter, this.w.lang), api: Apis.get(this.shownApi).name });
    const target = await this.host.pickFolder(title, this.startFolder());
    if (target === null) return;
    await this.saveFilesTo(target, files);
  }

  private async saveFilesTo(target: string, files: FilesToSave): Promise<void> {
    const w = this.w;
    let conflicts: string[];
    try {
      conflicts = await this.host.course.conflicts(target, files);
    } catch (e) {
      w.toast(w.t("yourProject.copyFailed", { message: errorMessage(e) }));
      return;
    }
    if (conflicts.length === 0) {
      await this.writeFiles(target, files);
      return;
    }
    const list = conflicts.slice(0, 6).join(", ") + (conflicts.length > 6 ? ", …" : "");
    w.overlay.confirm(
      w.t("yourProject.copyConfirmTitle"),
      w.t("yourProject.copyConfirm", { count: conflicts.length, files: list }),
      w.t("yourProject.overwrite"),
      w.t("dialog.cancel"),
      true,
      () => void this.writeFiles(target, files),
    );
  }

  private async writeFiles(target: string, files: FilesToSave): Promise<void> {
    const w = this.w;
    let result;
    try {
      result = await this.host.course.save(target, files);
    } catch (e) {
      result = { error: errorMessage(e) };
    }
    if ("error" in result) {
      w.toast(w.t("yourProject.copyFailed", { message: result.error }));
      return;
    }
    // The learner's earlier code (from the old built-in editor) is then the code that is checked.
    if (result.mainFile !== null) this.setMainFile(result.mainFile);
    w.toast(w.t("yourProject.saved", { count: result.count }));
  }

  // ---------- Code from the old built-in editor ----------

  /** Where the app's old built-in editor saved the chapter's code (project.&lt;api&gt;.&lt;chapter&gt;.json). */
  private get oldCodeKey(): string {
    return `project.${this.shownApi}.${this.chapter}`;
  }

  private hasOldCode(): boolean {
    return this.chapter !== "" && this.w.storage.loadText(this.oldCodeKey) !== null;
  }

  /** "Save my earlier code…". */
  saveOldCode(): Promise<void> {
    const saved = loadJson(this.w.storage, this.oldCodeKey);
    if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return Promise.resolve();
    const files: Record<string, string> = {};
    for (const [k, v] of Object.entries(saved)) if (typeof v === "string") files[k] = v;
    if (Object.keys(files).length === 0) return Promise.resolve();
    return this.saveFiles({ kind: "oldCode", chapter: this.chapter, api: this.shownApi, files });
  }

  // ---------- The solution in a window of its own (GpTool.Solution.cs) ----------

  solutionWindow(_task: TaskInfo, index: number, close: () => void): ReactNode | null {
    const tasks = GpCourse.allTasks(this.chapter, this.shownApi);
    const task = tasks[index];
    if (index < 0 || task === undefined) return null;
    return (
      <SolutionView
        task={task}
        index={index}
        steps={GpCourse.tasks(this.chapter, this.shownApi).length}
        t={(k, a) => this.w.t(k, a)}
        copy={(code) => void this.copyToClipboard(code)}
        close={close}
      />
    );
  }

  // ---------- The smoke test (GpTool.SmokeTest.cs; the rest is in GpTool.SmokeTest.ts) ----------

  /**
   * Solves a task as a learner would: the start files are saved into a temporary folder in a structure of the
   * learner's own (the main file under src/, renamed), the course's solution written over them, the main file
   * picked and "Check my code" run. The task counts once the check has been handed to the window.
   */
  async solveForSmokeTest(task: TaskInfo): Promise<void> {
    const tasks = GpCourse.allTasks(this.chapter, this.shownApi);
    const index = tasks.findIndex((t) => GpCourse.taskKey(this.chapter, t.id, this.shownApi) === task.key);
    const main = await this.host.course.smokePrepare(this.chapter, this.shownApi, Math.max(0, index));
    if (this.mainFile !== main) this.setMainFile(main);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const r = await Promise.race([this.startCheck(), new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 60_000)))]);
    clearTimeout(timer);
    if (r === null) throw new Error(`The code in ${main} was not checked.`);
    if (index >= 0 && !r.tasks[index]!.passed) throw new Error(`The solution of ${task.key} did not pass its check: ${r.messages.map((m) => m.key).join("; ")}`);
    this.smokeChecks++;
  }

  /** How many checks of the learner's code the smoke test made. */
  get smokeCheckCount(): number {
    return this.smokeChecks;
  }

  /** The chapter (lesson) and API the panel shows. */
  get shown(): { chapter: string; api: string } {
    return { chapter: this.chapter, api: this.shownApi };
  }
}

function args(m: CheckMessage): Record<string, string> {
  return Object.fromEntries(m.args);
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The "Your project" panel of the tool (C#'s ProjectPanel control, drawn from the tool's model). */
function ProjectPanelView({ tool }: { tool: GpTool }) {
  useStore(tool.panel);
  const w = tool.window;
  const model = tool.panelModel();
  if (w === undefined || model === null) return null;
  const unlocked = w.isChapterUnlocked(model.chapterId);
  return (
    <ProjectPanel
      model={model}
      t={(k, a) => w.t(k, a)}
      // The window's task list (text, hints, solutions) sits in the panel once the tasks are unlocked; each task's
      // state comes from taskStatus.
      hostedTasks={unlocked && model.tasks.length > 0 ? w.taskList : null}
      draw={(c, a, t, width) => tool.host.course.draw(c, a, t, width)}
      events={{
        check: () => void tool.checkMyCode(false),
        changeFile: () => void tool.checkMyCode(true),
        save: () => void tool.saveResources(),
        saveOld: () => void tool.saveOldCode(),
        taskSelected: (i) => tool.selectTask(i),
        enlarge: (panel) => w.overlay.showDialog(panel, () => w.overlay.closeDialog(), Large + 48),
      }}
    />
  );
}

/**
 * Port of NoSandbox.cs: Codestead GP's lessons only have quiz questions, which need no sandbox. This one answers the
 * rare "try it" block with an empty output.
 */
const NoSandbox: ISandbox = {
  outputOf: () => "",
};
