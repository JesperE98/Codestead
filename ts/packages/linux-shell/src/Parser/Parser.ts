// Port of Parser/Parser.cs (src/shell/parser.ts) – parses bash code into a syntax tree (AST):
// quotes, \-escapes, pipes, redirection, ; && || &, and compound commands
// such as if/elif/else, for, while/until, case, functions, { ...; }, ( ... ) and (( ... )).
// Variables, $(...) and wildcards are expanded later by the shell.

import type { AndOrItem } from "./Ast/AndOrItem.js";
import type { CaseItem } from "./Ast/CaseItem.js";
import type { IfClause } from "./Ast/IfClause.js";
import type { ListItem } from "./Ast/ListItem.js";
import type { ListNode } from "./Ast/ListNode.js";
import type { Node } from "./Ast/Node.js";
import type { Redirect } from "./Ast/Redirect.js";
import type { Word } from "./Ast/Word.js";
import { ParseError } from "./ParseError.js";
import { isRedir, isReserved } from "./ParserLib.Lexer.js";
import type { Tok } from "./Tokens/Tok.js";

const stopWords = ["then", "elif", "else", "fi", "do", "done", "esac", "}"];
// .NET \w is Unicode.
const validFuncName = /^[A-Za-z_][\p{L}\p{Mn}\p{Nd}\p{Pc}-]*$/u;
const validVarName = /^[A-Za-z_][\p{L}\p{Mn}\p{Nd}\p{Pc}]*$/u;

export class Parser {
  private i = 0;

  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok | null {
    return this.i < this.toks.length ? this.toks[this.i]! : null;
  }

  private at(idx: number): Tok | null {
    return idx < this.toks.length ? this.toks[idx]! : null;
  }

  private isOp(v: string, t: Tok | null = this.peek()): boolean {
    return t?.t === "op" && t.v === v;
  }

  private unexpected(t: Tok | null = this.peek()): ParseError {
    if (t === null) return new ParseError("syntax error: unexpected end of file", true);
    const what = t.t === "op" ? (t.v === "\n" ? "newline" : t.v) : t.t === "arith" ? "((" : t.t === "hdbody" ? "newline" : t.w.raw;
    return new ParseError(`syntax error near unexpected token \`${what}'`);
  }

  private skipNewlines(): void {
    while (this.isOp("\n")) this.i++;
  }

  private expectWord(name: string): void {
    this.skipNewlines();
    if (!isReserved(this.peek(), name)) throw this.unexpected();
    this.i++;
  }

  private atStop(stops: string[]): boolean {
    const t = this.peek();
    if (t === null) return true;
    if (t.t === "op") return stops.includes(t.v);
    return isReserved(t, ...stops);
  }

  parseProgram(): Node {
    const list = this.parseList([]);
    if (this.peek() !== null) throw this.unexpected();
    return list;
  }

  /** A sequence of commands separated by ; & or newline, up to a stop word. */
  parseList(stops: string[]): ListNode {
    const items: ListItem[] = [];
    for (;;) {
      this.skipNewlines();
      if (this.atStop(stops)) break;
      if (this.isOp(";") || this.isOp("&")) throw this.unexpected();
      const node = this.parseAndOr();
      let background = false;
      if (this.isOp("&")) {
        background = true;
        this.i++;
      } else if (this.isOp(";") || this.isOp("\n")) {
        this.i++;
      } else if (!this.atStop(stops)) {
        throw this.unexpected();
      }
      items.push({ node, background });
    }
    return { type: "list", items };
  }

  private parseAndOr(): Node {
    const first = this.parsePipeline();
    const rest: AndOrItem[] = [];
    while (this.isOp("&&") || this.isOp("||")) {
      const op = (this.toks[this.i++] as Extract<Tok, { t: "op" }>).v;
      this.skipNewlines();
      if (this.peek() === null) throw new ParseError("syntax error: unexpected end of file", true);
      rest.push({ op, node: this.parsePipeline() });
    }
    return rest.length > 0 ? { type: "andor", first, rest } : first;
  }

  private parsePipeline(): Node {
    let negate = false;
    if (isReserved(this.peek(), "!")) {
      negate = true;
      this.i++;
    }
    const commands: Node[] = [this.parseCommand()];
    while (this.isOp("|")) {
      this.i++;
      this.skipNewlines();
      if (this.peek() === null) throw new ParseError("syntax error: unexpected end of file", true);
      commands.push(this.parseCommand());
    }
    return commands.length === 1 && !negate ? commands[0]! : { type: "pipeline", commands, negate };
  }

  private parseRedirects(): Redirect[] {
    const redirects: Redirect[] = [];
    for (;;) {
      const op = this.peek();
      if (op?.t !== "op" || !isRedir(op.v)) return redirects;
      this.i++;
      if (op.v === "2>&1" || op.v === ">&2" || op.v === "1>&2") {
        redirects.push({ op: op.v === "2>&1" ? "2>&1" : ">&2" });
        continue;
      }
      const target = this.peek();
      if (target?.t !== "word") throw this.unexpected(target);
      this.i++;
      if (op.v === "<<" || op.v === "<<-") {
        const body = this.peek();
        if (body?.t !== "hdbody") throw new ParseError("here-document has no body", true);
        this.i++;
        redirects.push({ op: op.v, target: target.w, body: body.body, expand: !body.quoted });
        continue;
      }
      redirects.push({ op: op.v, target: target.w });
    }
  }

  private parseCommand(): Node {
    const t = this.peek();
    if (t === null) throw new ParseError("syntax error: unexpected end of file", true);
    if (t.t === "arith") {
      this.i++;
      return { type: "arith", expr: t.expr, redirects: this.parseRedirects() };
    }
    if (t.t === "op") {
      if (t.v === "(") {
        this.i++;
        const body = this.parseList([")"]);
        if (!this.isOp(")")) throw this.unexpected();
        this.i++;
        return { type: "group", body, subshell: true, redirects: this.parseRedirects() };
      }
      if (!isRedir(t.v)) throw this.unexpected();
    }
    if (isReserved(t, "if")) return this.parseIf();
    if (isReserved(t, "for")) return this.parseFor();
    if (isReserved(t, "while", "until")) return this.parseWhile();
    if (isReserved(t, "case")) return this.parseCase();
    if (isReserved(t, "function")) {
      this.i++;
      const name = this.peek();
      if (name?.t !== "word") throw this.unexpected();
      this.i++;
      if (this.isOp("(")) {
        this.i++;
        if (!this.isOp(")")) throw this.unexpected();
        this.i++;
      }
      return this.parseFuncBody(name.w.raw);
    }
    if (isReserved(t, "{")) {
      this.i++;
      const body = this.parseList(["}"]);
      this.expectWord("}");
      return { type: "group", body, subshell: false, redirects: this.parseRedirects() };
    }
    if (t.t === "word" && isReserved(t, ...stopWords)) throw this.unexpected();
    // name() { ... }
    if (t.t === "word" && this.isOp("(", this.at(this.i + 1)) && this.isOp(")", this.at(this.i + 2))) {
      this.i += 3;
      return this.parseFuncBody(t.w.raw);
    }
    return this.parseSimple();
  }

  private parseFuncBody(name: string): Node {
    if (!validFuncName.test(name)) throw new ParseError(`\`${name}': not a valid identifier`);
    this.skipNewlines();
    const body = this.parseCommand();
    return { type: "funcdef", name, body };
  }

  private parseSimple(): Node {
    const words: Word[] = [];
    const redirects: Redirect[] = [];
    for (;;) {
      const t = this.peek();
      if (t === null) break;
      if (t.t === "word") {
        words.push(t.w);
        this.i++;
        continue;
      }
      if (t.t === "op" && isRedir(t.v)) {
        redirects.push(...this.parseRedirects());
        continue;
      }
      break;
    }
    if (words.length === 0 && redirects.length === 0) throw this.unexpected();
    return { type: "simple", words, redirects };
  }

  private parseIf(): Node {
    this.i++; // if
    const clauses: IfClause[] = [];
    let elseBody: Node | null = null;
    for (;;) {
      const cond = this.parseList(["then"]);
      this.expectWord("then");
      const body = this.parseList(["elif", "else", "fi"]);
      clauses.push({ cond, body });
      if (isReserved(this.peek(), "elif")) {
        this.i++;
        continue;
      }
      if (isReserved(this.peek(), "else")) {
        this.i++;
        elseBody = this.parseList(["fi"]);
      }
      this.expectWord("fi");
      break;
    }
    return { type: "if", clauses, elseBody, redirects: this.parseRedirects() };
  }

  private parseDoBody(): Node {
    this.skipNewlines();
    if (this.isOp(";")) this.i++;
    this.expectWord("do");
    const body = this.parseList(["done"]);
    this.expectWord("done");
    return body;
  }

  private parseFor(): Node {
    this.i++; // for
    const t = this.peek();
    if (t?.t === "arith") {
      this.i++;
      const parts = t.expr.split(";");
      if (parts.length !== 3) throw new ParseError("syntax error: arithmetic expression required");
      const cbody = this.parseDoBody();
      return { type: "cfor", init: parts[0]!, cond: parts[1]!, step: parts[2]!, body: cbody, redirects: this.parseRedirects() };
    }
    if (t?.t !== "word" || !validVarName.test(t.w.raw)) throw this.unexpected(t);
    this.i++;
    const name = t.w.raw;
    let words: Word[] | null = null;
    this.skipNewlines();
    if (isReserved(this.peek(), "in")) {
      this.i++;
      words = [];
      for (let w = this.peek(); w?.t === "word"; w = this.peek()) {
        words.push(w.w);
        this.i++;
      }
      if (!this.isOp(";") && !this.isOp("\n")) throw this.unexpected();
      this.i++;
    }
    const body = this.parseDoBody();
    return { type: "for", name, words, body, redirects: this.parseRedirects() };
  }

  private parseWhile(): Node {
    const until = isReserved(this.peek(), "until");
    this.i++;
    const cond = this.parseList(["do"]);
    const body = this.parseDoBody();
    return { type: "while", until, cond, body, redirects: this.parseRedirects() };
  }

  private parseCase(): Node {
    this.i++; // case
    const w = this.peek();
    if (w?.t !== "word") throw this.unexpected(w);
    this.i++;
    this.expectWord("in");
    const items: CaseItem[] = [];
    for (;;) {
      this.skipNewlines();
      if (isReserved(this.peek(), "esac")) break;
      if (this.peek() === null) throw new ParseError("syntax error: unexpected end of file", true);
      if (this.isOp("(")) this.i++;
      const patterns: Word[] = [];
      for (;;) {
        const p = this.peek();
        if (p?.t !== "word") throw this.unexpected(p);
        patterns.push(p.w);
        this.i++;
        if (this.isOp("|")) {
          this.i++;
          continue;
        }
        break;
      }
      if (!this.isOp(")")) throw this.unexpected();
      this.i++;
      const body = this.parseList([";;", "esac"]);
      items.push({ patterns, body: body.items.length > 0 ? body : null });
      if (this.isOp(";;")) this.i++;
    }
    this.expectWord("esac");
    return { type: "case", word: w.w, items, redirects: this.parseRedirects() };
  }
}
