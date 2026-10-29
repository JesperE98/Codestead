// Gör om kapitlets markdown till HTML för vald distribution.

import { marked } from 'marked';
import { FAMILIES, type Distro } from '../shell/distros';

marked.setOptions({ gfm: true });

export function placeholders(d: Distro): Record<string, string> {
  return {
    distro: d.name,
    hostname: d.hostname,
    family: FAMILIES[d.family].name,
    pm: d.packageManager,
    adminGroup: d.adminGroup,
  };
}

/** Behåller bara :::familj-block för vald familj och fyller i {{platshållare}}. */
export function preprocess(md: string, d: Distro): string {
  const values = placeholders(d);
  return md
    .replace(/^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_m, family: string, body: string) =>
      family === d.family ? `<div class="distro-block" data-family="${family}">\n\n${body}\n\n</div>` : '',
    )
    .replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}

export function renderMarkdown(md: string, d: Distro): string {
  return marked.parse(preprocess(md, d), { async: false });
}

export function renderInline(md: string, d: Distro): string {
  return marked.parseInline(preprocess(md, d), { async: false });
}
