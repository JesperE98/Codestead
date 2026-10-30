// Gör om kapitlets markdown till HTML för vald distribution.

import { marked } from 'marked';
import type { Distro } from '../shell/distros';
import type { Lang } from '../i18n/languages';
import { translate } from '../i18n/ui';

marked.setOptions({ gfm: true });

export function placeholders(d: Distro, lang: Lang = 'sv'): Record<string, string> {
  return {
    distro: d.name,
    hostname: d.hostname,
    family: translate(lang, `family.${d.family}`),
    pm: d.packageManager,
    adminGroup: d.adminGroup,
  };
}

/** Behåller bara :::familj-block för vald familj och fyller i {{platshållare}}. */
export function preprocess(md: string, d: Distro, lang: Lang = 'sv'): string {
  const values = placeholders(d, lang);
  // Windows-radslut (\r\n) skulle annars hindra att :::familj-blocken hittas.
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_m, family: string, body: string) =>
      family === d.family ? `<div class="distro-block" data-family="${family}">\n\n${body}\n\n</div>` : '',
    )
    .replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}

export function renderMarkdown(md: string, d: Distro, lang: Lang = 'sv'): string {
  return marked.parse(preprocess(md, d, lang), { async: false });
}

export function renderInline(md: string, d: Distro, lang: Lang = 'sv'): string {
  return marked.parseInline(preprocess(md, d, lang), { async: false });
}
