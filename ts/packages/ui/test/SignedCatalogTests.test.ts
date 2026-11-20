// The signed catalog as the apps' native updates read it (SignedCatalog.ts): its signature, the product's version and
// the SHA-256 of its native packages – with the catalog the releases repository really published before the catalog
// listed native packages (fixtures/catalog-2026-11-19.json, signed with the release key: build/catalog-signing.pub.pem)
// and one in the new format, as packaging/catalog.py writes it (fixtures/catalog-native-packages.json).
import { generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  catalogPublicKey,
  catalogUrl,
  checkCatalogSignature,
  parseNativePackages,
  readSignedRelease,
  SignedCatalogError,
} from "../src/electron/SignedCatalog.js";
import { repoRoot } from "./repo.js";

const fixtures = join(__dirname, "fixtures");
const released = readFileSync(join(fixtures, "catalog-2026-11-19.json"));
const releasedSig = readFileSync(join(fixtures, "catalog-2026-11-19.json.sig"), "utf8");
const releaseKey = catalogPublicKey(readFileSync(join(repoRoot(), "build", "catalog-signing.pub.pem"), "utf8"))!;
const newFormat = readFileSync(join(fixtures, "catalog-native-packages.json"));

/** A throw-away signing key, as the tests' own. */
function testKey(): { key: KeyObject; publicKey: KeyObject; sign: (data: Uint8Array) => string } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { key: privateKey, publicKey, sign: (data) => sign("sha256", data, { key: privateKey, dsaEncoding: "der" }).toString("base64") };
}

const json = (o: unknown) => new TextEncoder().encode(JSON.stringify(o, null, 2));

/** A catalog with one tool (the new format's hub entry, changed by `change`). */
function catalogWith(change: (tool: Record<string, unknown>) => void, schema = 1): Uint8Array {
  const c = JSON.parse(newFormat.toString("utf8")) as { schema: number; tools: Record<string, unknown>[] };
  c.schema = schema;
  change(c.tools[0]!);
  return json(c);
}

describe("SignedCatalogTests: signaturen", () => {
  it("katalogen som releasesrepot publicerade stämmer med den inbyggda nyckeln", () => {
    expect(catalogUrl("JesperE98/codestead-releases")).toBe("https://github.com/JesperE98/codestead-releases/releases/download/catalog/catalog.json");
    expect(checkCatalogSignature(releaseKey, released, releasedSig)).toBe("ok");
  });

  it("en ändrad katalog, en annan nyckels signatur eller en signatur som inte är base64: används inte", () => {
    const changed = Buffer.from(released.toString("utf8").replace('"version": "0.6.7"', '"version": "9.6.7"'));
    expect(changed.equals(released)).toBe(false);
    expect(checkCatalogSignature(releaseKey, changed, releasedSig)).toBe("wrong");
    const other = testKey();
    expect(checkCatalogSignature(releaseKey, released, other.sign(released))).toBe("wrong");
    expect(checkCatalogSignature(other.publicKey, released, releasedSig)).toBe("wrong");
    expect(checkCatalogSignature(releaseKey, released, "not base64!")).toBe("not-base64");
    expect(checkCatalogSignature(releaseKey, released, "")).toBe("wrong");
    expect(() => readSignedRelease(changed, releasedSig, releaseKey, "codestead-linux")).toThrow(SignedCatalogError);
    expect(() => readSignedRelease(changed, releasedSig, releaseKey, "codestead-linux")).toThrow(/signature is wrong/);
    expect(() => readSignedRelease(released, "%%%%", releaseKey, "codestead-linux")).toThrow(/not valid base64/);
  });

  it("bara en ECDSA P-256-nyckel; ingen nyckel: null", () => {
    expect(catalogPublicKey(null)).toBeNull();
    expect(catalogPublicKey("")).toBeNull();
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(() => catalogPublicKey(rsa)).toThrow(/P-256/);
    const p384 = generateKeyPairSync("ec", { namedCurve: "secp384r1" }).publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(() => catalogPublicKey(p384)).toThrow(/P-256/);
  });
});

describe("SignedCatalogTests: produkten i katalogen", () => {
  it("den publicerade katalogen (utan nativePackages): versionen, inga paket", () => {
    expect(readSignedRelease(released, releasedSig, releaseKey, "codestead-linux")).toEqual({ version: "0.6.7", nativePackages: null });
    expect(readSignedRelease(released, releasedSig, releaseKey, "codestead-gp")).toEqual({ version: "0.2.7", nativePackages: null });
    expect(readSignedRelease(released, releasedSig, releaseKey, "codestead-unknown")).toBeNull();
  });

  it("det nya formatet (packaging/catalog.py): paketen per processor och sort med SHA-256 och storlek", () => {
    const k = testKey();
    const r = readSignedRelease(newFormat, k.sign(newFormat), k.publicKey, "codestead-hub")!;
    expect(r.version).toBe("0.2.8");
    expect(Object.keys(r.nativePackages!)).toEqual(["linux-x64"]);
    expect(r.nativePackages!["linux-x64"]!["deb"]).toEqual({
      file: "codestead-hub_0.2.8_amd64.deb",
      sha256: "3f04dea33f6ce3ee2bdd7bf653e978cd6e6deb7d2ac881c1844cf541821fc74e",
      size: 38,
    });
    expect(r.nativePackages!["linux-x64"]!["rpm"]!.file).toBe("codestead-hub-0.2.8-1.x86_64.rpm");
    expect(r.nativePackages!["linux-x64"]!["arch"]!.file).toBe("codestead-hub-0.2.8-1-x86_64.pkg.tar.zst");
  });

  it("framåtkompatibelt: okända egenskaper och sorter hoppas över, stora bokstäver i summan blir små", () => {
    const k = testKey();
    const data = catalogWith((t) => {
      const packages = t.nativePackages as Record<string, Record<string, Record<string, unknown>>>;
      packages["linux-x64"]!["flatpak"] = { file: "x.flatpak", sha256: "A".repeat(64), size: 3, signature: "later" };
      packages["linux-x64"]!["deb"]!["mirror"] = "https://example.org/";
      t.somethingNew = { a: 1 };
    });
    const r = readSignedRelease(data, k.sign(data), k.publicKey, "codestead-hub")!;
    expect(r.nativePackages!["linux-x64"]!["flatpak"]!.sha256).toBe("a".repeat(64));
    expect(Object.keys(r.nativePackages!["linux-x64"]!["deb"]!)).toEqual(["file", "sha256", "size"]);
  });

  it("en trasig post, en annan version av schemat eller ingen katalog: fel, inget paket används", () => {
    const k = testKey();
    const bad: [string, Uint8Array][] = [
      ["path", catalogWith((t) => ((t.nativePackages as Record<string, Record<string, Record<string, unknown>>>)["linux-x64"]!["deb"]!.file = "../../etc/x.deb"))],
      ["slash", catalogWith((t) => ((t.nativePackages as Record<string, Record<string, Record<string, unknown>>>)["linux-x64"]!["deb"]!.file = "a/x.deb"))],
      ["sha", catalogWith((t) => ((t.nativePackages as Record<string, Record<string, Record<string, unknown>>>)["linux-x64"]!["deb"]!.sha256 = "abc"))],
      ["size", catalogWith((t) => ((t.nativePackages as Record<string, Record<string, Record<string, unknown>>>)["linux-x64"]!["deb"]!.size = 0))],
      ["type", catalogWith((t) => ((t.nativePackages as Record<string, Record<string, Record<string, unknown>>>)["linux-x64"]!["deb"]!.size = "38"))],
      ["list", catalogWith((t) => (t.nativePackages = []))],
      ["version", catalogWith((t) => (t.version = "0.2.8-beta"))],
      ["schema", catalogWith(() => {}, 2)],
      ["json", new TextEncoder().encode("{ not json")],
      ["array", json([])],
    ];
    for (const [what, data] of bad) expect(() => readSignedRelease(data, k.sign(data), k.publicKey, "codestead-hub"), what).toThrow(SignedCatalogError);
    // Without the property (an older entry): no packages, not an error.
    const old = catalogWith((t) => delete t.nativePackages);
    expect(readSignedRelease(old, k.sign(old), k.publicKey, "codestead-hub")).toEqual({ version: "0.2.8", nativePackages: null });
  });

  it("parseNativePackages: formen", () => {
    expect(() => parseNativePackages(null)).toThrow(TypeError);
    expect(() => parseNativePackages({ "linux-x64": [] })).toThrow(TypeError);
    expect(() => parseNativePackages({ "linux-x64": { deb: { file: "a.deb", sha256: "a".repeat(64) } } })).toThrow(TypeError);
    expect(() => parseNativePackages({ "linux-x64": { deb: { file: "a.deb", sha256: "a".repeat(64), size: 1.5 } } })).toThrow(SignedCatalogError);
    expect(parseNativePackages({})).toEqual({});
  });
});
