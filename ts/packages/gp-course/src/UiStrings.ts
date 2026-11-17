import { Languages, translate } from "@codestead/common";
import * as Resources from "./Resources.js";

let all: Map<string, Readonly<Record<string, string>>> | null = null;

function load(): Map<string, Readonly<Record<string, string>>> {
  const map = new Map<string, Readonly<Record<string, string>>>();
  for (const lang of Languages.all) {
    const json = Resources.read(`ui/${lang.code}.json`);
    if (json === null) continue;
    const dict: Record<string, string> = {};
    for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, unknown>)) dict[k] = typeof v === "string" ? v : "";
    map.set(lang.code, dict);
  }
  return map;
}

/** The user-interface texts of Codestead GP (ui/&lt;lang&gt;.json); a key missing in a language falls back to English. */
export const UiStrings = {
  for(lang: string): Readonly<Record<string, string>> | null {
    return (all ??= load()).get(lang) ?? null;
  },

  /** A text with its {placeholders} filled in (numbers in the invariant form). */
  translate(lang: string, key: string, args?: Readonly<Record<string, unknown>> | null): string {
    return translate((l) => UiStrings.for(l) ?? undefined, Languages.fallbackChain(lang), key, args ?? undefined, invariant);
  },
};

/** IFormattable.ToString(null, InvariantCulture), or ToString(); null is "". */
function invariant(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
