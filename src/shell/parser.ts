// Tolkar en kommandorad ungefär som bash gör:
// citattecken, \-escape, pipes (|), omdirigering (> >> < 2> 2>&1 &>),
// samt kedjor med ; && och ||. Variabler och jokertecken expanderas senare av skalet.

export interface Part {
  text: string;
  quoted: 'none' | 'single' | 'double';
}

export interface Word {
  parts: Part[];
  raw: string;
}

export type RedirOp = '>' | '>>' | '<' | '2>' | '2>>' | '2>&1' | '&>';

export interface Redirect {
  op: RedirOp;
  target?: Word;
}

export interface SimpleCommand {
  words: Word[];
  redirects: Redirect[];
}

export type Pipeline = SimpleCommand[];

export interface ListItem {
  /** Operatorn före denna pipeline (null för den första). */
  op: ';' | '&&' | '||' | null;
  pipeline: Pipeline;
}

export class ParseError extends Error {}

type Tok = { t: 'word'; w: Word } | { t: 'op'; v: string };

const REDIRS = new Set(['>', '>>', '<', '2>', '2>>', '2>&1', '&>']);
// Ordningen spelar roll: längre operatorer först.
const OPS = ['2>&1', '2>>', '2>', '&>', '&&', '||', '>>', '|', '>', '<', ';', '&'];

export function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  let word: { parts: Part[]; raw: string; cur: string } | null = null;

  const begin = () => {
    if (!word) word = { parts: [], raw: '', cur: '' };
    return word;
  };
  const flush = (w: { parts: Part[]; cur: string }) => {
    if (w.cur) {
      w.parts.push({ text: w.cur, quoted: 'none' });
      w.cur = '';
    }
  };
  const end = () => {
    if (word) {
      flush(word);
      toks.push({ t: 'word', w: { parts: word.parts, raw: word.raw } });
      word = null;
    }
  };

  let i = 0;
  outer: while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      end();
      i++;
      continue;
    }
    if (!word && c === '#') break; // kommentar resten av raden

    for (const op of OPS) {
      // "2>" räknas bara som operator i början av ett ord (annars är "fil2>x" = "fil2" + ">").
      if (op.startsWith('2') && word) continue;
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
      if (j < 0) throw new ParseError("unexpected EOF while looking for matching `''");
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
        } else {
          buf += input[j];
          j++;
        }
      }
      if (j >= input.length) throw new ParseError('unexpected EOF while looking for matching `"\'');
      w.parts.push({ text: buf, quoted: 'double' });
      w.raw += input.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === '\\') {
      const w = begin();
      if (i + 1 < input.length) {
        flush(w);
        w.parts.push({ text: input[i + 1], quoted: 'single' });
        w.raw += input.slice(i, i + 2);
      }
      i += 2;
      continue;
    }

    const w = begin();
    w.cur += c;
    w.raw += c;
    i++;
  }
  end();
  return toks;
}

function unexpected(t: Tok | undefined): ParseError {
  const what = t ? (t.t === 'op' ? t.v : t.w.raw) : 'newline';
  return new ParseError(`syntax error near unexpected token \`${what}'`);
}

export function parse(input: string): ListItem[] {
  const toks = tokenize(input);
  const items: ListItem[] = [];
  let i = 0;
  let nextOp: ListItem['op'] = null;

  while (i < toks.length) {
    const pipeline: Pipeline = [];
    for (;;) {
      const cmd: SimpleCommand = { words: [], redirects: [] };
      while (i < toks.length) {
        const t = toks[i];
        if (t.t === 'word') {
          cmd.words.push(t.w);
          i++;
          continue;
        }
        if (REDIRS.has(t.v)) {
          if (t.v === '2>&1') {
            cmd.redirects.push({ op: '2>&1' });
            i++;
            continue;
          }
          const target = toks[i + 1];
          if (!target || target.t !== 'word') throw unexpected(target);
          cmd.redirects.push({ op: t.v as RedirOp, target: target.w });
          i += 2;
          continue;
        }
        break;
      }
      if (cmd.words.length === 0 && cmd.redirects.length === 0) throw unexpected(toks[i]);
      pipeline.push(cmd);
      const t = toks[i];
      if (t && t.t === 'op' && t.v === '|') {
        i++;
        continue;
      }
      break;
    }
    items.push({ op: nextOp, pipeline });

    const t = toks[i];
    if (!t) break;
    if (t.t !== 'op') throw unexpected(t);
    if (t.v === ';' || t.v === '&') nextOp = ';';
    else if (t.v === '&&' || t.v === '||') nextOp = t.v;
    else throw unexpected(t);
    i++;
    if (i >= toks.length && (t.v === '&&' || t.v === '||')) {
      throw new ParseError('syntax error: unexpected end of file');
    }
  }
  return items;
}

/** Gör om ett glob-mönster (*, ?, [abc]) för ETT sökvägssegment till ett RegExp. */
export function globToRegex(seg: string): RegExp {
  let re = '';
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === '\\' && i + 1 < seg.length) {
      re += escapeRegex(seg[++i]);
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
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
  return new RegExp(`^${re}$`);
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
