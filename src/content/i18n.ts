// Slår upp kapiteltexter, titlar och uppgiftstexter på valt språk,
// med engelska och sist svenska som reserv.

import type { Distro } from '../shell/distros';
import { fallbackChain, type Lang } from '../i18n/languages';
import { resolve, type Chapter, type ChapterStrings, type Task } from './types';

const MARKDOWN = import.meta.glob('./chapters/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const STRINGS = import.meta.glob('./i18n/*/*.json', { import: 'default', eager: true }) as Record<string, ChapterStrings>;

const md = (lang: string, id: string) => MARKDOWN[`./chapters/${lang}/${id}.md`];
const strings = (lang: string, id: string) => STRINGS[`./i18n/${lang}/${id}.json`];

/** Kapitlets markdown på valt språk (eller närmaste reserv). */
export function chapterMarkdown(chapter: Chapter, lang: Lang): string {
  for (const l of fallbackChain(lang)) {
    const text = md(l, chapter.id);
    if (text) return text;
  }
  return `# ${chapter.title}\n`;
}

/** Finns kapitlet översatt till språket (både text och uppgifter)? */
export function isTranslated(chapter: Chapter, lang: Lang): boolean {
  if (lang === 'sv') return !!md('sv', chapter.id);
  const s = strings(lang, chapter.id);
  return !!md(lang, chapter.id) && !!s && chapter.tasks.every((t) => s.tasks?.[t.id]?.text);
}

export function chapterTitle(chapter: Chapter, lang: Lang): string {
  for (const l of fallbackChain(lang)) {
    if (l === 'sv') return chapter.title;
    const title = strings(l, chapter.id)?.title;
    if (title) return title;
  }
  return chapter.title;
}

function taskString(chapter: Chapter, task: Task, lang: Lang, field: 'text' | 'hint', distro: Distro): string | undefined {
  for (const l of fallbackChain(lang)) {
    const value = l === 'sv' ? task[field] : strings(l, chapter.id)?.tasks?.[task.id]?.[field];
    if (value !== undefined) return resolve<string>(value, distro);
  }
  return undefined;
}

export function taskText(chapter: Chapter, task: Task, lang: Lang, distro: Distro): string {
  return taskString(chapter, task, lang, 'text', distro) ?? task.id;
}

export function taskHint(chapter: Chapter, task: Task, lang: Lang, distro: Distro): string | undefined {
  return taskString(chapter, task, lang, 'hint', distro);
}

/** Alla språk som har en markdown-fil för kapitlet. */
export function languagesWithMarkdown(chapter: Chapter): string[] {
  return Object.keys(MARKDOWN)
    .filter((k) => k.endsWith(`/${chapter.id}.md`))
    .map((k) => k.split('/')[2]);
}
