// Tolkar bash-kod till ett syntaxträd (AST):
// citattecken, \-escape, pipes, omdirigering, ; && || &, och sammansatta kommandon
// som if/elif/else, for, while/until, case, funktioner, { ...; }, ( ... ) och (( ... )).
// Variabler, $(...) och jokertecken expanderas senare av skalet.

export interface Part {
  /** Rå text. I ociterade och "dubbelciterade" delar finns $VAR, $(...) osv kvar. */
  text: string;
  quoted: 'none' | 'single' | 'double';
}

export interface Word {
  parts: Part[];
  raw: string;
}

export type RedirOp = '>' | '>>' | '<' | '2>' | '2>>' | '2>&1' | '>&2' | '&>' | '<<' | '<<-' | '<<<';

export interface Redirect {
  op: RedirOp;
  target?: Word;
  /** Texten i ett here-dokument (<< SLUT ... SLUT). */
  body?: string;
  /** Ska $VAR expanderas i here-dokumentet? (Inte om slutordet står inom citattecken.) */
  expand?: boolean;
}

export type Node =
  | { type: 'simple'; words: Word[]; redirects: Redirect[] }
  | { type: 'pipeline'; commands: Node[]; negate: boolean }
  | { type: 'andor'; first: Node; rest: { op: '&&' | '||'; node: Node }[] }
  | { type: 'list'; items: { node: Node; background: boolean }[] }
  | { type: 'if'; clauses: { cond: Node; body: Node }[]; elseBody: Node | null; redirects: Redirect[] }
  | { type: 'for'; name: string; words: Word[] | null; body: Node; redirects: Redirect[] }
  | { type: 'cfor'; init: string; cond: string; step: string; body: Node; redirects: Redirect[] }
  | { type: 'while'; until: boolean; cond: Node; body: Node; redirects: Redirect[] }
  | { type: 'case'; word: Word; items: { patterns: Word[]; body: Node | null }[]; redirects: Redirect[] }
  | { type: 'group'; body: Node; subshell: boolean; redirects: Redirect[] }
  | { type: 'arith'; expr: string; redirects: Redirect[] }
  | { type: 'funcdef'; name: string; body: Node };

export class ParseError extends Error {
  /** Sant om koden bara är ofullständig (t.ex. saknar "done") – skalet visar då "> " och väntar på mer. */
  constructor(
    message: string,
    public incomplete = false,
  ) {
    super(message);
  }
}

export type Tok =
  | { t: 'word'; w: Word }
  | { t: 'op'; v: string }
  | { t: 'arith'; expr: string }
  | { t: 'hdbody'; body: string; quoted: boolean };

const REDIRS = new Set(['>', '>>', '<', '2>', '2>>', '2>&1', '>&2', '&>', '<<', '<<-', '<<<']);
// Ordningen spelar roll: längre operatorer först.
const OPS = ['2>&1', '1>&2', '>&2', '2>>', '2>', '&>', '&&', '||', ';;', '<<<', '<<-', '<<', '>>', '|', '>', '<', ';', '&', '(', ')'];

/**
 * Hittar index för slutparentesen som hör ihop med parentesen på position `open`.
 * Hoppar över citattecken och nästlade parenteser. Returnerar -1 om den saknas.
 */
export function findClosingParen(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i++) {
    const c = input[i];
    if (c === '\\') {
      i++;
    } else if (c === "'") {
      const j = input.indexOf("'", i + 1);
      if (j < 0) return -1;
      i = j;
    } else if (c === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') i++;
        i++;
      }
      if (i >= input.length) return -1;
    } else if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Om input[i] inleder $( $(( ${ eller `...`: returnerar index efter slutet. Annars -1. */
function skipExpansion(input: string, i: number): number {
  if (input[i] === '`') {
    let j = i + 1;
    while (j < input.length && input[j] !== '`') {
      if (input[j] === '\\') j++;
      j++;
    }
    if (j >= input.length) throw new ParseError('unexpected EOF while looking for matching ``\'', true);
    return j + 1;
  }
  if (input[i] !== '$') return -1;
  if (input[i + 1] === '(') {
    const j = findClosingParen(input, i + 1);
    if (j < 0) throw new ParseError("unexpected EOF while looking for matching `)'", true);
    return j + 1;
  }
  if (input[i + 1] === '{') {
    const j = input.indexOf('}', i + 2);
    if (j < 0) throw new ParseError("unexpected EOF while looking for matching `}'", true);
    return j + 1;
  }
  return -1;
}

export function tokenize(input: string, noOps = false): Tok[] {
  const toks: Tok[] = [];
  let word: { parts: Part[]; raw: string; cur: string } | null = null;

  const begin = () => (word ??= { parts: [], raw: '', cur: '' });
  const flush = (w: { parts: Part[]; cur: string }) => {
    if (w.cur) {
      w.parts.push({ text: w.cur, quoted: 'none' });
      w.cur = '';
    }
  };
  // Here-dokument som väntar på nästa radbrytning: index för slutordets token.
  const heredocs: { index: number; strip: boolean }[] = [];
  const bodies = new Map<number, { body: string; quoted: boolean }>();
  const end = () => {
    if (word) {
      flush(word);
      const prev = toks.at(-1);
      if (prev?.t === 'op' && (prev.v === '<<' || prev.v === '<<-')) heredocs.push({ index: toks.length, strip: prev.v === '<<-' });
      toks.push({ t: 'word', w: { parts: word.parts, raw: word.raw } });
      word = null;
    }
  };
  const atCommandStart = () => {
    const last = toks.at(-1);
    return !last || (last.t === 'op' && !REDIRS.has(last.v)) || (last.t === 'word' && ['do', 'then', 'else', '{', 'for'].includes(last.w.raw));
  };

  let i = 0;
  outer: while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\r') {
      end();
      i++;
      continue;
    }
    if (c === '\n') {
      end();
      if (!noOps) toks.push({ t: 'op', v: '\n' });
      i++;
      // Läs in väntande here-dokument: raderna fram till slutordet.
      while (heredocs.length) {
        const { index, strip } = heredocs.shift()!;
        const delimWord = (toks[index] as { w: Word }).w;
        const delim = delimWord.parts.map((p) => p.text).join('');
        const quoted = delimWord.parts.some((p) => p.quoted !== 'none');
        const lines: string[] = [];
        for (;;) {
          if (i >= input.length) throw new ParseError(`here-document delimited by end-of-file (wanted \`${delim}')`, true);
          const nl = input.indexOf('\n', i);
          let line = input.slice(i, nl < 0 ? input.length : nl);
          i = nl < 0 ? input.length : nl + 1;
          if (strip) line = line.replace(/^\t+/, '');
          if (line === delim) break;
          lines.push(line);
        }
        bodies.set(index, { body: lines.map((l) => l + '\n').join(''), quoted });
      }
      continue;
    }
    if (!word && c === '#') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }

    // [[ ... ]]: inuti är && || < > ( ) vanliga ord som tolkas av [[ själv.
    if (!noOps && !word && /^\[\[\s/.test(input.slice(i, i + 3)) && atCommandStart()) {
      const j = input.indexOf(']]', i + 2);
      if (j < 0) throw new ParseError("unexpected EOF while looking for matching `]]'", true);
      const inner = tokenize(input.slice(i + 2, j), true);
      toks.push({ t: 'word', w: { parts: [{ text: '[[', quoted: 'none' }], raw: '[[' } }, ...inner);
      toks.push({ t: 'word', w: { parts: [{ text: ']]', quoted: 'none' }], raw: ']]' } });
      i = j + 2;
      continue;
    }

    // (( aritmetik )) som eget kommando, t.ex. ((i++)) eller for ((i=0; i<3; i++))
    if (!noOps && !word && input.startsWith('((', i) && atCommandStart()) {
      const j = findClosingParen(input, i);
      if (j < 0 || input[j - 1] !== ')') throw new ParseError("unexpected EOF while looking for matching `))'", true);
      toks.push({ t: 'arith', expr: input.slice(i + 2, j - 1) });
      i = j + 1;
      continue;
    }

    for (const op of noOps ? [] : OPS) {
      // "2>" räknas bara som operator i början av ett ord (annars är "fil2>x" = "fil2" + ">").
      if ((op.startsWith('2') || op.startsWith('1')) && word) continue;
      if (input.startsWith(op, i)) {
        end();
        toks.push({ t: 'op', v: op });
        i += op.length;
        continue outer;
      }
    }

    if (c === "'") {
      const w = begin();
      flush(w);
      const j = input.indexOf("'", i + 1);
      if (j < 0) throw new ParseError("unexpected EOF while looking for matching `''", true);
      w.parts.push({ text: input.slice(i + 1, j), quoted: 'single' });
      w.raw += input.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === '"') {
      const w = begin();
      flush(w);
      let j = i + 1;
      let buf = '';
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && j + 1 < input.length && '"\\$`'.includes(input[j + 1])) {
          // Escapat tecken inne i "..." blir bokstavligt (expanderas inte).
          if (buf) w.parts.push({ text: buf, quoted: 'double' });
          buf = '';
          w.parts.push({ text: input[j + 1], quoted: 'single' });
          j += 2;
          continue;
        }
        const k = skipExpansion(input, j);
        if (k > 0) {
          buf += input.slice(j, k);
          j = k;
          continue;
        }
        buf += input[j];
        j++;
      }
      if (j >= input.length) throw new ParseError('unexpected EOF while looking for matching `"\'', true);
      w.parts.push({ text: buf, quoted: 'double' });
      w.raw += input.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === '\\') {
      const w = begin();
      if (input[i + 1] === '\n') {
        // Radfortsättning
        i += 2;
        continue;
      }
      if (i + 1 < input.length) {
        flush(w);
        w.parts.push({ text: input[i + 1], quoted: 'single' });
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

    const w = begin();
    w.cur += c;
    w.raw += c;
    i++;
  }
  end();
  if (heredocs.length) {
    const delim = (toks[heredocs[0].index] as { w: Word }).w.raw;
    throw new ParseError(`here-document delimited by end-of-file (wanted \`${delim}')`, true);
  }
  if (!bodies.size) return toks;
  return toks.flatMap((t, idx) => {
    const b = bodies.get(idx);
    return b ? [t, { t: 'hdbody' as const, body: b.body, quoted: b.quoted }] : [t];
  });
}

/** Ett ord som skalet behandlar som reserverat (if, then, do ...) – bara om det står helt ociterat. */
function isReserved(t: Tok | undefined, ...names: string[]): boolean {
  return !!t && t.t === 'word' && t.w.parts.length === 1 && t.w.parts[0].quoted === 'none' && names.includes(t.w.raw);
}

const STOP_WORDS = ['then', 'elif', 'else', 'fi', 'do', 'done', 'esac', '}'];

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }

  private isOp(v: string, t = this.peek()): boolean {
    return !!t && t.t === 'op' && t.v === v;
  }

  private unexpected(t = this.peek()): ParseError {
    if (!t) return new ParseError('syntax error: unexpected end of file', true);
    const what = t.t === 'op' ? (t.v === '\n' ? 'newline' : t.v) : t.t === 'arith' ? '((' : t.t === 'hdbody' ? 'newline' : t.w.raw;
    return new ParseError(`syntax error near unexpected token \`${what}'`);
  }

  private skipNewlines(): void {
    while (this.isOp('\n')) this.i++;
  }

  private expectWord(name: string): void {
    this.skipNewlines();
    if (!isReserved(this.peek(), name)) throw this.unexpected();
    this.i++;
  }

  private atStop(stops: string[]): boolean {
    const t = this.peek();
    if (!t) return true;
    if (t.t === 'op') return stops.includes(t.v);
    return isReserved(t, ...stops);
  }

  parseProgram(): Node {
    const list = this.parseList([]);
    if (this.peek()) throw this.unexpected();
    return list;
  }

  /** En följd av kommandon, åtskilda av ; & eller ny rad, fram till ett stoppord. */
  parseList(stops: string[]): Node {
    const items: { node: Node; background: boolean }[] = [];
    for (;;) {
      this.skipNewlines();
      if (this.atStop(stops)) break;
      if (this.isOp(';') || this.isOp('&')) throw this.unexpected();
      const node = this.parseAndOr();
      let background = false;
      if (this.isOp('&')) {
        background = true;
        this.i++;
      } else if (this.isOp(';') || this.isOp('\n')) {
        this.i++;
      } else if (!this.atStop(stops)) {
        throw this.unexpected();
      }
      items.push({ node, background });
    }
    return { type: 'list', items };
  }

  private parseAndOr(): Node {
    const first = this.parsePipeline();
    const rest: { op: '&&' | '||'; node: Node }[] = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = (this.toks[this.i++] as { v: '&&' | '||' }).v;
      this.skipNewlines();
      if (!this.peek()) throw new ParseError('syntax error: unexpected end of file', true);
      rest.push({ op, node: this.parsePipeline() });
    }
    return rest.length ? { type: 'andor', first, rest } : first;
  }

  private parsePipeline(): Node {
    let negate = false;
    if (isReserved(this.peek(), '!')) {
      negate = true;
      this.i++;
    }
    const commands = [this.parseCommand()];
    while (this.isOp('|')) {
      this.i++;
      this.skipNewlines();
      if (!this.peek()) throw new ParseError('syntax error: unexpected end of file', true);
      commands.push(this.parseCommand());
    }
    return commands.length === 1 && !negate ? commands[0] : { type: 'pipeline', commands, negate };
  }

  private parseRedirects(): Redirect[] {
    const redirects: Redirect[] = [];
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== 'op' || !REDIRS.has(t.v)) return redirects;
      this.i++;
      if (t.v === '2>&1' || t.v === '>&2' || t.v === '1>&2') {
        redirects.push({ op: t.v === '2>&1' ? '2>&1' : '>&2' });
        continue;
      }
      const target = this.peek();
      if (!target || target.t !== 'word') throw this.unexpected(target);
      this.i++;
      if (t.v === '<<' || t.v === '<<-') {
        const body = this.peek();
        if (!body || body.t !== 'hdbody') throw new ParseError('here-document saknar innehåll', true);
        this.i++;
        redirects.push({ op: t.v, target: target.w, body: body.body, expand: !body.quoted });
        continue;
      }
      redirects.push({ op: t.v as RedirOp, target: target.w });
    }
  }

  private parseCommand(): Node {
    const t = this.peek();
    if (!t) throw new ParseError('syntax error: unexpected end of file', true);
    if (t.t === 'arith') {
      this.i++;
      return { type: 'arith', expr: t.expr, redirects: this.parseRedirects() };
    }
    if (t.t === 'op') {
      if (t.v === '(') {
        this.i++;
        const body = this.parseList([')']);
        if (!this.isOp(')')) throw this.unexpected();
        this.i++;
        return { type: 'group', body, subshell: true, redirects: this.parseRedirects() };
      }
      if (!REDIRS.has(t.v)) throw this.unexpected();
    }
    if (isReserved(t, 'if')) return this.parseIf();
    if (isReserved(t, 'for')) return this.parseFor();
    if (isReserved(t, 'while', 'until')) return this.parseWhile();
    if (isReserved(t, 'case')) return this.parseCase();
    if (isReserved(t, 'function')) {
      this.i++;
      const name = this.peek();
      if (!name || name.t !== 'word') throw this.unexpected();
      this.i++;
      if (this.isOp('(')) {
        this.i++;
        if (!this.isOp(')')) throw this.unexpected();
        this.i++;
      }
      return this.parseFuncBody(name.w.raw);
    }
    if (isReserved(t, '{')) {
      this.i++;
      const body = this.parseList(['}']);
      this.expectWord('}');
      return { type: 'group', body, subshell: false, redirects: this.parseRedirects() };
    }
    if (t.t === 'word' && isReserved(t, ...STOP_WORDS)) throw this.unexpected();
    // namn() { ... }
    if (t.t === 'word' && this.isOp('(', this.toks[this.i + 1]) && this.isOp(')', this.toks[this.i + 2])) {
      this.i += 3;
      return this.parseFuncBody(t.w.raw);
    }
    return this.parseSimple();
  }

  private parseFuncBody(name: string): Node {
    if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new ParseError(`\`${name}': not a valid identifier`);
    this.skipNewlines();
    const body = this.parseCommand();
    return { type: 'funcdef', name, body };
  }

  private parseSimple(): Node {
    const words: Word[] = [];
    const redirects: Redirect[] = [];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'word') {
        words.push(t.w);
        this.i++;
        continue;
      }
      if (t.t === 'op' && REDIRS.has(t.v)) {
        redirects.push(...this.parseRedirects());
        continue;
      }
      break;
    }
    if (!words.length && !redirects.length) throw this.unexpected();
    return { type: 'simple', words, redirects };
  }

  private parseIf(): Node {
    this.i++; // if
    const clauses: { cond: Node; body: Node }[] = [];
    let elseBody: Node | null = null;
    for (;;) {
      const cond = this.parseList(['then']);
      this.expectWord('then');
      const body = this.parseList(['elif', 'else', 'fi']);
      clauses.push({ cond, body });
      if (isReserved(this.peek(), 'elif')) {
        this.i++;
        continue;
      }
      if (isReserved(this.peek(), 'else')) {
        this.i++;
        elseBody = this.parseList(['fi']);
      }
      this.expectWord('fi');
      break;
    }
    return { type: 'if', clauses, elseBody, redirects: this.parseRedirects() };
  }

  private parseDoBody(): Node {
    this.skipNewlines();
    if (this.isOp(';')) this.i++;
    this.expectWord('do');
    const body = this.parseList(['done']);
    this.expectWord('done');
    return body;
  }

  private parseFor(): Node {
    this.i++; // for
    const t = this.peek();
    if (t?.t === 'arith') {
      this.i++;
      const parts = t.expr.split(';');
      if (parts.length !== 3) throw new ParseError('syntax error: arithmetic expression required');
      const body = this.parseDoBody();
      return { type: 'cfor', init: parts[0], cond: parts[1], step: parts[2], body, redirects: this.parseRedirects() };
    }
    if (!t || t.t !== 'word' || !/^[A-Za-z_]\w*$/.test(t.w.raw)) throw this.unexpected(t);
    this.i++;
    const name = t.w.raw;
    let words: Word[] | null = null;
    this.skipNewlines();
    if (isReserved(this.peek(), 'in')) {
      this.i++;
      words = [];
      while (this.peek()?.t === 'word') {
        words.push((this.peek() as { w: Word }).w);
        this.i++;
      }
      if (!this.isOp(';') && !this.isOp('\n')) throw this.unexpected();
      this.i++;
    }
    const body = this.parseDoBody();
    return { type: 'for', name, words, body, redirects: this.parseRedirects() };
  }

  private parseWhile(): Node {
    const until = isReserved(this.peek(), 'until');
    this.i++;
    const cond = this.parseList(['do']);
    const body = this.parseDoBody();
    return { type: 'while', until, cond, body, redirects: this.parseRedirects() };
  }

  private parseCase(): Node {
    this.i++; // case
    const w = this.peek();
    if (!w || w.t !== 'word') throw this.unexpected(w);
    this.i++;
    this.expectWord('in');
    const items: { patterns: Word[]; body: Node | null }[] = [];
    for (;;) {
      this.skipNewlines();
      if (isReserved(this.peek(), 'esac')) break;
      if (!this.peek()) throw new ParseError('syntax error: unexpected end of file', true);
      if (this.isOp('(')) this.i++;
      const patterns: Word[] = [];
      for (;;) {
        const p = this.peek();
        if (!p || p.t !== 'word') throw this.unexpected(p);
        patterns.push(p.w);
        this.i++;
        if (this.isOp('|')) {
          this.i++;
          continue;
        }
        break;
      }
      if (!this.isOp(')')) throw this.unexpected();
      this.i++;
      const body = this.parseList([';;', 'esac']);
      items.push({ patterns, body: (body as { items: unknown[] }).items.length ? body : null });
      if (this.isOp(';;')) this.i++;
    }
    this.expectWord('esac');
    return { type: 'case', word: w.w, items, redirects: this.parseRedirects() };
  }
}

export function parse(input: string): Node {
  return new Parser(tokenize(input)).parseProgram();
}

/** Gör om ett glob-mönster (*, ?, [abc]) till ett RegExp. Med `anyChar` matchar * även "/" (som i case). */
export function globToRegex(seg: string, anyChar = false): RegExp {
  const star = anyChar ? '.*' : '[^/]*';
  const one = anyChar ? '.' : '[^/]';
  let re = '';
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === '\\' && i + 1 < seg.length) {
      re += escapeRegex(seg[++i]);
    } else if (c === '*') {
      re += star;
    } else if (c === '?') {
      re += one;
    } else if (c === '[') {
      const j = seg.indexOf(']', i + 2);
      if (j < 0) {
        re += '\\[';
      } else {
        let cls = seg.slice(i + 1, j);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        re += `[${cls.replace(/\\/g, '\\\\')}]`;
        i = j;
      }
    } else {
      re += escapeRegex(c);
    }
  }
  return new RegExp(`^${re}$`, 's');
}

export function hasUnescapedGlob(seg: string): boolean {
  for (let i = 0; i < seg.length; i++) {
    if (seg[i] === '\\') {
      i++;
      continue;
    }
    if (seg[i] === '*' || seg[i] === '?' || seg[i] === '[') return true;
  }
  return false;
}

export function escapeGlob(text: string): string {
  return text.replace(/[*?[\]\\]/g, '\\$&');
}

export function unescapeGlob(text: string): string {
  return text.replace(/\\(.)/g, '$1');
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
