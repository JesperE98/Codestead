import { describe, expect, test } from 'vitest';
import { DISTROS } from '../shell/distros';
import { Shell } from '../shell/shell';
import { CHAPTERS, taskKey } from './chapters';
import { evaluateTasks, type Completed } from './progress';
import { renderMarkdown } from './render';
import { chapterMarkdown, isTranslated, languagesWithMarkdown } from './i18n';
import { LANGUAGES, type Lang } from '../i18n/languages';

/** Språk som måste vara helt översatta. */
const REQUIRED_LANGS: Lang[] = LANGUAGES.map((l) => l.code);
/** Nya kapitel som ännu bara finns på svenska och engelska. Ska vara tom inför en release. */
const AWAITING_TRANSLATION = ['natverk', 'diskar', 'systemd', 'anvandare', 'skal', 'extra-repon', 'universella-paket', 'git'];
import { resolve } from './types';

// Kör alla lösningar i ordning – precis som en elev skulle göra – och
// kontrollera att varje uppgift faktiskt bockas av i varje distribution.
describe.each(DISTROS.map((d) => [d.id, d] as const))('alla uppgifter går att lösa i %s', (_id, distro) => {
  const sh = Shell.create(distro.id);
  const completed: Completed = {};

  for (const chapter of CHAPTERS) {
    test(chapter.id, () => {
      for (const task of chapter.tasks) {
        for (const line of resolve(task.solution, distro)) {
          const result = sh.execute(line);
          for (const key of evaluateTasks(chapter, sh, result, completed)) completed[key] = true;
        }
        const key = taskKey(chapter.id, task.id, task.perFamily, distro.family);
        expect(completed[key], `${key} blev inte klar`).toBe(true);
      }
    });
  }
});

describe('kapitelinnehåll', () => {
  test.each(CHAPTERS.map((c) => [c.id, c] as const))('%s renderas på alla språk och för alla familjer', (_id, chapter) => {
    const langs = languagesWithMarkdown(chapter);
    expect(langs).toContain('sv');
    for (const lang of langs) {
      for (const d of DISTROS) {
        const html = renderMarkdown(chapterMarkdown(chapter, lang as Lang), d);
        expect(html, `${lang}/${chapter.id}`).toContain('<h1');
        expect(html, `${lang}/${chapter.id}`).not.toMatch(/\{\{\w+\}\}/);
        expect(html, `${lang}/${chapter.id}`).not.toMatch(/^:::/m);
      }
    }
  });

  test.each(LANGUAGES.filter((l) => REQUIRED_LANGS.includes(l.code)).map((l) => [l.code] as const))(
    'alla kapitel och uppgifter finns på %s',
    (lang) => {
      for (const chapter of CHAPTERS) {
        if (lang !== 'sv' && lang !== 'en' && AWAITING_TRANSLATION.includes(chapter.id)) continue;
        expect(isTranslated(chapter, lang), `${lang}/${chapter.id}`).toBe(true);
      }
    },
  );

  test('distro-block fungerar även med Windows-radslut', () => {
    const md = '# Titel\r\n\r\n:::arch\r\nBara Arch\r\n:::\r\n\r\n:::debian\r\nBara Debian\r\n:::\r\n';
    const html = renderMarkdown(md, DISTROS.find((d) => d.id === 'arch')!);
    expect(html).toContain('Bara Arch');
    expect(html).not.toContain('Bara Debian');
    expect(html).not.toContain(':::');
  });

  test('inga uppgifter klaras av utan att eleven gjort något', () => {
    for (const d of DISTROS) {
      const sh = Shell.create(d.id);
      const result = sh.execute('true');
      for (const chapter of CHAPTERS) expect(evaluateTasks(chapter, sh, result, {}), `${d.id}/${chapter.id}`).toEqual([]);
    }
  });

  test('uppgifts-id är unika inom varje kapitel', () => {
    for (const c of CHAPTERS) {
      const ids = c.tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
