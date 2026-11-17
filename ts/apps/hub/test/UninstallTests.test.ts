import { closeSync, constants, existsSync, openSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ToolStore } from "../src/core/ToolStore.js";
import { withFixture } from "./Fixture.js";
import { Fixture, http } from "./Fixture.js";

// HubCoreTests.cs: UninstallTests

describe("UninstallTests", () => {
  // Only Windows refuses to delete a file that is open (that is what happens right after a tool exits).
  it.skipIf(process.platform !== "win32")("avinstallation väntar en stund på filer som fortfarande är öppna (Windows)", () =>
    withFixture(async (f) => {
      const store = new ToolStore(f.storeRoot);
      const { asset: a } = f.package("0.1.0", true);
      const t = await store.install(Fixture.tool("0.1.0", a, "win-x64"), a, http);
      // FileShare.None: libuv's UV_FS_O_EXLOCK opens the file without sharing it.
      const fd = openSync(join(t.directory, "lib", "data.txt"), constants.O_RDONLY | (constants.UV_FS_O_EXLOCK ?? 0));
      const release = (async () => {
        await new Promise((r) => setTimeout(r, 700));
        closeSync(fd);
      })();
      await store.uninstall("codestead-test");
      await release;
      expect(store.installed("codestead-test")).toBeNull();
      expect(existsSync(t.directory)).toBe(false);
    }),
  );
});
