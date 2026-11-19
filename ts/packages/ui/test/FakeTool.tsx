import type { ProductMeta } from "@codestead/common";
import {
  ChapterKinds,
  CommandFacts,
  CommonAchievements,
  CourseChapter,
  CourseOutline,
  GameRules,
  OutlinePart,
  type Reference,
} from "@codestead/learning";
import {
  ChangelogEntry,
  type ISandbox,
  type LearningTool,
  type LearningWindow,
  RanEvent,
  SandboxRun,
  type TaskInfo,
  type VariantGroup,
} from "../src/index.js";
import { FakeSandbox } from "./FakeSandbox.js";

const texts: Record<string, string> = {
  hello: "# Hello\n\nRun `pwd`.\n\n```quiz\nWhich?\n- [ ] ls\n- [x] pwd\n```\n\n```try\npwd\n```\n\n```sh\necho hi\n```\n\nSee [the docs](https://example.com/docs).",
  read: "# Reading\n\nJust read this.",
  sum: "# Summary\n\nAll of it.",
  exam: "# Exam\n\n```quiz\nWhich?\n- [x] pwd\n- [ ] ls\n```\n\n```predict\n$ echo hej\nhej\n```",
};

/** Each task: its key, the command that solves it, and a hint. */
const taskList: Record<string, { key: string; solution: string; hint: string | null }[]> = {
  hello: [
    { key: "hello/t1", solution: "echo hi", hint: null },
    { key: "hello/t2", solution: "ls", hint: "Try **ls**." },
  ],
  read: [{ key: "read/t1", solution: "cat notes", hint: null }],
};

/**
 * A made-up tool with nothing of Linux in it: one part with two lessons, a summary and an exam. Its "terminal" is a
 * div; tests run commands with {@link ran}. Every text is its key, followed by its arguments ("tasks.count:1,2").
 */
export class FakeTool implements LearningTool {
  window?: LearningWindow;
  readonly product: ProductMeta = { name: "Codestead Test", id: "codestead-test", releasesRepo: "example/releases", version: "0.2.0" };
  readonly iconUrl = "icon.svg";
  readonly changelog = [
    new ChangelogEntry({ version: "0.2.0", date: "2026-11-17", changes: { en: ["The **new** version."] } }),
    new ChangelogEntry({ version: "0.1.0", date: "2026-11-01", changes: { en: ["The first version."] } }),
  ];
  readonly parts = ["basics"];
  readonly chapters = [
    new CourseChapter("hello", "basics", ChapterKinds.Lesson),
    new CourseChapter("read", "basics", ChapterKinds.Lesson),
    new CourseChapter("sum", "basics", ChapterKinds.Summary),
    new CourseChapter("exam", "basics", ChapterKinds.Exam),
  ];
  readonly rules = new GameRules(new CourseOutline([new OutlinePart("basics", ["hello", "read"], true)]), [
    CommonAchievements.firstTask,
    CommonAchievements.firstChapter,
    CommonAchievements.partDone("basics", "🧱"),
    CommonAchievements.examFirst,
  ]);
  readonly ranEvent = new RanEvent();
  readonly injected: string[] = [];
  readonly shown: string[] = [];
  variant = "one";

  translate(_lang: string, key: string, args?: Readonly<Record<string, unknown>>): string {
    return args ? `${key}:${Object.values(args).join(",")}` : key;
  }

  chapterTitle(chapterId: string): string {
    return `Title ${chapterId}`;
  }

  languagesWithText(): readonly string[] {
    return ["en", "sv"];
  }

  rawText(chapterId: string): string {
    return texts[chapterId] ?? "";
  }

  lessonText(chapterId: string): string {
    return texts[chapterId] ?? "";
  }

  references(chapterId: string): readonly Reference[] {
    return chapterId === "hello" ? [{ title: "The manual", url: "https://example.com/manual", publisher: "Example" }] : [];
  }

  taskKeys(chapterId: string): readonly string[] {
    return (taskList[chapterId] ?? []).map((t) => t.key);
  }

  tasks(chapterId: string): readonly TaskInfo[] {
    return (taskList[chapterId] ?? []).map((t) => ({ key: t.key, text: `Task ${t.key}: run \`${t.solution}\`.`, hint: t.hint, solution: [t.solution], chips: [] }));
  }

  chapterCommands(chapterId: string): readonly string[] {
    return (taskList[chapterId] ?? []).map((t) => t.solution);
  }

  progressTitle(done: number, total: number): string {
    return `${done} of ${total}`;
  }

  variants(): readonly VariantGroup[] {
    return [{ label: "Group", options: [{ id: "one", name: "One" }, { id: "two", name: "Two" }] }];
  }

  currentVariant(): string {
    return this.variant;
  }

  variantChosen(variantId: string): void {
    this.variant = variantId;
  }

  workbench() {
    return <div data-testid="workbench">terminal</div>;
  }

  onRan(listener: (run: SandboxRun) => void): () => void {
    return this.ranEvent.listen(listener);
  }

  /** A command line run in the "terminal". */
  ran(line: string, output = ""): void {
    this.ranEvent.raise(new SandboxRun(line, output || FakeSandbox.run(line), 0, true));
  }

  inject(command: string): void {
    this.injected.push(command);
  }

  focusWorkbench(): void {}

  run(command: string): void {
    this.ran(command);
  }

  evaluate(chapterId: string, run: SandboxRun, completed: ReadonlyMap<string, boolean>): readonly string[] {
    return (taskList[chapterId] ?? []).filter((t) => t.solution === run.line.trim() && !completed.has(t.key)).map((t) => t.key);
  }

  analyze(run: SandboxRun): CommandFacts | null {
    const facts = new CommandFacts({ line: run.line, output: run.output, exitCode: run.exitCode });
    facts.names.push(run.line.split(" ")[0]!);
    return facts;
  }

  sandbox(): ISandbox {
    return new FakeSandbox();
  }

  chapterShown(chapterId: string): void {
    this.shown.push(chapterId);
  }
}
