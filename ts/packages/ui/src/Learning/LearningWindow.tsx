import { Languages } from "@codestead/common";
import {
  Checkpoint,
  type CourseChapter,
  ChapterKinds,
  DateOnly,
  type GameEvents,
  GameRules,
  GameState,
  LearningState,
  ProgressView,
  SolvedTask,
} from "@codestead/learning";
import type { ReactNode } from "react";
import { NewsDialog } from "../App/NewsDialog.js";
import { ThemeSwitcher } from "../App/ThemeSwitcher.js";
import { Changelog } from "../Changelog.js";
import type { ChangelogEntry } from "../ChangelogEntry.js";
import type { CheckpointHandle } from "../Controls/CheckpointView.js";
import type { CheckpointTexts } from "../Controls/CheckpointTexts.js";
import { Overlay } from "../Controls/Dialogs.js";
import type { GameBarHandle } from "../Controls/Game/Views/GameBar.js";
import { Notices } from "../Controls/Game/Views/NoticeLayer.js";
import { LinkOpener } from "../Controls/MarkdownView.js";
import type { SandboxRun } from "../Controls/Sandbox/SandboxRun.js";
import { loadJson, saveJson, type Storage } from "../Storage.js";
import { Store } from "../Store.js";
import { WindowGame } from "./LearningWindow.Game.js";
import type { LearningTool, TaskInfo } from "./LearningTool.js";
import { SettingsPanel } from "./Settings.js";
import { TaskList } from "./Tasks.js";

export interface LearningWindowOptions {
  /** The tool's data folder (C#: new Storage(tool.Product.Id)); the window saves state.json and profile.json there. */
  storage: Storage;
  /** --smoke-test: no notices, no profile.json, no focus changes. */
  smokeTest?: boolean;
  /** The local time (tests). */
  now?: () => Date;
}

/**
 * The learning window every tool shares: top bar, chapter list, lesson text with checkpoints, exams, tasks and the
 * tool's workbench (Codestead Linux: the terminal) – sidebar | lesson | workbench. Everything that depends on the
 * tool comes from its {@link LearningTool}.
 *
 * This object holds the window's state and does what the C# window does; {@link LearningWindowView} shows it (React
 * re-renders on every change instead of the C# Render* methods, which here only say what to rebuild).
 */
export class LearningWindow extends Store {
  /** How many own attempts a task needs before its solution can be shown (unless the hint was opened). */
  static readonly AttemptsBeforeSolution = 3;
  /** Percentage needed to pass an exam. */
  static readonly ExamPassPercent = GameRules.ExamPassPercent;

  readonly tool: LearningTool;
  /** The tool's data folder (the window saves state.json there). */
  readonly storage: Storage;
  /** What is saved between runs. */
  state: LearningState;
  readonly smokeTest: boolean;
  /** The overlay for the tool's dialogs and notices. */
  readonly overlay = new Overlay();
  /** The achievement notices at the top corner. */
  readonly notices = new Notices();
  /** True when the app had saved progress at start (so a missing "seen" version means an update, not a new installation). */
  readonly existingUser: boolean;
  readonly now: () => Date;
  readonly game: WindowGame;

  /** Tasks just completed (shown fresh for two seconds). */
  justCompleted: readonly string[] = [];
  private freshTimer: ReturnType<typeof setTimeout> | null = null;

  /** The top bar's game widget, set by the view. */
  gameBar: GameBarHandle | null = null;
  /** The checkpoints shown now (index → view): every command line run in the terminal is passed on to them. */
  readonly checkpointViews = new Map<number, CheckpointHandle>();

  /** Bumped when the lesson (with its checkpoints) is built anew, as C#'s RenderLesson. */
  lessonKey = 0;
  /** Bumped when the task list is built anew (open hints and solutions close), as C#'s RenderTasks. */
  tasksKey = 0;
  /** Bumped by every RenderAll (the view then calls the tool's rendered()). */
  renderCount = 0;

  private readonly checkpointCounts = new Map<string, number>();
  private wasOpened = false;
  private stopListening: (() => void) | null = null;

  constructor(tool: LearningTool, options: LearningWindowOptions) {
    super();
    this.tool = tool;
    tool.window = this;
    this.smokeTest = options.smokeTest ?? false;
    this.now = options.now ?? (() => new Date());
    this.storage = options.storage;
    const saved = LearningState.fromJson(loadJson(this.storage, LearningState.FileName));
    this.existingUser = saved !== null;
    this.state = saved ?? new LearningState();
    const state = this.state;
    if (!Languages.isOffered(state.lang)) state.lang = Languages.default;
    state.variant = tool.normalizeVariant ? tool.normalizeVariant(state.variant) : state.variant;
    if (state.moveTasks(tool.movedTasks ?? new Map())) this.saveState();
    if (state.chapter === null || tool.chapters.every((c) => c.id !== state.chapter)) state.chapter = tool.chapters[0]!.id;
    tool.chapterShown?.(this.chapter.id);

    this.game = new WindowGame(this);
    this.game.init();
    this.stopListening = tool.onRan((run) => this.onResult(run));
    this.applyTheme();
    this.applyLanguage();
  }

  // ---------- What the tool can use ----------

  /** The learner's language. */
  get lang(): string {
    return this.state.lang ?? Languages.default;
  }

  /** The variant the learner chose (null: the tool's default). */
  get chosenVariant(): string | null {
    return this.state.variant;
  }

  /** A user-interface text in the learner's language. */
  t(key: string, args?: Readonly<Record<string, unknown>>): string {
    return this.tool.translate(this.lang, key, args);
  }

  /** Re-renders everything (e.g. after the workbench was reset). */
  refresh(): void {
    this.renderAll();
  }

  /** Are a chapter's tasks unlocked (its text worked through)? */
  isChapterUnlocked(chapterId: string): boolean {
    const c = this.chapters.find((x) => x.id === chapterId);
    return c !== undefined && this.isUnlocked(c);
  }

  /** Is a task done (by its progress key)? */
  isTaskDone(key: string): boolean {
    return this.state.progress.has(key);
  }

  /**
   * The chapter's task list (header, progress, tasks with hints and solutions), for a tool that
   * {@link LearningTool.hostsTasks hosts the tasks} in its workbench.
   */
  get taskList(): ReactNode {
    return <TaskList window={this} />;
  }

  /** The questions in a chapter's text: how many are answered, and how many there are (0: none). */
  checkpointProgress(chapterId: string): { done: number; total: number } {
    const c = this.chapters.find((x) => x.id === chapterId);
    return c ? { done: this.solvedCheckpoints(c), total: this.checkpointCount(c) } : { done: 0, total: 0 };
  }

  /** Re-renders the task list (a tool whose taskStatus changed). */
  refreshTasks(): void {
    this.renderTasks();
  }

  /**
   * Something the tool's achievements look at changed outside a command (Codestead GP: the first project folder):
   * the game is brought up to date and new achievements are shown.
   */
  refreshGame(): void {
    this.game.present(this.tool.rules.sync(this.state.game, this.snapshot(), this.now()));
  }

  /** Shows a short notice at the bottom of the window. */
  toast(text: string): void {
    this.overlay.toast(text);
  }

  /** The window's title: "Chapter – Product". */
  get title(): string {
    return `${this.tool.chapterTitle(this.chapter.id, this.lang)} – ${this.tool.product.name}`;
  }

  /** "rtl" for a right-to-left language. */
  get dir(): "ltr" | "rtl" {
    return Languages.find(this.lang)?.dir === "rtl" ? "rtl" : "ltr";
  }

  // ---------- Helpers ----------

  get chapters(): readonly CourseChapter[] {
    return this.tool.chapters;
  }

  lessonsIn(part: string): CourseChapter[] {
    return this.chapters.filter((c) => c.part === part && c.isLesson);
  }

  static checkpointKey(chapter: CourseChapter, index: number): string {
    return `${chapter.id}#${index}`;
  }

  /** Number of checkpoints in a chapter text (the same in every language; the English text is the source). */
  checkpointCount(chapter: CourseChapter): number {
    let n = this.checkpointCounts.get(chapter.id);
    if (n === undefined) {
      n = Checkpoint.parseAll(this.tool.rawText(chapter.id, "en")).length;
      this.checkpointCounts.set(chapter.id, n);
    }
    return n;
  }

  solvedCheckpoints(chapter: CourseChapter): number {
    let n = 0;
    for (let i = 0; i < this.checkpointCount(chapter); i++) if (this.state.checkpoints.has(LearningWindow.checkpointKey(chapter, i))) n++;
    return n;
  }

  /** The keys of a chapter's tasks for its current variant. */
  taskKeys(chapter: CourseChapter): readonly string[] {
    return this.tool.taskKeys(chapter.id);
  }

  chapterProgress(chapter: CourseChapter): { done: number; total: number } {
    const keys = this.taskKeys(chapter);
    return { done: keys.filter((k) => this.state.progress.get(k) === true).length, total: keys.length };
  }

  /**
   * Are the tasks unlocked? Only after the learner has worked through the text:
   * all checkpoints answered, or (in a text without checkpoints) marked as read.
   * Chapters where a task is already done stay unlocked.
   */
  isUnlocked(chapter: CourseChapter): boolean {
    if (chapter.isProject) return this.isProjectOpen(chapter);
    if (this.taskKeys(chapter).some((k) => this.state.progress.has(k))) return true;
    const total = this.checkpointCount(chapter);
    return total > 0 ? this.solvedCheckpoints(chapter) === total : this.state.read.includes(chapter.id);
  }

  /** A lesson is complete when it is unlocked and all of its tasks are done. */
  isLessonComplete(chapter: CourseChapter): boolean {
    const { done, total } = this.chapterProgress(chapter);
    return done === total && this.isUnlocked(chapter);
  }

  /** An exam opens when every sub-chapter of its main chapter is complete. */
  isExamOpen(exam: CourseChapter): boolean {
    return this.lessonsIn(exam.part).every((l) => this.isLessonComplete(l));
  }

  /** The exam of a main chapter, if it has one. */
  examOf(part: string): CourseChapter | undefined {
    return this.chapters.find((c) => c.part === part && c.kind === ChapterKinds.Exam);
  }

  /** The optional project of a main chapter, if it has one. */
  projectOf(part: string): CourseChapter | undefined {
    return this.chapters.find((c) => c.part === part && c.isProject);
  }

  /**
   * The optional project opens when its main chapter's exam is passed (in a main chapter without an exam: when every
   * sub-chapter is complete). A project where a milestone is already done stays open.
   */
  isProjectOpen(project: CourseChapter): boolean {
    if (this.taskKeys(project).some((k) => this.state.progress.has(k))) return true;
    const exam = this.examOf(project.part);
    if (exam === undefined) return this.isExamOpen(project);
    return (this.state.exams.get(project.part) ?? 0) >= LearningWindow.ExamPassPercent;
  }

  /** A project is complete when it is open and every milestone is done. */
  isProjectComplete(project: CourseChapter): boolean {
    const { done, total } = this.chapterProgress(project);
    return total > 0 && done === total && this.isProjectOpen(project);
  }

  checkpointTexts(): CheckpointTexts {
    const t = (k: string) => this.t(k);
    return {
      check: t("checkpoint.check"),
      correct: t("checkpoint.correct"),
      wrong: t("checkpoint.wrong"),
      predictPrompt: t("checkpoint.predict"),
      tryPrompt: t("checkpoint.try"),
      done: t("checkpoint.done"),
      answerPlaceholder: t("checkpoint.answer"),
      question: t("checkpoint.question"),
      showAnswer: t("checkpoint.showAnswer"),
      almostPath: t("checkpoint.almostPath"),
    };
  }

  get chapterIndex(): number {
    return Math.max(
      0,
      this.chapters.findIndex((c) => c.id === this.state.chapter),
    );
  }

  get chapter(): CourseChapter {
    return this.chapters[this.chapterIndex]!;
  }

  get lessons(): CourseChapter[] {
    return this.chapters.filter((c) => c.isLesson);
  }

  saveState(): void {
    saveJson(this.storage, LearningState.FileName, this.state);
  }

  /** Saves the workbench and the state (when the window closes). */
  saveAll(): void {
    this.tool.save?.();
    this.saveState();
  }

  /** The window is closing: saves everything and stops listening to the tool. */
  close(): void {
    this.saveAll();
    this.stopListening?.();
    this.stopListening = null;
    if (this.freshTimer) clearTimeout(this.freshTimer);
  }

  /** Opens a web link in the browser: only http and https. */
  openLink(url: string): void {
    LinkOpener.open(url);
  }

  /** The progress as the game rules see it. */
  snapshot(): ProgressView {
    const { done, total } = this.totalProgress();
    const s = this.state;
    return new ProgressView(
      [...s.progress].filter(([, v]) => v).map(([k]) => k),
      [...s.checkpoints.values()].filter((v) => v).length,
      s.exams,
      new Set(this.lessons.filter((c) => this.isLessonComplete(c)).map((c) => c.id)),
      done,
      total,
      new Set(this.chapters.filter((c) => c.isProject && this.isProjectComplete(c)).map((c) => c.part)),
    );
  }

  /** The total progress (top bar): tasks done of all tasks. The optional projects are not counted. */
  totalProgress(): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const ch of this.chapters) {
      if (ch.isProject) continue;
      const p = this.chapterProgress(ch);
      done += p.done;
      total += p.total;
    }
    return { done, total };
  }

  // ---------- Rendering (what the C# Render* methods rebuild) ----------

  /** Re-renders the view (C#'s RenderProgress, RenderSidebar, RenderWorkbench, UpdateGameViews). */
  render(): void {
    this.changed();
  }

  renderLesson(): void {
    this.lessonKey++;
    this.changed();
  }

  renderTasks(): void {
    this.tasksKey++;
    this.changed();
  }

  renderAll(): void {
    this.renderCount++;
    this.lessonKey++;
    this.tasksKey++;
    this.changed();
  }

  private applyLanguage(): void {
    this.tool.textsApplied?.();
    this.renderAll();
  }

  /** The window was opened (the view is on screen): the news after an update, the update offer, the game's welcome. */
  opened(): void {
    if (this.wasOpened || this.smokeTest) return;
    this.wasOpened = true;
    this.tool.focusWorkbench();
    // After an update: what changed. The update offer waits until the news are closed.
    if (!this.showNewsAfterUpdate()) void this.offerUpdate();
    this.game.opened();
  }

  /** The tasks were unlocked: the workbench and sidebar change, and the tool is told. */
  unlocked(): void {
    this.render();
    this.tool.tasksUnlocked?.(this.chapter.id);
    if (!this.smokeTest) this.tool.focusWorkbench();
  }

  // ---------- The lesson ----------

  /** A question in the text was answered right (lesson mode). */
  checkpointSolved(chapter: CourseChapter, index: number): void {
    const wasUnlocked = this.isUnlocked(chapter);
    this.state.checkpoints.set(LearningWindow.checkpointKey(chapter, index), true);
    this.saveState();
    const ev = this.tool.rules.onCheckpoint(this.state.game, this.snapshot(), this.now());
    this.game.present(ev);
    if (chapter.id !== this.chapter.id) return;
    if (!wasUnlocked && this.isUnlocked(chapter)) {
      this.overlay.toast(this.t("gate.unlocked"));
      this.unlocked();
    } else {
      this.render();
    }
  }

  /** A lesson without checkpoints: the student confirms having read it. */
  markRead(chapter: CourseChapter): void {
    if (!this.state.read.includes(chapter.id)) this.state.read.push(chapter.id);
    this.saveState();
    this.overlay.toast(this.t("gate.unlocked"));
    this.unlocked();
    this.game.present(this.tool.rules.sync(this.state.game, this.snapshot(), this.now()));
  }

  /** Hands in the exam of a main chapter: grades every question and saves the best result. */
  submitExam(chapter: CourseChapter): { score: number; total: number; percent: number; passed: boolean } {
    const views = [...this.checkpointViews.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v)
      .filter((v) => v.examMode);
    // Every question is graded (C#'s Count(v => v.Grade()) runs them all).
    const score = views.map((v) => v.grade()).filter(Boolean).length;
    const percent = views.length === 0 ? 100 : Math.floor((100 * score) / views.length);
    const old = this.state.exams.get(chapter.part);
    if (old === undefined || percent > old) this.state.exams.set(chapter.part, percent);
    this.saveState();
    this.render();
    this.game.present(this.tool.rules.onExam(this.state.game, this.snapshot(), chapter.part, percent, this.now()));
    return { score, total: views.length, percent, passed: percent >= LearningWindow.ExamPassPercent };
  }

  // ---------- The tasks ----------

  /** The hint of a task was opened (it also unlocks the solution). */
  hintShown(key: string): void {
    if (this.state.hintSeen.includes(key)) return;
    this.state.hintSeen.push(key);
    this.saveState();
  }

  /** The solution of a task was shown: solving it no longer counts as "without help". */
  solutionShown(key: string): void {
    if (this.state.progress.has(key) || this.state.game.solutionSeen.includes(key)) return;
    GameRules.onSolutionShown(this.state.game, key);
    this.saveState();
  }

  /** Can the solution be shown: done, enough own attempts, or the hint opened. */
  solutionUnlocked(key: string): boolean {
    return this.state.progress.has(key) || this.attempts(key) >= LearningWindow.AttemptsBeforeSolution || this.state.hintSeen.includes(key);
  }

  attempts(key: string): number {
    return this.state.attempts.get(key) ?? 0;
  }

  /** The solution button was clicked: a tool's own solution window, if it has one (true), else the solution opens under the task. */
  openSolutionWindow(task: TaskInfo, index: number): boolean {
    const close = () => this.overlay.closeDialog();
    const window = this.tool.solutionWindow?.(task, index, close);
    if (window == null) return false;
    // A tool can show the solution in a window of its own; it counts as seen all the same.
    this.solutionShown(task.key);
    this.overlay.showDialog(window, close, 720);
    return true;
  }

  // ---------- Moving between chapters, the workbench, variant and language ----------

  /** Shows another chapter. */
  navigate(id: string): void {
    this.state.chapter = id;
    this.justCompleted = [];
    this.saveState();
    this.tool.chapterShown?.(this.chapter.id);
    this.renderAll();
  }

  private onResult(result: SandboxRun): void {
    // The "try it" questions in the text are answered in the terminal (this may unlock the tasks).
    for (const view of [...this.checkpointViews.values()]) view.commandRan(result);
    const chapter = this.chapter;
    const state = this.state;
    // Locked tasks are not checked: the text comes first, even though the terminal is already there.
    const tasksOpen = (chapter.kind === ChapterKinds.Lesson || chapter.isProject) && this.isUnlocked(chapter);
    const newly = tasksOpen ? [...this.tool.evaluate(chapter.id, result, state.progress)] : [];
    // Every finished command line counts as an attempt for the tasks that are not done yet.
    let solutionUnlocked = false;
    if (tasksOpen && result.finished && result.line.trim() !== "") {
      for (const key of this.taskKeys(chapter)) {
        if (state.progress.has(key) || newly.includes(key)) continue;
        const n = this.attempts(key) + 1;
        if (n > LearningWindow.AttemptsBeforeSolution) continue;
        state.attempts.set(key, n);
        if (n === LearningWindow.AttemptsBeforeSolution) solutionUnlocked = true;
      }
    }
    for (const k of newly) state.progress.set(k, true);
    // The game counts every finished command line (statistics, hidden achievements) and the solved tasks.
    let ev: GameEvents | null = null;
    if (result.finished && result.line.trim() !== "") {
      const solved = newly.map((k) => new SolvedTask(k, state.hintSeen.includes(k) || state.game.solutionSeen.includes(k)));
      ev = this.tool.rules.onCommand(state.game, this.snapshot(), this.tool.analyze(result), chapter.id, solved, this.now());
    }
    if (newly.length === 0) {
      if (solutionUnlocked || ev?.changed === true) this.saveState();
      if (solutionUnlocked) this.renderTasks();
      if (ev !== null) this.game.present(ev);
      return;
    }
    this.saveState();
    this.justCompleted = newly;
    this.renderTasks();
    if (this.freshTimer) clearTimeout(this.freshTimer);
    this.freshTimer = setTimeout(() => {
      this.justCompleted = [];
      this.renderTasks();
    }, 2000);
    if (ev !== null) this.game.present(ev);
  }

  /** Chooses another variant (Codestead Linux: distribution). */
  changeVariant(id: string): void {
    if (id === this.state.variant) return;
    this.tool.save?.();
    this.state.variant = id;
    this.saveState();
    this.tool.variantChosen(id);
    this.tool.chapterShown?.(this.chapter.id);
    this.renderAll();
  }

  changeLanguage(code: string): void {
    if (code === this.lang || !Languages.isOffered(code)) return;
    this.state.lang = code;
    this.saveState();
    this.tool.languageChanged?.(code);
    this.applyLanguage();
  }

  // ---------- Settings ----------

  applyTheme(): void {
    ThemeSwitcher.apply(this.state.theme);
  }

  setTheme(theme: string | null): void {
    this.state.theme = theme;
    this.saveState();
    this.applyTheme();
    this.render();
  }

  confirmResetProgress(): void {
    this.overlay.confirm(this.t("reset.progress.title"), this.t("reset.progress.confirm"), this.t("reset.progress.button"), this.t("dialog.cancel"), true, () => {
      const s = this.state;
      s.progress = new Map();
      s.checkpoints = new Map();
      s.read = [];
      s.attempts = new Map();
      s.hintSeen = [];
      s.exams = new Map();
      this.resetGame();
      this.saveState();
      this.renderAll();
      this.overlay.toast(this.t("toast.progressReset"));
    });
  }

  private resetGame(): void {
    this.state.game = new GameState();
    this.tool.rules.sync(this.state.game, this.snapshot(), this.now());
    this.game.writeProfile();
  }

  openSettings(): void {
    const close = () => this.overlay.closeDialog();
    this.overlay.showDialog(<SettingsPanel window={this} />, close, 640);
  }

  // ---------- "What's new" after an update and the offer to update ----------

  /** Shows "What's new" if the app was updated since it last ran. Returns false if there was nothing to show. */
  private showNewsAfterUpdate(): boolean {
    const news = Changelog.newsAtStart(this.storage, this.tool.changelog, this.tool.product.version, this.existingUser);
    if (news.length === 0) return false;
    this.showNews(news, () => void this.offerUpdate());
    return true;
  }

  /** The "What's new" dialog for some versions (newest first). */
  showNews(entries: Iterable<ChangelogEntry>, afterClose?: () => void): void {
    NewsDialog.show(
      this.overlay,
      { title: this.t("whatsnew.title", { name: this.tool.product.name }), version: this.t("whatsnew.version"), close: this.t("whatsnew.close") },
      entries,
      this.lang,
      afterClose,
    );
  }

  /**
   * Installed so that it can update itself (Velopack, or a native package and the system's package manager), the app
   * offers a newer version. Installed by the hub, the hub does it instead.
   */
  private async offerUpdate(): Promise<void> {
    const updater = this.tool.selfUpdate;
    if (!updater?.canUpdateItself) return;
    let version: string | null;
    try {
      version = await updater.check();
    } catch {
      return; // Offline or the release server is unavailable – try again next start.
    }
    if (version === null) return;
    const text = this.t("update.text", { version }) + (updater.asksForPassword === true ? " " + this.t("update.password") : "");
    this.overlay.showWhenFree(() =>
      this.overlay.confirm(this.t("update.title"), text, this.t("update.button"), this.t("update.later"), false, () => {
        this.overlay.toast(this.t("update.downloading"), 30);
        this.saveAll();
        let installing = false;
        updater
          .downloadAndRestart((percent) => {
            if (percent >= 0 || installing) return;
            installing = true;
            this.overlay.toast(this.t("update.installing"), 120);
          })
          .catch((e: unknown) => this.updateFailed(e instanceof Error ? e.message : String(e)));
      }),
    );
  }

  /** The update could not be installed (say, the password dialog was closed): its release page instead. */
  private updateFailed(error: string): void {
    const product = this.tool.product;
    this.overlay.showWhenFree(() =>
      this.overlay.confirm(this.t("update.failedTitle"), this.t("update.failed", { error }), this.t("update.download"), this.t("update.later"), false, () =>
        this.openLink(`https://github.com/${product.releasesRepo}/releases/tag/${product.id}-latest`),
      ),
    );
  }

  /** The streak shown today. */
  streakToday(): { shown: number; today: boolean } {
    return GameRules.streakAt(this.state.game, DateOnly.fromDate(this.now()));
  }
}
