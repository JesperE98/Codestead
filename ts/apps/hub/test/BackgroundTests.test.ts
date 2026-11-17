import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Autostart } from "../src/core/Autostart.js";
import { SingleInstance } from "../src/core/SingleInstance.js";

// BackgroundTests.cs

describe("BackgroundTests", () => {
  it.skipIf(process.platform !== "linux")("autostart skriver och tar bort .desktop-filen (Linux)", () => {
    const dir = mkdtempSync(join(tmpdir(), "codestead-autostart-"));
    try {
      const autostart = new Autostart("codestead-hub-test", dir);
      expect(autostart.isEnabled).toBe(false);
      autostart.enable("Codestead", "/opt/my apps/codestead-hub", "--background");
      expect(autostart.isEnabled).toBe(true);
      const text = readFileSync(autostart.desktopFile, "utf8");
      expect(text).toContain('Exec="/opt/my apps/codestead-hub" --background');
      expect(text).toContain("Name=Codestead");
      autostart.disable();
      expect(autostart.isEnabled).toBe(false);
      autostart.disable(); // already off: nothing happens
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("en andra start av hubben visar den första", async () => {
    const name = `codestead-hub-test-${randomUUID().replace(/-/g, "")}`;
    const first = new SingleInstance(name);
    const second = new SingleInstance(name);
    try {
      expect(await first.notifyRunning()).toBe(false); // nobody listens yet: this is the first hub
      const shown = new Promise<void>((resolve) => void first.listen(resolve));
      await new Promise((r) => setTimeout(r, 200));
      expect(await second.notifyRunning()).toBe(true);
      await expect(Promise.race([shown, new Promise((_, reject) => setTimeout(() => reject(new Error("not shown")), 5000))])).resolves.toBeUndefined();
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
