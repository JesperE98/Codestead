/// <reference types="vite/client" />
// Port of Codestead.Linux/LinuxTool.cs and LinuxTool.Terminal.cs (one class here; the terminal's frame, the React
// part of LinuxTool.Terminal.cs, is in LinuxTool.Terminal.tsx).

import type { ProductMeta } from "@codestead/common";
import { type CommandFacts, CourseChapter, type GameRules, type Reference } from "@codestead/learning";
import { type Chapter, ChaptersLib, CommandInfo, I18nLib, LinuxGame, PicturesLib, ProgressLib, RenderLib, UiStrings } from "@codestead/linux-content";
import { type Distro, DistrosLib, type ExecResult, Shell, ShellSandbox, UtilCmd, World, WorldMigration } from "@codestead/linux-shell";
import {
  Changelog,
  type ChangelogEntry,
  type ISandbox,
  type LearningTool,
  type LearningWindow,
  RanEvent,
  type ResetAction,
  SandboxRun,
  type SelfUpdate,
  type TaskChip,
  type TaskInfo,
  type VariantGroup,
  type VariantOption,
} from "@codestead/ui";
import type { ReactNode } from "react";
import changelogJson from "../../../../src/Linux/changelog.json?raw";
import iconUrl from "../../../../src/Linux/Codestead.Linux/Assets/icon.png";
import { NoUpdates } from "./NoUpdates.js";
import { ProductInfo } from "./ProductInfo.js";
import { TerminalFrame, TerminalFrameState } from "./LinuxTool.Terminal.js";
import { TerminalView } from "./Terminal/TerminalView.js";

const FamilyOrder = ["debian", "arch", "redhat"];

const CourseChapters: readonly CourseChapter[] = ChaptersLib.chapters.map((c) => new CourseChapter(c.id, c.part, c.kind));

let changelogEntries: ChangelogEntry[] | null = null;

function chapterOf(id: string): Chapter {
  const c = ChaptersLib.chapters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`No chapter "${id}".`);
  return c;
}

function familyShort(f: string): string {
  return f === "debian" ? "Debian" : f === "arch" ? "Arch" : "Red Hat";
}

/**
 * Codestead Linux in the shared learning window: the Linux course, its texts, the distributions as variants and
 * the simulated terminal as the workbench.
 */
export class LinuxTool implements LearningTool {
  window?: LearningWindow;

  /** The terminal (C#'s TerminalView control). */
  readonly terminal = new TerminalView();
  /** The terminal's title bar (user@host and the Reset button). */
  readonly frame = new TerminalFrameState();
  private shellValue: Shell | null = null;
  private lastResult: ExecResult | null = null;
  private readonly ran = new RanEvent();

  /** @param selfUpdate The app's own updates (C#'s LearningWindow makes a Velopack SelfUpdate; the app passes the preload's). */
  constructor(readonly selfUpdate: SelfUpdate = NoUpdates) {
    this.terminal.onCommandExecuted((r) => this.onTerminalResult(r));
  }

  private get w(): LearningWindow {
    if (this.window === undefined) throw new Error("The tool is not in a window yet.");
    return this.window;
  }

  /** The learner's language (C#'s LearningTool.Lang). */
  get lang(): string {
    return this.w.lang;
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

  // ---------- The course ----------

  /** The distribution a chapter runs on: the learner's choice in the distro main chapter, Ubuntu elsewhere. */
  private distroOf(chapter: Chapter): Distro {
    return DistrosLib.getDistro(ChaptersLib.distroFor(chapter, this.w.chosenVariant ?? ChaptersLib.DefaultDistro));
  }

  readonly parts: readonly string[] = ChaptersLib.parts.map((p) => p.id);

  get chapters(): readonly CourseChapter[] {
    return CourseChapters;
  }

  chapterTitle(chapterId: string, lang: string): string {
    return I18nLib.chapterTitle(chapterOf(chapterId), lang);
  }

  languagesWithText(chapterId: string): readonly string[] {
    return I18nLib.languagesWithMarkdown(chapterOf(chapterId));
  }

  rawText(chapterId: string, lang: string): string {
    return I18nLib.chapterMarkdown(chapterOf(chapterId), lang);
  }

  lessonText(chapterId: string, lang: string): string {
    const chapter = chapterOf(chapterId);
    return RenderLib.preprocess(I18nLib.chapterMarkdown(chapter, lang), this.distroOf(chapter), lang);
  }

  /**
   * A picture of the chapters' texts (`![alt](images/fs-tree.webp "caption")`): the one in the learner's language
   * (images/sv/fs-tree.webp), else the English one, else the shared one – as the URL of the built app's copy.
   */
  picture(path: string, lang: string): string | null {
    return PicturesLib.url(path, lang);
  }

  references(chapterId: string): readonly Reference[] {
    return I18nLib.references(chapterOf(chapterId));
  }

  taskKeys(chapterId: string): readonly string[] {
    const chapter = chapterOf(chapterId);
    const family = this.distroOf(chapter).family;
    return chapter.tasks.map((t) => ChaptersLib.taskKey(chapter.id, t.id, t.perFamily, family));
  }

  tasks(chapterId: string, lang: string): readonly TaskInfo[] {
    const chapter = chapterOf(chapterId);
    const d = this.distroOf(chapter);
    const world = this.shellValue?.world ?? World.get(lang);
    return chapter.tasks.map((task) => {
      const hint = I18nLib.taskHint(chapter, task, lang, d);
      const chips: TaskChip[] =
        task.perFamily === true
          ? FamilyOrder.map((f) => ({ label: familyShort(f), key: ChaptersLib.taskKey(chapter.id, task.id, true, f), current: f === d.family }))
          : [];
      return {
        key: ChaptersLib.taskKey(chapter.id, task.id, task.perFamily, d.family),
        text: RenderLib.preprocess(I18nLib.taskText(chapter, task, lang, d), d, lang),
        hint: hint === null ? null : RenderLib.preprocess(hint, d, lang),
        solution: task.solutionFor(d, world),
        chips,
      };
    });
  }

  get rules(): GameRules {
    return LinuxGame.rules;
  }

  chapterCommands(chapterId: string): readonly string[] {
    const chapter = chapterOf(chapterId);
    const d = this.distroOf(chapter);
    return LinuxGame.chapterCommands(chapter, d, this.shellValue?.world ?? World.get(this.lang));
  }

  progressTitle(done: number, total: number): string {
    const family = (this.shellValue?.distro ?? DistrosLib.getDistro(ChaptersLib.DefaultDistro)).family;
    return this.w.t("progress.title", { done, total, family: this.w.t(`family.${family}`) });
  }

  // ---------- Distributions as variants ----------

  variants(chapterId: string): readonly VariantGroup[] {
    // Only the distributions this chapter can run on (a family chapter: that family's).
    const choices = ChaptersLib.distrosFor(chapterOf(chapterId));
    return FamilyOrder.filter((f) => choices.some((d) => d.family === f)).map((f) => ({
      label: this.w.t(`family.${f}`),
      options: choices.filter((d) => d.family === f).map((d) => ({ id: d.id, name: d.name })),
    }));
  }

  currentVariant(chapterId: string): string {
    return this.distroOf(chapterOf(chapterId)).id;
  }

  /** The tr tasks left "Text processing" when it moved from the basics to scripts (0.6.2). */
  readonly movedTasks: ReadonlyMap<string, string> = new Map([
    ["textbearbetning/tr-upper", "pipes/tr-upper"],
    ["textbearbetning/tr-path", "miljo/tr-path"],
  ]);

  normalizeVariant(chosen: string | null): string | null {
    return DistrosLib.getDistro(chosen ?? ChaptersLib.DefaultDistro).id;
  }

  variantChosen(_variantId: string): void {
    // The window saves the choice; chapterShown then switches the terminal.
  }

  get allVariants(): readonly VariantOption[] {
    return DistrosLib.distros.map((d) => ({ id: d.id, name: d.name }));
  }

  // ---------- The workbench: a simulated terminal per distribution, saved between runs ----------

  private get shell(): Shell {
    if (this.shellValue === null) throw new Error("No chapter has been shown yet.");
    return this.shellValue;
  }

  private get distro(): Distro {
    return this.shell.distro;
  }

  /** The terminal with its title bar (three dots, user@host, "Reset"). */
  workbench(): ReactNode {
    return <TerminalFrame tool={this} />;
  }

  private updateTitle(): void {
    this.frame.setTitle(`${this.shell.currentUser().name}@${this.distro.hostname} — ${this.distro.name}`);
  }

  onRan(listener: (run: SandboxRun) => void): () => void {
    return this.ran.listen(listener);
  }

  inject(command: string): void {
    this.terminal.inject(command);
  }

  focusWorkbench(): void {
    this.terminal.focusInput();
  }

  run(command: string): void {
    this.onTerminalResult(this.shell.execute(command));
  }

  private onTerminalResult(result: ExecResult): void {
    this.saveShell();
    this.updateTitle();
    this.lastResult = result;
    this.ran.raise(new SandboxRun(result.line, UtilCmd.stripAnsi(result.output), result.exitCode, !result.pending && !result.incomplete));
  }

  evaluate(chapterId: string, _run: SandboxRun, completed: ReadonlyMap<string, boolean>): readonly string[] {
    return this.lastResult === null ? [] : ProgressLib.evaluateTasks(chapterOf(chapterId), this.shell, this.lastResult, completed);
  }

  analyze(run: SandboxRun): CommandFacts | null {
    return CommandInfo.analyze(run.line, run.output, run.exitCode);
  }

  sandbox(chapterId: string): ISandbox {
    return new ShellSandbox(this.distroOf(chapterOf(chapterId)).id, this.lang);
  }

  // ---------- Events from the window ----------

  /** Switches the terminal to the chapter's distribution (Ubuntu outside the distro main chapter). */
  chapterShown(chapterId: string): void {
    const id = ChaptersLib.distroFor(chapterOf(chapterId), this.w.chosenVariant ?? ChaptersLib.DefaultDistro);
    if (this.shellValue !== null && id === this.shellValue.distro.id) return;
    if (this.shellValue !== null) this.saveShell();
    this.shellValue = this.loadShell(id);
    this.terminal.shell = this.shellValue;
  }

  languageChanged(lang: string): void {
    // The exercise files, folders and the user get names and texts in the new language (see World.ts).
    WorldMigration.translate(this.shell, lang);
    this.saveShell();
  }

  textsApplied(): void {
    this.shell.lang = this.lang;
    this.terminal.inputLabel = this.w.t("terminal.input");
    this.frame.setReset("↺  " + this.w.t("terminal.reset"), this.w.t("terminal.resetTitle"));
  }

  rendered(): void {
    this.updateTitle();
  }

  save(): void {
    this.saveShell();
  }

  resets(): readonly ResetAction[] {
    const w = this.w;
    return [
      {
        title: w.t("reset.terminal.title"),
        description: w.t("reset.terminal.desc", { distro: this.distro.name }),
        button: w.t("reset.terminal.button"),
        run: () => this.confirmResetTerminal(),
      },
    ];
  }

  private loadShell(distroId: string): Shell {
    const sh = Shell.restoreJson(this.w.storage.loadText(`shell.${distroId}`)) ?? Shell.create(distroId, this.lang);
    sh.lang = this.lang;
    // A terminal saved in another language: its exercise files and user follow the current language.
    WorldMigration.translate(sh, this.lang);
    return sh;
  }

  private saveShell(): void {
    if (this.shellValue !== null) this.w.storage.saveText(`shell.${this.shellValue.distro.id}`, this.shellValue.snapshotJson());
  }

  /** Asks, then gives the current distribution a new computer. */
  confirmResetTerminal(): void {
    const w = this.w;
    w.overlay.confirm(w.t("reset.terminal.title"), w.t("reset.terminal.confirm", { distro: this.distro.name }), w.t("reset.terminal.button"), w.t("dialog.cancel"), true, () => {
      w.storage.remove(`shell.${this.distro.id}`);
      const sh = Shell.create(this.distro.id, this.lang);
      sh.lang = this.lang;
      this.shellValue = sh;
      this.terminal.shell = sh;
      w.refresh();
      w.toast(w.t("toast.terminalReset"));
    });
  }
}
