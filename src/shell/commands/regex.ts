// Gör om POSIX-reguljära uttryck (som sed och awk använder) till JavaScript.

import { breToJs } from './text';

/** Teckenklasser som [[:digit:]] – i UTF-8 räknas även å, ä och ö som bokstäver. */
const CLASSES: Record<string, string> = {
  alpha: 'a-zA-ZÀ-ÖØ-öø-ÿ',
  upper: 'A-ZÀ-ÖØ-Þ',
  lower: 'a-zß-öø-ÿ',
  digit: '0-9',
  alnum: '0-9a-zA-ZÀ-ÖØ-öø-ÿ',
  space: '\\s',
  blank: ' \\t',
  punct: '!-\\/:-@\\[-`{-~',
  xdigit: '0-9A-Fa-f',
  cntrl: '\\x00-\\x1f\\x7f',
};

/**
 * Översätter ett grundläggande (BRE) eller utökat (ERE) reguljärt uttryck
 * till JavaScript-syntax: [:klasser:], \< \> (ordgräns) och BRE:s \( \) \{ \}.
 */
export function toJsRegex(src: string, extended: boolean): string {
  let s = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\' && i + 1 < src.length) {
      const n = src[i + 1];
      s += n === '<' || n === '>' ? '\\b' : c + n;
      i++;
    } else if (c === '[' && src[i + 1] === ':') {
      const end = src.indexOf(':]', i + 2);
      const cls = end > 0 ? CLASSES[src.slice(i + 2, end)] : undefined;
      if (cls === undefined) {
        s += c;
      } else {
        s += cls;
        i = end + 1;
      }
    } else {
      s += c;
    }
  }
  return extended ? s : breToJs(s);
}

/** Antalet fångande grupper ( ... ) i ett JavaScript-uttryck. */
export function groupCount(re: RegExp): number {
  return new RegExp(`${re.source}|`).exec('')!.length - 1;
}
