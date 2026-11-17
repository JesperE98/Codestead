import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// The Storage module alone: the main process must not load the React parts of @codestead/ui.
import { type Storage, storageDirectory } from "@codestead/ui/storage";

/**
 * @codestead/ui's Storage with files (C#'s Codestead.UI.Storage): `<name>.json` in the tool's folder
 * ({@link storageDirectory}: the same folder as the C# apps', so progress and settings carry over). Writes are atomic
 * (temp file + rename); every method is best effort and never throws.
 */
export class FileStorage implements Storage {
  readonly directory: string;

  constructor(toolId: string, baseDirectory?: string) {
    this.directory = storageDirectory(toolId, { platform: process.platform, env: process.env, home: homedir(), ...(baseDirectory !== undefined ? { baseDirectory } : {}) });
  }

  private pathFor(name: string): string {
    return join(this.directory, name + ".json");
  }

  loadText(name: string): string | null {
    try {
      return readFileSync(this.pathFor(name), "utf8");
    } catch {
      return null;
    }
  }

  saveText(name: string, json: string): void {
    try {
      mkdirSync(this.directory, { recursive: true });
      const path = this.pathFor(name);
      const tmp = path + ".tmp";
      writeFileSync(tmp, json);
      renameSync(tmp, path);
    } catch {
      // Saving is best effort; the app keeps working without it.
    }
  }

  remove(name: string): void {
    try {
      rmSync(this.pathFor(name), { force: true });
    } catch {
      // Best effort.
    }
  }
}
