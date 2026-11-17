import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CatalogAsset } from "../src/core/CatalogAsset.js";
import { ArgumentError, InvalidDataError, IOError } from "../src/core/Errors.js";
import { executablePath } from "../src/core/InstalledTool.js";
import { ToolStore } from "../src/core/ToolStore.js";
import { writeZip } from "./ArchiveWriters.js";
import { Fixture, http, withFixture } from "./Fixture.js";
import { sep } from "node:path";

// HubCoreTests.cs: ToolStoreTests

describe("ToolStoreTests", () => {
  it.each([false, true])("installerar, uppdaterar, återställer och avinstallerar (zip: %s)", (zip) =>
    withFixture(async (f) => {
      const store = new ToolStore(f.storeRoot);
      expect(store.installed("codestead-test")).toBeNull();

      const { asset: a1 } = f.package("0.1.0", zip);
      const progress: number[] = [];
      const t1 = await store.install(Fixture.tool("0.1.0", a1), a1, http, (p) => progress.push(p));
      expect(t1.version).toBe("0.1.0");
      expect(existsSync(executablePath(t1, sep))).toBe(true);
      expect(readFileSync(join(t1.directory, "lib", "data.txt"), "utf8")).toBe("0.1.0");
      if (process.platform !== "win32" && !zip) expect(statSync(executablePath(t1, sep)).mode & 0o100).not.toBe(0);
      expect(store.installed("codestead-test")!.version).toBe("0.1.0");

      const { asset: a2 } = f.package("0.2.0", zip);
      const t2 = await store.install(Fixture.tool("0.2.0", a2), a2, http);
      expect(t2.previous).toBe("0.1.0");
      expect(existsSync(t1.directory), "the previous version is kept").toBe(true);

      const { asset: a3 } = f.package("0.3.0", zip);
      const t3 = await store.install(Fixture.tool("0.3.0", a3), a3, http);
      expect(t3.previous).toBe("0.2.0");
      expect(existsSync(t1.directory), "older versions are removed").toBe(false);
      expect(readdirSync(join(f.storeRoot, "tools", "codestead-test")).filter((n) => n.startsWith("."))).toEqual([]);

      const back = store.rollBack("codestead-test");
      expect(back!.version).toBe("0.2.0");
      expect(store.installed("codestead-test")!.version).toBe("0.2.0");

      expect(store.all()).toHaveLength(1);
      await store.uninstall("codestead-test");
      expect(store.installed("codestead-test")).toBeNull();
      expect(store.all()).toEqual([]);
    }),
  );

  it("fel kontrollsumma eller storlek installerar ingenting och rör inte den gamla versionen", () =>
    withFixture(async (f) => {
      const store = new ToolStore(f.storeRoot);
      const { asset: good } = f.package("0.1.0", false);
      await store.install(Fixture.tool("0.1.0", good), good, http);

      const { asset: a2 } = f.package("0.2.0", false);
      const wrongHash = new CatalogAsset({ url: a2.url, sha256: "a".repeat(64), size: a2.size, executable: a2.executable });
      await expect(store.install(Fixture.tool("0.2.0", wrongHash), wrongHash, http)).rejects.toBeInstanceOf(InvalidDataError);
      const tooSmall = new CatalogAsset({ url: a2.url, sha256: a2.sha256, size: a2.size - 1, executable: a2.executable });
      await expect(store.install(Fixture.tool("0.2.0", tooSmall), tooSmall, http)).rejects.toBeInstanceOf(InvalidDataError);
      const tooBig = new CatalogAsset({ url: a2.url, sha256: a2.sha256, size: a2.size + 1, executable: a2.executable });
      await expect(store.install(Fixture.tool("0.2.0", tooBig), tooBig, http)).rejects.toBeInstanceOf(InvalidDataError);
      const noExe = new CatalogAsset({ url: a2.url, sha256: a2.sha256, size: a2.size, executable: "missing" });
      await expect(store.install(Fixture.tool("0.2.0", noExe), noExe, http)).rejects.toBeInstanceOf(InvalidDataError);

      const current = store.installed("codestead-test");
      expect(current!.version).toBe("0.1.0");
      expect(existsSync(executablePath(current!, sep))).toBe(true);
      expect(readdirSync(join(f.storeRoot, "tools", "codestead-test")).sort()).toEqual(["0.1.0", "current.json"]);
    }));

  it("arkiv som försöker skriva utanför installationsmappen stoppas", () =>
    withFixture(async (f) => {
      const file = join(f.dir, "evil.zip");
      writeZip(file, [
        { name: "tool.exe", data: Buffer.alloc(0), mode: 0o644 },
        { name: "../../evil.txt", data: Buffer.alloc(0), mode: 0o644 },
      ]);
      const bytes = readFileSync(file);
      const asset = new CatalogAsset({ url: pathToFileURL(file).href, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, executable: "tool.exe" });
      const store = new ToolStore(f.storeRoot);
      await expect(store.install(Fixture.tool("0.1.0", asset), asset, http)).rejects.toBeInstanceOf(IOError);
      expect(existsSync(join(f.storeRoot, "evil.txt"))).toBe(false);
      expect(existsSync(join(f.storeRoot, "tools", "evil.txt"))).toBe(false);
      expect(store.installed("codestead-test")).toBeNull();
    }));

  it("ogiltiga id:n blir aldrig mappnamn", () => {
    expect(ToolStore.isSafeId("codestead-linux")).toBe(true);
    for (const bad of ["", "..", "a/b", "A", "-x", "a b", "a\\b"]) expect(ToolStore.isSafeId(bad), bad).toBe(false);
    expect(() => new ToolStore("x").installed("../x")).toThrow(ArgumentError);
  });
});
