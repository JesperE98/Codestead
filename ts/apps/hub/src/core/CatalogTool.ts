import { CatalogAsset } from "./CatalogAsset.js";
import { CatalogChange } from "./CatalogChange.js";
import { CatalogException } from "./CatalogException.js";
import { JsonShapeError, readList, readMap, readNullableString, readObject, readString } from "./Json.js";
import { isSafeId } from "./SafeId.js";
import { SemVer } from "./SemVer.js";

// One tool in the catalog.

export class CatalogTool {
  /** Package id, e.g. "codestead-linux". Also the folder name of the installation. */
  id = "";
  name = "";
  /** Short description per language code; "en" is required. */
  description = new Map<string, string>();
  version = "";
  releaseNotesUrl: string | null = null;
  /** What changed in the latest versions, newest first (changelog/&lt;id&gt;.json). Older catalogs have none. */
  changes: CatalogChange[] | null = null;
  /** Downloads per platform, keyed by runtime id ("win-x64", "linux-x64"). */
  assets = new Map<string, CatalogAsset>();

  constructor(init?: {
    id?: string;
    name?: string;
    description?: Record<string, string>;
    version?: string;
    releaseNotesUrl?: string | null;
    changes?: CatalogChange[] | null;
    assets?: Record<string, CatalogAsset>;
  }) {
    if (!init) return;
    this.id = init.id ?? "";
    this.name = init.name ?? "";
    this.description = new Map(Object.entries(init.description ?? {}));
    this.version = init.version ?? "";
    this.releaseNotesUrl = init.releaseNotesUrl ?? null;
    this.changes = init.changes ?? null;
    this.assets = new Map(Object.entries(init.assets ?? {}));
  }

  descriptionFor(lang: string): string {
    return this.description.get(lang) ?? this.description.get("en") ?? "";
  }

  assetFor(rid: string): CatalogAsset | null {
    return this.assets.get(rid) ?? null;
  }

  static fromJson(v: unknown, path: string): CatalogTool {
    const o = readObject(v, path);
    const t = new CatalogTool();
    t.id = readString(o, "id", path);
    t.name = readString(o, "name", path);
    t.description = readMap(o, "description", path, (d, p) => {
      if (typeof d !== "string") throw new JsonShapeError(p, "System.String");
      return d;
    });
    t.version = readString(o, "version", path);
    t.releaseNotesUrl = readNullableString(o, "releaseNotesUrl", path);
    t.changes = o.changes === undefined || o.changes === null ? null : readList(o.changes, `${path}.changes`, CatalogChange.fromJson);
    t.assets = readMap(o, "assets", path, CatalogAsset.fromJson);
    return t;
  }

  /** @internal Throws {@link CatalogException} for a tool the hub must not use. */
  validate(): void {
    if (!isSafeId(this.id)) throw new CatalogException(`Invalid tool id "${this.id}".`);
    if (SemVer.parse(this.version) === null) throw new CatalogException(`${this.id}: invalid version "${this.version}".`);
    for (const [rid, a] of this.assets) {
      const scheme = absoluteUriScheme(a.url);
      if (scheme !== "https" && scheme !== "file") throw new CatalogException(`${this.id}/${rid}: the download must be an https address.`);
      if (a.sha256.length !== 64 || !/^[0-9a-fA-F]*$/.test(a.sha256)) throw new CatalogException(`${this.id}/${rid}: invalid SHA-256.`);
      if (a.size <= 0) throw new CatalogException(`${this.id}/${rid}: invalid size.`);
      if (a.executable.trim() === "" || a.executable.includes("..") || isPathRooted(a.executable))
        throw new CatalogException(`${this.id}/${rid}: invalid executable "${a.executable}".`);
    }
  }
}

/** An absolute local path ("/opt/x", "C:\x", "\\server\x"), which .NET's Uri also takes as a file:// address. */
export function isLocalPath(s: string): boolean {
  return s.startsWith("/") || /^[A-Za-z]:[\\/]/.test(s) || s.startsWith("\\\\");
}

/** The scheme of an absolute address (Uri.TryCreate(…, UriKind.Absolute)), or null when it is not one. */
export function absoluteUriScheme(s: string): string | null {
  if (isLocalPath(s)) return "file";
  try {
    return new URL(s).protocol.replace(/:$/, "");
  } catch {
    return null;
  }
}

/**
 * Path.IsPathRooted, for the platforms the hub runs on: "/x" and "\x", and on Windows also "C:x" – checked on every
 * platform, so a catalog cannot be valid on one and not on the other.
 */
export function isPathRooted(p: string): boolean {
  return p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p);
}
