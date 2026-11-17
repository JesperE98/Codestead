// Port of Parser/ParserLib.Lexer.cs – ParserLib: the tokenizer (lexer) that turns bash code into tokens, with its helpers.

import type { Part } from "./Ast/Part.js";
import { ParseError } from "./ParseError.js";
import type { Tok } from "./Tokens/Tok.js";

const redirs = new Set([">", ">>", "<", "2>", "2>>", "2>&1", ">&2", "&>", "<<", "<<-", "<<<"]);
// The order matters: longer operators first.
const ops = ["2>&1", "1>&2", ">&2", "2>>", "2>", "&>", "&&", "||", ";;", "<<<", "<<-", "<<", ">>", "|", ">", "<", ";", "&", "(", ")"];

export function isRedir(op: string): boolean {
  return redirs.has(op);
}

/**
 * Finds the index of the closing parenthesis matching the one at open.
 * Skips quotes and nested parentheses. Returns -1 if it is missing.
 */
export function findClosingParen(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i++) {
    const c = input[i];
    if (c === "\\") {
      i++;
    } else if (c === "'") {
      const j = input.indexOf("'", i + 1);
      if (j < 0) return -1;
      i = j;
    } else if (c === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") i++;
        i++;
      }
      if (i >= input.length) return -1;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** If input[i] starts $( $(( ${ or `...`: returns the index after the end. Otherwise -1. */
function skipExpansion(input: string, i: number): number {
  if (i < input.length && input[i] === "`") {
    let j = i + 1;
    while (j < input.length && input[j] !== "`") {
      if (input[j] === "\\") j++;
      j++;
    }
    if (j >= input.length) throw new ParseError("unexpected EOF while looking for matching ``'", true);
    return j + 1;
  }
  if (i >= input.length || input[i] !== "$") return -1;
  if (i + 1 < input.length && input[i + 1] === "(") {
    const j = findClosingParen(input, i + 1);
    if (j < 0) throw new ParseError("unexpected EOF while looking for matching `)'", true);
    return j + 1;
  }
  if (i + 1 < input.length && input[i + 1] === "{") {
    const j = input.indexOf("}", i + 2);
    if (j < 0) throw new ParseError("unexpected EOF while looking for matching `}'", true);
    return j + 1;
  }
  return -1;
}

interface WordBuf {
  parts: Part[];
  raw: string;
  cur: string;
}

const doubleBracket = /^\[\[\s/;

export function tokenize(input: string, noOps = false): Tok[] {
  const toks: Tok[] = [];
  let word = null as WordBuf | null;

  const begin = (): WordBuf => (word ??= { parts: [], raw: "", cur: "" });
  const flush = (w: WordBuf): void => {
    if (w.cur !== "") {
      w.parts.push({ text: w.cur, quoted: "none" });
      w.cur = "";
    }
  };
  // Here-documents waiting for the next newline: index of the end word's token.
  const heredocs: { index: number; strip: boolean }[] = [];
  const bodies = new Map<number, { body: string; quoted: boolean }>();
  const end = (): void => {
    if (word !== null) {
      flush(word);
      const prev = toks.at(-1);
      if (prev?.t === "op" && (prev.v === "<<" || prev.v === "<<-")) heredocs.push({ index: toks.length, strip: prev.v === "<<-" });
      toks.push({ t: "word", w: { parts: word.parts, raw: word.raw } });
      word = null;
    }
  };
  const atCommandStart = (): boolean => {
    const last = toks.at(-1);
    return (
      last === undefined ||
      (last.t === "op" && !redirs.has(last.v)) ||
      (last.t === "word" && ["do", "then", "else", "{", "for"].includes(last.w.raw))
    );
  };

  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (c === " " || c === "\t" || c === "\r") {
      end();
      i++;
      continue;
    }
    if (c === "\n") {
      end();
      if (!noOps) toks.push({ t: "op", v: "\n" });
      i++;
      // Read pending here-documents: the lines up to the end word.
      while (heredocs.length > 0) {
        const { index, strip } = heredocs.shift()!;
        const delimWord = (toks[index] as Extract<Tok, { t: "word" }>).w;
        const delim = delimWord.parts.map((p) => p.text).join("");
        const quoted = delimWord.parts.some((p) => p.quoted !== "none");
        const lines: string[] = [];
        for (;;) {
          if (i >= input.length) throw new ParseError(`here-document delimited by end-of-file (wanted \`${delim}')`, true);
          const nl = input.indexOf("\n", i);
          let line = input.slice(i, nl < 0 ? input.length : nl);
          i = nl < 0 ? input.length : nl + 1;
          if (strip) line = line.replace(/^\t+/, "");
          if (line === delim) break;
          lines.push(line);
        }
        bodies.set(index, { body: lines.map((l) => l + "\n").join(""), quoted });
      }
      continue;
    }
    if (word === null && c === "#") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    // [[ ... ]]: inside, && || < > ( ) are ordinary words interpreted by [[ itself.
    if (!noOps && word === null && doubleBracket.test(input.slice(i, i + 3)) && atCommandStart()) {
      const j = input.indexOf("]]", i + 2);
      if (j < 0) throw new ParseError("unexpected EOF while looking for matching `]]'", true);
      const inner = tokenize(input.slice(i + 2, j), true);
      toks.push({ t: "word", w: { parts: [{ text: "[[", quoted: "none" }], raw: "[[" } });
      toks.push(...inner);
      toks.push({ t: "word", w: { parts: [{ text: "]]", quoted: "none" }], raw: "]]" } });
      i = j + 2;
      continue;
    }

    // (( arithmetic )) as its own command, e.g. ((i++)) or for ((i=0; i<3; i++))
    if (!noOps && word === null && input.startsWith("((", i) && atCommandStart()) {
      const j = findClosingParen(input, i);
      if (j < 0 || input[j - 1] !== ")") throw new ParseError("unexpected EOF while looking for matching `))'", true);
      toks.push({ t: "arith", expr: input.slice(i + 2, j - 1) });
      i = j + 1;
      continue;
    }

    let matchedOp = false;
    if (!noOps) {
      for (const op of ops) {
        // "2>" only counts as an operator at the start of a word (otherwise "file2>x" = "file2" + ">").
        if ((op.startsWith("2") || op.startsWith("1")) && word !== null) continue;
        if (input.startsWith(op, i)) {
          end();
          toks.push({ t: "op", v: op });
          i += op.length;
          matchedOp = true;
          break;
        }
      }
    }
    if (matchedOp) continue;

    if (c === "'") {
      const w = begin();
      flush(w);
      const j = input.indexOf("'", i + 1);
      if (j < 0) throw new ParseError("unexpected EOF while looking for matching `''", true);
      w.parts.push({ text: input.slice(i + 1, j), quoted: "single" });
      w.raw += input.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === '"') {
      const w = begin();
      flush(w);
      let j = i + 1;
      let buf = "";
      while (j < input.length && input[j] !== '"') {
        if (input[j] === "\\" && j + 1 < input.length && '"\\$`'.includes(input[j + 1]!)) {
          // An escaped character inside "..." becomes literal (is not expanded).
          if (buf !== "") w.parts.push({ text: buf, quoted: "double" });
          buf = "";
          w.parts.push({ text: input[j + 1]!, quoted: "single" });
          j += 2;
          continue;
        }
        const k2 = skipExpansion(input, j);
        if (k2 > 0) {
          buf += input.slice(j, k2);
          j = k2;
          continue;
        }
        buf += input[j];
        j++;
      }
      if (j >= input.length) throw new ParseError("unexpected EOF while looking for matching `\"'", true);
      w.parts.push({ text: buf, quoted: "double" });
      w.raw += input.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === "\\") {
      const w = begin();
      if (i + 1 < input.length && input[i + 1] === "\n") {
        // Line continuation
        i += 2;
        continue;
      }
      if (i + 1 < input.length) {
        flush(w);
        w.parts.push({ text: input[i + 1]!, quoted: "single" });
        w.raw += input.slice(i, i + 2);
      }
      i += 2;
      continue;
    }

    const k = skipExpansion(input, i);
    if (k > 0) {
      const w = begin();
      w.cur += input.slice(i, k);
      w.raw += input.slice(i, k);
      i = k;
      continue;
    }

    const wb = begin();
    wb.cur += c;
    wb.raw += c;
    i++;
  }
  end();
  if (heredocs.length > 0) {
    const delim = (toks[heredocs[0]!.index] as Extract<Tok, { t: "word" }>).w.raw;
    throw new ParseError(`here-document delimited by end-of-file (wanted \`${delim}')`, true);
  }
  if (bodies.size === 0) return toks;
  const result: Tok[] = [];
  for (let idx = 0; idx < toks.length; idx++) {
    result.push(toks[idx]!);
    const b = bodies.get(idx);
    if (b) result.push({ t: "hdbody", body: b.body, quoted: b.quoted });
  }
  return result;
}

/** A word the shell treats as reserved (if, then, do ...) – only when completely unquoted. */
export function isReserved(t: Tok | null | undefined, ...names: string[]): boolean {
  return t?.t === "word" && t.w.parts.length === 1 && t.w.parts[0]!.quoted === "none" && names.includes(t.w.raw);
}
