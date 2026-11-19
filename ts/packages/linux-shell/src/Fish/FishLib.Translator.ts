// Port of Fish/FishLib.Translator.cs – FishLib: the translator that turns fish tokens into bash code.

import { Js } from "../Js.js";
import * as ShellI18n from "../ShellI18n.js";
import {
  assignPrefixRe,
  assignWordRe,
  bare,
  bashBracketRe,
  bashOnly,
  bracedVarRe,
  charAt,
  closingParen,
  closingQuote,
  Dim,
  dollarErrors,
  dollarVarRe,
  fishBuiltins,
  fishError,
  type FTok,
  identRe,
  lex,
  readScopeRe,
  Reset,
  unquote,
} from "./FishLib.js";

interface Block {
  /** "if", "for", "while", "function", "begin" or "switch". */
  kind: string;
  cases: number;
}

export class FishTranslator {
  private output = "";
  private pending: string | null = null;
  private needSep = false;
  private readonly blocks: Block[] = [];

  constructor(private readonly lang: string) {}

  translate(text: string): string {
    const toks = lex(text);
    let stmt: FTok[] = [];
    for (const t of toks) {
      if (t.t === "op" && (t.op === ";" || t.op === "&")) {
        if (stmt.length > 0) this.statement(stmt);
        else if (t.op === "&") throw fishError("Unexpected '&' found");
        if (t.op === "&" && stmt.length > 0) {
          this.output += " &";
          this.needSep = false;
        }
        stmt = [];
      } else {
        stmt.push(t);
      }
    }
    if (stmt.length > 0) this.statement(stmt);
    if (this.blocks.length > 0) {
      throw fishError(`Missing end to balance this ${this.blocks.at(-1)!.kind} block`, true);
    }
    return this.output;
  }

  private emit(code: string): void {
    if (this.pending !== null) {
      this.output += this.pending + " ";
      this.pending = null;
    } else if (this.needSep) {
      this.output += "; ";
    } else if (this.output !== "" && !this.output.endsWith(" ")) {
      this.output += " ";
    }
    this.output += code;
    this.needSep = true;
  }

  private open(kind: string, header: string, after: string): void {
    this.emit(header);
    this.blocks.push({ kind, cases: 0 });
    this.pending = after;
  }

  private statement(toks: FTok[]): void {
    const kw = bare(toks[0]);
    const rest = toks.slice(1);
    switch (kw) {
      case "if":
        this.open("if", `if ${this.commands(rest)}`, "; then");
        return;
      case "while":
        this.open("while", `while ${this.commands(rest)}`, "; do");
        return;
      case "else": {
        const top = this.blocks.at(-1);
        if (top?.kind !== "if") throw fishError("'else' builtin not inside of if block");
        if (bare(rest[0]) === "if") {
          this.emit(`elif ${this.commands(rest.slice(1))}`);
          this.pending = "; then";
        } else {
          this.emit("else");
          this.pending = "";
          if (rest.length > 0) this.statement(rest);
        }
        return;
      }
      case "for": {
        const name = bare(rest[0]);
        if (!name || !identRe.test(name)) throw fishError("for: Variable name '' is not valid. See `help identifiers`.");
        if (bare(rest[1]) !== "in") throw fishError("for: Expected 'in'");
        this.open("for", `for ${name} in ${this.words(rest.slice(2))}`.trimEnd(), "; do");
        return;
      }
      case "function":
        this.functionHeader(rest);
        return;
      case "begin":
        this.open("begin", "{", "");
        if (rest.length > 0) this.statement(rest);
        return;
      case "switch":
        this.open("switch", `case ${this.words(rest)} in`, "");
        return;
      case "case": {
        const top = this.blocks.at(-1);
        if (top?.kind !== "switch") throw fishError("case: 'case' builtin not inside of switch block");
        const patterns = rest.filter((t) => t.t === "word").map((t) => unquote(t.raw));
        const joined = patterns.join("|");
        this.output += (top.cases++ > 0 ? " ;; " : " ") + (joined !== "" ? joined : '""') + ")";
        this.pending = "";
        this.needSep = false;
        return;
      }
      case "end": {
        if (this.blocks.length === 0) throw fishError("'end' outside of a block");
        const top = this.blocks.pop()!;
        if (this.pending !== null) {
          // Empty block – bash needs at least one command.
          if (top.kind !== "switch") this.emit("true");
          this.pending = null;
        }
        const close =
          top.kind === "if" ? "fi" : top.kind === "for" || top.kind === "while" ? "done" : top.kind === "function" || top.kind === "begin" ? "}" : "esac";
        if (top.kind === "switch") {
          this.output += top.cases > 0 ? " ;; esac" : " esac";
          this.needSep = true;
        } else {
          this.emit(close);
        }
        // Redirections and pipes after end: "end < file", "end | sort".
        if (rest.length > 0) this.output += " " + this.commands(rest, false);
        return;
      }
      case "and":
      case "or":
        if (this.output === "") throw fishError(`'${kw}' must follow a command`);
        if (rest.length === 0) throw fishError(`Missing command after '${kw}'`);
        this.output += (kw === "and" ? " && " : " || ") + this.commands(rest);
        return;
    }
    this.emit(this.commands(toks));
  }

  /** function name [--argument-names a b] [--description text] */
  private functionHeader(rest: FTok[]): void {
    const first = rest[0];
    const name = bare(first) ?? (first?.t === "word" ? first.raw : "");
    if (name === "" || name.startsWith("-")) throw fishError("function: Expected function name");
    const argNames: string[] = [];
    let mode: "args" | "skip" | null = null;
    for (const t of rest.slice(1)) {
      if (t.t !== "word") continue;
      if (t.raw === "--argument-names" || t.raw === "-a") mode = "args";
      else if (t.raw === "--description" || t.raw === "-d" || t.raw === "--wraps" || t.raw === "-w") mode = "skip";
      else if (t.raw.startsWith("-")) mode = null;
      else if (mode === "args") argNames.push(t.raw);
      else if (mode === "skip") mode = null;
    }
    this.open("function", `${name}() {`, "");
    for (let i = 0; i < argNames.length; i++) this.emit(`local ${argNames[i]}="\${${i + 1}}"`);
  }

  /** One or more commands with | && || between them. */
  private commands(toks: FTok[], cmdPos = true): string {
    const parts: string[] = [];
    let words: string[] = [];
    let first = cmdPos;
    let cmdName: string | null = null;
    let assignOnly = true;
    let assignWord = "";
    const flush = (): void => {
      if (cmdPos && words.length > 0 && assignOnly && assignWord !== "") {
        const m = assignWordRe.exec(assignWord)!;
        const name = m[1]!;
        const value = m[2]!;
        const shown = value !== "" ? ` ${value}` : "";
        throw fishError(
          `Unsupported use of '='. In fish, please use 'set ${name}${shown}'.\n${assignWord}\n` +
            (assignWord.length > 1 ? `^${Js.repeat("~", assignWord.length - 2)}^` : "^"),
        );
      }
      parts.push(words.join(" "));
      words = [];
      first = true;
      assignOnly = true;
      assignWord = "";
      cmdName = null;
    };
    for (const t of toks) {
      if (t.t === "op") {
        flush();
        parts.push(t.op);
        continue;
      }
      if (first) {
        // Variable assignments before the command (X=1 command) work in fish 3.1+.
        if (assignPrefixRe.test(t.raw)) {
          if (assignWord === "") assignWord = t.raw;
          words.push(this.word(t.raw));
          continue;
        }
        first = false;
        assignOnly = false;
        if (t.raw === "not" || t.raw === "!") {
          words.push("!");
          first = true;
          continue;
        }
        if (bashOnly.has(t.raw)) {
          throw fishError(`Unknown command: ${t.raw}\n${Dim}${ShellI18n.msg(this.lang, "fish.bashSyntax")}${Reset}`);
        }
        cmdName = t.raw;
        const builtin = fishBuiltins.get(t.raw);
        if (builtin !== undefined) {
          words.push(builtin);
          continue;
        }
        words.push(this.word(t.raw));
        continue;
      }
      if (cmdName === "read" && readScopeRe.test(t.raw)) continue;
      if (cmdName === "read" && t.raw === "-P") {
        words.push("-p");
        continue;
      }
      if (cmdName === "alias" && words.length === 2 && !words[1]!.includes("=")) {
        // fish: alias ll 'ls -l'  ->  alias ll='ls -l'
        words[1] += "=" + this.word(t.raw);
        continue;
      }
      words.push(this.word(t.raw));
    }
    flush();
    return parts.join(" ").trim();
  }

  private words(toks: FTok[]): string {
    return toks.map((t) => (t.t === "word" ? this.word(t.raw) : t.op)).join(" ");
  }

  /** Translates a word: (command), $argv, $status, {$VAR} … */
  private word(raw: string): string {
    let sb = "";
    for (let i = 0; i < raw.length; ) {
      const c = raw[i]!;
      if (c === "\\") {
        sb += raw.slice(i, i + 2);
        i += 2;
      } else if (c === "'") {
        const j = closingQuote(raw, i);
        // fish allows \' inside single quotes – bash does not.
        sb += "'" + raw.slice(i + 1, j).replaceAll("\\'", "'\\''").replaceAll("\\\\", "\\") + "'";
        i = j + 1;
      } else if (c === '"') {
        const j = closingQuote(raw, i);
        sb += '"' + this.dollars(raw.slice(i + 1, j), true) + '"';
        i = j + 1;
      } else if (c === "(") {
        const j = closingParen(raw, i);
        sb += "$(" + this.sub(raw.slice(i + 1, j)) + ")";
        i = j + 1;
      } else if (c === "{" && bracedVarRe.test(raw.slice(i))) {
        const name = bracedVarRe.exec(raw.slice(i))![1]!;
        sb += FishTranslator.variable(name, "", false);
        i += name.length + 3;
      } else if (c === "$") {
        const { text, len } = this.dollar(raw.slice(i), false);
        sb += text;
        i += len;
      } else {
        sb += c;
        i++;
      }
    }
    return sb;
  }

  /** Text inside double quotes: only $ expressions are translated. */
  private dollars(text: string, quoted: boolean): string {
    let sb = "";
    for (let i = 0; i < text.length; ) {
      if (text[i] === "\\") {
        sb += text.slice(i, i + 2);
        i += 2;
      } else if (text[i] === "$") {
        const { text: t, len } = this.dollar(text.slice(i), quoted);
        sb += t;
        i += len;
      } else {
        sb += text[i++];
      }
    }
    return sb;
  }

  /** A $ expression at the start of s. Returns (bash text, number of characters). */
  private dollar(s: string, quoted: boolean): { text: string; len: number } {
    const next = charAt(s, 1);
    if (next === "(") {
      if (charAt(s, 2) === "(") throw fishError("$((...)) is not supported. In fish, please use 'math'.");
      const j = closingParen(s, 1);
      return { text: "$(" + this.sub(s.slice(2, j)) + ")", len: j + 1 };
    }
    if (next === "{") {
      const bm = bashBracketRe.exec(s);
      const name = bm ? bm[1]! : "VAR";
      throw fishError(`Variables cannot be bracketed. In fish, please use {$${name}}.`);
    }
    const error = next !== "" ? dollarErrors.get(next) : undefined;
    if (error !== undefined) throw fishError(error);
    const m = dollarVarRe.exec(s);
    if (!m) return { text: "$", len: 1 };
    return { text: FishTranslator.variable(m[1]!, m[2] ?? "", quoted), len: m[0].length };
  }

  private static variable(name: string, index: string, quoted: boolean): string {
    if (name === "argv") return index !== "" ? (Js.number(index) > 0 ? `\${${index}}` : `$(__fish_index ${index} "$@")`) : quoted ? "$*" : "$@";
    if (name === "status") return "$?";
    if (name === "fish_pid") return "$$";
    if (index !== "") return `$(__fish_index ${index} \${${name}})`;
    return `\${${name}}`;
  }

  /** Code inside (…): translated on its own. */
  private sub(code: string): string {
    return new FishTranslator(this.lang).translate(code);
  }
}
