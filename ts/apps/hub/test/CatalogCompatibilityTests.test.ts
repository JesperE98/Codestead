import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/core/Catalog.js";
import { CatalogVerifier } from "../src/core/CatalogVerifier.js";

// The catalog only grows: the native packages each tool lists since the apps check their native updates against the
// signed catalog ("nativePackages", packaging/catalog.py) must not change what released hubs read. The hub's parser
// (Catalog, CatalogTool, Json.ts – unchanged since the TypeScript hub's first release; the C# hub's System.Text.Json
// skipped unknown properties too) is the one the released hubs have, so it reads the new format here: the catalog
// catalog.py writes (ts/packages/ui/test/fixtures/catalog-native-packages.json) and the catalog the releases repository
// really published (catalog-2026-11-19.json, signed with the release key) with every tool's native packages added.

const fixtures = join(__dirname, "..", "..", "..", "packages", "ui", "test", "fixtures");
const releaseKey = readFileSync(join(__dirname, "..", "..", "..", "..", "build", "catalog-signing.pub.pem"), "utf8");
const published = readFileSync(join(fixtures, "catalog-2026-11-19.json"));
const publishedSig = readFileSync(join(fixtures, "catalog-2026-11-19.json.sig"), "utf8");
const newFormat = readFileSync(join(fixtures, "catalog-native-packages.json"));

function testKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    verifier: new CatalogVerifier(publicKey.export({ type: "spki", format: "pem" }).toString()),
    sign: (data: Uint8Array) => sign("sha256", data, { key: privateKey, dsaEncoding: "der" }).toString("base64"),
  };
}

describe("CatalogCompatibilityTests", () => {
  it("den publicerade katalogen godtas med den inbyggda nyckeln (samma kontroll som apparnas uppdatering gör)", () => {
    new CatalogVerifier(releaseKey).verify(published, publishedSig);
    expect(Catalog.parse(published).tools.map((t) => `${t.id} ${t.version}`)).toEqual(["codestead-gp 0.2.7", "codestead-hub 0.2.6", "codestead-linux 0.6.7"]);
  });

  it("katalogen som packaging/catalog.py skriver nu (med nativePackages) läses av hubbens parser", () => {
    const k = testKey();
    k.verifier.verify(newFormat, k.sign(newFormat));
    const c = Catalog.parse(newFormat);
    const hub = c.find("codestead-hub")!;
    expect(hub.version).toBe("0.2.8");
    expect([...hub.assets.keys()]).toEqual(["linux-x64", "win-x64"]);
    expect(hub.assetFor("linux-x64")!.executable).toBe("Codestead.Hub");
    // The hub keeps only what it knows (the window gets the catalog as the hub serializes it).
    expect(new TextDecoder().decode(Catalog.serialize(c))).not.toContain("nativePackages");
  });

  it("den publicerade katalogen med varje verktygs native-paket tillagda: samma verktyg, versioner och filer", () => {
    const grown = JSON.parse(published.toString("utf8")) as { tools: Record<string, unknown>[] };
    for (const t of grown.tools) {
      const v = t.version as string;
      const id = t.id as string;
      const entry = (file: string) => ({ file, sha256: "ab".repeat(32), size: 123456 });
      t.nativePackages = {
        "linux-x64": { deb: entry(`${id}_${v}_amd64.deb`), rpm: entry(`${id}-${v}-1.x86_64.rpm`), arch: entry(`${id}-${v}-1-x86_64.pkg.tar.zst`) },
      };
    }
    const data = new TextEncoder().encode(JSON.stringify(grown, null, 2) + "\n");
    const k = testKey();
    k.verifier.verify(data, k.sign(data));
    const before = Catalog.parse(published);
    const after = Catalog.parse(data);
    expect(new TextDecoder().decode(Catalog.serialize(after))).toBe(new TextDecoder().decode(Catalog.serialize(before)));
  });
});
