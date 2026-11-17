// Port of ShellI18n.cs – the simulator's own texts (tips, notes, the welcome banner and the one-line summaries
// shown by help) in every language. They live in src/Linux/Codestead.Shell/i18n/<lang>.json (shared with the
// C# app, read from the repository):
//
//   { "messages": { "<key>": "text with {placeholders}" }, "summaries": { "<command>": "..." } }
//
// en.json is the source; a missing key falls back to English. The summaries in en.json and sv.json
// are generated from CommandDef.summaryEn/summary (see the ShellI18n tests) – edit them in the code.
// Output that imitates real programs (error messages, man pages) is not translated.

import t_ar from "../../../../src/Linux/Codestead.Shell/i18n/ar.json" with { type: "json" };
import t_de from "../../../../src/Linux/Codestead.Shell/i18n/de.json" with { type: "json" };
import t_en from "../../../../src/Linux/Codestead.Shell/i18n/en.json" with { type: "json" };
import t_es from "../../../../src/Linux/Codestead.Shell/i18n/es.json" with { type: "json" };
import t_fr from "../../../../src/Linux/Codestead.Shell/i18n/fr.json" with { type: "json" };
import t_hi from "../../../../src/Linux/Codestead.Shell/i18n/hi.json" with { type: "json" };
import t_ja from "../../../../src/Linux/Codestead.Shell/i18n/ja.json" with { type: "json" };
import t_pt from "../../../../src/Linux/Codestead.Shell/i18n/pt.json" with { type: "json" };
import t_ru from "../../../../src/Linux/Codestead.Shell/i18n/ru.json" with { type: "json" };
import t_sv from "../../../../src/Linux/Codestead.Shell/i18n/sv.json" with { type: "json" };
import t_zh from "../../../../src/Linux/Codestead.Shell/i18n/zh.json" with { type: "json" };

interface TextsFile {
  messages?: Record<string, string>;
  summaries?: Record<string, string>;
}

interface Texts {
  messages: Map<string, string>;
  summaries: Map<string, string>;
}

/** The i18n files built into the app (embedded resources in C#), by language code. */
const files: Record<string, TextsFile> = {
  ar: t_ar,
  de: t_de,
  en: t_en,
  es: t_es,
  fr: t_fr,
  hi: t_hi,
  ja: t_ja,
  pt: t_pt,
  ru: t_ru,
  sv: t_sv,
  zh: t_zh,
};

export const Source = "en";

let all: Map<string, Texts> | null = null;

function load(): Map<string, Texts> {
  const result = new Map<string, Texts>();
  for (const [lang, file] of Object.entries(files)) {
    result.set(lang, {
      messages: new Map(Object.entries(file.messages ?? {}).map(([k, v]) => [k, v ?? ""])),
      summaries: new Map(Object.entries(file.summaries ?? {}).map(([k, v]) => [k, v ?? ""])),
    });
  }
  return result;
}

function texts(): Map<string, Texts> {
  return (all ??= load());
}

/** The language codes that have a file (en, sv, de ...). */
export function languages(): string[] {
  return [...texts().keys()];
}

/** All message texts of a language (empty when the language has no file). */
export function messages(lang: string): ReadonlyMap<string, string> {
  return texts().get(lang)?.messages ?? new Map();
}

/** All command summaries of a language (empty when the language has no file). */
export function summaries(lang: string): ReadonlyMap<string, string> {
  return texts().get(lang)?.summaries ?? new Map();
}

/** The values of a message's {placeholders} (a list of (Name, Value) tuples in C#). */
export type MsgArgs = Record<string, unknown>;

/** The message key in lang (else English) with {placeholders} filled in. */
export function msg(lang: string, key: string, args?: MsgArgs): string {
  const text = lookup(lang, key, (t) => t.messages) ?? key;
  if (!args || Object.keys(args).length === 0) return text;
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, name: string) => (Object.hasOwn(args, name) ? format(args[name]) : m));
}

/** The one-line summary of a command in lang (else English), or null. */
export function summary(lang: string, command: string): string | null {
  return lookup(lang, command, (t) => t.summaries);
}

function lookup(lang: string, key: string, pick: (t: Texts) => Map<string, string>): string | null {
  for (const l of [lang, Source]) {
    const t = texts().get(l);
    const v = t ? pick(t).get(key) : undefined;
    if (v !== undefined) return v;
  }
  return null;
}

/** The value as text: numbers in the invariant format (String(n)). */
function format(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * The locale used to format numbers for a language (e.g. 10 000 in Swedish, 10,000 in English,
 * 10.000 in German). Numbers that should follow the language are formatted with it before they
 * are passed to msg. (A CultureInfo in C#; here a BCP 47 tag for Intl.)
 */
export function culture(lang: string): string {
  const name = lang === "sv" ? "sv-SE" : lang === "en" ? "en-US" : lang;
  try {
    return Intl.NumberFormat.supportedLocalesOf([name]).length > 0 ? name : "und";
  } catch {
    return "und";
  }
}

/** n.ToString("N0", Culture(lang)): a whole number with the language's group separators. */
export function formatNumber(lang: string, n: number | bigint): string {
  return new Intl.NumberFormat(culture(lang), { maximumFractionDigits: 0, useGrouping: true }).format(n);
}
