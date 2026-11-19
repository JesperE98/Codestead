import { Languages } from "@codestead/common";
import { Apis } from "@codestead/gp-gpu";
import type { Reference } from "@codestead/learning";
import type { ApiReference } from "./ApiReference.js";
import { ChapterStrings } from "./ChapterStrings.js";
import * as Resources from "./Resources.js";

const markdown = new Map<string, string | null>();
const strings = new Map<string, ChapterStrings | null>();
const referenceCache = new Map<string, ApiReference[]>();

function md(lang: string, id: string): string | null {
  const name = `chapters/${lang}/${id}.md`;
  if (!markdown.has(name)) markdown.set(name, Resources.read(name));
  return markdown.get(name)!;
}

function stringsFor(lang: string, id: string): ChapterStrings | null {
  const name = `i18n/${lang}/${id}.json`;
  if (!strings.has(name)) {
    const json = Resources.read(name);
    strings.set(name, json !== null ? ChapterStrings.parse(json) : null);
  }
  return strings.get(name)!;
}

const opener = /^:::[ \t]*(\S.*?)[ \t]*$/;
const closer = /^:::[ \t]*$/;
const placeholderRe = /\{\{([A-Za-z0-9_]+)\}\}/g;

/**
 * The course's texts in the learner's language, API and IDE: chapter markdown with :::opengl / :::vulkan / :::d3d12
 * blocks (several APIs: ":::vulkan d3d12") and :::ide blocks (":::ide vs rider"), {{placeholders}}, titles and task
 * texts. English is the source; a text missing in a language falls back to English.
 */
export const CourseText = {
  /** The chapter's markdown as written (all APIs), in the language or the closest fallback. */
  raw(chapterId: string, lang: string): string {
    for (const l of Languages.fallbackChain(lang)) {
      const text = md(l, chapterId);
      if (text !== null && text.length > 0) return text;
    }
    return `# ${chapterId}\n`;
  },

  languagesWithText(chapterId: string): readonly string[] {
    return Resources.list("chapters/")
      .filter((k) => k.endsWith(`/${chapterId}.md`))
      .map((k) => k.split("/")[1]!);
  },

  /** The ids of a block's opening line (":::vulkan d3d12" → vulkan, d3d12; ":::ide vs rider" → ide, vs, rider). */
  blockIds(opener: string): string[] {
    return opener.split(/[ ,\t]/).filter((s) => s.length > 0);
  },

  /**
   * Keeps the blocks for `api` and `ide` and fills in the placeholders. API blocks (":::opengl", ":::vulkan d3d12") and
   * IDE blocks (":::ide vs rider") end with a line ":::"; IDE blocks may sit inside API blocks. Without an IDE every
   * IDE block is kept (the tests, counting the questions).
   */
  preprocess(markdownText: string, api: string, ide: string | null = null): string {
    const lines = markdownText.replaceAll("\r\n", "\n").split("\n");
    const output: string[] = [];
    const open: boolean[] = [];
    for (const line of lines) {
      const m = opener.exec(line);
      if (m !== null && !closer.test(line)) {
        const ids = CourseText.blockIds(m[1]!);
        open.push(ids[0] === "ide" ? ide === null || ids.slice(1).includes(ide) : ids.includes(api));
        continue;
      }
      if (closer.test(line) && open.length > 0) {
        const shown = open.pop()!;
        // A left-out block leaves an empty line, so the paragraphs around it stay apart.
        if (!shown && open.every((v) => v)) output.push("");
        continue;
      }
      if (open.every((v) => v)) output.push(line);
    }
    return CourseText.fill(output.join("\n"), api);
  },

  fill(text: string, api: string): string {
    const info = Apis.get(api);
    const values = new Map([
      ["api", info.name],
      ["apiFull", info.fullName],
      ["shaderLanguage", info.shadingLanguage],
    ]);
    return text.replace(placeholderRe, (whole, name: string) => values.get(name) ?? whole);
  },

  /** The chapter's text ready to show for an API (and an IDE: null keeps every IDE's steps). */
  lesson(chapterId: string, lang: string, api: string, ide: string | null = null): string {
    return CourseText.preprocess(CourseText.raw(chapterId, lang), api, ide);
  },

  title(chapterId: string, lang: string, api: string): string {
    for (const l of Languages.fallbackChain(lang)) {
      const t = ChapterStrings.for(stringsFor(l, chapterId)?.title, api);
      if (t !== null && t.length > 0) return CourseText.fill(t, api);
    }
    return chapterId;
  },

  taskText(chapterId: string, taskId: string, lang: string, api: string): string {
    for (const l of Languages.fallbackChain(lang)) {
      const t = stringsFor(l, chapterId)?.tasks.get(taskId)?.text;
      const s = t != null ? ChapterStrings.for(t, api) : null;
      if (s !== null) return CourseText.fill(s, api);
    }
    return taskId;
  },

  taskHint(chapterId: string, taskId: string, lang: string, api: string): string | null {
    for (const l of Languages.fallbackChain(lang)) {
      const t = stringsFor(l, chapterId)?.tasks.get(taskId)?.hint;
      const s = t != null ? ChapterStrings.for(t, api) : null;
      if (s !== null) return CourseText.fill(s, api);
    }
    return null;
  },

  /** Official sources for a chapter (references/&lt;id&gt;.json); a source may be for one API only ("api"). */
  references(chapterId: string, api: string): Reference[] {
    let list = referenceCache.get(chapterId);
    if (list === undefined) {
      const json = Resources.read(`references/${chapterId}.json`);
      referenceCache.set(chapterId, (list = json !== null ? parseReferences(json) : []));
    }
    return list.filter((r) => r.api === null || r.api === api).map((r) => ({ title: r.title, url: r.url, publisher: r.publisher }));
  },
};

/** JsonSerializer.Deserialize&lt;List&lt;ApiReference&gt;&gt; with PropertyNameCaseInsensitive. */
function parseReferences(json: string): ApiReference[] {
  const data = JSON.parse(json) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((item: unknown) => {
    const r: ApiReference = { title: "", url: "", publisher: "", api: null };
    if (typeof item === "object" && item !== null)
      for (const [k, v] of Object.entries(item)) {
        const key = k.toLowerCase();
        if (key === "title" && typeof v === "string") r.title = v;
        else if (key === "url" && typeof v === "string") r.url = v;
        else if (key === "publisher" && typeof v === "string") r.publisher = v;
        else if (key === "api") r.api = typeof v === "string" ? v : null;
      }
    return r;
  });
}
