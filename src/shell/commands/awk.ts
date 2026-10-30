// En liten awk-tolk: tokenizer, rekursiv parser och en trädtolk.
// Stöder en användbar delmängd av språket: mönster/åtgärd, BEGIN/END,
// fält, variabler, arrayer, if/while/for, print/printf och de vanligaste
// inbyggda funktionerna. Saknas något ger parsern ett syntaxfel.

import { toJsRegex } from './regex';

// ---------- Fel ----------

export class AwkSyntaxError extends Error {
  constructor(
    message: string,
    public pos: number,
    /** Satt när konstruktionen finns i riktig awk men inte i simulatorn. */
    public unsupported?: { sv: string; en: string },
  ) {
    super(message);
  }
}

export class AwkFatal extends Error {}

// ---------- Tokenizer ----------

type TokType = 'num' | 'str' | 'ere' | 'name' | 'builtin' | 'kw' | 'op' | 'nl' | 'eof';

interface Tok {
  t: TokType;
  v: string;
  n?: number;
  pos: number;
  /** Ett '(' som följer direkt efter ett namn, utan mellanslag. */
  tight?: boolean;
}

const KEYWORDS = new Set([
  'BEGIN', 'END', 'if', 'else', 'while', 'for', 'in', 'do', 'break', 'continue', 'next', 'nextfile',
  'exit', 'print', 'printf', 'getline', 'function', 'func', 'delete', 'return',
]);

const BUILTINS = new Set([
  'length', 'substr', 'index', 'split', 'sub', 'gsub', 'match', 'sprintf', 'toupper', 'tolower', 'int',
  'sqrt', 'exp', 'log', 'sin', 'cos', 'atan2', 'rand', 'srand', 'system', 'close', 'fflush',
]);
const UNSUPPORTED_BUILTINS = new Set(['system', 'close', 'fflush']);

const OPS = [
  '**=', '+=', '-=', '*=', '/=', '%=', '^=', '==', '<=', '>=', '!=', '++', '--', '&&', '||', '>>', '!~', '**',
  '{', '}', '(', ')', '[', ']', ';', ',', '+', '-', '*', '/', '%', '^', '!', '>', '<', '|', '?', ':', '~', '$', '=',
];

/** Gör om escape-sekvenser i en sträng (\n, \t, \\, \" ...). */
export function unescapeAwk(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\' || i + 1 >= s.length) {
      out += c;
      continue;
    }
    const n = s[++i];
    const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '\\': '\\', '"': '"', '/': '/' };
    if (n in simple) out += simple[n];
    else if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(s[i + 1] ?? '')) oct += s[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += n;
  }
  return out;
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const regexAllowed = () => {
    const p = toks.at(-1);
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'ere' || p.t === 'name' || p.t === 'builtin') return false;
    return !(p.t === 'op' && [')', ']', '$', '++', '--'].includes(p.v));
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '\n') {
      toks.push({ t: 'nl', v: '\n', pos: i });
      i++;
      continue;
    }
    const start = i;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      toks.push({ t: 'num', v: m[0], n: Number(m[0]), pos: start });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      const w = m[0];
      i += w.length;
      const t: TokType = KEYWORDS.has(w) ? 'kw' : BUILTINS.has(w) ? 'builtin' : 'name';
      toks.push({ t, v: w, pos: start });
      if (src[i] === '(') {
        toks.push({ t: 'op', v: '(', pos: i, tight: true });
        i++;
      }
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let raw = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\n') throw new AwkSyntaxError('unterminated string', start);
        if (src[j] === '\\' && j + 1 < src.length) {
          raw += src[j] + src[j + 1];
          j += 2;
        } else raw += src[j++];
      }
      if (j >= src.length) throw new AwkSyntaxError('unterminated string', start);
      toks.push({ t: 'str', v: unescapeAwk(raw), pos: start });
      i = j + 1;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let raw = '';
      let inBracket = false;
      while (j < src.length && (src[j] !== '/' || inBracket)) {
        if (src[j] === '\n') throw new AwkSyntaxError('unterminated regexp', start);
        if (src[j] === '\\' && j + 1 < src.length) {
          raw += src[j + 1] === '/' ? '/' : src[j] + src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '[') inBracket = true;
        else if (src[j] === ']') inBracket = false;
        raw += src[j++];
      }
      if (j >= src.length) throw new AwkSyntaxError('unterminated regexp', start);
      toks.push({ t: 'ere', v: raw, pos: start });
      i = j + 1;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new AwkSyntaxError(`invalid char '${c}' in expression`, start);
    toks.push({ t: 'op', v: op === '**' ? '^' : op === '**=' ? '^=' : op, pos: start });
    i += op.length;
  }
  toks.push({ t: 'eof', v: '', pos: src.length });
  return toks;
}

// ---------- Syntaxträd ----------

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 're'; src: string }
  | { k: 'var'; name: string }
  | { k: 'field'; e: Expr }
  | { k: 'idx'; name: string; subs: Expr[] }
  | { k: 'assign'; op: string; target: Expr; e: Expr }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr }
  | { k: 'and' | 'or'; a: Expr; b: Expr }
  | { k: 'not' | 'neg' | 'pos'; e: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr }
  | { k: 'cmp'; op: string; a: Expr; b: Expr }
  | { k: 'match'; neg: boolean; a: Expr; re: Expr }
  | { k: 'concat'; a: Expr; b: Expr }
  | { k: 'incr'; op: string; prefix: boolean; target: Expr }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'in'; subs: Expr[]; arr: string }
  | { k: 'group'; list: Expr[] };

export type Stmt =
  | { k: 'print' | 'printf'; args: Expr[] }
  | { k: 'expr'; e: Expr }
  | { k: 'block'; body: Stmt[] }
  | { k: 'if'; c: Expr; then: Stmt; else?: Stmt }
  | { k: 'while'; c: Expr; body: Stmt }
  | { k: 'do'; c: Expr; body: Stmt }
  | { k: 'for'; init?: Stmt; c?: Expr; step?: Stmt; body: Stmt }
  | { k: 'forin'; v: string; arr: string; body: Stmt }
  | { k: 'next' | 'break' | 'continue' }
  | { k: 'exit'; e?: Expr }
  | { k: 'delete'; arr: string; subs?: Expr[] };

export interface Rule {
  pattern: 'BEGIN' | 'END' | Expr | null;
  action: Stmt[] | null;
}

// ---------- Parser ----------

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '^=']);
const isLvalue = (e: Expr) => e.k === 'var' || e.k === 'field' || e.k === 'idx';

class Parser {
  private p = 0;
  /** Inne i argumenten till print: ">" betyder omdirigering, inte jämförelse. */
  private noGt = false;

  constructor(private toks: Tok[]) {}

  private get tok(): Tok {
    return this.toks[this.p];
  }
  private is(v: string, t: TokType = 'op'): boolean {
    return this.tok.t === t && this.tok.v === v;
  }
  private next(): Tok {
    return this.toks[this.p++];
  }
  private fail(tok: Tok = this.tok): never {
    if (tok.t === 'eof' || tok.t === 'nl') throw new AwkSyntaxError('unexpected newline or end of string', tok.pos);
    throw new AwkSyntaxError('syntax error', tok.pos);
  }
  private unsupported(what: { sv: string; en: string }, tok: Tok = this.tok): never {
    throw new AwkSyntaxError('syntax error', tok.pos, what);
  }
  private expect(v: string): Tok {
    if (!this.is(v)) this.fail();
    return this.next();
  }
  private skipNl() {
    while (this.tok.t === 'nl') this.p++;
  }
  private skipTerms() {
    while (this.tok.t === 'nl' || this.is(';')) this.p++;
  }

  program(): Rule[] {
    const rules: Rule[] = [];
    this.skipTerms();
    while (this.tok.t !== 'eof') {
      rules.push(this.rule());
      this.skipTerms();
    }
    return rules;
  }

  private rule(): Rule {
    if (this.is('BEGIN', 'kw') || this.is('END', 'kw')) {
      const pattern = this.next().v as 'BEGIN' | 'END';
      if (!this.is('{')) this.fail();
      return { pattern, action: this.block() };
    }
    if (this.is('function', 'kw') || this.is('func', 'kw')) this.unsupported({ sv: 'egna funktioner (function)', en: 'user-defined functions (function)' });
    let pattern: Expr | null = null;
    if (!this.is('{')) {
      pattern = this.expr();
      if (this.is(',')) this.unsupported({ sv: 'intervallmönster (/start/,/slut/)', en: 'range patterns (/start/,/end/)' });
    }
    if (this.is('{')) return { pattern, action: this.block() };
    if (this.tok.t !== 'nl' && !this.is(';') && this.tok.t !== 'eof') this.fail();
    return { pattern, action: null };
  }

  private block(): Stmt[] {
    this.expect('{');
    const body: Stmt[] = [];
    for (;;) {
      this.skipTerms();
      if (this.is('}')) break;
      if (this.tok.t === 'eof') this.fail();
      body.push(this.stmt());
    }
    this.next();
    return body;
  }

  /** Efter en enkel sats: ; eller ny rad, eller } / slut som inte äts upp. */
  private endSimple() {
    if (this.is(';') || this.tok.t === 'nl') {
      this.next();
      return;
    }
    if (this.is('}') || this.tok.t === 'eof') return;
    this.fail();
  }

  private body(): Stmt {
    this.skipNl();
    if (this.is(';')) {
      this.next();
      return { k: 'block', body: [] };
    }
    return this.stmt();
  }

  private stmt(): Stmt {
    const t = this.tok;
    if (this.is('{')) return { k: 'block', body: this.block() };
    if (t.t === 'kw') {
      switch (t.v) {
        case 'if': {
          this.next();
          this.expect('(');
          const c = this.expr();
          this.expect(')');
          const then = this.body();
          const save = this.p;
          this.skipTerms();
          if (this.is('else', 'kw')) {
            this.next();
            return { k: 'if', c, then, else: this.body() };
          }
          this.p = save;
          return { k: 'if', c, then };
        }
        case 'while': {
          this.next();
          this.expect('(');
          const c = this.expr();
          this.expect(')');
          return { k: 'while', c, body: this.body() };
        }
        case 'do': {
          this.next();
          const body = this.body();
          this.skipTerms();
          if (!this.is('while', 'kw')) this.fail();
          this.next();
          this.expect('(');
          const c = this.expr();
          this.expect(')');
          this.endSimple();
          return { k: 'do', c, body };
        }
        case 'for': {
          this.next();
          this.expect('(');
          const t1 = this.toks[this.p];
          const t2 = this.toks[this.p + 1];
          const t3 = this.toks[this.p + 2];
          const t4 = this.toks[this.p + 3];
          if (t1.t === 'name' && t2.t === 'kw' && t2.v === 'in' && t3.t === 'name' && t4.t === 'op' && t4.v === ')') {
            this.p += 4;
            return { k: 'forin', v: t1.v, arr: t3.v, body: this.body() };
          }
          const init = this.is(';') ? undefined : this.simple();
          this.expect(';');
          this.skipNl();
          const c = this.is(';') ? undefined : this.expr();
          this.expect(';');
          this.skipNl();
          const step = this.is(')') ? undefined : this.simple();
          this.expect(')');
          return { k: 'for', init, c, step, body: this.body() };
        }
        case 'next':
        case 'break':
        case 'continue':
          this.next();
          this.endSimple();
          return { k: t.v };
        case 'exit': {
          this.next();
          const e = this.is(';') || this.is('}') || this.tok.t === 'nl' || this.tok.t === 'eof' ? undefined : this.expr();
          this.endSimple();
          return { k: 'exit', e };
        }
        case 'delete': {
          this.next();
          if (this.tok.t !== 'name') this.fail();
          const arr = this.next().v;
          let subs: Expr[] | undefined;
          if (this.is('[')) subs = this.subscripts();
          this.endSimple();
          return { k: 'delete', arr, subs };
        }
        case 'getline':
          this.unsupported({ sv: 'getline', en: 'getline' });
          break;
        case 'return':
          this.unsupported({ sv: 'egna funktioner (return)', en: 'user-defined functions (return)' });
          break;
        case 'nextfile':
          this.unsupported({ sv: 'nextfile', en: 'nextfile' });
          break;
      }
    }
    const s = this.simple();
    this.endSimple();
    return s;
  }

  /** print, printf eller ett uttryck (utan avslutande ;). */
  private simple(): Stmt {
    if (this.is('print', 'kw') || this.is('printf', 'kw')) {
      const k = this.next().v as 'print' | 'printf';
      let args: Expr[] = [];
      const atEnd = () => this.is(';') || this.is('}') || this.tok.t === 'nl' || this.tok.t === 'eof';
      if (!atEnd() && !this.is('>') && !this.is('>>') && !this.is('|')) {
        const saved = this.noGt;
        this.noGt = true;
        args = [this.expr()];
        while (this.is(',')) {
          this.next();
          this.skipNl();
          args.push(this.expr());
        }
        this.noGt = saved;
      }
      if (args.length === 1 && args[0].k === 'group') args = args[0].list;
      if (this.is('>') || this.is('>>') || this.is('|')) this.unsupported({ sv: `omdirigering av utdata (${k} ${this.tok.v} ...)`, en: `output redirection (${k} ${this.tok.v} ...)` });
      if (k === 'printf' && args.length === 0) this.fail();
      return { k, args };
    }
    return { k: 'expr', e: this.expr() };
  }

  private subscripts(): Expr[] {
    this.expect('[');
    const saved = this.noGt;
    this.noGt = false;
    const subs = [this.expr()];
    while (this.is(',')) {
      this.next();
      subs.push(this.expr());
    }
    this.noGt = saved;
    this.expect(']');
    return subs;
  }

  expr(): Expr {
    return this.ternary();
  }

  private ternary(): Expr {
    const c = this.or();
    if (this.is('?')) {
      this.next();
      this.skipNl();
      const a = this.ternary();
      this.skipNl();
      this.expect(':');
      this.skipNl();
      const b = this.ternary();
      return { k: 'cond', c, a, b };
    }
    if (this.tok.t === 'op' && ASSIGN_OPS.has(this.tok.v) && isLvalue(c)) {
      const op = this.next().v;
      this.skipNl();
      return { k: 'assign', op, target: c, e: this.ternary() };
    }
    return c;
  }

  private or(): Expr {
    let a = this.and();
    while (this.is('||')) {
      this.next();
      this.skipNl();
      a = { k: 'or', a, b: this.and() };
    }
    return a;
  }

  private and(): Expr {
    let a = this.inExpr();
    while (this.is('&&')) {
      this.next();
      this.skipNl();
      a = { k: 'and', a, b: this.inExpr() };
    }
    return a;
  }

  private inExpr(): Expr {
    let a = this.match();
    while (this.is('in', 'kw')) {
      this.next();
      if (this.tok.t !== 'name') this.fail();
      a = { k: 'in', subs: a.k === 'group' ? a.list : [a], arr: this.next().v };
    }
    return a;
  }

  private match(): Expr {
    let a = this.cmp();
    while (this.is('~') || this.is('!~')) {
      const neg = this.next().v === '!~';
      a = { k: 'match', neg, a, re: this.cmp() };
    }
    return a;
  }

  private cmp(): Expr {
    const a = this.concat();
    const ops = ['<', '<=', '==', '!=', '>=', ...(this.noGt ? [] : ['>'])];
    if (this.tok.t === 'op' && ops.includes(this.tok.v)) {
      const op = this.next().v;
      return { k: 'cmp', op, a, b: this.concat() };
    }
    return a;
  }

  /** Kan nästa token börja ett nytt operand? Då är det strängsammanfogning ("a" b). */
  private startsOperand(): boolean {
    const t = this.tok;
    if (t.t === 'num' || t.t === 'str' || t.t === 'name' || t.t === 'builtin') return true;
    return t.t === 'op' && (t.v === '$' || t.v === '(');
  }

  private concat(): Expr {
    let a = this.additive();
    while (this.startsOperand()) a = { k: 'concat', a, b: this.additive() };
    return a;
  }

  private additive(): Expr {
    let a = this.mul();
    while (this.is('+') || this.is('-')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.mul() };
    }
    return a;
  }

  private mul(): Expr {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.unary() };
    }
    return a;
  }

  private unary(): Expr {
    if (this.is('!')) {
      this.next();
      return { k: 'not', e: this.unary() };
    }
    if (this.is('-')) {
      this.next();
      return { k: 'neg', e: this.unary() };
    }
    if (this.is('+')) {
      this.next();
      return { k: 'pos', e: this.unary() };
    }
    return this.pow();
  }

  private pow(): Expr {
    const a = this.postfix();
    if (this.is('^')) {
      this.next();
      // Högerassociativ: 2^3^2 = 2^9. Tillåter också 2^-1.
      const b = this.is('-') ? (this.next(), { k: 'neg' as const, e: this.pow() }) : this.pow();
      return { k: 'bin', op: '^', a, b };
    }
    return a;
  }

  private postfix(): Expr {
    if (this.is('++') || this.is('--')) {
      const tok = this.next();
      const target = this.postfix();
      if (!isLvalue(target)) this.fail(tok);
      return { k: 'incr', op: tok.v, prefix: true, target };
    }
    const e = this.primary();
    if (isLvalue(e) && (this.is('++') || this.is('--'))) return { k: 'incr', op: this.next().v, prefix: false, target: e };
    return e;
  }

  private primary(): Expr {
    const t = this.tok;
    switch (t.t) {
      case 'num':
        this.next();
        return { k: 'num', v: t.n! };
      case 'str':
        this.next();
        return { k: 'str', v: t.v };
      case 'ere':
        this.next();
        return { k: 're', src: t.v };
      case 'name': {
        this.next();
        if (this.is('[')) return { k: 'idx', name: t.v, subs: this.subscripts() };
        if (this.is('(') && this.tok.tight) this.unsupported({ sv: `egna funktioner (${t.v}(...))`, en: `user-defined functions (${t.v}(...))` }, t);
        return { k: 'var', name: t.v };
      }
      case 'builtin': {
        this.next();
        if (UNSUPPORTED_BUILTINS.has(t.v)) this.unsupported({ sv: `funktionen ${t.v}()`, en: `the function ${t.v}()` }, t);
        if (!this.is('(')) {
          if (t.v === 'length') return { k: 'call', name: 'length', args: [] };
          this.fail();
        }
        this.next();
        const saved = this.noGt;
        this.noGt = false;
        const args: Expr[] = [];
        this.skipNl();
        if (!this.is(')')) {
          args.push(this.expr());
          while (this.is(',')) {
            this.next();
            this.skipNl();
            args.push(this.expr());
          }
        }
        this.noGt = saved;
        this.expect(')');
        return { k: 'call', name: t.v, args };
      }
      case 'kw':
        if (t.v === 'getline') this.unsupported({ sv: 'getline', en: 'getline' });
        this.fail();
        break;
      case 'op':
        if (t.v === '$') {
          this.next();
          let e: Expr;
          if (this.is('++') || this.is('--')) e = this.postfix();
          else if (this.is('-')) {
            this.next();
            e = { k: 'neg', e: this.primary() };
          } else e = this.primary();
          return { k: 'field', e };
        }
        if (t.v === '(') {
          this.next();
          const saved = this.noGt;
          this.noGt = false;
          const list = [this.expr()];
          while (this.is(',')) {
            this.next();
            this.skipNl();
            list.push(this.expr());
          }
          this.noGt = saved;
          this.expect(')');
          return list.length === 1 ? list[0] : { k: 'group', list };
        }
        if (t.v === '-' || t.v === '+' || t.v === '!') return this.unary();
        if (t.v === '++' || t.v === '--') return this.postfix();
        break;
    }
    return this.fail();
  }
}

export function parseAwk(src: string): Rule[] {
  return new Parser(tokenize(src)).program();
}

// ---------- Värden ----------

/** Text som kommer utifrån (fält, -v): räknas som tal om den ser ut som ett. */
class StrNum {
  readonly n: number;
  readonly numeric: boolean;
  constructor(
    readonly s: string,
    numeric?: boolean,
  ) {
    this.n = strToNum(s);
    this.numeric = numeric ?? /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s);
  }
}

type Val = number | string | StrNum;

const UNINIT = new StrNum('', true);

function strToNum(s: string): number {
  const m = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s);
  return m ? Number(m[0]) : 0;
}

const num = (v: Val): number => (typeof v === 'number' ? v : typeof v === 'string' ? strToNum(v) : v.n);
const isNumeric = (v: Val) => typeof v === 'number' || (v instanceof StrNum && v.numeric);
const truthy = (v: Val) =>
  typeof v === 'number' ? v !== 0 : typeof v === 'string' ? v !== '' : v.numeric ? v.n !== 0 : v.s !== '';

/** %g som i C: högst `prec` värdesiffror, utan avslutande nollor. */
export function formatG(n: number, prec = 6, alt = false): string {
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  if (n === 0) return '0';
  const p = prec === 0 ? 1 : prec;
  const exp = Math.floor(Math.log10(Math.abs(Number(n.toPrecision(p)))));
  const strip = (s: string) => (alt ? s : s.includes('.') ? s.replace(/\.?0+$/, '') : s);
  if (exp < -4 || exp >= p) {
    const [mant, e] = n.toExponential(p - 1).split('e');
    const sign = e.startsWith('-') ? '-' : '+';
    return `${strip(mant)}e${sign}${e.replace(/^[+-]/, '').padStart(2, '0')}`;
  }
  return strip(n.toFixed(Math.max(0, p - 1 - exp)));
}

function numToStr(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e16) return String(n);
  return formatG(n, 6);
}

const str = (v: Val): string => (typeof v === 'number' ? numToStr(v) : typeof v === 'string' ? v : v.s);

/** sprintf/printf: %s %d %i %f %e %g %c %x %o %u %% med flaggor, bredd och precision. */
export function awkSprintf(fmt: string, args: Val[]): string {
  let ai = 0;
  const take = (): Val => {
    if (ai >= args.length) throw new AwkFatal('not enough arguments to satisfy format string');
    return args[ai++];
  };
  return fmt.replace(/%([-+ #0]*)(\d+|\*)?(?:\.(\d+|\*))?([csdiouxXeEfFgG%])/g, (_m, flags: string, w?: string, pr?: string, conv?: string) => {
    if (conv === '%') return '%';
    const width = w === '*' ? num(take()) : w ? Number(w) : 0;
    const prec = pr === '*' ? num(take()) : pr !== undefined ? Number(pr) : undefined;
    const left = flags.includes('-') || width < 0;
    const v = take();
    let body: string;
    let sign = '';
    let numeric = true;
    const n = num(v);
    switch (conv) {
      case 's':
        body = str(v);
        if (prec !== undefined) body = body.slice(0, prec);
        numeric = false;
        break;
      case 'c':
        body = typeof v === 'number' ? String.fromCodePoint(Math.trunc(v)) : [...str(v)][0] ?? '';
        numeric = false;
        break;
      case 'd':
      case 'i': {
        const t = Math.trunc(n);
        body = String(Math.abs(t));
        if (prec !== undefined) body = body.padStart(prec, '0');
        sign = t < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
        break;
      }
      case 'o':
      case 'u':
      case 'x':
      case 'X': {
        const t = Math.trunc(Math.abs(n));
        body = t.toString(conv === 'o' ? 8 : conv === 'u' ? 10 : 16);
        if (conv === 'X') body = body.toUpperCase();
        break;
      }
      case 'f':
      case 'F':
        body = Math.abs(n).toFixed(prec ?? 6);
        sign = n < 0 || Object.is(n, -0) ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
        break;
      case 'e':
      case 'E': {
        const [m, e] = Math.abs(n).toExponential(prec ?? 6).split('e');
        body = `${m}e${e[0]}${e.slice(1).padStart(2, '0')}`;
        if (conv === 'E') body = body.toUpperCase();
        sign = n < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
        break;
      }
      default: {
        body = formatG(Math.abs(n), prec ?? 6, flags.includes('#'));
        if (conv === 'G') body = body.toUpperCase();
        sign = n < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
      }
    }
    const w2 = Math.abs(width);
    const len = sign.length + body.length;
    if (len >= w2) return sign + body;
    if (left) return sign + body + ' '.repeat(w2 - len);
    if (numeric && flags.includes('0') && prec === undefined) return sign + '0'.repeat(w2 - len) + body;
    return ' '.repeat(w2 - len) + sign + body;
  });
}

// ---------- Tolken ----------

class NextSignal {}
class BreakSignal {}
class ContinueSignal {}
class ExitSignal {
  constructor(public code: number) {}
}

export interface AwkInput {
  name: string;
  content: string;
}

export interface AwkIO {
  out(s: string): void;
  /** Läser en fil; returnerar null (och skriver själv ut felet) om det inte gick. */
  readInput(operand: string): AwkInput | null;
  /** Som mawk: toupper/tolower ändrar bara a-z (inte å, ä, ö). */
  asciiCase?: boolean;
}

const MAX_STEPS = 200_000;

export class AwkInterpreter {
  private vars = new Map<string, Val>();
  private arrays = new Map<string, Map<string, Val>>();
  private record = '';
  private fields: string[] = [];
  private nf = 0;
  private regexCache = new Map<string, RegExp>();
  private steps = 0;

  constructor(
    private rules: Rule[],
    private io: AwkIO,
  ) {
    const init: Record<string, Val> = {
      FS: ' ', OFS: ' ', ORS: '\n', RS: '\n', NR: 0, FNR: 0, FILENAME: '', SUBSEP: '\x1c',
      RSTART: 0, RLENGTH: -1, CONVFMT: '%.6g', OFMT: '%.6g',
    };
    for (const [k, v] of Object.entries(init)) this.vars.set(k, v);
  }

  /** -v namn=värde och namn=värde bland filargumenten. */
  assign(name: string, value: string) {
    this.vars.set(name, new StrNum(unescapeAwk(value)));
  }

  run(operands: string[], stdin: string): number {
    let code = 0;
    const begin = this.rules.filter((r) => r.pattern === 'BEGIN');
    const end = this.rules.filter((r) => r.pattern === 'END');
    const main = this.rules.filter((r) => r.pattern !== 'BEGIN' && r.pattern !== 'END');
    let exited = false;
    try {
      for (const r of begin) this.execBody(r.action!);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
      code = e.code;
      exited = true;
    }
    if (!exited && (main.length || end.length)) {
      try {
        const files = operands.filter((o) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(o));
        const sources = files.length ? operands : [...operands, '-'];
        for (const op of sources) {
          const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(op);
          if (m) {
            this.assign(m[1], m[2]);
            continue;
          }
          const input = op === '-' ? { name: '', content: stdin } : this.io.readInput(op);
          if (!input) {
            code = 2;
            continue;
          }
          this.vars.set('FILENAME', input.name);
          this.vars.set('FNR', 0);
          for (const rec of this.records(input.content)) {
            this.vars.set('NR', num(this.vars.get('NR')!) + 1);
            this.vars.set('FNR', num(this.vars.get('FNR')!) + 1);
            this.setRecord(rec);
            try {
              for (const r of main) {
                if (r.pattern !== null && !truthy(this.ev(r.pattern as Expr))) continue;
                if (r.action) this.execBody(r.action);
                else this.io.out(this.record + str(this.vars.get('ORS')!));
              }
            } catch (e) {
              if (!(e instanceof NextSignal)) throw e;
            }
          }
        }
      } catch (e) {
        if (!(e instanceof ExitSignal)) throw e;
        code = e.code;
      }
    }
    try {
      for (const r of end) this.execBody(r.action!);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
      code = e.code;
    }
    return code;
  }

  private records(content: string): string[] {
    const rs = str(this.vars.get('RS')!);
    if (content === '') return [];
    if (rs === '\n' || rs === '') {
      const lines = content.split('\n');
      if (lines.at(-1) === '') lines.pop();
      return lines;
    }
    const recs = content.split(rs[0]);
    if (recs.at(-1) === '' || recs.at(-1) === '\n') recs.pop();
    return recs;
  }

  // ---------- Poster och fält ----------

  private splitFs(s: string, fs: string): string[] {
    if (fs === ' ') {
      const t = s.trim();
      return t === '' ? [] : t.split(/[ \t\n]+/);
    }
    if (s === '') return [];
    if (fs.length === 1 && fs !== '\\') return s.split(fs);
    return s.split(this.regex(fs, ''));
  }

  private setRecord(rec: string) {
    this.record = rec;
    const parts = this.splitFs(rec, str(this.vars.get('FS')!));
    this.fields = ['', ...parts];
    this.nf = parts.length;
  }

  private rebuild() {
    this.record = this.fields.slice(1, this.nf + 1).join(str(this.vars.get('OFS')!));
  }

  private getField(i: number): Val {
    if (i < 0) throw new AwkFatal(`attempt to access field ${i}`);
    if (i === 0) return new StrNum(this.record);
    return i <= this.nf ? new StrNum(this.fields[i]) : UNINIT;
  }

  private setField(i: number, v: string) {
    if (i < 0) throw new AwkFatal(`attempt to access field ${i}`);
    if (i === 0) {
      this.setRecord(v);
      return;
    }
    while (this.fields.length <= i) this.fields.push('');
    this.fields[i] = v;
    if (i > this.nf) this.nf = i;
    this.rebuild();
  }

  // ---------- Variabler ----------

  private getVar(name: string): Val {
    if (name === 'NF') return this.nf;
    if (this.arrays.has(name)) throw new AwkFatal(`attempt to use array \`${name}' in a scalar context`);
    return this.vars.get(name) ?? UNINIT;
  }

  private setVar(name: string, v: Val) {
    if (this.arrays.has(name)) throw new AwkFatal(`attempt to use array \`${name}' in a scalar context`);
    if (name === 'NF') {
      const n = Math.max(0, Math.trunc(num(v)));
      while (this.fields.length <= n) this.fields.push('');
      this.nf = n;
      this.rebuild();
      return;
    }
    this.vars.set(name, v);
  }

  private array(name: string): Map<string, Val> {
    if (this.vars.has(name) || name === 'NF') throw new AwkFatal(`attempt to use scalar \`${name}' as an array`);
    let a = this.arrays.get(name);
    if (!a) {
      a = new Map();
      this.arrays.set(name, a);
    }
    return a;
  }

  private key(subs: Expr[]): string {
    return subs.map((s) => str(this.ev(s))).join(str(this.vars.get('SUBSEP')!));
  }

  private get(target: Expr): Val {
    if (target.k === 'var') return this.getVar(target.name);
    if (target.k === 'field') return this.getField(Math.trunc(num(this.ev(target.e))));
    if (target.k === 'idx') {
      const a = this.array(target.name);
      const k = this.key(target.subs);
      if (!a.has(k)) a.set(k, UNINIT);
      return a.get(k)!;
    }
    throw new AwkFatal('invalid assignment target');
  }

  private set(target: Expr, v: Val) {
    if (target.k === 'var') this.setVar(target.name, v);
    else if (target.k === 'field') this.setField(Math.trunc(num(this.ev(target.e))), str(v));
    else if (target.k === 'idx') this.array(target.name).set(this.key(target.subs), v);
  }

  private regex(src: string, flags: string): RegExp {
    const key = flags + '/' + src;
    let re = this.regexCache.get(key);
    if (!re) {
      try {
        re = new RegExp(toJsRegex(src, true), flags);
      } catch {
        throw new AwkFatal(`invalid regexp: /${src}/`);
      }
      this.regexCache.set(key, re);
    }
    re.lastIndex = 0;
    return re;
  }

  private regexOf(e: Expr, flags = ''): RegExp {
    return this.regex(e.k === 're' ? e.src : str(this.ev(e)), flags);
  }

  // ---------- Satser ----------

  private tick() {
    if (++this.steps > MAX_STEPS) throw new AwkFatal('__steps__');
  }

  private execBody(body: Stmt[]) {
    for (const s of body) this.exec(s);
  }

  private exec(s: Stmt): void {
    this.tick();
    switch (s.k) {
      case 'print': {
        const ofs = str(this.vars.get('OFS')!);
        const ors = str(this.vars.get('ORS')!);
        const text = s.args.length
          ? s.args
              .map((a) => {
                const v = this.ev(a);
                return typeof v === 'number' && !(Number.isInteger(v) && Math.abs(v) < 1e16)
                  ? awkSprintf(str(this.vars.get('OFMT')!), [v])
                  : str(v);
              })
              .join(ofs)
          : this.record;
        this.io.out(text + ors);
        return;
      }
      case 'printf': {
        const [fmt, ...rest] = s.args.map((a) => this.ev(a));
        this.io.out(awkSprintf(str(fmt), rest));
        return;
      }
      case 'expr':
        this.ev(s.e);
        return;
      case 'block':
        this.execBody(s.body);
        return;
      case 'if':
        if (truthy(this.ev(s.c))) this.exec(s.then);
        else if (s.else) this.exec(s.else);
        return;
      case 'while':
        while (truthy(this.ev(s.c))) if (!this.loopBody(s.body)) break;
        return;
      case 'do':
        do {
          if (!this.loopBody(s.body)) break;
        } while (truthy(this.ev(s.c)));
        return;
      case 'for':
        if (s.init) this.exec(s.init);
        while (!s.c || truthy(this.ev(s.c))) {
          if (!this.loopBody(s.body)) break;
          if (s.step) this.exec(s.step);
        }
        return;
      case 'forin': {
        const keys = [...this.array(s.arr).keys()];
        for (const k of keys) {
          const isNum = /^-?\d+$/.test(k);
          this.setVar(s.v, new StrNum(k, isNum));
          if (!this.loopBody(s.body)) break;
        }
        return;
      }
      case 'next':
        throw new NextSignal();
      case 'break':
        throw new BreakSignal();
      case 'continue':
        throw new ContinueSignal();
      case 'exit':
        throw new ExitSignal(s.e ? Math.trunc(num(this.ev(s.e))) : 0);
      case 'delete':
        if (s.subs) this.array(s.arr).delete(this.key(s.subs));
        else this.array(s.arr).clear();
        return;
    }
  }

  /** Kör en loopkropp. Returnerar false vid break. */
  private loopBody(body: Stmt): boolean {
    this.tick();
    try {
      this.exec(body);
    } catch (e) {
      if (e instanceof BreakSignal) return false;
      if (!(e instanceof ContinueSignal)) throw e;
    }
    return true;
  }

  // ---------- Uttryck ----------

  private ev(e: Expr): Val {
    switch (e.k) {
      case 'num':
        return e.v;
      case 'str':
        return e.v;
      case 're':
        return this.regex(e.src, '').test(this.record) ? 1 : 0;
      case 'var':
        return this.getVar(e.name);
      case 'field':
      case 'idx':
        return this.get(e);
      case 'group':
        throw new AwkFatal('invalid use of a parenthesized list');
      case 'assign': {
        const rhs = this.ev(e.e);
        let v: Val = rhs;
        if (e.op !== '=') v = this.arith(e.op.slice(0, -1), num(this.get(e.target)), num(rhs));
        this.set(e.target, v);
        return v;
      }
      case 'cond':
        return truthy(this.ev(e.c)) ? this.ev(e.a) : this.ev(e.b);
      case 'and':
        return truthy(this.ev(e.a)) && truthy(this.ev(e.b)) ? 1 : 0;
      case 'or':
        return truthy(this.ev(e.a)) || truthy(this.ev(e.b)) ? 1 : 0;
      case 'not':
        return truthy(this.ev(e.e)) ? 0 : 1;
      case 'neg':
        return -num(this.ev(e.e));
      case 'pos':
        return num(this.ev(e.e));
      case 'bin':
        return this.arith(e.op, num(this.ev(e.a)), num(this.ev(e.b)));
      case 'cmp': {
        const a = this.ev(e.a);
        const b = this.ev(e.b);
        let d: number;
        if (isNumeric(a) && isNumeric(b)) d = num(a) - num(b);
        else {
          const sa = str(a);
          const sb = str(b);
          d = sa < sb ? -1 : sa > sb ? 1 : 0;
        }
        const r = { '<': d < 0, '<=': d <= 0, '>': d > 0, '>=': d >= 0, '==': d === 0, '!=': d !== 0 }[e.op];
        return r ? 1 : 0;
      }
      case 'match': {
        const ok = this.regexOf(e.re).test(str(this.ev(e.a)));
        return ok !== e.neg ? 1 : 0;
      }
      case 'concat':
        return str(this.ev(e.a)) + str(this.ev(e.b));
      case 'incr': {
        const old = num(this.get(e.target));
        const v = e.op === '++' ? old + 1 : old - 1;
        this.set(e.target, v);
        return e.prefix ? v : old;
      }
      case 'in': {
        const a = this.array(e.arr);
        return a.has(this.key(e.subs)) ? 1 : 0;
      }
      case 'call':
        return this.call(e.name, e.args);
    }
  }

  private arith(op: string, a: number, b: number): number {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        if (b === 0) throw new AwkFatal('division by zero attempted');
        return a / b;
      case '%':
        if (b === 0) throw new AwkFatal("division by zero attempted in `%'");
        return a % b;
      default:
        return a ** b;
    }
  }

  private call(name: string, args: Expr[]): Val {
    const arg = (i: number) => this.ev(args[i]);
    const need = (min: number, max = min) => {
      if (args.length < min || args.length > max) throw new AwkFatal(`${name}: called with ${args.length} arguments`);
    };
    switch (name) {
      case 'length': {
        need(0, 1);
        if (args.length === 0) return this.record.length;
        const a0 = args[0];
        if (a0.k === 'var' && this.arrays.has(a0.name)) return this.arrays.get(a0.name)!.size;
        return str(arg(0)).length;
      }
      case 'substr': {
        need(2, 3);
        const s = str(arg(0));
        const m = Math.round(num(arg(1)));
        const end = args.length === 3 ? m + Math.round(num(arg(2))) : Infinity;
        const from = Math.max(m, 1);
        const to = Math.min(end, s.length + 1);
        return to > from ? s.slice(from - 1, to - 1) : '';
      }
      case 'index':
        need(2);
        return str(arg(0)).indexOf(str(arg(1))) + 1;
      case 'split': {
        need(2, 3);
        const target = args[1];
        if (target.k !== 'var') throw new AwkFatal('split: second argument is not an array');
        const s = str(arg(0));
        const parts =
          args.length === 3
            ? args[2].k === 're'
              ? s === '' ? [] : s.split(this.regex(args[2].src, ''))
              : this.splitFs(s, str(arg(2)))
            : this.splitFs(s, str(this.vars.get('FS')!));
        const a = this.array(target.name);
        a.clear();
        parts.forEach((p, i) => a.set(String(i + 1), new StrNum(p)));
        return parts.length;
      }
      case 'sub':
      case 'gsub': {
        need(2, 3);
        const target: Expr = args[2] ?? { k: 'field', e: { k: 'num', v: 0 } };
        if (!isLvalue(target)) throw new AwkFatal(`${name}: third argument is not a changeable object`);
        const re = this.regexOf(args[0], 'g');
        const repl = str(arg(1));
        const s = str(this.get(target));
        let count = 0;
        const result = s.replace(re, (m) => {
          if (name === 'sub' && count > 0) return m;
          count++;
          return repl.replace(/\\\\|\\&|&/g, (r) => (r === '&' ? m : r === '\\&' ? '&' : '\\'));
        });
        if (count) this.set(target, result);
        return count;
      }
      case 'match': {
        need(2);
        const m = this.regexOf(args[1]).exec(str(arg(0)));
        const start = m ? m.index + 1 : 0;
        this.vars.set('RSTART', start);
        this.vars.set('RLENGTH', m ? m[0].length : -1);
        return start;
      }
      case 'sprintf': {
        if (args.length === 0) throw new AwkFatal('sprintf: no arguments');
        const [fmt, ...rest] = args.map((a) => this.ev(a));
        return awkSprintf(str(fmt), rest);
      }
      case 'toupper':
        need(1);
        return this.io.asciiCase ? str(arg(0)).replace(/[a-z]+/g, (m) => m.toUpperCase()) : str(arg(0)).toUpperCase();
      case 'tolower':
        need(1);
        return this.io.asciiCase ? str(arg(0)).replace(/[A-Z]+/g, (m) => m.toLowerCase()) : str(arg(0)).toLowerCase();
      case 'int':
        need(1);
        return Math.trunc(num(arg(0)));
      case 'sqrt':
        need(1);
        return Math.sqrt(num(arg(0)));
      case 'exp':
        need(1);
        return Math.exp(num(arg(0)));
      case 'log':
        need(1);
        return Math.log(num(arg(0)));
      case 'sin':
        need(1);
        return Math.sin(num(arg(0)));
      case 'cos':
        need(1);
        return Math.cos(num(arg(0)));
      case 'atan2':
        need(2);
        return Math.atan2(num(arg(0)), num(arg(1)));
      case 'rand':
        return Math.random();
      case 'srand':
        return 0;
    }
    throw new AwkFatal(`function \`${name}' not defined`);
  }
}
