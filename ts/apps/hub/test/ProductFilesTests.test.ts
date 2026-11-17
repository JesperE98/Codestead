import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ProductFilesTests.cs: packaging/products.json says which files belong to each product; a product only gets a new
// version when they change. The hub leaves out parts of the shared src/Shared/Codestead.UI that only Codestead Linux
// uses – this checks that the (C#) hub and the parts of Codestead.UI it does use really never touch them. The C# hub
// is still released, so the checks stay as they are.

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "Codestead.sln"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("Codestead.sln not found");
    dir = parent;
  }
  return dir;
}

interface Product {
  key: string;
  dir: string;
  paths: string[];
  own: string[];
  exclude?: string[];
}

const products = () => JSON.parse(readFileSync(join(repoRoot(), "packaging", "products.json"), "utf8")) as Product[];

function filesUnder(dir: string, filter: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

const typeRe = /\b(?:class|record|struct|enum|interface)\s+([A-Z]\w*)/g;

describe("ProductFilesTests", () => {
  it("varje produkts egna filer (own) finns och hör till dess paths", () => {
    // packaging/plan.py: a change in a product's own files always makes a new version; a change only in the rest
    // of its paths does so only when its changelog has an entry for it.
    const root = repoRoot();
    for (const product of products()) {
      expect(product.own).toContain(product.dir);
      for (const o of product.own) {
        expect(product.paths.includes(o), `${product.key}: own entry ${o} is not in its paths`).toBe(true);
        const dir = dirname(join(root, o));
        let exists: boolean;
        if (o.includes("*")) {
          const pattern = new RegExp("^" + basename(o).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
          exists = existsSync(dir) && readdirSync(dir).some((f) => pattern.test(f) && statSync(join(dir, f)).isFile());
        } else exists = existsSync(join(root, o));
        expect(exists, `${product.key}: own entry ${o} does not exist`).toBe(true);
      }
    }
  });

  it("hubben använder inget av det som products.json undantar för den", () => {
    const root = repoRoot();
    const hub = products().find((p) => p.key === "hub")!;
    const excluded = (hub.exclude ?? []).map((e) => resolve(root, e));

    const excludedFiles: string[] = [];
    for (const e of excluded) {
      expect(existsSync(e), `products.json excludes ${e}, which does not exist`).toBe(true);
      excludedFiles.push(...(statSync(e).isDirectory() ? filesUnder(e, (f) => f.endsWith(".cs")) : [e]));
    }
    const types = new Set(excludedFiles.flatMap((f) => [...readFileSync(f, "utf8").matchAll(typeRe)].map((m) => m[1]!)));
    expect(types.size).toBeGreaterThan(0);

    const built = (f: string) => !f.includes(`${sep}obj${sep}`) && !f.includes(`${sep}bin${sep}`);
    const users = ["src/Hub", "src/Shared"]
      .flatMap((d) => filesUnder(join(root, d), (f) => f.endsWith(".cs") || f.endsWith(".axaml")))
      .filter((f) => built(f) && !excludedFiles.includes(f));
    for (const file of users) {
      const text = readFileSync(file, "utf8");
      for (const type of types)
        expect(
          new RegExp(`\\b${type}\\b`).test(text),
          `${relative(root, file)} uses ${type}, which packaging/products.json excludes from the hub. Remove it from "exclude" there.`,
        ).toBe(false);
    }
  });
});
