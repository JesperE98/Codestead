// Port of Parser/ParserLib.cs – ParserLib: parse() and the wildcard (glob) helpers used by the shell.
// The lexer is in ParserLib.Lexer.ts (re-exported here, as one static class in C#).

import type { Node } from "./Ast/Node.js";
import { Parser } from "./Parser.js";
import { tokenize } from "./ParserLib.Lexer.js";

export { findClosingParen, isRedir, isReserved, tokenize } from "./ParserLib.Lexer.js";

export function parse(input: string): Node {
  return new Parser(tokenize(input)).parseProgram();
}

/** Turns a glob pattern (*, ?, [abc]) into a regex. With anyChar, * also matches "/" (as in case). */
export function globToRegex(seg: string, anyChar = false): RegExp {
  const star = anyChar ? ".*" : "[^/]*";
  const one = anyChar ? "." : "[^/]";
  let re = "";
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i]!;
    if (c === "\\" && i + 1 < seg.length) {
      re += escapeRegex(seg[++i]!);
    } else if (c === "*") {
      re += star;
    } else if (c === "?") {
      re += one;
    } else if (c === "[") {
      const j = i + 2 <= seg.length ? seg.indexOf("]", i + 2) : -1;
      if (j < 0) {
        re += "\\[";
      } else {
        let cls = seg.slice(i + 1, j);
        if (cls.startsWith("!")) cls = "^" + cls.slice(1);
        re += "[" + cls.replaceAll("\\", "\\\\") + "]";
        i = j;
      }
    } else {
      re += escapeRegex(c);
    }
  }
  // Without the m flag, $ only matches at the very end (C# used \z).
  return new RegExp(`^(?:${re})$`, "s");
}

export function hasUnescapedGlob(seg: string): boolean {
  for (let i = 0; i < seg.length; i++) {
    if (seg[i] === "\\") {
      i++;
      continue;
    }
    if (seg[i] === "*" || seg[i] === "?" || seg[i] === "[") return true;
  }
  return false;
}

export function escapeGlob(text: string): string {
  return text.replace(/[*?[\]\\]/g, (m) => "\\" + m);
}

export function unescapeGlob(text: string): string {
  return text.replace(/\\(.)/gs, "$1");
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, (m) => (m === "/" ? "/" : "\\" + m));
}
