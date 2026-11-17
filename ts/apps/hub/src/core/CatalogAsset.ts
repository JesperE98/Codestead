import { type JsonObject, readInteger, readObject, readString } from "./Json.js";

// One downloadable file of a tool in the catalog.

export class CatalogAsset {
  /** Portable archive: .zip on Windows, .tar.gz on Linux. */
  url = "";
  sha256 = "";
  size = 0;
  /** The program to start, relative to the archive root (e.g. "Codestead.Linux.exe"). */
  executable = "";

  constructor(init?: Partial<CatalogAsset>) {
    if (init) Object.assign(this, init);
  }

  static fromJson(v: unknown, path: string): CatalogAsset {
    const o: JsonObject = readObject(v, path);
    return new CatalogAsset({
      url: readString(o, "url", path),
      sha256: readString(o, "sha256", path),
      size: readInteger(o, "size", path),
      executable: readString(o, "executable", path),
    });
  }
}
