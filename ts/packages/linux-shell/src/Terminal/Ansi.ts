// Port of Codestead.Terminal/Ansi.cs – splits text with ANSI colour codes (\x1b[...m) into segments. The C# also
// turned the segments into Avalonia runs (ToInlines); that part belongs to the UI, which gets the same palette
// from the constants below.

import type { AnsiSegment } from "./AnsiSegment.js";

const sgr = /\x1b\[([0-9;]*)m/g;

export function parse(text: string): AnsiSegment[] {
  const result: AnsiSegment[] = [];
  let fg = 0;
  let bg = 0;
  let bold = false;
  let dim = false;
  let last = 0;
  for (const m of text.matchAll(sgr)) {
    if (m.index > last) result.push({ text: text.slice(last, m.index), fg, bg, bold, dim });
    last = m.index + m[0].length;
    const codes = m[1] === "" ? "0" : m[1]!;
    for (const part of codes.split(";")) {
      // int.TryParse: anything else (e.g. an empty part) counts as 0.
      const code = /^[0-9]+$/.test(part) && Number(part) <= 2147483647 ? Number(part) : 0;
      if (code === 0) [fg, bg, bold, dim] = [0, 0, false, false];
      else if (code === 1) bold = true;
      else if (code === 2) dim = true;
      else if (code === 22) [bold, dim] = [false, false];
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) fg = code;
      else if (code === 39) fg = 0;
      else if (code >= 40 && code <= 47) bg = code;
      else if (code === 49) bg = 0;
    }
  }
  if (last < text.length) result.push({ text: text.slice(last), fg, bg, bold, dim });
  return result;
}

/** Foreground colours (codes 30–37; 90–97 use the same colour as code − 60). The same palette as the web version (GitHub dark). */
export const foreground: ReadonlyMap<number, string> = new Map([
  [30, "#6e7681"],
  [31, "#ff7b72"],
  [32, "#7ee787"],
  [33, "#e3b341"],
  [34, "#79c0ff"],
  [35, "#d2a8ff"],
  [36, "#76e3ea"],
  [37, "#e6edf3"],
]);

/** Background colours; codes without an entry get no background. */
export const background: ReadonlyMap<number, string> = new Map([
  [41, "#b62324"],
  [42, "#2ea043"],
  [44, "#1f6feb"],
]);

/** Black text on a green background (sticky + world-writable dirs in ls) uses this colour instead of code 30's. */
export const blackOnGreen = "#0f1318";

/** Dimmed text is drawn with this opacity. */
export const dimOpacity = 0.62;
