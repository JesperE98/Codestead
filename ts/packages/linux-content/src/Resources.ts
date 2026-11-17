/// <reference types="vite/client" />
// Port of Resources.cs – reads the course texts. The C# app embeds them in its assembly (see Codestead.Content.csproj);
// here they are read from the same files in the repository with Vite's import.meta.glob (eager, as raw text), so the
// content is shared and never copied. Logical names are the C# ones, always with forward slashes:
// chapters/<lang>/<id>.md, i18n/<lang>/<id>.json, references/<id>.json and ui/<lang>.json.

const chapters = import.meta.glob<string>("../../../../src/Linux/content/chapters/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const i18n = import.meta.glob<string>("../../../../src/Linux/content/i18n/**/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const references = import.meta.glob<string>("../../../../src/Linux/content/references/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const ui = import.meta.glob<string>("../../../../src/Linux/Codestead.Content/i18n/ui/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** All texts, keyed by logical name (C#: the manifest resource names). */
let names: Map<string, string> | null = null;

function load(): Map<string, string> {
  const all = new Map<string, string>();
  const add = (files: Record<string, string>, folder: string, logical: string) => {
    for (const [path, text] of Object.entries(files)) {
      const at = path.indexOf(folder);
      if (at >= 0) all.set(logical + path.slice(at + folder.length), text);
    }
  };
  add(chapters, "/src/Linux/content/chapters/", "chapters/");
  add(i18n, "/src/Linux/content/i18n/", "i18n/");
  add(references, "/src/Linux/content/references/", "references/");
  add(ui, "/src/Linux/Codestead.Content/i18n/ui/", "ui/");
  return all;
}

function all(): Map<string, string> {
  return (names ??= load());
}

/** The logical names (with forward slashes) of all texts starting with `prefix`, in ordinal order. */
export function list(prefix: string): string[] {
  return [...all().keys()].filter((k) => k.startsWith(prefix)).sort();
}

/** The text of a resource, or null when it does not exist. */
export function read(name: string): string | null {
  return all().get(name) ?? null;
}
