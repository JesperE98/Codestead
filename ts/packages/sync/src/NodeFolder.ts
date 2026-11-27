// A SyncFolder on disk, for the hub's main process: the same file names and atomic writes (temp file + rename) as the
// apps' FileStorage. Kept out of the package's main entry because it needs node:fs.

import * as fs from "node:fs";
import * as path from "node:path";
import type { SavedFile, SyncFolder } from "./SyncFolder.js";

/** A name the folder may use: letters, digits, '.', '-' and '_' (no folders, no ".."). */
const safeName = /^(?!\.)[A-Za-z0-9._-]{1,100}$/;

export class NodeFolder implements SyncFolder {
  constructor(readonly directory: string) {}

  private pathFor(name: string): string | null {
    return safeName.test(name) && !name.includes("..") ? path.join(this.directory, name + ".json") : null;
  }

  names(): string[] {
    try {
      return fs
        .readdirSync(this.directory)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -".json".length))
        .filter((n) => this.pathFor(n) !== null);
    } catch {
      return [];
    }
  }

  read(name: string): SavedFile | null {
    const file = this.pathFor(name);
    if (file === null) return null;
    try {
      const text = fs.readFileSync(file, "utf8");
      return { text, modifiedAt: fs.statSync(file).mtimeMs };
    } catch {
      return null;
    }
  }

  write(name: string, text: string): void {
    const file = this.pathFor(name);
    if (file === null) throw new Error(`Not a file name the sync may write: ${name}`);
    fs.mkdirSync(this.directory, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, file);
  }
}
