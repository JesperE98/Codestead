// The signed catalog (catalog.json + catalog.json.sig in the release "catalog" of the releases repository, written by
// packaging/catalog.py and signed by .github/workflows/release.yml): its signature, and what an app's own update reads
// from it – the product's latest version and the SHA-256 of that version's native packages (.deb, .rpm, Arch). The hub
// checks the same signature for its tool list (ts/apps/hub/src/core/CatalogVerifier.ts uses this file); every app has
// the public key built in (build/catalog-signing.pub.pem), and nothing can give it another one. Node only.
//
// The catalog's format only grows: "nativePackages" is a property of a tool that released hubs do not know and ignore
// (their parser, like System.Text.Json's in the C# hub, skips unknown properties), so they still read and verify it.

import { createPublicKey, type KeyObject, verify } from "node:crypto";

/** The catalog's schema this code reads (Catalog.CurrentSchema of the hub). */
export const catalogSchema = 1;

/** Where the release workflow publishes the catalog: the fixed release "catalog" of the releases repository. */
export function catalogUrl(releasesRepo: string): string {
  return `https://github.com/${releasesRepo}/releases/download/catalog/catalog.json`;
}

/**
 * The catalog's public key ("-----BEGIN PUBLIC KEY-----" PEM, ECDSA P-256), or null when none is given (a build without
 * build/catalog-signing.pub.pem). Throws for a key of another kind.
 */
export function catalogPublicKey(pem: string | null | undefined): KeyObject | null {
  if (pem == null || pem.trim() === "" || !pem.includes("BEGIN PUBLIC KEY")) return null;
  const key = createPublicKey(pem);
  // C#: ECDsa.ImportFromPem (which refuses other key types) and KeySize == 256.
  const curve = key.asymmetricKeyDetails?.namedCurve ?? "";
  if (key.asymmetricKeyType !== "ec" || !curve.includes("256")) throw new Error("The catalog key must be ECDSA P-256.");
  return key;
}

/** Why a signature is not accepted, or "ok". */
export type SignatureCheck = "ok" | "not-base64" | "wrong";

/**
 * Is `signatureBase64` (catalog.json.sig: a DER ECDSA signature of SHA-256, base64) the signature of exactly these
 * bytes?
 */
export function checkCatalogSignature(key: KeyObject, data: Uint8Array, signatureBase64: string): SignatureCheck {
  const sig = fromBase64Strict(signatureBase64.trim());
  if (sig === null) return "not-base64";
  try {
    return verify("sha256", data, { key, dsaEncoding: "der" }, sig) ? "ok" : "wrong";
  } catch {
    return "wrong";
  }
}

/**
 * Convert.FromBase64String: white space is ignored, the rest must be base64 characters with at most two "=" at the
 * end and a length that is a multiple of 4 (Buffer.from(…, "base64") would quietly skip anything else).
 */
function fromBase64Strict(s: string): Buffer | null {
  const compact = s.replace(/[ \t\r\n]/g, "");
  if (compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  return Buffer.from(compact, "base64");
}

/** One native package of a version: its file name in the release <id>-v<version>, SHA-256 and size. */
export interface NativePackageFile {
  readonly file: string;
  /** Lower case hex. */
  readonly sha256: string;
  readonly size: number;
}

/**
 * A tool's "nativePackages" in the catalog: per runtime id ("linux-x64"), per kind ("deb", "rpm", "arch"), the file.
 * Kinds this code does not know are kept (and never used).
 */
export type NativePackages = Readonly<Record<string, Readonly<Record<string, NativePackageFile>>>>;

/** What the signed catalog says about one product. */
export interface SignedRelease {
  readonly version: string;
  /** Null when the catalog's entry was written before the catalog listed native packages. */
  readonly nativePackages: NativePackages | null;
}

/** The catalog cannot be used: its signature, its JSON or the product's entry is wrong. */
export class SignedCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignedCatalogError";
  }
}

function isObject(v: unknown): v is Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Reads "nativePackages" of a tool (the value of the property). Throws a TypeError when its shape is wrong and a
 * {@link SignedCatalogError} when an entry is not usable (a file name with a path, a SHA-256 that is not one, no size).
 */
export function parseNativePackages(v: unknown, path = "nativePackages"): NativePackages {
  if (!isObject(v)) throw new TypeError(`${path} is not an object.`);
  const out: Record<string, Record<string, NativePackageFile>> = {};
  for (const [rid, kinds] of Object.entries(v)) {
    if (!isObject(kinds)) throw new TypeError(`${path}.${rid} is not an object.`);
    const files: Record<string, NativePackageFile> = {};
    for (const [kind, entry] of Object.entries(kinds)) {
      const at = `${path}.${rid}.${kind}`;
      if (!isObject(entry)) throw new TypeError(`${at} is not an object.`);
      const { file, sha256, size } = entry;
      if (typeof file !== "string" || typeof sha256 !== "string" || typeof size !== "number") throw new TypeError(`${at} needs file, sha256 and size.`);
      if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(file) || file.includes("..")) throw new SignedCatalogError(`${at}: invalid file name "${file}".`);
      if (!/^[0-9a-fA-F]{64}$/.test(sha256)) throw new SignedCatalogError(`${at}: invalid SHA-256.`);
      if (!Number.isSafeInteger(size) || size <= 0) throw new SignedCatalogError(`${at}: invalid size.`);
      files[kind] = { file, sha256: sha256.toLowerCase(), size };
    }
    out[rid] = files;
  }
  return out;
}

/**
 * The product `toolId` in a catalog whose signature has been checked against `key`, or null when the catalog does not
 * list it. Throws {@link SignedCatalogError} when the signature does not match these exact bytes, the catalog is not
 * one (or of another schema), or the product's entry is not usable.
 */
export function readSignedRelease(data: Uint8Array, signatureBase64: string, key: KeyObject, toolId: string): SignedRelease | null {
  const check = checkCatalogSignature(key, data, signatureBase64);
  if (check === "not-base64") throw new SignedCatalogError("The catalog signature is not valid base64.");
  if (check !== "ok") throw new SignedCatalogError("The catalog signature is wrong – the catalog has been changed or damaged and is not used.");
  let catalog: unknown;
  try {
    catalog = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new SignedCatalogError("The catalog is not valid JSON.");
  }
  if (!isObject(catalog)) throw new SignedCatalogError("The catalog is not valid JSON.");
  if (catalog.schema !== catalogSchema) throw new SignedCatalogError(`Unsupported catalog schema ${String(catalog.schema)} (this app understands ${catalogSchema}).`);
  const tools = catalog.tools ?? [];
  if (!Array.isArray(tools)) throw new SignedCatalogError("The catalog is not valid JSON.");
  const tool: unknown = tools.find((t: unknown) => isObject(t) && t.id === toolId);
  if (!isObject(tool)) return null;
  if (typeof tool.version !== "string" || !/^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(tool.version)) throw new SignedCatalogError(`${toolId}: invalid version in the catalog.`);
  let nativePackages: NativePackages | null = null;
  if (tool.nativePackages !== undefined && tool.nativePackages !== null) {
    try {
      nativePackages = parseNativePackages(tool.nativePackages, `${toolId}.nativePackages`);
    } catch (e) {
      throw e instanceof SignedCatalogError ? e : new SignedCatalogError(`The catalog is not valid: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { version: tool.version, nativePackages };
}
