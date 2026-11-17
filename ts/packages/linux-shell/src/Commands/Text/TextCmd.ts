// Port of Commands/Text/TextCmd.cs (src/shell/commands/text.ts) – text commands: echo, cat, less, head, tail, wc,
// grep, sort, uniq, cut, tee. This is the group's root file: the helpers shared by the group (and by RegexCmd,
// Script and Extras) and the list of the group's commands. The commands themselves are TextCmd.<Name>.ts.

import type { Shell } from "../../Shell/Shell.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

// ---------- JavaScript helpers shared by the basic commands ----------

/** The characters JavaScript's \s and String.prototype.trim treat as white space (as a regex class). */
export const JsWhitespaceClass = "[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

/** s.trim() in JavaScript. */
export function jsTrim(s: string): string {
  return s.trim();
}

/** s.split(/\s+/).filter(Boolean) in JavaScript. */
export function splitWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w !== "");
}

/** /\s/.test(s) in JavaScript. */
export function hasJsWhitespace(s: string): boolean {
  return /\s/.test(s);
}

/** new RegExp(source) in JavaScript (with the i flag when ignoreCase). Throws SyntaxError for an invalid pattern. */
export function jsRegex(source: string, ignoreCase = false): RegExp {
  return new RegExp(source, ignoreCase ? "i" : "");
}

export function catLike(name: string, summary: string, man: string): CommandDef {
  return {
    name,
    summary,
    man,
    run: (ctx) => {
      const o = UtilCmd.parseOpts(ctx.args, { flags: "n", long: { number: "n" } });
      if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
      const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands);
      let lineNo = 1;
      for (const input of inputs) {
        if (o.flags.has("n")) {
          for (const line of UtilCmd.splitLines(input.content)) ctx.out(`${String(lineNo++).padStart(6)}\t${line}\n`);
        } else {
          ctx.out(input.content);
        }
      }
      return failed ? 1 : 0;
    },
  };
}

/** A JS number used as an array index (slice): NaN is 0, the rest is truncated and clamped (to the C# int range). */
export function toIndex(n: number): number {
  return Number.isNaN(n) ? 0 : n >= 2147483647 ? 2147483647 : n <= -2147483648 ? -2147483648 : Math.trunc(n);
}

/** Turns a basic regular expression (BRE, as grep uses) into JavaScript. */
export function breToJs(p: string): string {
  const special = "|(){}+?";
  let sb = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i]!;
    if (c === "\\" && i + 1 < p.length) {
      const n = p[++i]!;
      if (special.includes(n)) sb += n;
      else sb += "\\" + n;
    } else if (special.includes(c)) {
      sb += "\\" + c;
    } else {
      sb += c;
    }
  }
  return sb;
}

/**
 * How sort orders text: by the terminal's $LANG, like GNU sort (sv_SE.UTF-8 puts å, ä, ö last,
 * en_US.UTF-8 sorts them with a and o). Unknown locales fall back to the root (invariant) collation.
 */
export function collation(sh: Shell): Intl.Collator {
  const all = sh.env.get("LC_ALL");
  const lang = all !== undefined && all.length > 0 ? all : (sh.env.get("LANG") ?? "");
  const name = lang.split(".")[0]!.replaceAll("_", "-");
  if (name === "" || name === "C" || name === "POSIX") return new Intl.Collator("und");
  try {
    return Intl.Collator.supportedLocalesOf([name]).length > 0 ? new Intl.Collator(name) : new Intl.Collator("und");
  } catch {
    return new Intl.Collator("und");
  }
}

/** Plain `sort` of some lines, as the simulator does it. */
export function sortLines(sh: Shell, lines: Iterable<string>): string[] {
  const ci = collation(sh);
  return [...lines].sort((a, b) => {
    const c = ci.compare(a, b);
    if (c !== 0) return c;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * The group's commands, in the C# order: echo, cat, less, more, head, tail, wc, grep, sort, uniq, cut, tee.
 * Wave 2 fills this in as the commands are ported (see PORTING.md).
 */
export function all(): CommandDef[] {
  return [];
}
