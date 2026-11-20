/// <reference types="vite/client" />
// The pictures of the chapters' texts: `![alt](images/name.webp "caption")` alone in a paragraph. They are in
// src/Linux/content/images – images/<lang>/name.webp for a picture with words (or the learner's file names) in it, and
// images/name.webp for one that is the same in every language – drawn by images/diagrams/make.mjs (see "Bilder i
// Codestead Linux" in docs/DEVELOPMENT.md). A language without its own picture gets the English one.
//
// Vite gives every picture a URL (the built app gets a copy of each; only the ones shown are loaded). The diagrams'
// folder and its node_modules are not pictures of the app: only files directly in images/ and one folder down are.

const urls: Readonly<Record<string, string>> = import.meta.glob<string>(
  ["../../../../src/Linux/content/images/*.{webp,png,gif,jpg}", "../../../../src/Linux/content/images/*/*.{webp,png,gif,jpg}"],
  { query: "?url", import: "default", eager: true },
);

const folder = "/src/Linux/content/";

/** Logical name ("images/en/fs-tree.webp") → URL. */
const byName: ReadonlyMap<string, string> = new Map(
  Object.entries(urls)
    .filter(([path]) => !path.includes("/images/diagrams/"))
    .map(([path, url]) => [path.slice(path.indexOf(folder) + folder.length), url] as const),
);

export const Prefix = "images/";

/** The logical names of all pictures ("images/en/fs-tree.webp", "images/log-lines.webp" …), sorted. */
export function names(): string[] {
  return [...byName.keys()].sort();
}

/**
 * The picture a chapter's `images/name.webp` is shown from in a language: images/<lang>/name.webp, else the English
 * one, else the shared images/name.webp. Null when there is none (or the path is not a picture of the chapters).
 */
export function resolve(path: string, lang: string): string | null {
  if (!path.startsWith(Prefix) || path.includes("..")) return null;
  const name = path.slice(Prefix.length);
  if (name.includes("/")) return byName.has(path) ? path : null;
  for (const l of [...new Set([lang, "en"])]) {
    const own = `${Prefix}${l}/${name}`;
    if (byName.has(own)) return own;
  }
  return byName.has(path) ? path : null;
}

/** The URL of the picture a chapter's `images/name.webp` is shown from in a language (see {@link resolve}), or null. */
export function url(path: string, lang: string): string | null {
  const name = resolve(path, lang);
  return name === null ? null : (byName.get(name) ?? null);
}
