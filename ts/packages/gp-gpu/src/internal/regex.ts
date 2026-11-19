// .NET Regex helpers: Regex.Escape, Regex.Matches (every match), Regex.Unescape. The C# patterns are written as
// JavaScript regular expressions in the port (the same syntax for what they use: lookbehind, named groups); note that
// JavaScript's \w is ASCII and its `.` also stops at \r.

/** Regex.Escape: the text matched literally inside a pattern. */
export function escapeRegex(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
}

/** Regex.Matches: every match of a pattern (with or without the g flag) in a text, in order. */
export function matchesAll(re: RegExp, s: string): RegExpExecArray[] {
  const g = re.global ? new RegExp(re.source, re.flags) : new RegExp(re.source, re.flags + "g");
  const list: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(s)) !== null) {
    list.push(m);
    if (m[0].length === 0) g.lastIndex++;
  }
  return list;
}

/** Regex.Match(input, startat): the first match at or after an offset (lookbehind sees the text before it), or null. */
export function matchFrom(re: RegExp, s: string, startAt: number): RegExpExecArray | null {
  const g = re.global ? re : new RegExp(re.source, re.flags + "g");
  g.lastIndex = startAt;
  return g.exec(s);
}

/** Regex.Unescape: \n \t \r \f \v \a \e \0oo \xhh \uhhhh \cX, any other escaped character itself. */
export function regexUnescape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "\\" || i + 1 >= s.length) {
      out += c;
      continue;
    }
    const e = s[++i]!;
    switch (e) {
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "a": out += "\x07"; break;
      case "e": out += "\x1b"; break;
      case "x": {
        const hex = /^[0-9a-fA-F]{2}/.exec(s.slice(i + 1));
        if (!hex) throw new Error("Insufficient hexadecimal digits.");
        out += String.fromCharCode(parseInt(hex[0], 16));
        i += 2;
        break;
      }
      case "u": {
        const hex = /^[0-9a-fA-F]{4}/.exec(s.slice(i + 1));
        if (!hex) throw new Error("Insufficient hexadecimal digits.");
        out += String.fromCharCode(parseInt(hex[0], 16));
        i += 4;
        break;
      }
      case "c": {
        const ch = s[i + 1];
        if (ch === undefined) throw new Error("Missing control character.");
        out += String.fromCharCode(ch.toUpperCase().charCodeAt(0) ^ 0x40);
        i++;
        break;
      }
      default:
        if (e >= "0" && e <= "7") {
          const oct = /^[0-7]{1,3}/.exec(s.slice(i))!;
          out += String.fromCharCode(parseInt(oct[0], 8) & 0xff);
          i += oct[0].length - 1;
        } else out += e;
    }
  }
  return out;
}
