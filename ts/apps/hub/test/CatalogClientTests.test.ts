import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CatalogClient } from "../src/core/CatalogClient.js";
import { CatalogException } from "../src/core/CatalogException.js";
import type { CatalogTool } from "../src/core/CatalogTool.js";
import { Fixture, http } from "./Fixture.js";

// HubCoreTests.cs: CatalogClientTests

async function setup<T>(body: (f: Fixture, tool: CatalogTool) => Promise<T>): Promise<T> {
  const f = new Fixture();
  try {
    const { asset } = f.package("0.1.0", false);
    return await body(f, Fixture.tool("0.1.0", asset));
  } finally {
    f.dispose();
  }
}

describe("CatalogClientTests", () => {
  it("hämtar, kontrollerar och sparar katalogen", () =>
    setup(async (f, tool) => {
      const url = f.publish(f.catalogBytes("2026-01-01T00:00:00Z", tool));
      const client = new CatalogClient(http, f.verifier, join(f.dir, "cache"), url);
      const r = await client.load();
      expect(r.fromCache).toBe(false);
      expect(r.catalog.tools.map((t) => t.id)).toEqual(["codestead-test"]);
      expect(existsSync(join(f.dir, "cache", "catalog.json"))).toBe(true);
    }));

  it("en manipulerad katalog används aldrig", () =>
    setup(async (f, tool) => {
      const good = f.catalogBytes("2026-01-01T00:00:00Z", tool);
      const evil = f.catalogBytes("2026-01-02T00:00:00Z", Fixture.tool("9.9.9", tool.assets.get("linux-x64")!));
      const url = f.publish(evil, f.sign(good));
      const client = new CatalogClient(http, f.verifier, join(f.dir, "cache"), url);
      await expect(client.load()).rejects.toBeInstanceOf(CatalogException);

      // With a good cached copy, the hub keeps using it and reports the problem.
      f.publish(good);
      await client.load();
      f.publish(evil, f.sign(good));
      const r = await client.load();
      expect(r.fromCache).toBe(true);
      expect(r.problem).not.toBeNull();
      expect(r.catalog.tools[0]!.version).toBe("0.1.0");
    }));

  it("offline används den senaste kontrollerade katalogen", () =>
    setup(async (f, tool) => {
      const url = f.publish(f.catalogBytes("2026-01-01T00:00:00Z", tool));
      const client = new CatalogClient(http, f.verifier, join(f.dir, "cache"), url);
      await client.load();
      rmSync(fileURLToPath(url));
      const r = await client.load();
      expect(r.fromCache).toBe(true);
      expect(r.catalog.tools).toHaveLength(1);
    }));

  it("en äldre katalog än den senast sedda godtas inte", () =>
    setup(async (f, tool) => {
      const url = f.publish(f.catalogBytes("2026-02-01T00:00:00Z", tool));
      const client = new CatalogClient(http, f.verifier, join(f.dir, "cache"), url);
      await client.load();
      f.publish(f.catalogBytes("2026-01-01T00:00:00Z"));
      const r = await client.load();
      expect(r.fromCache).toBe(true);
      expect(r.catalog.tools).toHaveLength(1);
    }));
});
