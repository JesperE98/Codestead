import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appDir, createWorld, electronPath, ensureDisplay, sandboxArgs, type World } from "./setup.js";

// End-to-end: the built hub (npm run build) in Electron, with the world of setup.ts – a signed catalog of local
// packages, so nothing is downloaded. Run with `npm run test:e2e` in ts/apps/hub.

// Playwright is not a dependency of the workspace: it is found where it is installed (NODE_PATH, a global install).
interface Locator {
  click(): Promise<void>;
  textContent(): Promise<string | null>;
  waitFor(o?: { state?: "visible" | "hidden" | "detached"; timeout?: number }): Promise<void>;
  count(): Promise<number>;
  locator(selector: string): Locator;
  getByRole(role: string, o?: { name?: string | RegExp }): Locator;
  first(): Locator;
}
interface Page {
  locator(selector: string): Locator;
  getByRole(role: string, o?: { name?: string | RegExp }): Locator;
  keyboard: { press(key: string): Promise<void> };
  title(): Promise<string>;
  screenshot(o: { path: string }): Promise<Buffer>;
  waitForFunction(fn: string, arg?: unknown, o?: { timeout?: number }): Promise<unknown>;
}
interface ElectronApp {
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
}
const playwright = createRequire(import.meta.url)("playwright") as { _electron: { launch(o: { executablePath: string; args: string[]; env: Record<string, string> }): Promise<ElectronApp> } };

const shots = process.env.CODESTEAD_E2E_SHOTS;

describe("the hub", () => {
  let world: World;
  let display: Awaited<ReturnType<typeof ensureDisplay>>;
  let app: ElectronApp;
  let page: Page;

  beforeAll(async () => {
    expect(existsSync(join(appDir, "dist-electron", "main.cjs")), "run npm run build first").toBe(true);
    display = await ensureDisplay();
    world = createWorld();
    app = await playwright._electron.launch({
      executablePath: electronPath,
      args: [appDir, ...sandboxArgs, ...world.args],
      env: { ...world.env, ...(display.display ? { DISPLAY: display.display } : {}) },
    });
    page = await app.firstWindow();
  });

  afterAll(async () => {
    await app?.close();
    display?.stop();
    if (world) rmSync(world.dir, { recursive: true, force: true });
  });

  const card = (id: string) => page.locator(`[data-tool="${id}"]`);

  it("shows the tools of the catalog and their state", async () => {
    await card("codestead-linux").locator(".hub-status").waitFor();
    expect(await page.title()).toBe("Codestead");
    const linux = await card("codestead-linux").textContent();
    expect(linux).toContain("Codestead Linux");
    expect(linux).toContain("Learn the Linux shell by doing.");
    expect(linux).toContain("Installed: 0.6.3 · Latest version: 0.6.5");
    expect(linux).toContain("Pipe fitter"); // its profile
    expect(await card("codestead-linux").getByRole("button", { name: /Update to 0.6.5/ }).count()).toBe(1);
    expect(await card("codestead-linux").getByRole("button", { name: /Open/ }).count()).toBe(1);

    const gp = await card("codestead-gp").textContent();
    expect(gp).toContain("Codestead GP");
    expect(gp).toContain("Latest version: 0.2.5");
    expect(gp).not.toContain("Installed");
    expect(await card("codestead-gp").getByRole("button", { name: /Install/ }).count()).toBe(1);
    // The hub itself is not listed.
    expect(await card("codestead-hub").count()).toBe(0);
    if (shots) {
      mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: join(shots, "hub-tools.png") });
    }
  });

  it("opens the news and closes them with ✕ and with Escape", async () => {
    const dialog = page.getByRole("dialog");
    await card("codestead-linux").getByRole("button", { name: "What's new" }).click();
    await dialog.waitFor();
    const text = await dialog.textContent();
    expect(text).toContain("What's new in Codestead Linux");
    expect(text).toContain("Linux 0.6.5: something new");
    if (shots) await page.screenshot({ path: join(shots, "hub-news.png") });
    await dialog.getByRole("button", { name: "Close" }).first().click(); // the ✕
    await dialog.waitFor({ state: "detached" });

    await card("codestead-gp").getByRole("button", { name: "What's new" }).click();
    await dialog.waitFor();
    expect(await dialog.textContent()).toContain("What's new in Codestead GP");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  });

  it("installs a tool and updates another from the catalog's packages", async () => {
    await card("codestead-gp").getByRole("button", { name: /Install/ }).click();
    await page.waitForFunction(`document.querySelector('[data-tool="codestead-gp"] .hub-status')?.textContent.includes("Installed: 0.2.5 · up to date")`, undefined, { timeout: 30_000 });
    expect(existsSync(join(world.hubDir, "tools", "codestead-gp", "0.2.5", "Codestead.GP"))).toBe(true);

    await card("codestead-linux").getByRole("button", { name: /Update to 0.6.5/ }).click();
    // An update shows what changed since the installed version.
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ timeout: 30_000 });
    const news = await dialog.textContent();
    expect(news).toContain("Linux 0.6.5");
    expect(news).toContain("Linux 0.6.4");
    expect(news).not.toContain("Linux 0.6.3");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    expect(await card("codestead-linux").locator(".hub-status").textContent()).toBe("Installed: 0.6.5 · up to date");
    expect(await card("codestead-linux").getByRole("button", { name: /Go back to 0.6.3/ }).count()).toBe(1);
    if (shots) await page.screenshot({ path: join(shots, "hub-installed.png") });
  });
});

describe("the hub's smoke test", () => {
  it("installs a tool, starts it with --smoke-test and removes it (packaging/hub-e2e.sh)", async () => {
    const display = await ensureDisplay();
    const world = createWorld();
    try {
      const r = spawnSync(electronPath, [appDir, ...sandboxArgs, "--smoke-test", ...world.args, "--install", "codestead-gp"], {
        env: { ...world.env, CODESTEAD_HUB_E2E: "", ...(display.display ? { DISPLAY: display.display } : {}) },
        encoding: "utf8",
        timeout: 120_000,
      });
      expect(r.stdout, r.stderr).toContain("SMOKE OK codestead-gp 0.2.5 (e2e)");
      expect(r.stdout).toMatch(/SMOKE OK Codestead \S+ \(\d+ languages, installed, started and removed codestead-gp 0\.2\.5\)/);
      expect(r.status).toBe(0);
      expect(existsSync(join(world.hubDir, "tools", "codestead-gp", "current.json"))).toBe(false);
    } finally {
      display.stop();
      rmSync(world.dir, { recursive: true, force: true });
    }
  });
});
