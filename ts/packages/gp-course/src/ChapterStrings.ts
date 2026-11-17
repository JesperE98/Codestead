/** One text per API; "*" is the text for every API. */
export type PerApiText = ReadonlyMap<string, string>;

/**
 * A chapter's title and task texts in one language (i18n/&lt;lang&gt;/&lt;id&gt;.json). The title, a task's text and its
 * hint are a string, or an object with one string per API: { "opengl": …, "vulkan": …, "d3d12": … }.
 */
export class ChapterStrings {
  title: PerApiText | null = null;
  readonly tasks = new Map<string, { text: PerApiText | null; hint: PerApiText | null }>();

  static parse(json: string): ChapterStrings {
    const root = JSON.parse(json) as unknown;
    const s = new ChapterStrings();
    if (!isObject(root)) return s;
    if (Object.hasOwn(root, "title")) s.title = perApi(root["title"]);
    const tasks = root["tasks"];
    if (isObject(tasks))
      for (const [name, t] of Object.entries(tasks))
        s.tasks.set(name, {
          text: isObject(t) && Object.hasOwn(t, "text") ? perApi(t["text"]) : null,
          hint: isObject(t) && Object.hasOwn(t, "hint") ? perApi(t["hint"]) : null,
        });
    return s;
  }

  static for(texts: PerApiText | null | undefined, api: string): string | null {
    return texts == null ? null : (texts.get(api) ?? texts.get("*") ?? null);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** "*" is the text for every API. */
function perApi(e: unknown): PerApiText | null {
  if (typeof e === "string") return new Map([["*", e]]);
  if (isObject(e)) return new Map(Object.entries(e).filter((p): p is [string, string] => typeof p[1] === "string"));
  return null;
}
