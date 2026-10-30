import { describe, expect, test } from 'vitest';
import { DISTROS } from '../shell/distros';
import { Shell } from '../shell/shell';
import { CHAPTERS, taskKey } from './chapters';
import { evaluateTasks, type Completed } from './progress';
import { renderMarkdown } from './render';
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
  test.each(CHAPTERS.map((c) => [c.id, c] as const))('%s renderas för alla familjer', (_id, chapter) => {
    for (const d of DISTROS) {
      const html = renderMarkdown(chapter.content, d);
      expect(html).toContain('<h1');
      expect(html).not.toMatch(/\{\{\w+\}\}/);
      expect(html).not.toMatch(/^:::/m);
    }
  });

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
