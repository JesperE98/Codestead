import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root (the folder with Codestead.sln), found from this file's folder. */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "Codestead.sln"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Codestead.sln not found");
    dir = parent;
  }
  return dir;
}
