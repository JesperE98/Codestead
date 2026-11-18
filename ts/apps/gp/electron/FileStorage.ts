// C#'s Codestead.UI.Storage for the Electron main process: small JSON files in the tool's data folder (the same
// folder and names as the C# app, so progress carries over). Writes are atomic (temp file + rename) so a crash never
// leaves a half-written file. Every method is best effort and never throws.

import * as fs from "node:fs";
import * as path from "node:path";
import type { Storage } from "@codestead/ui";

/** A file name the renderer may use: letters, digits, '.', '-' and '_' (no folders, no "..") – e.g. "shell.ubuntu". */
const safeName = /^(?!\.)[A-Za-z0-9._-]{1,100}$/;

export class FileStorage implements Storage {
  constructor(readonly directory: string) {}

  /** The file of a name, or null for a name that could leave the folder. */
  private pathFor(name: string): string | null {
    return safeName.test(name) && !name.includes("..") ? path.join(this.directory, name + ".json") : null;
  }

  loadText(name: string): string | null {
    const file = this.pathFor(name);
    if (file === null) return null;
    try {
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    } catch {
      return null;
    }
  }

  saveText(name: string, json: string): void {
    const file = this.pathFor(name);
    if (file === null) return;
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      const tmp = file + ".tmp";
      fs.writeFileSync(tmp, json, "utf8");
      fs.renameSync(tmp, file);
    } catch {
      // Saving is best effort; the app keeps working without it.
    }
  }

  remove(name: string): void {
    const file = this.pathFor(name);
    if (file === null) return;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // Best effort.
    }
  }
}
