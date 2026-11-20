import type { ProductMeta } from "@codestead/common";
import type { CommandFacts, CourseChapter, GameRules, Reference } from "@codestead/learning";
import type { ReactNode } from "react";
import type { ChangelogEntry } from "../ChangelogEntry.js";
import type { MarkdownPicture } from "../Controls/MarkdownView.js";
import type { ISandbox } from "../Controls/Sandbox/ISandbox.js";
import type { SandboxRun } from "../Controls/Sandbox/SandboxRun.js";
import type { SelfUpdate } from "../SelfUpdate.js";
import type { LearningWindow } from "./LearningWindow.js";

// Port of Codestead.Learning.UI: LearningTool.cs, TaskInfo.cs, TaskChip.cs, VariantGroup.cs, VariantOption.cs and
// ResetAction.cs.

/** A variant group of a task counted per group: its label, the progress key and whether it is the current one. */
export interface TaskChip {
  label: string;
  key: string;
  current: boolean;
}

/** A task as the window shows it, already in the learner's language and variant. */
export interface TaskInfo {
  /** The key its progress is saved under. */
  key: string;
  /** The task (markdown). */
  text: string;
  /** The hint (markdown), or null. */
  hint: string | null;
  /** Commands that solve it (shown after a few attempts or the hint). */
  solution: readonly string[];
  /** For a task counted per variant group: one chip per group (e.g. Debian, Arch, Red Hat). */
  chips: readonly TaskChip[];
  /** The group the task belongs to (a heading where the group starts), or null. */
  section?: string | null;
}

/** A variant the learner can choose (Codestead Linux: a distribution). */
export interface VariantOption {
  id: string;
  name: string;
}

/** A group in the variant picker (Codestead Linux: a distribution family) and its variants. */
export interface VariantGroup {
  label: string;
  options: readonly VariantOption[];
}

/** A reset in the settings' danger zone (e.g. "Reset the terminal"); `run` asks first. */
export interface ResetAction {
  title: string;
  description: string;
  button: string;
  run: () => void;
}

/**
 * What a tool gives the shared {@link LearningWindow}: its course, its texts, its variants (Codestead Linux: the
 * distributions) and its workbench (Codestead Linux: the terminal). Everything the window shows comes from here,
 * already in the learner's language, so the window itself knows nothing about Linux.
 *
 * C#'s abstract class LearningTool: its abstract members are required here, its virtual ones optional (the window
 * uses the C# default when a tool leaves one out).
 */
export interface LearningTool {
  /** The window, set when it is created (to show dialogs, re-render, …). */
  window?: LearningWindow;

  // ---------- The product ----------

  readonly product: ProductMeta;

  /** The window and top bar icon (a URL the renderer can load, e.g. of build/icons/&lt;id&gt;.svg). */
  readonly iconUrl: string;

  /** The tool's "What's new" (its changelog), newest first. */
  readonly changelog: readonly ChangelogEntry[];

  /** A user-interface text in a language, with its {placeholders} filled in. */
  translate(lang: string, key: string, args?: Readonly<Record<string, unknown>>): string;

  // ---------- The course ----------

  /** The main chapters, in order (titles are the texts "part.&lt;id&gt;"). */
  readonly parts: readonly string[];

  /** Every chapter (lessons, summaries, exams) in course order. */
  readonly chapters: readonly CourseChapter[];

  chapterTitle(chapterId: string, lang: string): string;

  /** The languages the chapter's text exists in. */
  languagesWithText(chapterId: string): ReadonlySet<string> | readonly string[];

  /** The chapter's text as written, in a language (the checkpoints are counted in the English one). */
  rawText(chapterId: string, lang: string): string;

  /** The chapter's text ready to show: in the language, for the chapter's variant, placeholders filled in. */
  lessonText(chapterId: string, lang: string): string;

  references(chapterId: string): readonly Reference[];

  /** The progress keys of the chapter's tasks for its current variant (cheap: no texts). */
  taskKeys(chapterId: string): readonly string[];

  /** The chapter's tasks for its current variant. */
  tasks(chapterId: string, lang: string): readonly TaskInfo[];

  /** The game rules (course outline and achievements). */
  readonly rules: GameRules;

  /** The commands practised in a chapter (shown when it is done). */
  chapterCommands(chapterId: string): readonly string[];

  /** The tooltip of the total progress, e.g. "12 of 191 tasks done in the Debian family". */
  progressTitle(done: number, total: number): string;

  // ---------- Variants ----------

  /** The variants a chapter can run on, grouped. One option (or none) hides the picker. */
  variants(chapterId: string): readonly VariantGroup[];

  /** The variant a chapter runs on now. */
  currentVariant(chapterId: string): string;

  /** The learner chose another variant (saved in LearningState.variant by the window). */
  variantChosen(variantId: string): void;

  /** The variant to use for what the learner chose (null: nothing yet) – e.g. a default or a known id. Default: as chosen. */
  normalizeVariant?(chosen: string | null): string | null;

  /** Tasks that moved to another chapter: old progress key → new key (saved progress follows them). */
  readonly movedTasks?: ReadonlyMap<string, string>;

  /** A control of the tool's own in the top bar, after the variant picker (Codestead GP: the IDE picker). */
  topBarExtra?(): ReactNode;

  /** Every variant there is, for the settings (none: no variant section). */
  readonly allVariants?: readonly VariantOption[] | null;

  // ---------- The workbench ----------

  /** The workbench under the tasks (Codestead Linux: the terminal with its title bar). It stays mounted. */
  workbench(): ReactNode;

  /**
   * Listens to every command line run in the workbench (C#'s event Ran); returns what stops listening. A tool can
   * use {@link RanEvent} for it.
   */
  onRan(listener: (run: SandboxRun) => void): () => void;

  /** Puts a command into the workbench's input (a clicked command or solution). */
  inject(command: string): void;

  focusWorkbench(): void;

  /** Runs a command in the workbench as if typed (the smoke test). */
  run(command: string): void;

  /**
   * The smoke test solves a task: by default each line of its solution is put in the workbench and run. A tool whose
   * tasks are checked another way (Codestead GP: the learner's own project folder) does that here instead.
   */
  solveForSmokeTest?(task: TaskInfo): Promise<void>;

  /** The tasks of the chapter that `run` completed (keys). */
  evaluate(chapterId: string, run: SandboxRun, completed: ReadonlyMap<string, boolean>): readonly string[];

  /** What the command contained, for the statistics and achievements. */
  analyze(run: SandboxRun): CommandFacts | null;

  /** Where the chapter's "try it" questions run. */
  sandbox(chapterId: string): ISandbox;

  // ---------- Events from the window ----------

  /** A chapter is shown (Codestead Linux: switches the terminal to the chapter's distribution). */
  chapterShown?(chapterId: string): void;

  /** The language changed (Codestead Linux: translates the learner's files and user). */
  languageChanged?(lang: string): void;

  /** The learner unlocked the chapter's tasks (finished its text). */
  tasksUnlocked?(chapterId: string): void;

  /** The texts were (re)applied in the current language. */
  textsApplied?(): void;

  /** Everything was re-rendered (e.g. update the workbench title). */
  rendered?(): void;

  /**
   * The tool shows the chapter's tasks inside its own workbench (Codestead GP's "Your project" panel): the window
   * then has no tasks card of its own, gives the workbench the whole column once the tasks are unlocked, and the
   * tool places {@link LearningWindow.taskList} where it wants it. Codestead Linux keeps the tasks card.
   */
  readonly hostsTasks?: boolean;

  /** Extra lines under a task in the task list (e.g. whether the app has seen it built and run), or null. */
  taskStatus?(task: TaskInfo, index: number): ReactNode;

  /**
   * A picture or animation of the chapters' texts (`![alt](images/name.webp)`) in the learner's language: its
   * bytes (or a URL), or null (the picture is left out).
   */
  picture?(path: string, lang: string): Uint8Array | string | null;

  /**
   * A picture of the chapters' texts that is something else than a picture file (Codestead GP: `viz:` scenes of the
   * Render Pipeline Visualizer), or null to show it with {@link picture}. The window puts the caption under it.
   */
  pictureView?(picture: MarkdownPicture, lang: string): ReactNode | null;

  /**
   * A task's solution as a window of its own, which the learner closes again; null (Codestead Linux): the solution
   * opens under the task as clickable commands.
   */
  solutionWindow?(task: TaskInfo, index: number, close: () => void): ReactNode | null;

  /** Save the workbench (the window saves its own state). */
  save?(): void;

  /** Extra resets in the settings' danger zone. */
  resets?(): readonly ResetAction[];

  /** Extra checks of the smoke test, after the generic ones. Returns details for "SMOKE OK (…)". */
  smokeTest?(): string;

  /** The app's own updates (C#: Velopack's SelfUpdate made by the window); none: no update offer. */
  readonly selfUpdate?: SelfUpdate | null;
}

/** C#'s `event Action<SandboxRun> Ran` with its protected OnRan, for a tool to keep. */
export class RanEvent {
  private readonly listeners = new Set<(run: SandboxRun) => void>();

  /** For {@link LearningTool.onRan}. */
  readonly listen = (listener: (run: SandboxRun) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Raised after every command line run in the workbench. */
  raise(run: SandboxRun): void {
    for (const l of [...this.listeners]) l(run);
  }
}
