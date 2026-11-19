import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root (the folder with packaging/products.json), found from this file's folder. */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "packaging", "products.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("packaging/products.json not found");
    dir = parent;
  }
  return dir;
}
