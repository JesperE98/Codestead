import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// packaging/products.json says which files belong to each product; a product only gets a new version when they change
// (packaging/plan.py). The hub leaves out the parts of the shared packages (ts/packages/ui, ts/packages/learning) that
// only the learning apps use – this checks, by following the hub's imports, that the hub really never uses them.

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "packaging", "products.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("packaging/products.json not found");
    dir = parent;
  }
  return dir;
}

interface Product {
  key: string;
  dir: string;
  app: string;
  paths: string[];
  own: string[];
  exclude?: string[];
}

const root = repoRoot();
const products = () => (JSON.parse(readFileSync(join(root, "packaging", "products.json"), "utf8")) as { products: Product[] }).products;

/** Does a products.json entry (a path, or a file name pattern with * and ?) name something that exists? */
function exists(entry: string): boolean {
  if (!entry.includes("*") && !entry.includes("?")) return existsSync(join(root, entry));
  const dir = dirname(join(root, entry));
  const pattern = new RegExp("^" + basename(entry).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return existsSync(dir) && readdirSync(dir).some((f) => pattern.test(f) && statSync(join(dir, f)).isFile());
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
}

// --- The hub's imports ------------------------------------------------------------------------------------------------

const workspace = join(root, "ts");

/** "@codestead/ui/storage" → its file, from the package's exports (package.json). */
function packageFile(spec: string): string | null {
  const m = /^@codestead\/([^/]+)(\/.*)?$/.exec(spec);
  if (m === null) return null;
  const dir = [join(workspace, "packages", m[1]!), join(workspace, "apps", m[1]!)].find((d) => existsSync(join(d, "package.json")));
  if (dir === undefined) throw new Error(`no workspace package ${spec}`);
  const exports = (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports?: Record<string, string> }).exports ?? {};
  const target = exports["." + (m[2] ?? "")];
  if (target === undefined) throw new Error(`${spec} is not exported by ${relative(root, dir)}/package.json`);
  return resolve(dir, target);
}

/** A relative import ("./X.js", "../Y", "./a.css?raw") → its file. */
function relativeFile(from: string, spec: string): string {
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ""));
  for (const candidate of [base, base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base + ".ts", base + ".tsx", join(base, "index.ts")])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  throw new Error(`${relative(root, from)}: cannot resolve ${spec}`);
}

interface Import {
  file: string;
  /** The names imported, or null for the whole module (import * as, side effects, export * from). */
  names: string[] | null;
}

/** The workspace modules a file imports, with the names it takes from each. */
function importsOf(file: string): Import[] {
  if (!/\.(ts|tsx|mts|cts)$/.test(file)) return [];
  const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const out: Import[] = [];
  const add = (spec: string, names: string[] | null) => {
    const target = spec.startsWith(".") ? relativeFile(file, spec) : packageFile(spec);
    if (target !== null) out.push({ file: target, names });
  };
  for (const m of text.matchAll(/\b(?:import|export)\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    const clause = m[1]!.trim();
    if (clause.includes("*")) {
      add(m[2]!, null);
      continue;
    }
    const braces = /\{([\s\S]*)\}/.exec(clause);
    const list = braces === null ? [] : names(braces[1]!);
    if (!clause.startsWith("{")) list.push("default");
    add(m[2]!, list);
  }
  for (const m of text.matchAll(/\bimport\s+["']([^"']+)["']/g)) add(m[1]!, null);
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]!, null);
  return out;
}

/** "A, type B, C as D" → the exported names ["A", "B", "C"]. */
function names(list: string): string[] {
  return list
    .split(",")
    .map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim())
    .filter((n) => n !== "");
}

/** Does a module itself declare (not re-export) `name`? */
function declares(file: string, name: string): boolean {
  const text = readFileSync(file, "utf8");
  const n = name.replace(/\$/g, "\\$");
  if (new RegExp(`\\bexport\\s+(?:default\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class|interface|type|enum|namespace)\\s+${n}\\b`).test(text)) return true;
  return [...text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/g)].some((m) => names(m[1]!).includes(name) || m[1]!.split(",").some((p) => p.trim().split(/\s+as\s+/)[1]?.trim() === name));
}

/** Where a barrel's `name` comes from: the module that declares it (following export * from / export { } from). */
function provider(file: string, name: string, seen = new Set<string>()): Import | null {
  if (seen.has(file)) return null;
  seen.add(file);
  if (declares(file, name)) return { file, names: [name] };
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s+["']([^"']+)["']/g)) {
    const entry = m[1]!.split(",").map((p) => p.trim().replace(/^type\s+/, "")).find((p) => p.split(/\s+as\s+/).pop()!.trim() === name);
    if (entry !== undefined) {
      const target = m[2]!.startsWith(".") ? relativeFile(file, m[2]!) : packageFile(m[2]!);
      return target === null ? null : provider(target, entry.split(/\s+as\s+/)[0]!.trim(), seen) ?? { file: target, names: null };
    }
  }
  for (const m of text.matchAll(/\bexport\s+\*\s+from\s+["']([^"']+)["']/g)) {
    const target = m[1]!.startsWith(".") ? relativeFile(file, m[1]!) : packageFile(m[1]!);
    const found = target === null ? null : provider(target, name, seen);
    if (found !== null) return found;
  }
  return null;
}

/** A barrel: a module of re-exports only (a package's index.ts). */
const isBarrel = (file: string) => basename(file) === "index.ts" && /\bexport\s+\*\s+from\b/.test(readFileSync(file, "utf8"));

/** Every workspace file the given files use, following imports; from a barrel only the modules of the names taken. */
function used(entries: string[]): Set<string> {
  const reached = new Set<string>();
  const queue: Import[] = entries.map((file) => ({ file, names: null }));
  while (queue.length > 0) {
    const { file, names: wanted } = queue.pop()!;
    if (isBarrel(file) && wanted !== null) {
      for (const name of wanted) {
        if (name === "default") continue;
        const from = provider(file, name);
        if (from === null) throw new Error(`${relative(root, file)} does not export ${name}`);
        queue.push(from);
      }
      continue;
    }
    if (reached.has(file)) continue;
    reached.add(file);
    queue.push(...importsOf(file));
  }
  return reached;
}

describe("ProductFilesTests", () => {
  it("varje produkts egna filer (own) finns och hör till dess paths, och allt den nämner finns", () => {
    // packaging/plan.py: a change in a product's own files always makes a new version; a change only in the rest
    // of its paths does so only when its changelog has an entry for it.
    for (const product of products()) {
      expect(product.own).toContain(product.dir);
      expect(product.own).toContain(product.app);
      for (const o of product.own) expect(product.paths.includes(o), `${product.key}: own entry ${o} is not in its paths`).toBe(true);
      for (const e of [...product.paths, ...(product.exclude ?? [])]) expect(exists(e), `${product.key}: ${e} does not exist`).toBe(true);
    }
  });

  it("varje produkts app och de paket den använder hör till dess paths", () => {
    for (const product of products()) {
      const app = join(root, product.app);
      const entries = ["src", "electron"].filter((d) => existsSync(join(app, d))).flatMap((d) => filesUnder(join(app, d)));
      const packages = new Set(
        [...used(entries)].map((f) => relative(root, f).replaceAll("\\", "/")).filter((f) => f.startsWith("ts/packages/")).map((f) => f.split("/").slice(0, 3).join("/")),
      );
      expect(packages.size, product.key).toBeGreaterThan(0);
      for (const p of packages) expect(product.paths, `${product.key} uses ${p}`).toContain(p);
    }
  });

  it("hubben använder inget av det som products.json undantar för den", () => {
    const hub = products().find((p) => p.key === "hub")!;
    const app = join(root, hub.app);
    const reached = [...used([...filesUnder(join(app, "src")), ...filesUnder(join(app, "electron"))])].map((f) => relative(root, f).replaceAll("\\", "/"));
    expect(reached.length).toBeGreaterThan(0);
    // CODESTEAD_SHOW_UNUSED=1: the files of the shared packages the hub does not use (candidates for "exclude").
    if (process.env["CODESTEAD_SHOW_UNUSED"])
      console.log(
        ["ts/packages/ui/src", "ts/packages/learning/src", "ts/packages/common/src"]
          .flatMap((d) => filesUnder(join(root, d)))
          .map((f) => relative(root, f).replaceAll("\\", "/"))
          .filter((f) => !reached.includes(f))
          .join("\n"),
      );
    // What the hub leaves out of the shared packages besides their tests: the learning window and the lesson controls.
    const sharedSource = (hub.exclude ?? []).filter((e) => e.startsWith("ts/packages/") && !e.split("/").includes("test"));
    expect(sharedSource.length).toBeGreaterThan(0);
    for (const e of hub.exclude ?? [])
      for (const f of reached)
        expect(
          f === e || f.startsWith(e + "/"),
          `${f} is used by the hub, but packaging/products.json excludes ${e} from the hub. Remove it from "exclude" there.`,
        ).toBe(false);
  });
});
