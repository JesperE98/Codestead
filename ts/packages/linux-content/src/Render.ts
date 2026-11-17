// Port of Render.cs – the text preprocessing in src/content/render.ts. The HTML rendering (marked) is not part of
// it: the UI renders the preprocessed markdown itself.

import { type Distro, Js, type Obj, World } from "@codestead/linux-shell";
import type { Lang } from "./Language.js";
import * as UiStrings from "./UiStrings.js";

/**
 * The {{placeholders}} in chapter and task texts: the distribution, and the names and words of the
 * student's world in this language (see Shell/World.cs), e.g. {{documents}} or {{user}}.
 */
export function placeholders(d: Distro, lang: Lang = "sv"): Obj<string> {
  const values = Js.obj<string>();
  for (const [k, v] of World.get(lang).placeholders) values.set(k, v);
  values.set("distro", d.name);
  values.set("hostname", d.hostname);
  values.set("family", UiStrings.translate(lang, `family.${d.family}`));
  values.set("pm", d.packageManager);
  values.set("adminGroup", d.adminGroup);
  return values;
}

const newlineRe = /\r\n?/g;
const familyBlockRe = /^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm;
const placeholderRe = /\{\{([A-Za-z0-9_]+)\}\}/g;

/**
 * Keeps only the :::family blocks for the chosen family and fills in {{placeholders}}.
 * A kept block is wrapped in `<div class="distro-block" data-family=".." data-label="..">` exactly like the TypeScript.
 */
export function preprocess(md: string, d: Distro, lang: Lang = "sv"): string {
  const values = placeholders(d, lang);
  // Windows line endings (\r\n) would otherwise stop the :::family blocks from being found.
  let text = md.replace(newlineRe, "\n");
  text = text.replace(familyBlockRe, (_m, family: string, body: string) =>
    family === d.family ? `<div class="distro-block" data-family="${family}" data-label="${values.get("family")}">\n\n${body}\n\n</div>` : "",
  );
  return text.replace(placeholderRe, (m, key: string) => values.get(key) ?? m);
}
