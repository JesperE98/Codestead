// Port of World.cs – the student's simulated computer in the student's language: the user name, the names of
// the exercise files and folders, and what people wrote in them (a fruit list, grades, notes, a small web page ...).
// Each language has src/Linux/Codestead.Shell/world/<lang>.json (shared with the C# app, read from the repository):
//
//   {
//     "locale": "en_US.UTF-8",
//     "names": { "user": "student", "documents": "documents", "fruits": "fruits.txt", ... },
//     "words": { "userFull": "Student", "helloWorld": "Hello world", ... },
//     "files": { "fruits": "apple\nbanana\n...", "grades": "...", ... }
//   }
//
// "names" are things the student types as file, folder, user, group, variable or branch names. They are
// ASCII so they can be typed on any keyboard (languages in other scripts use the English names).
// "words" are short texts in the student's language. Chapter texts, task texts and the task checks refer
// to both with {{key}} placeholders, e.g. `~/{{documents}}/{{fruits}}`.
//
// What programs write (logs, configuration files, system files) is English in every language, like on a
// real computer. en.json is the source; every language has the same keys (see the world tests).

import w_ar from "../../../../src/Linux/Codestead.Shell/world/ar.json" with { type: "json" };
import w_de from "../../../../src/Linux/Codestead.Shell/world/de.json" with { type: "json" };
import w_en from "../../../../src/Linux/Codestead.Shell/world/en.json" with { type: "json" };
import w_es from "../../../../src/Linux/Codestead.Shell/world/es.json" with { type: "json" };
import w_fr from "../../../../src/Linux/Codestead.Shell/world/fr.json" with { type: "json" };
import w_hi from "../../../../src/Linux/Codestead.Shell/world/hi.json" with { type: "json" };
import w_ja from "../../../../src/Linux/Codestead.Shell/world/ja.json" with { type: "json" };
import w_pt from "../../../../src/Linux/Codestead.Shell/world/pt.json" with { type: "json" };
import w_ru from "../../../../src/Linux/Codestead.Shell/world/ru.json" with { type: "json" };
import w_sv from "../../../../src/Linux/Codestead.Shell/world/sv.json" with { type: "json" };
import w_zh from "../../../../src/Linux/Codestead.Shell/world/zh.json" with { type: "json" };

interface WorldFile {
  locale?: string;
  names?: Record<string, string>;
  words?: Record<string, string>;
  files?: Record<string, string>;
}

/** The world files built into the app (embedded resources in C#), by language code. */
const builtIn: Record<string, WorldFile> = {
  ar: w_ar,
  de: w_de,
  en: w_en,
  es: w_es,
  fr: w_fr,
  hi: w_hi,
  ja: w_ja,
  pt: w_pt,
  ru: w_ru,
  sv: w_sv,
  zh: w_zh,
};

function toMap(o: Record<string, string> | undefined): Map<string, string> {
  return new Map(Object.entries(o ?? {}).map(([k, v]) => [k, v ?? ""]));
}

export class World {
  static readonly Source = "en";

  readonly lang: string;
  /** The value of $LANG in the terminal, e.g. "sv_SE.UTF-8". */
  readonly locale: string;
  readonly names: ReadonlyMap<string, string>;
  readonly words: ReadonlyMap<string, string>;
  readonly files: ReadonlyMap<string, string>;

  private constructor(lang: string, file: WorldFile) {
    this.lang = lang;
    this.locale = file.locale ?? "en_US.UTF-8";
    this.names = toMap(file.names);
    this.words = toMap(file.words);
    this.files = toMap(file.files);
  }

  /** The student's user name (also the home directory /home/<user>). */
  get user(): string {
    return this.names.get("user")!;
  }

  get home(): string {
    return `/home/${this.user}`;
  }

  /** A name or a word (the indexer this[key] in C#). */
  get(key: string): string {
    const n = this.names.get(key);
    if (n !== undefined) return n;
    const w = this.words.get(key);
    if (w !== undefined) return w;
    throw new Error(`world/${this.lang}.json has no "${key}"`);
  }

  /** The contents of an exercise file. */
  file(key: string): string {
    const f = this.files.get(key);
    if (f === undefined) throw new Error(`world/${this.lang}.json has no file "${key}"`);
    return f;
  }

  /** Fills in the {{name}} and {{word}} placeholders of this world. Other placeholders are kept. */
  expand(text: string): string {
    return text.includes("{{") ? text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (m, key: string) => this.names.get(key) ?? this.words.get(key) ?? m) : text;
  }

  /** All names and words, for placeholders in texts. */
  get placeholders(): [string, string][] {
    return [...this.names, ...this.words];
  }

  // ---------- Loading ----------

  private static all: Map<string, World> | null = null;

  private static load(): Map<string, World> {
    const all = new Map<string, World>();
    for (const [lang, file] of Object.entries(builtIn)) all.set(lang, new World(lang, file));
    // For translators: world files on disk override the built-in ones (see docs/DEVELOPMENT.md). Node only.
    const proc = (globalThis as { process?: NodeJS.Process }).process;
    const dir = proc?.env?.["CODESTEAD_WORLD_DIR"];
    const fs = dir ? (proc?.getBuiltinModule?.("node:fs") as typeof import("node:fs") | undefined) : undefined;
    if (dir && fs?.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith(".json")) continue;
        try {
          const lang = name.slice(0, -".json".length);
          all.set(lang, new World(lang, JSON.parse(fs.readFileSync(`${dir}/${name}`, "utf8")) as WorldFile));
        } catch (e) {
          // A file that is being written: keep the built-in world.
          if (!(e instanceof SyntaxError)) throw e;
        }
      }
    }
    return all;
  }

  private static worlds(): Map<string, World> {
    return (World.all ??= World.load());
  }

  /** The language codes that have a world. */
  static get languages(): string[] {
    return [...World.worlds().keys()];
  }

  static has(lang: string | null | undefined): boolean {
    return lang !== null && lang !== undefined && World.worlds().has(lang);
  }

  /** The world of a language (English when the language has none). */
  static get(lang: string | null | undefined): World {
    return (lang !== null && lang !== undefined ? World.worlds().get(lang) : undefined) ?? World.worlds().get(World.Source)!;
  }
}
