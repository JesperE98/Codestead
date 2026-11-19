// Port of I18n.cs (src/content/i18n.ts) – looks up chapter texts, titles and task texts in the chosen language,
// with English and finally Swedish as fallback. The texts are read with Resources: chapters/<lang>/<id>.md and
// i18n/<lang>/<id>.json (TS: import.meta.glob).

import type { Reference } from "@codestead/learning";
import { type Distro, Js } from "@codestead/linux-shell";
import type { Lang } from "./Language.js";
import * as LanguagesLib from "./LanguagesLib.js";
import * as Resources from "./Resources.js";
import type { Chapter } from "./Types/Chapter.js";
import type { ChapterStrings } from "./Types/ChapterStrings.js";
import type { ChapterTask } from "./Types/ChapterTask.js";
import type { ChapterTaskStrings } from "./Types/ChapterTaskStrings.js";
import { FamilyText } from "./Types/FamilyText.js";
import { PerDistro } from "./Types/PerDistro.js";
import * as TypesLib from "./Types/TypesLib.js";

const markdownCache = new Map<string, string | null>();
const stringsCache = new Map<string, ChapterStrings | null>();

function md(lang: string, id: string): string | null {
  const name = `chapters/${lang}/${id}.md`;
  if (!markdownCache.has(name)) markdownCache.set(name, Resources.read(name));
  return markdownCache.get(name)!;
}

function strings(lang: string, id: string): ChapterStrings | null {
  const name = `i18n/${lang}/${id}.json`;
  if (!stringsCache.has(name)) {
    const json = Resources.read(name);
    stringsCache.set(name, json !== null ? parseStrings(json) : null);
  }
  return stringsCache.get(name)!;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parses a translation file; texts and hints may be a string or { debian, arch, redhat }. */
export function parseStrings(json: string): ChapterStrings {
  const root: unknown = JSON.parse(json);
  const result: ChapterStrings = { title: null, tasks: null };
  if (!isObject(root)) return result;
  if (typeof root["title"] === "string") result.title = root["title"];
  const tasks = root["tasks"];
  if (isObject(tasks)) {
    result.tasks = Js.obj<ChapterTaskStrings>();
    for (const [name, t] of Object.entries(tasks)) {
      if (!isObject(t)) continue;
      result.tasks.set(name, {
        text: Object.hasOwn(t, "text") ? text(t["text"]) : null,
        hint: Object.hasOwn(t, "hint") ? text(t["hint"]) : null,
      });
    }
  }
  return result;
}

function text(e: unknown): PerDistro<string> | null {
  if (typeof e === "string") return e;
  if (isObject(e)) {
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return TypesLib.fromFamilyText(new FamilyText({ debian: str(e["debian"]), arch: str(e["arch"]), redhat: str(e["redhat"]) }));
  }
  return null;
}

/** The chapter's markdown in the chosen language (or the closest fallback). */
export function chapterMarkdown(chapter: Chapter, lang: Lang): string {
  for (const l of LanguagesLib.fallbackChain(lang)) {
    const t = md(l, chapter.id);
    if (t) return t;
  }
  return `# ${chapter.title}\n`;
}

const referencesCache = new Map<string, Reference[]>();

/** Official sources for a chapter (src/Linux/content/references/&lt;id&gt;.json). Empty if there are none. */
export function references(chapter: Chapter): Reference[] {
  let list = referencesCache.get(chapter.id);
  if (list === undefined) {
    const json = Resources.read(`references/${chapter.id}.json`);
    // C#: JsonSerializer with Js.JsonOptions (camelCase names).
    list = json !== null ? ((JSON.parse(json) as Reference[] | null) ?? []) : [];
    referencesCache.set(chapter.id, list);
  }
  return list;
}

/** Is the chapter translated into the language (both text and tasks)? */
export function isTranslated(chapter: Chapter, lang: Lang): boolean {
  if (lang === "sv") return !!md("sv", chapter.id);
  const s = strings(lang, chapter.id);
  return !!md(lang, chapter.id) && s !== null && chapter.tasks.every((t) => PerDistro.truthy(s.tasks?.get(t.id)?.text));
}

export function chapterTitle(chapter: Chapter, lang: Lang): string {
  for (const l of LanguagesLib.fallbackChain(lang)) {
    if (l === "sv" && chapter.title !== "") return chapter.title;
    const title = strings(l, chapter.id)?.title;
    if (title) return title;
  }
  return chapter.title;
}

function taskString(chapter: Chapter, task: ChapterTask, lang: Lang, hint: boolean, distro: Distro): string | null {
  for (const l of LanguagesLib.fallbackChain(lang)) {
    let value: PerDistro<string> | null | undefined;
    if (l === "sv") value = hint ? task.hint : task.text;
    else {
      const t = strings(l, chapter.id)?.tasks?.get(task.id);
      value = hint ? t?.hint : t?.text;
    }
    if (value !== null && value !== undefined) return TypesLib.resolve(value, distro);
  }
  return null;
}

export function taskText(chapter: Chapter, task: ChapterTask, lang: Lang, distro: Distro): string {
  return taskString(chapter, task, lang, false, distro) ?? task.id;
}

export function taskHint(chapter: Chapter, task: ChapterTask, lang: Lang, distro: Distro): string | null {
  return taskString(chapter, task, lang, true, distro);
}

/** All languages that have a markdown file for the chapter. */
export function languagesWithMarkdown(chapter: Chapter): string[] {
  return Resources.list("chapters/")
    .filter((k) => k.endsWith(`/${chapter.id}.md`))
    .map((k) => k.split("/")[1]!);
}
