// Port of Commands/RegexCmd.cs (src/shell/commands/regex.ts) – turns POSIX regular expressions (used by sed and
// awk) into JavaScript regex syntax. The C# then compiled the JavaScript regex for .NET (newRegExp/jsToNet, which
// translated the JavaScript-only semantics); in TypeScript the JavaScript engine is used directly, as in the
// original, so those helpers are thin wrappers.

import { breToJs } from "./Text/TextCmd.js";

/** Character classes like [[:digit:]] – in UTF-8, å, ä and ö also count as letters. */
const classes = new Map<string, string>([
  ["alpha", "a-zA-ZÀ-ÖØ-öø-ÿ"],
  ["upper", "A-ZÀ-ÖØ-Þ"],
  ["lower", "a-zß-öø-ÿ"],
  ["digit", "0-9"],
  ["alnum", "0-9a-zA-ZÀ-ÖØ-öø-ÿ"],
  ["space", "\\s"],
  ["blank", " \\t"],
  ["punct", "!-\\/:-@\\[-`{-~"],
  ["xdigit", "0-9A-Fa-f"],
  ["cntrl", "\\x00-\\x1f\\x7f"],
]);

/**
 * Translates a basic (BRE) or extended (ERE) regular expression to JavaScript syntax:
 * [:classes:], \< \> (word boundary) and BRE's \( \) \{ \}.
 */
export function toJsRegex(src: string, extended: boolean): string {
  let s = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "\\" && i + 1 < src.length) {
      const n = src[i + 1]!;
      if (n === "<" || n === ">") s += "\\b";
      else s += c + n;
      i++;
    } else if (c === "[" && i + 1 < src.length && src[i + 1] === ":") {
      const end = src.indexOf(":]", i + 2);
      const cls = end > 0 ? classes.get(src.slice(i + 2, end)) : undefined;
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

/** The number of capturing groups ( ... ) in a regex. */
export function groupCount(re: RegExp): number {
  return new RegExp(re.source + "|", re.flags.replace(/[gy]/g, "")).exec("")!.length - 1;
}

/**
 * new RegExp(source, flags). Throws SyntaxError when the pattern is invalid. (In C# this compiled the JavaScript
 * source for .NET; only the flags g, i, m, s, u and y are kept, each once, as C# ignored the others.)
 */
export function newRegExp(source: string, flags = ""): RegExp {
  const f = [..."gimsuy"].filter((c) => flags.includes(c)).join("");
  return new RegExp(source, f);
}

/**
 * Rewrote a JavaScript regex so .NET matched the same strings. JavaScript needs no rewriting: the source is
 * returned as it is (kept so ported callers compile).
 */
export function jsToNet(src: string, _dotAll = false, _multiline = false): string {
  return src;
}

/**
 * s.split(re) with JavaScript semantics: an empty match at the start, or right after the previous separator,
 * does not split; captured groups are included in the result. (String.prototype.split itself.)
 */
export function jsSplit(s: string, re: RegExp): string[] {
  return s.split(re);
}
