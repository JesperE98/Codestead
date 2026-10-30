import { describe, expect, test } from 'vitest';
import { LANGUAGES } from './languages';
import { translate, UI, type UiKey } from './ui';

describe('gränssnittets texter', () => {
  const keys = Object.keys(UI.sv) as UiKey[];

  test.each(LANGUAGES.map((l) => [l.code] as const))('%s har alla nycklar och samma platshållare', (code) => {
    for (const key of keys) {
      const text = UI[code][key] ?? (key === 'progress.short' ? UI.sv[key] : undefined);
      expect(text, `${code}: ${key}`).toBeTruthy();
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(placeholders(text!), `${code}: ${key}`).toBe(placeholders(UI.sv[key]!));
    }
  });

  test('platshållare fylls i och saknade nycklar faller tillbaka', () => {
    expect(translate('en', 'lesson.chapter', { n: 3, total: 21 })).toBe('Chapter 3 of 21');
    expect(translate('ja', 'progress.short', { done: 1, total: 2 })).toBe('1/2');
  });
});
