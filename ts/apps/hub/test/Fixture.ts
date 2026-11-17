import { createHash, generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Catalog } from "../src/core/Catalog.js";
import { CatalogAsset } from "../src/core/CatalogAsset.js";
import { CatalogTool } from "../src/core/CatalogTool.js";
import { CatalogVerifier } from "../src/core/CatalogVerifier.js";
import type { HttpClient } from "../src/core/Http.js";
import { entriesOf, writeTarGz, writeZip } from "./ArchiveWriters.js";

/** The packages are file:// addresses, so the network is never used (C#: a plain HttpClient). */
export const http: HttpClient = {
  getBytes: () => Promise.reject(new Error("no network in the tests")),
  getStream: () => Promise.reject(new Error("no network in the tests")),
};


/** A temporary folder with a signing key, packages and a catalog – removed after each test. */
export class Fixture {
  readonly dir = mkdtempSync(join(tmpdir(), "codestead-hub-test-"));
  private readonly key: KeyObject;
  readonly publicPem: string;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    this.key = privateKey;
    this.publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  }

  get verifier(): CatalogVerifier {
    return new CatalogVerifier(this.publicPem);
  }

  get storeRoot(): string {
    return join(this.dir, "store");
  }

  sign(data: Uint8Array): string {
    return sign("sha256", data, { key: this.key, dsaEncoding: "der" }).toString("base64");
  }

  /** Builds a portable package with an executable "tool" (and "tool.exe") printing the version. */
  package(version: string, zip: boolean, tweak?: (src: string) => void): { path: string; asset: CatalogAsset } {
    const src = join(this.dir, `src-${version}-${zip}`);
    mkdirSync(join(src, "lib"), { recursive: true });
    writeFileSync(join(src, "tool"), `#!/bin/sh\necho ${version}\n`);
    writeFileSync(join(src, "tool.exe"), version);
    writeFileSync(join(src, "lib", "data.txt"), version);
    tweak?.(src);
    const file = join(this.dir, `tool-${version}` + (zip ? ".zip" : ".tar.gz"));
    if (zip) writeZip(file, entriesOf(src));
    else writeTarGz(file, entriesOf(src));
    const bytes = readFileSync(file);
    return {
      path: file,
      asset: new CatalogAsset({
        url: pathToFileURL(file).href,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
        executable: zip ? "tool.exe" : "tool",
      }),
    };
  }

  static tool(version: string, asset: CatalogAsset, rid = "linux-x64"): CatalogTool {
    return new CatalogTool({
      id: "codestead-test",
      name: "Codestead Test",
      description: { en: "A test tool", sv: "Ett testverktyg" },
      version,
      assets: { [rid]: asset },
    });
  }

  catalogBytes(generated: string, ...tools: CatalogTool[]): Uint8Array {
    return Catalog.serialize(new Catalog({ schema: 1, generated, tools }));
  }

  /** Writes catalog.json and its signature; returns the catalog URL. */
  publish(catalog: Uint8Array, signature?: string): URL {
    const dir = join(this.dir, "web");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "catalog.json"), catalog);
    writeFileSync(join(dir, "catalog.json.sig"), signature ?? this.sign(catalog));
    return pathToFileURL(join(dir, "catalog.json"));
  }

  dispose(): void {
    try {
      rmSync(this.dir, { recursive: true, force: true });
    } catch {
      // Removed by the system later.
    }
  }
}

/** `using`-like helper: runs `body` with fixtures and disposes them afterwards. */
export async function withFixture<T>(body: (f: Fixture) => Promise<T> | T): Promise<T> {
  const f = new Fixture();
  try {
    return await body(f);
  } finally {
    f.dispose();
  }
}
