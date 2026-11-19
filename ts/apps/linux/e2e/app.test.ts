// End-to-end: builds Codestead Linux and drives the real Electron window with Playwright's _electron – the first
// chapter and the terminal on screen, `ls` in the terminal, the text's questions answered, the first task solved
// and ticked, everything saved in the C# app's files and back after a restart; and --smoke-test.
//
//   npm run test:e2e            (in ts/apps/linux; set E2E_SKIP_BUILD=1 to use the last build)
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
import { ChaptersLib, I18nLib, UiStrings } from "@codestead/linux-content";
import { DistrosLib, Shell, UtilCmd, World } from "@codestead/linux-shell";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------- The little of Playwright this test uses ----------

interface Locator {
  first(): Locator;
  last(): Locator;
  nth(i: number): Locator;
  locator(selector: string): Locator;
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  waitFor(options?: { state?: "visible" | "attached"; timeout?: number }): Promise<void>;
  textContent(): Promise<string | null>;
  inputValue(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  fill(text: string): Promise<void>;
  press(key: string): Promise<void>;
  click(): Promise<void>;
  check(): Promise<void>;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
}

interface Page extends Locator {
  title(): Promise<string>;
  screenshot(options: { path: string }): Promise<Buffer>;
  waitForFunction(fn: string): Promise<unknown>;
  keyboard: { press(key: string): Promise<void> };
}

interface ElectronApp {
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
  process(): ChildProcess;
}

interface PlaywrightElectron {
  launch(options: { executablePath: string; args: string[]; env: Record<string, string | undefined>; timeout?: number }): Promise<ElectronApp>;
}

const require = createRequire(import.meta.url);
const appDir = fileURLToPath(new URL("..", import.meta.url));
const electronPath = require("electron") as string;
const lang = "en";
const t = (key: string, args?: Record<string, unknown>) => UiStrings.translate(lang, key, args);
const shots = process.env["E2E_SHOTS"] ?? null;
const rootArgs = process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let xvfb: ChildProcess | null = null;
let display: string | undefined = process.env["DISPLAY"];
let dataDir = "";

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

async function launch(): Promise<{ app: ElectronApp; page: Page }> {
  const { _electron } = require("playwright") as { _electron: PlaywrightElectron };
  const app = await _electron.launch({ executablePath: electronPath, args: [appDir, ...rootArgs], env: env(), timeout: 60_000 });
  const page = await app.firstWindow();
  await page.locator(".cs-terminal input").waitFor({ state: "visible", timeout: 60_000 });
  return { app, page };
}

async function shot(page: Page, name: string): Promise<void> {
  if (shots !== null) await page.screenshot({ path: path.join(shots, `${name}.png`) });
}

/** Types a command line in the terminal and presses Enter. */
async function typeInTerminal(page: Page, line: string): Promise<void> {
  const input = page.getByRole("textbox", { name: t("terminal.input") });
  await input.click();
  await input.fill(line);
  await input.press("Enter");
}

const firstChapter = ChaptersLib.chapters[0]!;
const ubuntu = DistrosLib.getDistro("ubuntu");

beforeAll(async () => {
  if (process.env["E2E_SKIP_BUILD"] !== "1") execFileSync("npm", ["run", "build"], { cwd: appDir, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  await ensureDisplay();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "codestead-linux-e2e-"));
  if (shots !== null) fs.mkdirSync(shots, { recursive: true });
});

afterAll(() => {
  xvfb?.kill();
  if (dataDir !== "") fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("Codestead Linux (Electron)", () => {
  it("startar med första kapitlet och terminalen; ls skriver ut hemkatalogen; första uppgiften bockas av och sparas", async () => {
    const { app, page } = await launch();
    try {
      // The first chapter, in the default language, with the terminal next to it.
      const title = I18nLib.chapterTitle(firstChapter, lang);
      expect(await page.title()).toBe(`${title} – Codestead Linux`);
      await page.getByRole("heading", { name: "Welcome to the Linux shell" }).first().waitFor();
      const user = World.get(lang).user;
      await page.getByText(`${user}@${ubuntu.hostname} — ${ubuntu.name}`, { exact: true }).waitFor();
      // The tasks wait until the text is worked through.
      await page.getByText(`🔒 ${t("gate.title")}`).waitFor();
      await shot(page, "1-start");

      // ls in the terminal shows what it shows on a new Ubuntu computer.
      await typeInTerminal(page, "ls");
      const fresh = Shell.create("ubuntu", lang);
      fresh.lang = lang;
      const expected = UtilCmd.stripAnsi(fresh.execute("ls").output).replace(/\n$/, "");
      await page.waitForFunction(`[...document.querySelectorAll(".cs-terminal-line")].some((e) => e.textContent.endsWith("$ ls"))`);
      expect(await page.locator(".cs-terminal-output").last().textContent()).toBe(expected);
      await shot(page, "2-ls");

      // Answer the text's questions: quizzes with the mouse, "try it" in the terminal.
      const checkpoints = Checkpoint.parseAll(I18nLib.chapterMarkdown(firstChapter, lang));
      for (const cp of checkpoints) {
        const view = page.locator(".cs-checkpoint").nth(cp.index);
        if (cp.kind === Checkpoint.Quiz) {
          for (const [i, o] of cp.options.entries()) if (o.correct) await view.locator(".cs-checkpoint-option input").nth(i).check();
          await view.getByRole("button", { name: t("checkpoint.check") }).click();
        } else if (cp.kind === Checkpoint.Try) {
          await typeInTerminal(page, cp.commands[0]!);
        } else {
          await view.locator(".cs-checkpoint-answer").fill(cp.expected);
          await view.getByRole("button", { name: t("checkpoint.check") }).click();
        }
        await page.waitForFunction(`document.querySelectorAll(".cs-checkpoint")[${cp.index}].dataset.solved === "true"`);
      }
      // The tasks are unlocked.
      await page.locator(".cs-task").first().waitFor();
      expect(await page.locator(".cs-task").count()).toBe(firstChapter.tasks.length);
      expect(await page.locator(".cs-task").first().getAttribute("data-done")).toBeNull();

      // The first task, solved in the terminal, is ticked.
      const solution = firstChapter.tasks[0]!.solutionFor(ubuntu, World.get(lang));
      for (const line of solution) await typeInTerminal(page, line);
      await page.waitForFunction(`document.querySelector(".cs-task")?.dataset.done === "true"`);
      expect(await page.locator(".cs-task .cs-task-check").first().getAttribute("aria-label")).toBe(t("tasks.done"));
      await shot(page, "3-task-done");
    } finally {
      await app.close();
    }

    // Saved in the C# app's files: state.json with the progress, shell.ubuntu.json with the computer.
    const state = JSON.parse(fs.readFileSync(path.join(dataDir, "codestead-linux", "state.json"), "utf8")) as { progress: Record<string, boolean> };
    expect(state.progress["valkommen/echo"]).toBe(true);
    const saved = Shell.restoreJson(fs.readFileSync(path.join(dataDir, "codestead-linux", "shell.ubuntu.json"), "utf8"))!;
    expect(saved.history.at(-1)).toBe(firstChapter.tasks[0]!.solutionFor(ubuntu, World.get(lang)).at(-1));
  });

  it("efter omstart finns framstegen och terminalens historik kvar", async () => {
    const { app, page } = await launch();
    try {
      await page.locator(`.cs-task[data-done="true"]`).first().waitFor();
      const input = page.getByRole("textbox", { name: t("terminal.input") });
      await input.click();
      await input.press("ArrowUp");
      expect(await input.inputValue()).toBe(firstChapter.tasks[0]!.solutionFor(ubuntu, World.get(lang)).at(-1));
      // Ctrl+C cancels the line.
      await input.press("Control+c");
      expect(await input.inputValue()).toBe("");
      expect(await page.locator(".cs-terminal-line").last().textContent()).toMatch(/\^C$/);
    } finally {
      await app.close();
    }
  });

  it("--smoke-test går igenom alla kapitel och språk och avslutar med 0", () => {
    const r = spawnSync(electronPath, [appDir, ...rootArgs, "--smoke-test"], { env: env(), encoding: "utf8", timeout: 300_000 });
    expect(r.stdout).toMatch(/^SMOKE OK Codestead Linux \d+\.\d+\.\d+ \(\d+ chapters, \d+ languages\)$/m);
    expect(r.status).toBe(0);
  });

  it("--version skriver versionen", () => {
    const r = spawnSync(electronPath, [appDir, ...rootArgs, "--version"], { env: env(), encoding: "utf8", timeout: 60_000 });
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.status).toBe(0);
  });
});
