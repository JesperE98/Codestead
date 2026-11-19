/// <reference types="vite/client" />
// Port of Resources.cs – the texts and projects of the course. The C# assembly embeds them (see
// Codestead.GP.Course.csproj); here they are read from the same files in the repository (src/GP/content and
// src/GP/Codestead.GP.Course/i18n/ui), so the content is shared and never copied. Logical names are the C# ones, with
// forward slashes: chapters/<lang>/<id>.md, i18n/<lang>/<id>.json, references/<id>.json, ui/<lang>.json,
// projects/<api>/<chapter>/start/<file>, projects/<api>/<chapter>/edits.txt and exercises.txt, images/[<lang>/]<name>.
//
// Texts are bundled with Vite's import.meta.glob (eager, raw), so reading them is synchronous everywhere, as in C#.
// Binary files (the projects' images, models and fonts, the chapters' pictures) are not inlined: their names are known
// at once, and their bytes are read from the repository with node:fs where there is one (Node, Electron's main process,
// the tests), or – in a browser renderer – after `preloadBytes` fetched them from the URLs Vite gives them.

const ROOT = "../../../../src/GP/";

const textGlobs: Record<string, string> = {
  ...import.meta.glob<string>("../../../../src/GP/content/chapters/**/*.md", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("../../../../src/GP/content/i18n/**/*.json", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>("../../../../src/GP/content/references/*.json", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob<string>(["../../../../src/GP/content/projects/*/*/edits.txt", "../../../../src/GP/content/projects/*/*/exercises.txt"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob<string>(
    [
      "../../../../src/GP/content/projects/*/*/start/**/*",
      // (A negative pattern is relative to this file too: "!**/…" would leave src/GP alone.)
      "!../../../../src/GP/content/projects/*/*/start/**/*.{png,jpg,hdr,obj,mtl,otf,ttf,gltf,bin,PNG,JPG,HDR,OBJ,MTL,OTF,TTF,GLTF,BIN}",
    ],
    { query: "?raw", import: "default", eager: true },
  ),
  ...import.meta.glob<string>("../../../../src/GP/Codestead.GP.Course/i18n/ui/*.json", { query: "?raw", import: "default", eager: true }),
};

/** The binary files: their URL, loaded on demand. */
const byteGlobs: Record<string, () => Promise<string>> = {
  ...import.meta.glob<string>(
    [
      "../../../../src/GP/content/projects/*/*/start/**/*.{png,jpg,hdr,obj,mtl,otf,ttf,gltf,bin,PNG,JPG,HDR,OBJ,MTL,OTF,TTF,GLTF,BIN}",
      "../../../../src/GP/content/images/**/*.{png,webp,gif,jpg}",
    ],
    { query: "?url", import: "default" },
  ),
};

/** The logical name of a file under src/GP/ (C#'s LogicalName in the .csproj), or null when it is not a resource. */
function logicalName(path: string): string | null {
  const at = path.indexOf(ROOT);
  if (at < 0) return null;
  const rel = path.slice(at + ROOT.length);
  if (rel.startsWith("content/projects/")) return rel.slice("content/".length);
  if (rel.startsWith("content/")) return rel.slice("content/".length);
  if (rel.startsWith("Codestead.GP.Course/i18n/ui/")) return "ui/" + rel.slice("Codestead.GP.Course/i18n/ui/".length);
  return null;
}

interface Entry {
  /** The path as the glob gives it (relative to this file). */
  path: string;
  text: string | null;
  load: (() => Promise<string>) | null;
}

let names: Map<string, Entry> | null = null;

function all(): Map<string, Entry> {
  if (names !== null) return names;
  const map = new Map<string, Entry>();
  for (const [path, text] of Object.entries(textGlobs)) {
    const name = logicalName(path);
    if (name !== null) map.set(name, { path, text, load: null });
  }
  for (const [path, load] of Object.entries(byteGlobs)) {
    const name = logicalName(path);
    if (name !== null) map.set(name, { path, text: null, load });
  }
  return (names = map);
}

/** The logical names of all resources starting with `prefix`, in ordinal order. */
export function list(prefix: string): string[] {
  return [...all().keys()].filter((k) => k.startsWith(prefix)).sort(ordinal);
}

/** string.CompareOrdinal: UTF-16 code units. */
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The text of a resource (CRLF made LF, as C# reads it), or null when there is none. */
export function read(name: string): string | null {
  const e = all().get(name);
  if (e === undefined) return null;
  if (e.text !== null) return e.text.replaceAll("\r\n", "\n");
  const bytes = readBytes(name);
  return bytes === null ? null : new TextDecoder().decode(bytes).replaceAll("\r\n", "\n");
}

const bytesCache = new Map<string, Uint8Array>();

/** The bytes of a resource, or null when there is none (or, in a browser, when it was not preloaded). */
export function readBytes(name: string): Uint8Array | null {
  const e = all().get(name);
  if (e === undefined) return null;
  if (e.text !== null) return new TextEncoder().encode(e.text);
  const cached = bytesCache.get(name);
  if (cached !== undefined) return cached;
  const fs = nodeFs();
  if (fs === null) return null;
  try {
    const bytes = new Uint8Array(fs.readFileSync(new URL(e.path, import.meta.url)));
    bytesCache.set(name, bytes);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Fetches the binary resources starting with `prefix` so {@link readBytes} has them (a browser renderer: no node:fs).
 * Not needed in Node.
 */
export async function preloadBytes(prefix: string): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [name, e] of all()) {
    if (!name.startsWith(prefix) || e.load === null || bytesCache.has(name)) continue;
    const load = e.load;
    tasks.push(
      (async () => {
        const url = await load();
        const response = await fetch(url);
        bytesCache.set(name, new Uint8Array(await response.arrayBuffer()));
      })(),
    );
  }
  await Promise.all(tasks);
}

interface NodeFs {
  readFileSync(path: URL): Uint8Array;
}

/** node:fs when the code runs in Node (no static import: the package is also bundled for a browser renderer). */
function nodeFs(): NodeFs | null {
  const p = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  return (p?.getBuiltinModule?.("node:fs") as NodeFs | undefined) ?? null;
}
