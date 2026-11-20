// End-to-end: builds Codestead GP and drives the real Electron window with Playwright's _electron – the first chapter
// on screen; in Hello Triangle the text's questions answered, a task ticked with Mark as done, the code of the old
// built-in editor (the chapter's start files) saved into a folder, Check my code on it (no task solved), the course's
// solution written into the folder and Check my code again (the steps ticked), the solution window opened and closed
// with ✕ and with Escape, the expected-result picture drawn; everything saved in the C# app's files; the Render
// Pipeline Visualizer's scenes in Hello Triangle (live with WebGL – SwiftShader –, stepped, at most two WebGL contexts
// while scrolling; the overview's stages lead to the scene of another chapter; the still pictures without WebGL);
// --smoke-test and --version.
//
//   npm run test:e2e            (in ts/apps/gp; set E2E_SKIP_BUILD=1 to use the last build)
//
// Playwright is not a dependency of the workspace: require("playwright") must find it (e.g. a global install on
// NODE_PATH). On Linux without a display an Xvfb server is started for the test. Screenshots go to $E2E_SHOTS if set.

import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Checkpoint } from "@codestead/learning";
import { CourseText, GpCourse, Ides, StartFiles, UiStrings } from "@codestead/gp-course";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------- The little of Playwright this test uses ----------

interface Locator {
  first(): Locator;
  last(): Locator;
  nth(i: number): Locator;
  locator(selector: string): Locator;
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  waitFor(options?: { state?: "visible" | "attached" | "detached" | "hidden"; timeout?: number }): Promise<void>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  fill(text: string): Promise<void>;
  click(): Promise<void>;
  check(): Promise<void>;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  scrollIntoViewIfNeeded(): Promise<void>;
}

interface Page extends Locator {
  title(): Promise<string>;
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  screenshot(options: { path: string }): Promise<Buffer>;
  waitForFunction(fn: string): Promise<unknown>;
  waitForFunction<A>(fn: (arg: A) => unknown, arg: A): Promise<unknown>;
  keyboard: { press(key: string): Promise<void> };
}

interface ElectronApp {
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
  evaluate<A>(fn: (electron: { dialog: { showOpenDialog: unknown } }, arg: A) => void, arg: A): Promise<void>;
}

interface PlaywrightElectron {
  launch(options: { executablePath: string; args: string[]; env: Record<string, string | undefined>; timeout?: number }): Promise<ElectronApp>;
}

const require = createRequire(import.meta.url);
const appDir = fileURLToPath(new URL("..", import.meta.url));
const electronPath = require("electron") as string;
const lang = "en";
const api = "opengl";
const chapter = "hello-triangle";
const t = (key: string, args?: Record<string, unknown>) => UiStrings.translate(lang, key, args);
const shots = process.env["E2E_SHOTS"] ?? null;
const rootArgs = process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let xvfb: ChildProcess | null = null;
let display: string | undefined = process.env["DISPLAY"];
let dataDir = "";
let projectDir = "";

/** On Linux without a display: an Xvfb server of our own. */
async function ensureDisplay(): Promise<void> {
  if (process.platform !== "linux" || display) return;
  if (spawnSync("which", ["Xvfb"]).status !== 0) throw new Error("No display and no Xvfb: run the e2e tests on a desktop or install Xvfb.");
  for (let n = 99; n < 120; n++) {
    if (fs.existsSync(`/tmp/.X11-unix/X${n}`) || fs.existsSync(`/tmp/.X${n}-lock`)) continue;
    xvfb = spawn("Xvfb", [`:${n}`, "-screen", "0", "1600x1000x24", "-nolisten", "tcp"], { stdio: "ignore" });
    display = `:${n}`;
    for (let i = 0; i < 50 && !fs.existsSync(`/tmp/.X11-unix/X${n}`); i++) await new Promise((r) => setTimeout(r, 100));
    return;
  }
  throw new Error("No free X display for Xvfb.");
}

function env(): Record<string, string | undefined> {
  return { ...process.env, DISPLAY: display, CODESTEAD_DATA_DIR: dataDir, ELECTRON_ENABLE_LOGGING: undefined };
}

/** Chromium's switches (before the app's folder): `webgl` draws with SwiftShader where there is no GPU (Xvfb), `noWebgl` has none. */
const webgl = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const noWebgl = ["--disable-gpu", "--disable-software-rasterizer"];

async function launch(switches: string[] = []): Promise<{ app: ElectronApp; page: Page }> {
  const { _electron } = require("playwright") as { _electron: PlaywrightElectron };
  const app = await _electron.launch({ executablePath: electronPath, args: [...switches, appDir, ...rootArgs], env: env(), timeout: 60_000 });
  const page = await app.firstWindow();
  await page.locator(".cs-gp-project").waitFor({ state: "visible", timeout: 60_000 });
  return { app, page };
}

async function shot(page: Page, name: string): Promise<void> {
  if (shots !== null) await page.screenshot({ path: path.join(shots, `${name}.png`) });
}

/** The folder dialog answers with this folder (the native dialog cannot be clicked). */
async function answerFolderDialog(app: ElectronApp, folder: string): Promise<void> {
  await app.evaluate(({ dialog }, f) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [f] });
  }, folder);
}

const data = (name: string) => path.join(dataDir, "codestead-gp", name);

beforeAll(async () => {
  if (process.env["E2E_SKIP_BUILD"] !== "1") execFileSync("npm", ["run", "build"], { cwd: appDir, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  await ensureDisplay();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-gp-e2e-"));
  projectDir = path.join(dataDir, "my-project");
  // The learner wrote code for Hello Triangle in the app's earlier built-in editor: the chapter's start files.
  fs.mkdirSync(data(""), { recursive: true });
  fs.writeFileSync(data(`project.${api}.${chapter}.json`), JSON.stringify(Object.fromEntries(GpCourse.startProject(chapter, api).files)));
  if (shots !== null) fs.mkdirSync(shots, { recursive: true });
});

afterAll(() => {
  xvfb?.kill();
  if (dataDir !== "") fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("Codestead GP (Electron)", () => {
  it("första kapitlet; Hello Triangle: Mark as done, den tidigare koden sparas, Check my code före och efter lösningen, lösningsfönstret, förväntat resultat", async () => {
    const { app, page } = await launch();
    const keys = GpCourse.allTasks(chapter, api).map((x) => GpCourse.taskKey(chapter, x.id, api));
    const steps = GpCourse.tasks(chapter, api).length;
    try {
      // The first chapter, in the default language, with "Your project" next to it.
      const first = GpCourse.chapters[0]!.id;
      expect(await page.title()).toBe(`${CourseText.title(first, lang, api)} – Codestead GP`);
      await page.getByRole("heading", { name: CourseText.title(first, lang, api) }).first().waitFor();
      await page.locator(".cs-gp-project").getByText(t("yourProject.title"), { exact: true }).waitFor();
      await shot(page, "1-start");

      // Hello Triangle: locked until the text's questions are answered.
      await page.locator(".cs-sidebar button.nav-item").getByText("Hello Triangle", { exact: true }).click();
      await page.getByRole("heading", { name: "Hello Triangle" }).first().waitFor();
      await page.locator(".cs-gp-task-row").first().waitFor();
      const text = CourseText.preprocess(CourseText.raw(chapter, lang), api, Ides.default);
      for (const cp of Checkpoint.parseAll(text)) {
        const view = page.locator(".cs-checkpoint").nth(cp.index);
        if (cp.kind === Checkpoint.Quiz) {
          for (const [i, o] of cp.options.entries()) if (o.correct) await view.locator(".cs-checkpoint-option input").nth(i).check();
        } else {
          await view.locator(".cs-checkpoint-answer").fill(cp.expected);
        }
        await view.getByRole("button", { name: t("checkpoint.check") }).click();
        await page.waitForFunction(`document.querySelectorAll(".cs-checkpoint")[${cp.index}].dataset.solved === "true"`);
      }
      // Unlocked: the window's task list is in the panel, each task with "Mark as done".
      await page.locator(".cs-gp-project .cs-task").first().waitFor();
      expect(await page.locator(".cs-task").count()).toBe(keys.length);
      await page.locator(".cs-gp-mark-done").first().click();
      await page.waitForFunction(`document.querySelector(".cs-task")?.dataset.done === "true"`);
      await shot(page, "2-mark-done");

      // The old editor's code (the start files) saved into a folder: it becomes the main file Check my code reads.
      await answerFolderDialog(app, projectDir);
      await page.getByRole("button", { name: t("yourProject.copyOld") }).click();
      await page.getByText(t("yourProject.saved", { count: GpCourse.startProject(chapter, api).files.size }), { exact: true }).waitFor();
      await page.locator(".cs-gp-main-file").getByText(path.join(projectDir, "main.cpp"), { exact: true }).waitFor();
      expect(fs.readFileSync(path.join(projectDir, "main.cpp"), "utf8")).toBe(GpCourse.startProject(chapter, api).files.get("main.cpp"));

      // Check my code on the start files: no task is solved.
      await page.getByRole("button", { name: t("yourProject.check") }).click();
      await page.locator(".cs-gp-check-result").waitFor();
      expect(await page.locator(".cs-gp-check-result").textContent()).toContain(`: 0 of ${keys.length} tasks solved.`);
      expect(await page.locator(`.cs-task[data-done="true"]`).count()).toBe(1);
      expect(await page.locator(`.cs-gp-status[data-state="notYet"]`).count()).toBeGreaterThan(0);
      await shot(page, "3-check-start");

      // The course's solution written into the folder: Check my code ticks every step.
      StartFiles.copy(projectDir, GpCourse.solutionProject(chapter, api));
      await page.getByRole("button", { name: t("yourProject.check") }).click();
      await page.locator(`.cs-task[data-done="true"]`).nth(steps - 1).waitFor({ timeout: 60_000 });
      expect(await page.locator(`.cs-task[data-done="true"]`).count()).toBe(steps);
      expect(await page.locator(".cs-gp-check-result").textContent()).toContain(`: ${steps} of ${keys.length} tasks solved.`);
      expect(await page.locator(".cs-gp-check-result").getAttribute("data-all-passed")).toBeNull();
      await shot(page, "4-check-solution");

      // The expected result of the next task (the first exercise) is drawn by the simulated GPU.
      await page.getByText(t("expected.exercise", { n: 1 }), { exact: true }).waitFor();
      await page.locator(".cs-gp-expected img").waitFor({ timeout: 30_000 });
      expect(await page.locator(".cs-gp-expected img").getAttribute("src")).toMatch(/^data:image\/bmp;base64,/);

      // The solution opens in a window of its own; ✕ and Escape close it.
      await page.getByRole("button", { name: "👁 " + t("tasks.solution") }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByText(t("yourProject.solutionTitle", { n: 1 }), { exact: true }).waitFor();
      expect(await dialog.locator("pre").first().textContent()).toContain(GpCourse.tasks(chapter, api)[0]!.edits[0]!.replace.trim().split("\n")[0]!.trim());
      await shot(page, "5-solution");
      await dialog.locator(".dialog-close").click();
      await dialog.waitFor({ state: "detached" });
      await page.getByRole("button", { name: "👁 " + t("tasks.solution") }).first().click();
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });

      // Clicking the expected result shows it larger.
      await page.locator(".cs-gp-expected").scrollIntoViewIfNeeded();
      await shot(page, "6-expected");
      await page.locator(".cs-gp-expected-frame").click();
      await dialog.locator("img").waitFor({ timeout: 30_000 });
      expect(await dialog.locator("img").getAttribute("src")).toMatch(/^data:image\/bmp;base64,/);
      await shot(page, "7-enlarged");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
    } finally {
      await app.close();
    }

    // Saved in the C# app's files.
    const state = JSON.parse(fs.readFileSync(data("state.json"), "utf8")) as { progress: Record<string, boolean>; chapter: string };
    expect(state.chapter).toBe(chapter);
    for (const key of keys.slice(0, steps)) expect(state.progress[key]).toBe(true);
    expect(JSON.parse(fs.readFileSync(data("mainfiles.json"), "utf8"))).toEqual({ files: { [`${api}/${chapter}`]: path.join(projectDir, "main.cpp") }, lastFolder: projectDir });
    expect(fs.existsSync(data("profile.json"))).toBe(true);
  });

  it("visualiserarens scener i Hello Triangle: live med WebGL, stegas, högst två WebGL-kontexter; utan WebGL stillbilderna", async () => {
    const scenes = [...CourseText.raw(chapter, lang).matchAll(/!\[[^\]]*\]\(viz:([\w-]+)/g)].map((m) => m[1]!);
    expect(scenes.length).toBeGreaterThan(2);
    // In the window (functions, not strings: the page's CSP has no eval).
    const sceneIs = (page: Page, name: string, key: "state" | "step", value: string) =>
      page.waitForFunction(([n, k, v]) => document.querySelector<HTMLElement>(`.cs-viz[data-scene="${n}"]`)?.dataset[k] === v, [name, key, value] as const);
    /** The canvases of running scenes (each its own WebGL context). */
    const contexts = (page: Page) => page.evaluate(() => [...document.querySelectorAll(".cs-viz-host")].filter((h) => h.shadowRoot?.querySelector("canvas")).length, null);
    const openChapter = async (page: Page) => {
      await page.locator(".cs-sidebar button.nav-item").getByText("Hello Triangle", { exact: true }).click();
      await page.getByRole("heading", { name: "Hello Triangle" }).first().waitFor();
      if ((await page.getByRole("dialog").count()) > 0) await page.keyboard.press("Escape");
    };
    {
      const { app, page } = await launch(webgl);
      try {
        await openChapter(page);
        const first = page.locator(`.cs-viz[data-scene="${scenes[0]}"]`);
        await first.scrollIntoViewIfNeeded();
        await sceneIs(page, scenes[0]!, "state", "live");
        await page.waitForFunction((n) => !!document.querySelector(`.cs-viz[data-scene="${n}"] .cs-viz-host`)?.shadowRoot?.querySelector("canvas"), scenes[0]!);
        const before = await first.locator(".cs-viz-step").textContent();
        await shot(page, "8-scene");
        // A step forward with the button, and with the keyboard when the scene has the focus.
        await first.getByRole("button", { name: t("viz.next") }).click();
        await sceneIs(page, scenes[0]!, "step", "2");
        expect(await first.locator(".cs-viz-step").textContent()).not.toBe(before);
        await page.keyboard.press("ArrowRight");
        await sceneIs(page, scenes[0]!, "step", "3");
        await shot(page, "9-scene-stepped");
        // Every scene of the chapter in turn: each runs when it is on screen, and never more than two at once.
        let most = 0;
        for (const name of scenes) {
          await page.locator(`.cs-viz[data-scene="${name}"]`).scrollIntoViewIfNeeded();
          await sceneIs(page, name, "state", "live").catch(async (err: unknown) => {
            const states = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".cs-viz")].map((e) => `${e.dataset.scene}: ${e.dataset.state}`), null);
            throw new Error(`${name} did not start (${states.join(", ")}): ${String(err)}`);
          });
          most = Math.max(most, await contexts(page));
        }
        expect(most).toBeGreaterThan(0);
        expect(most).toBeLessThanOrEqual(2);
        // The overview's stages lead to the scene of the course that shows them (Depth test: in Depth testing); a stage no
        // scene shows is no link.
        const overview = page.locator(`.cs-viz[data-scene="pipeline"]`);
        await overview.scrollIntoViewIfNeeded();
        await sceneIs(page, "pipeline", "state", "live");
        expect(await overview.locator(".cs-viz-host button.ov-chip:disabled").count()).toBeGreaterThan(0);
        await overview.getByRole("button", { name: t("viz.step", { n: 4, total: 4 }) }).click();
        await sceneIs(page, "pipeline", "step", "4");
        await overview.getByRole("button", { name: /^Depth test/ }).click();
        await page.getByRole("heading", { name: "Depth testing" }).first().waitFor();
        await page.waitForFunction(() => (document.activeElement as HTMLElement | null)?.dataset["scene"] === "depth", null);
        await sceneIs(page, "depth", "state", "live");
        await shot(page, "10-scene-link");
        // Leaving the chapter frees them all.
        await page.locator(".cs-sidebar button.nav-item").getByText("Textures", { exact: true }).click();
        await page.getByRole("heading", { name: "Textures" }).first().waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.cs-viz[data-state="live"]').length === 0, null);
        expect(await contexts(page)).toBe(0);
      } finally {
        await app.close();
      }
    }
    {
      const { app, page } = await launch(noWebgl);
      try {
        await openChapter(page);
        const first = page.locator(`.cs-viz[data-scene="${scenes[0]}"]`);
        await first.scrollIntoViewIfNeeded();
        await sceneIs(page, scenes[0]!, "state", "fallback");
        expect(await first.locator("img").getAttribute("src")).toContain(`viz-${scenes[0]}`);
        expect(await contexts(page)).toBe(0);
        await shot(page, "11-scene-fallback");
      } finally {
        await app.close();
      }
    }
  });

  it("--smoke-test går igenom alla kapitel och språk, kontrollerar en lösning och avslutar med 0", () => {
    const r = spawnSync(electronPath, [appDir, ...rootArgs, "--smoke-test"], { env: env(), encoding: "utf8", timeout: 300_000 });
    expect(r.stdout).toMatch(/^SMOKE OK Codestead GP \d+\.\d+\.\d+ \(\d+ chapters, \d+ languages, \d+ projects, \d+ simulated builds, 4 IDEs, [1-9]\d* checks of the learner's code\)$/m);
    expect(r.status).toBe(0);
  });

  it("--version skriver versionen", () => {
    const r = spawnSync(electronPath, [appDir, ...rootArgs, "--version"], { env: env(), encoding: "utf8", timeout: 60_000 });
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.status).toBe(0);
  });
});
