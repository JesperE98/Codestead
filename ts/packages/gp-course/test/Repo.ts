// Paths in the repository (the tests read solution/ folders and texts from disk), as the C# tests' Repo class finds
// them; and the guard for the readers (registered by @codestead/gp-gpu as they are ported).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readerFor } from "@codestead/gp-gpu";
import { it } from "vitest";

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

/** The reader of an API is registered in @codestead/gp-gpu (OpenGL, Vulkan, Direct3D 12: ported in turn). */
export const hasReader = (api: string): boolean => readerFor(api) !== null;

/** A test that needs the readers of some APIs: skipped (and says why) until they are registered, then it runs. */
export function itNeeds(apis: readonly string[], name: string, fn: () => void, timeout?: number): void {
  const missing = apis.filter((a) => !hasReader(a));
  if (missing.length === 0) it(name, fn, timeout);
  else it.skip(`${name} – needs the ${missing.join(", ")} reader`, fn);
}
