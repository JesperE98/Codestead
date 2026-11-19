// In the node environment with a DOM of its own (see withDom.ts): it reads the course texts.
// The GP tool in the shared learning window (GpTool*.cs and YourProject/; the C# app project has no tests of its own –
// tests/GP/Codestead.GP.Tests tests the course and the simulator, ported with @codestead/gp-course and gp-gpu): the
// course, the APIs as variants, the IDE picker, "Your project" – Mark as done, Check my code on the learner's own files,
// Save resources…, the old editor's code –, the solution window and the expected-result picture. The course's work
// runs in-process here (electron/CourseService.ts, what the app's worker runs).

import "./withDom.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CourseText, ExpectedResult, GpCourse, Ides, nodeFileSystem, StartFiles, UiStrings } from "@codestead/gp-course";
import { parseVizSource, VizEnvironment } from "@codestead/pipeline-viz";
import { LearningWindow, LearningWindowView, MemoryStorage, Motion } from "@codestead/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CourseService } from "../electron/CourseService.js";
import type { CourseHost } from "../src/CourseHost.js";
import { dedent } from "../src/GpTool.Solution.js";
import { type GpHost, GpTool, taskTitle } from "../src/GpTool.js";
import { ProductInfo } from "../src/ProductInfo.js";
import { bmpDataUrl } from "../src/YourProject/ExpectedPicture.js";

afterEach(cleanup);
beforeAll(() => {
  Motion.enabled = false;
});

const noon = new Date(2026, 10, 18, 12, 0, 0);
const t = (key: string, args?: Record<string, unknown>) => UiStrings.translate("en", key, args);

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function temp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-gp-test-"));
  dirs.push(d);
  return d;
}

/** The course's work in-process, as the app's worker does it. */
const inProcess: CourseHost = {
  check: async (main, chapter, api) => CourseService.check(main, chapter, api),
  cancelCheck: () => {},
  draw: async (chapter, api, task, width) => CourseService.draw(chapter, api, task, width),
  conflicts: async (folder, files) => CourseService.conflicts(folder, files),
  save: async (folder, files) => CourseService.save(folder, files),
  smokePrepare: async (chapter, api, index) => CourseService.smokePrepare(chapter, api, index),
  smokeBuilds: async () => CourseService.smokeBuilds(),
  smokeAssets: async () => CourseService.smokeAssets(),
  smokeCleanup: async () => CourseService.smokeCleanup(),
};

/** A host whose pickers answer what the test says, and whose clipboard is a list. */
function testHost() {
  const answers = { file: null as string | null, folder: null as string | null };
  const asked: { kind: "file" | "folder"; title: string; startFolder: string | null }[] = [];
  const copied: string[] = [];
  const host: GpHost = {
    course: inProcess,
    fs: nodeFileSystem()!,
    pickFile: async (title, _filters, startFolder) => {
      asked.push({ kind: "file", title, startFolder });
      return answers.file;
    },
    pickFolder: async (title, startFolder) => {
      asked.push({ kind: "folder", title, startFolder });
      return answers.folder;
    },
    copyText: async (text) => void copied.push(text),
  };
  return { host, answers, asked, copied };
}

/** A window with the GP tool, in English (and OpenGL) unless the storage says otherwise. */
function open(storage = new MemoryStorage()) {
  if (storage.loadText("state") === null) storage.saveText("state", JSON.stringify({ lang: "en" }));
  const h = testHost();
  const tool = new GpTool(h.host);
  const w = new LearningWindow(tool, { storage, now: () => noon, smokeTest: true });
  return { tool, w, storage, ...h };
}

/** Marks a chapter's text as worked through (its tasks unlock). */
function unlock(w: LearningWindow, chapterId: string): void {
  const chapter = w.chapters.find((c) => c.id === chapterId)!;
  for (let i = 0; i < w.checkpointCount(chapter); i++) w.state.checkpoints.set(LearningWindow.checkpointKey(chapter, i), true);
  w.state.read.push(chapterId);
}

/** The element, or an error (for waitFor). */
function found<T extends Element>(selector: string): T {
  const e = document.querySelector<T>(selector);
  if (e === null) throw new Error(`No ${selector}`);
  return e;
}

/** "✓  Mark as done" (accessible names have their spaces collapsed). */
const markDoneName = "✓ " + t("yourProject.markDone");

const taskKeys = (chapter: string, api = "opengl") => GpCourse.allTasks(chapter, api).map((x) => GpCourse.taskKey(chapter, x.id, api));

describe("GpToolTests", () => {
  it("produkten kommer från packaging/products.json", () => {
    expect(ProductInfo.meta).toEqual({ name: "Codestead GP", id: "codestead-gp", releasesRepo: "JesperE98/codestead-releases", version: "0.2.0" });
    const { tool } = open();
    expect(tool.product).toBe(ProductInfo.meta);
    expect(tool.changelog[0]!.version).toMatch(/^0\.2\.\d+$/);
    expect(tool.translate("sv", "yourProject.title")).toBe(UiStrings.translate("sv", "yourProject.title"));
  });

  it("kursen: delarna, kapitlen, texterna för valt API och uppgifterna (stegen, sedan övningarna, med chips per API)", () => {
    const { tool, w } = open();
    expect(tool.parts).toEqual(GpCourse.parts);
    expect(tool.chapters).toBe(GpCourse.chapters);
    expect(w.chapter.id).toBe("introduction");
    expect(tool.chapterTitle("hello-triangle", "en")).toBe("Hello Triangle");
    expect(tool.lessonText("hello-triangle", "en")).toBe(CourseText.lesson("hello-triangle", "en", "opengl", tool.ide));
    const tasks = tool.tasks("hello-triangle", "en");
    expect(tasks.map((x) => x.key)).toEqual(taskKeys("hello-triangle"));
    expect(tool.taskKeys("hello-triangle")).toEqual(taskKeys("hello-triangle"));
    const steps = GpCourse.tasks("hello-triangle", "opengl").length;
    expect(tasks[0]!.section).toBe(t("yourProject.steps"));
    expect(tasks[steps]!.section).toBe(t("yourProject.exercises"));
    expect(tasks[0]!.solution).toEqual(GpCourse.tasks("hello-triangle", "opengl")[0]!.edits.map((e) => e.replace));
    expect(tasks[0]!.chips.map((c) => c.label)).toEqual(["OpenGL", "Vulkan", "DirectX 12"]);
    expect(tasks[0]!.chips.map((c) => c.current)).toEqual([true, false, false]);
    expect(tool.progressTitle(3, 10)).toBe(t("progress.title", { done: 3, total: 10, api: "OpenGL" }));
    expect(tool.chapterCommands("hello-triangle")).toEqual(GpCourse.functions("hello-triangle", "opengl"));
  });

  it("API:erna är varianterna; ett annat API visar dess texter och uppgifter", () => {
    const { tool, w, storage } = open();
    expect(tool.normalizeVariant(null)).toBe("opengl");
    expect(tool.normalizeVariant("nonsense")).toBe("opengl");
    expect(tool.variants("hello-triangle")).toEqual([
      { label: t("api.group"), options: [{ id: "opengl", name: "OpenGL" }, { id: "vulkan", name: "Vulkan" }, { id: "d3d12", name: "DirectX 12" }] },
    ]);
    expect(tool.allVariants.map((v) => v.id)).toEqual(["opengl", "vulkan", "d3d12"]);
    act(() => w.navigate("hello-triangle"));
    act(() => w.changeVariant("vulkan"));
    expect(tool.currentVariant("hello-triangle")).toBe("vulkan");
    // Saved as "distro", as the C# app does.
    expect(JSON.parse(storage.loadText("state")!).distro).toBe("vulkan");
    expect(tool.taskKeys("hello-triangle")).toEqual(taskKeys("hello-triangle", "vulkan"));
    expect(tool.shown).toEqual({ chapter: "hello-triangle", api: "vulkan" });
    expect(tool.panelModel()!.apiName).toBe("Vulkan");
  });

  it("IDE-väljaren: Setting up your IDE ber om ett val tills det är gjort; valet sparas i ide.json", () => {
    const { tool, w, storage } = open();
    expect(tool.ide).toBe(Ides.default);
    expect(tool.lessonText("ide-setup", "en").startsWith(`> ${t("ide.chooseHint", { ide: Ides.get(Ides.default).name })}\n\n`)).toBe(true);
    render(<LearningWindowView window={w} />);
    const picker = screen.getByRole("combobox", { name: t("ide.label") });
    expect([...(picker as HTMLSelectElement).options].map((o) => o.value)).toEqual(Ides.all.map((i) => i.id));
    act(() => void fireEvent.change(picker, { target: { value: "vscode" } }));
    expect(tool.ide).toBe("vscode");
    expect(JSON.parse(storage.loadText("ide")!)).toEqual({ ide: "vscode" });
    expect(tool.lessonText("ide-setup", "en")).toBe(CourseText.lesson("ide-setup", "en", "opengl", "vscode"));
    // The choice is read back at the next start.
    expect(open(storage).tool.ide).toBe("vscode");
  });

  it("bilderna i texterna: språkets egen om den finns, annars den delade; inget utanför images/", () => {
    const { tool } = open();
    const used = /!\[[^\]]*\]\((images\/[^ )]+)/.exec(CourseText.raw("hello-triangle", "en"))![1]!;
    const url = tool.picture(used, "en");
    expect(typeof url).toBe("string");
    expect(url).toContain(used.slice("images/".length).replace(/\.\w+$/, ""));
    expect(tool.picture("images/../chapters/en/introduction.md", "en")).toBeNull();
    expect(tool.picture("chapters/en/introduction.md", "en")).toBeNull();
    expect(tool.picture("images/no-such-picture.webp", "en")).toBeNull();
  });

  it("scener ur visualiseraren (viz:) står i texten där bilderna stod, med bildtext, i valt API; utan WebGL stillbilden", () => {
    const { tool, w } = open();
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    const sources = [...CourseText.raw("hello-triangle", "en").matchAll(/!\[[^\]]*\]\((viz:[^ )]+) "([^"]*)"\)/g)];
    expect(sources.map((m) => m[1])).toEqual(["viz:pipeline", "viz:buffers", "viz:input-layout", "viz:rasterization", "viz:indices"]);
    const scenes = [...document.querySelectorAll(".cs-viz")];
    expect(scenes.map((e) => e.getAttribute("data-scene"))).toEqual(sources.map((m) => parseVizSource(m[1]!)!.name));
    // The caption under each, as under a picture; the controls in the window's language.
    for (const [i, m] of sources.entries()) expect(scenes[i]!.parentElement!.querySelector(".cs-md-caption")!.textContent).toBe(m[2]);
    expect(within(scenes[1] as HTMLElement).getByRole("button", { name: t("viz.next") })).toBeTruthy();
    expect(within(scenes[1] as HTMLElement).getAllByRole("button", { name: /^Step \d of 5$/ }).length).toBe(5);
    // An ordinary picture is still a picture.
    expect(tool.pictureView({ href: "images/results/hello-triangle.webp", alt: "", title: "" }, "en")).toBeNull();
    cleanup();

    // Without WebGL: the still pictures, in the language.
    const saved = { ...VizEnvironment };
    VizEnvironment.canObserve = () => true;
    VizEnvironment.webgl = () => false;
    try {
      render(<LearningWindowView window={w} />);
      const still = document.querySelector('.cs-viz[data-scene="buffers"] img')!;
      expect(still.getAttribute("src")).toBe(tool.picture("images/viz-buffers.webp", "en"));
      expect(document.querySelectorAll('.cs-viz[data-state="fallback"]').length).toBe(5);
    } finally {
      Object.assign(VizEnvironment, saved);
    }
  });

  it("Mark as done bockar av en uppgift först när texten är genomgången; det sparas i state.json", () => {
    const { tool, w, storage } = open();
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    // Locked: the panel says what unlocks the tasks, and lists them without "Mark as done".
    const questions = w.checkpointProgress("hello-triangle");
    expect(screen.getByText(t("yourProject.lockedQuestions", { done: 0, total: questions.total }), { exact: false }).textContent).toBe(
      "🔒  " + t("yourProject.lockedQuestions", { done: 0, total: questions.total }),
    );
    expect(screen.queryByRole("button", { name: markDoneName })).toBeNull();
    act(() => tool.markDone(0));
    expect(w.isTaskDone(taskKeys("hello-triangle")[0]!)).toBe(false);

    act(() => {
      unlock(w, "hello-triangle");
      w.unlocked();
    });
    // The window's task list is in the panel, each task with its state and "Mark as done".
    const buttons = screen.getAllByRole("button", { name: markDoneName });
    expect(buttons).toHaveLength(taskKeys("hello-triangle").length);
    act(() => void fireEvent.click(buttons[0]!));
    expect(w.isTaskDone(taskKeys("hello-triangle")[0]!)).toBe(true);
    expect(JSON.parse(storage.loadText("state")!).progress[taskKeys("hello-triangle")[0]!]).toBe(true);
    expect(document.querySelector(".cs-task")!.getAttribute("data-done")).toBe("true");
    // Done: its state says so, and the next one is the one whose expected result is shown.
    expect(screen.getAllByText(t("yourProject.done")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: markDoneName })).toHaveLength(taskKeys("hello-triangle").length - 1);
    expect(tool.panelModel()!.selectedTask).toBe(1);
    // A task ticked by hand is no check: no "first check" achievement.
    expect(w.state.game.achievements.has("first-check")).toBe(false);
  });

  it("Check my code: startfilerna löser inga uppgifter, kursens lösning bockar av stegen; huvudfilen sparas i mainfiles.json", async () => {
    const { tool, w, storage, answers, asked } = open();
    render(<LearningWindowView window={w} />);
    act(() => {
      w.navigate("hello-triangle");
      unlock(w, "hello-triangle");
      w.unlocked();
    });
    // The learner's own layout: the main file under src/, renamed.
    const dir = temp();
    StartFiles.copy(dir, GpCourse.startProject("hello-triangle", "opengl"));
    const main = path.join(dir, "src", "triangle.cpp");
    fs.mkdirSync(path.dirname(main));
    fs.renameSync(path.join(dir, "main.cpp"), main);
    answers.file = main;

    // The first time, "Check my code" asks for the main file.
    await act(() => tool.checkMyCode(false));
    expect(asked).toEqual([{ kind: "file", title: t("yourProject.pickTitle", { chapter: "Hello Triangle", api: "OpenGL" }), startFolder: null }]);
    expect(JSON.parse(storage.loadText("mainfiles")!)).toEqual({ files: { "opengl/hello-triangle": main }, lastFolder: path.dirname(main) });
    expect(screen.getByText(main)).toBeTruthy();
    const steps = GpCourse.tasks("hello-triangle", "opengl").length;
    for (const key of taskKeys("hello-triangle")) expect(w.isTaskDone(key)).toBe(false);
    const model = tool.panelModel()!;
    expect(model.checkSummary).toBe(t("yourProject.checked", { time: "12:00", passed: 0, total: taskKeys("hello-triangle").length }));
    expect(model.tasks[0]!.state).toBe("notYet");
    expect(screen.getAllByText(t("yourProject.notYet")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t("yourProject.notYetHelp")).length).toBeGreaterThan(0);
    // A check counts for the game even when it solves nothing.
    expect(w.state.game.achievements.has("first-check")).toBe(true);

    // The course's solution of the chapter, written over the start files: every step is ticked, no exercise.
    const solved = GpCourse.solutionProject("hello-triangle", "opengl");
    fs.writeFileSync(main, solved.files.get("main.cpp")!);
    for (const [name, text] of solved.files) if (name !== "main.cpp") fs.writeFileSync(path.join(dir, name), text);
    await act(() => tool.checkMyCode(false));
    expect(asked).toHaveLength(1);
    const keys = taskKeys("hello-triangle");
    expect(keys.slice(0, steps).every((k) => w.isTaskDone(k))).toBe(true);
    expect(keys.slice(steps).some((k) => w.isTaskDone(k))).toBe(false);
    expect(tool.panelModel()!.checkSummary).toBe(t("yourProject.checked", { time: "12:00", passed: steps, total: keys.length }));
    expect(w.state.game.xp).toBeGreaterThan(0);

    // "Change file…" asks again, starting in the main file's folder.
    answers.file = null;
    await act(() => tool.checkMyCode(true));
    expect(asked[1]!.startFolder).toBe(path.dirname(main));
    expect(tool.currentMainFile).toBe(main);
  });

  it("en kontroll medan uppgifterna är låsta räknas när texten är genomgången", async () => {
    const { tool, w, answers } = open();
    act(() => w.navigate("hello-triangle"));
    const dir = temp();
    StartFiles.copy(dir, ExpectedResult.project("hello-triangle", "opengl", 0));
    answers.file = path.join(dir, "main.cpp");
    await act(() => tool.checkMyCode(false));
    const first = taskKeys("hello-triangle")[0]!;
    expect(w.isTaskDone(first)).toBe(false);
    expect(tool.panelModel()!.tasks[0]!.state).toBe("locked");
    act(() => {
      unlock(w, "hello-triangle");
      w.unlocked();
    });
    expect(w.isTaskDone(first)).toBe(true);
  });

  it("huvudfilen som inte finns längre sägs till om; den tidigare appens mapp (folders.json) används tills en annan väljs", () => {
    const storage = new MemoryStorage();
    const gone = path.join(temp(), "gone", "main.cpp");
    storage.saveText("mainfiles", JSON.stringify({ files: { "opengl/hello-triangle": gone } }));
    const old = temp();
    fs.writeFileSync(path.join(old, "main.cpp"), "int main() {}\n");
    storage.saveText("folders", JSON.stringify({ folders: { "opengl/hello-window": old } }));
    const { tool, w } = open(storage);
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    expect(tool.panelModel()!.fileMissing).toBe(true);
    expect(screen.getByText(t("yourProject.fileMissing"))).toBeTruthy();
    act(() => w.navigate("hello-window"));
    expect(tool.currentMainFile).toBe(path.join(old, "main.cpp"));
    expect(tool.panelModel()!.fileMissing).toBe(false);
  });

  it("lösningen öppnas i ett eget fönster som stängs med ✕, med Escape och med Close", () => {
    const { tool, w, copied } = open();
    render(<LearningWindowView window={w} />);
    act(() => {
      w.navigate("hello-triangle");
      unlock(w, "hello-triangle");
      w.unlocked();
    });
    const key = taskKeys("hello-triangle")[0]!;
    act(() => w.hintShown(key));
    act(() => w.renderTasks());
    const openSolution = () => act(() => void fireEvent.click(screen.getAllByRole("button", { name: "👁 " + t("tasks.solution") })[0]!));
    openSolution();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(t("yourProject.solutionTitle", { n: 1 }))).toBeTruthy();
    const edits = GpCourse.tasks("hello-triangle", "opengl")[0]!.edits;
    expect(within(dialog).getAllByText(edits[0]!.file).length).toBeGreaterThan(0);
    expect(dialog.querySelector("pre")!.textContent).toBe(dedent(edits[0]!.replace).replace(/\n+$/, ""));
    expect(w.state.game.solutionSeen).toContain(key);
    // Copy puts the code on the clipboard.
    act(() => void fireEvent.click(within(dialog).getAllByRole("button", { name: t("yourProject.copyCode") })[0]!));
    return waitFor(() => expect(copied).toEqual([dedent(edits[0]!.replace)])).then(() => {
      act(() => void fireEvent.click(dialog.querySelector(".dialog-close")!));
      expect(screen.queryByRole("dialog")).toBeNull();
      openSolution();
      act(() => void fireEvent.keyDown(document.body, { key: "Escape" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      openSolution();
      act(() => void fireEvent.click(within(screen.getByRole("dialog")).getByText(t("yourProject.close"))));
      expect(screen.queryByRole("dialog")).toBeNull();
      // An exercise's solution is numbered among the exercises.
      expect(tool.solutionWindow(w.tool.tasks("hello-triangle", "en")[0]!, GpCourse.tasks("hello-triangle", "opengl").length, () => {})).not.toBeNull();
      expect(tool.solutionWindow(w.tool.tasks("hello-triangle", "en")[0]!, 99, () => {})).toBeNull();
    });
  });

  it("det förväntade resultatet ritas av den simulerade GPU:n och visas större vid klick", async () => {
    const { w } = open();
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    expect(screen.getByText(t("expected.task", { n: 1 }))).toBeTruthy();
    // "Drawing…" until the picture is there – unless an earlier test's drawing of the same task (the session's pictures
    // are shared, as in C#) finished first.
    expect(screen.queryByText(t("expected.drawing")) ?? document.querySelector(".cs-gp-expected img")).not.toBeNull();
    const img = await waitFor(() => found<HTMLImageElement>(".cs-gp-expected img"), { timeout: 5000 });
    expect(img.src.startsWith("data:image/bmp;base64,")).toBe(true);
    expect(img.alt).toBe(t("expected.task", { n: 1 }));
    // Another task: its own picture (exercises are numbered on their own).
    const steps = GpCourse.tasks("hello-triangle", "opengl").length;
    act(() => w.navigate("hello-triangle"));
    act(() => (w.tool as GpTool).selectTask(steps));
    expect(screen.getByText(t("expected.exercise", { n: 1 }))).toBeTruthy();
    // Clicking shows it larger, in a dialog.
    await act(async () => void fireEvent.click(screen.getByTitle(t("expected.enlarge"))));
    const dialog = await waitFor(() => screen.getByRole("dialog"), { timeout: 5000 });
    expect(dialog.querySelector("img")!.src.startsWith("data:image/bmp;base64,")).toBe(true);
    // A task whose program opens no window has no picture, and says why.
    const { w: w2 } = open();
    cleanup();
    render(<LearningWindowView window={w2} />);
    act(() => w2.navigate("creating-a-window"));
    await waitFor(() => expect(document.querySelector(".cs-gp-expected-note")!.textContent).not.toBe(t("expected.drawing")), { timeout: 5000 });
    expect([t("expected.noWindow"), t("expected.closed"), t("expected.nothing"), t("expected.none")]).toContain(document.querySelector(".cs-gp-expected-note")!.textContent);
    // Three pictures drawn by the simulated GPU take about five seconds: more than Vitest's default for a test.
  }, 30_000);

  it("Save resources… sparar kursens texturer i en vald mapp och frågar innan något annat skrivs över", async () => {
    const { tool, w, answers, asked } = open();
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    expect(screen.queryByRole("button", { name: t("yourProject.save") })).toBeNull();
    act(() => w.navigate("textures"));
    const folder = temp();
    answers.folder = folder;
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t("yourProject.save") })));
    await waitFor(() => expect(screen.getByText(t("yourProject.saved", { count: 2 }))).toBeTruthy());
    expect(asked.at(-1)!.title).toBe(t("yourProject.saveFolderTitle", { chapter: tool.chapterTitle("textures", "en"), api: "OpenGL" }));
    // Only the course's own files, no code.
    expect(fs.readdirSync(folder).sort()).toEqual(["awesomeface.png", "container.png"]);
    expect(fs.readFileSync(path.join(folder, "container.png"))).toEqual(Buffer.from(GpCourse.startProject("textures", "opengl").assets.get("container.png")!));
    expect(tool.currentMainFile).toBeNull();

    // A file with other contents: asked first; Cancel leaves it, Overwrite replaces it.
    fs.writeFileSync(path.join(folder, "container.png"), "mine");
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t("yourProject.save") })));
    const dialog = await waitFor(() => screen.getByRole("dialog"));
    expect(within(dialog).getByText(t("yourProject.copyConfirm", { count: 1, files: "container.png" }))).toBeTruthy();
    act(() => void fireEvent.click(within(dialog).getByRole("button", { name: t("dialog.cancel") })));
    expect(fs.readFileSync(path.join(folder, "container.png"), "utf8")).toBe("mine");
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t("yourProject.save") })));
    await act(async () => void fireEvent.click(within(await waitFor(() => screen.getByRole("dialog"))).getByRole("button", { name: t("yourProject.overwrite") })));
    await waitFor(() => expect(fs.readFileSync(path.join(folder, "container.png")).length).toBeGreaterThan(4));
  });

  it("koden från den gamla inbyggda editorn sparas i en mapp och blir koden som kontrolleras", async () => {
    const storage = new MemoryStorage();
    const start = GpCourse.startProject("hello-triangle", "opengl");
    storage.saveText("project.opengl.hello-triangle", JSON.stringify(Object.fromEntries(start.files)));
    const { tool, w, answers } = open(storage);
    render(<LearningWindowView window={w} />);
    act(() => w.navigate("hello-triangle"));
    expect(screen.getByText(t("yourProject.oldCode"))).toBeTruthy();
    const folder = temp();
    answers.folder = folder;
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t("yourProject.copyOld") })));
    await waitFor(() => expect(tool.currentMainFile).toBe(path.join(folder, "main.cpp")));
    expect(fs.readFileSync(path.join(folder, "main.cpp"), "utf8")).toBe(start.files.get("main.cpp"));
    expect(screen.getByText(t("yourProject.saved", { count: start.files.size }))).toBeTruthy();
    // Without old code there is no such note.
    act(() => w.navigate("hello-window"));
    expect(screen.queryByText(t("yourProject.oldCode"))).toBeNull();
  });

  it("en lösning eller ett kodblock som klickas kopieras; en uppgift utan kod säger att den byggs i IDE:n", async () => {
    const { tool, w, copied } = open();
    render(<LearningWindowView window={w} />);
    await act(async () => tool.inject("glClear(GL_COLOR_BUFFER_BIT);"));
    expect(copied).toEqual(["glClear(GL_COLOR_BUFFER_BIT);"]);
    expect(screen.getByText(t("yourProject.copiedCode"))).toBeTruthy();
    act(() => tool.inject("▶ " + t("yourProject.buildRunSolution")));
    expect(copied).toHaveLength(1);
    expect(screen.getByText(t("yourProject.buildRunToast"))).toBeTruthy();
  });

  it("smoke-testets lösning: start + lösning i en egen mapp (src/<kapitel>.cpp) klarar uppgiftens kontroll", async () => {
    const { tool, w } = open();
    act(() => {
      w.navigate("hello-triangle");
      unlock(w, "hello-triangle");
    });
    const task = tool.tasks("hello-triangle", "en")[2]!;
    await act(() => tool.solveForSmokeTest(task));
    expect(tool.currentMainFile).toMatch(/[/\\]opengl[/\\]hello-triangle[/\\]src[/\\]hello-triangle\.cpp$/);
    expect(w.isTaskDone(task.key)).toBe(true);
    expect(tool.smokeCheckCount).toBe(1);
    CourseService.smokeCleanup();
    expect(fs.existsSync(tool.currentMainFile!)).toBe(false);
  });

  it("en uppgifts titel i listan: första meningen utan markdown, högst 90 tecken", () => {
    expect(taskTitle("Create a **vertex buffer** with `glGenBuffers`. Then bind it.")).toBe("Create a vertex buffer with glGenBuffers");
    expect(taskTitle("See [the docs](https://example.com): read them")).toBe("See the docs");
    expect(taskTitle("三角形を描く。次へ")).toBe("三角形を描く");
    const long = "word ".repeat(30);
    expect(taskTitle(long)).toBe(long.slice(0, 87).trimEnd() + "…");
  });

  it("lösningens kod utan den gemensamma indragningen", () => {
    expect(dedent("    a();\n      b();\n\n    c();\n\n")).toBe("a();\n  b();\n\nc();");
    expect(dedent("\tx;\r\n\ty;")).toBe("x;\ny;");
  });

  it("bilden av en ruta: BMP, 32 bitar, översta raden först, ogenomskinlig", () => {
    const url = bmpDataUrl(2, 1, new Uint8Array([1, 2, 3, 0, 4, 5, 6, 7]));
    const bytes = Buffer.from(url.slice("data:image/bmp;base64,".length), "base64");
    expect(bytes.subarray(0, 2).toString()).toBe("BM");
    expect(bytes.readUInt32LE(2)).toBe(54 + 8);
    expect(bytes.readInt32LE(18)).toBe(2);
    expect(bytes.readInt32LE(22)).toBe(-1);
    expect(bytes.readUInt16LE(28)).toBe(32);
    expect([...bytes.subarray(54)]).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
  });
});
