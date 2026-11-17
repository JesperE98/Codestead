// Port of UiStrings.cs (src/i18n/ui.ts) – all texts in the user interface (buttons, menus, dialogs) in the app's
// language. The texts live in src/Linux/Codestead.Content/i18n/ui/<lang>.json (generated from ui.ts by
// build/gen-ui-strings.mjs). When a key is missing in a language, English is used, and as a last resort Swedish.

import { fill } from "@codestead/common";
import { Js, type Obj } from "@codestead/linux-shell";
import type { Lang } from "./Language.js";
import * as LanguagesLib from "./LanguagesLib.js";
import * as Resources from "./Resources.js";

let loaded: Obj<Obj<string>> | null = null;

/** UI[lang][key]. Swedish has every key; other languages may lack some. (C#: OrderedDictionary → Map.) */
export function ui(): Obj<Obj<string>> {
  return (loaded ??= load());
}

/** All keys (the keys of the Swedish texts, in order). TS: UiKey. */
export function keys(): string[] {
  return [...ui().get("sv")!.keys()];
}

function load(): Obj<Obj<string>> {
  const all = Js.obj<Obj<string>>();
  for (const lang of LanguagesLib.languages) {
    const dict = Js.obj<string>();
    const json = Resources.read(`ui/${lang.code}.json`);
    if (json !== null) {
      for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, unknown>)) dict.set(k, typeof v === "string" ? v : "");
    }
    all.set(lang.code, dict);
  }
  return all;
}

/** Translates a key and fills in {placeholders}. (C#: Codestead.Common.Translator.Translate over the fallback chain.) */
export function translate(lang: Lang, key: string, parameters?: Readonly<Record<string, unknown>> | null): string {
  let text = key;
  for (const l of LanguagesLib.fallbackChain(lang)) {
    const v = ui().get(l)?.get(key);
    if (v !== undefined) {
      text = v;
      break;
    }
  }
  return fill(text, parameters ?? undefined, jsString);
}

/** String(value) in JS for the parameter types the UI uses (strings and numbers). */
function jsString(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return Js.num(value);
  return String(value);
}
