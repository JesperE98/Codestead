// Port of Fish/FishLib.cs (src/shell/fish.ts) – translates fish code into bash code the shell's normal parser can run.
//
// fish has its own syntax: blocks end with `end`, variables are set with `set`, command
// substitution is written (command), `and`/`or`/`not` are commands and $argv/$status replace
// $@/$?. The translation covers the common cases:
//
//   set NAME value…            ->  __fish_set NAME value…   (builtin command)
//   (command)                  ->  $(command)
//   if A; and B; …; else; …; end      ->  if A && B; then …; else …; fi
//   for x in a b c; …; end     ->  for x in a b c; do …; done
//   while …; …; end            ->  while …; do …; done
//   function f; …; end         ->  f() { …; }
//   begin; …; end              ->  { …; }
//   switch $x; case a b; …; end       ->  case $x in a|b) … ;; esac
//   $argv, $argv[1], $status   ->  "$@", ${1}, $?
//
// Bash syntax fish does not accept (X=1, $?, ${X}, $((...)), then/do/fi …) gives fish's own errors.
// The translator itself is in FishLib.Translator.ts.

import { ParseError } from "../Parser/ParseError.js";
import * as ShellI18n from "../ShellI18n.js";
import { FishTranslator } from "./FishLib.Translator.js";

/** Fish commands the shell has its own (hidden) builtins for. */
export const fishBuiltins = new Map<string, string>([
  ["set", "__fish_set"],
  ["count", "__fish_count"],
  ["math", "__fish_math"],
  ["status", "__fish_status"],
  ["contains", "__fish_contains"],
]);

/** Bash words that do not exist in fish. */
export const bashOnly = new Set(["then", "do", "done", "fi", "esac", "elif", "local", "declare", "let", "[[", "until", "select"]);

export const Dim = "\x1b[2m";
export const Reset = "\x1b[0m";

const bareRe = /^[A-Za-z0-9_[\]-]+$/;
// \\([^\n\r\u2028\u2029]) in C#: "." without the s flag matches exactly those characters in JavaScript.
const unquoteRe = /\\(.)|'([^']*)'|"([^"]*)"/g;
export const identRe = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const assignWordRe = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
export const assignPrefixRe = /^[A-Za-z_][A-Za-z0-9_]*=/;
export const readScopeRe = /^(-[lgxU]+|--(local|global|export|universal))$/;
export const bracedVarRe = /^\{\$([A-Za-z_][A-Za-z0-9_]*)\}/;
export const bashBracketRe = /^\$\{([^}]*)\}/;
export const dollarVarRe = /^\$([A-Za-z_][A-Za-z0-9_]*)(?:\[(-?[0-9]+)\])?/;

export const dollarErrors = new Map<string, string>([
  ["?", "$? is not the exit status. In fish, please use $status."],
  ["$", "$$ is not the pid. In fish, please use $fish_pid."],
  ["#", "$# is not supported. In fish, please use 'count $argv'."],
  ["@", "$@ is not supported. In fish, please use $argv."],
  ["*", "$* is not supported. In fish, please use $argv."],
]);

/** Translates fish code to bash. lang is the language of the simulator's own hints. */
export function translateFish(text: string, lang: string = ShellI18n.Source): string {
  return new FishTranslator(lang).translate(text);
}

export function fishError(message: string, incomplete = false): ParseError {
  return new ParseError(message, incomplete);
}

/** s[i] in JavaScript as C#'s CharAt: the character, or "" when out of range. */
export function charAt(s: string, i: number): string {
  return i >= 0 && i < s.length ? s[i]! : "";
}

/** Finds the end of a quote starting at i (pointing at the quote character). Returns -1 if missing. */
export function closingQuote(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === "\\" && (q === '"' || charAt(s, j + 1) === "'" || charAt(s, j + 1) === "\\")) j++;
    else if (s[j] === q) return j;
  }
  return -1;
}

/** Finds the parenthesis closing the one at i. Returns -1 if missing. */
export function closingParen(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++;
    else if (c === "'" || c === '"') {
      const k = closingQuote(s, j);
      if (k < 0) return -1;
      j = k;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return j;
  }
  return -1;
}

export interface FTok {
  /** "word" or "op". */
  t: "word" | "op";
  raw: string;
  op: string;
}

const word = (raw: string): FTok => ({ t: "word", raw, op: "" });
const makeOp = (op: string): FTok => ({ t: "op", raw: "", op });

export function lex(text: string): FTok[] {
  const toks: FTok[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (c === " " || c === "\t" || c === "\r") {
      i++;
    } else if (c === "\\" && charAt(text, i + 1) === "\n") {
      i += 2;
    } else if (c === "#") {
      while (i < n && text[i] !== "\n") i++;
    } else if (c === "\n" || c === ";") {
      toks.push(makeOp(";"));
      i++;
    } else if (c === "|") {
      const two = charAt(text, i + 1) === "|";
      toks.push(makeOp(two ? "||" : "|"));
      i += two ? 2 : 1;
    } else if (c === "&" && charAt(text, i + 1) === "&") {
      toks.push(makeOp("&&"));
      i += 2;
    } else if (c === "&" && charAt(text, i + 1) !== ">") {
      toks.push(makeOp("&"));
      i++;
    } else {
      const start = i;
      while (i < n) {
        const ch = text[i]!;
        if (ch === "\\") {
          i += 2;
        } else if (ch === "'" || ch === '"') {
          const j = closingQuote(text, i);
          if (j < 0) throw fishError("Unexpected end of string, quotes are not balanced", true);
          i = j + 1;
        } else if (ch === "(") {
          const j = closingParen(text, i);
          if (j < 0) throw fishError("Unexpected end of string, parenthesis do not match", true);
          i = j + 1;
        } else if (ch === ")") {
          throw fishError("Unexpected ')' for unopened parenthesis");
        } else if (ch === "<" && charAt(text, i + 1) === "<") {
          throw fishError("Expected a string, but found a redirection");
        } else if (" \t\r\n;|".includes(ch)) {
          break;
        } else if (ch === "&" && charAt(text, i - 1) !== ">" && charAt(text, i + 1) !== ">") {
          break;
        } else {
          i++;
        }
      }
      toks.push(word(text.slice(start, i)));
    }
  }
  return toks;
}

/** The word without quotes, if it is a plain word (for keywords). */
export function bare(t: FTok | null | undefined): string | null {
  return t && t.t === "word" && bareRe.test(t.raw) ? t.raw : null;
}

/** Removes quotes (used for case patterns, which work as wildcards). */
export function unquote(raw: string): string {
  return raw.replace(unquoteRe, (_m, g1: string | undefined, g2: string | undefined, g3: string | undefined) => g1 ?? g2 ?? g3 ?? "");
}
