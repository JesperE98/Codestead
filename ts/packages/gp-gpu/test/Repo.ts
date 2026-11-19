// Paths in the repository (the tests read content from disk), as the C# tests' Repo class finds them.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function find(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "packaging", "products.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("packaging/products.json not found");
    dir = parent;
  }
  return dir;
}

export const Repo = {
  root: find(),
  get content(): string {
    return join(Repo.root, "src", "GP", "content");
  },
};
