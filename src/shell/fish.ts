// Översätter fish-kod till bash-kod som skalets vanliga parser kan köra.
//
// fish har en egen syntax: block avslutas med `end`, variabler sätts med `set`,
// kommandosubstitution skrivs (kommando), `and`/`or`/`not` är egna kommandon och
// $argv/$status ersätter $@/$?. Översättningen täcker det vanligaste:
//
//   set NAMN värde…            ->  __fish_set NAMN värde…   (inbyggt kommando)
//   (kommando)                 ->  $(kommando)
//   if A; and B; …; else; …; end      ->  if A && B; then …; else …; fi
//   for x in a b c; …; end     ->  for x in a b c; do …; done
//   while …; …; end            ->  while …; do …; done
//   function f; …; end         ->  f() { …; }
//   begin; …; end              ->  { …; }
//   switch $x; case a b; …; end       ->  case $x in a|b) … ;; esac
//   $argv, $argv[1], $status   ->  "$@", ${1}, $?
//
// Bash-syntax som fish inte godtar (X=1, $?, ${X}, $((...)), then/do/fi …) ger
// fish egna felmeddelanden.

import { ParseError } from './parser';

type Msg = (t: { sv: string; en: string }) => string;

type Tok = { t: 'word'; raw: string } | { t: 'op'; op: ';' | '&' | '&&' | '||' | '|' };

interface Block {
  kind: 'if' | 'for' | 'while' | 'function' | 'begin' | 'switch';
  cases: number;
}

/** Fish-kommandon som skalet har egna (dolda) inbyggda kommandon för. */
const FISH_BUILTINS: Record<string, string> = {
  set: '__fish_set',
  count: '__fish_count',
  math: '__fish_math',
  status: '__fish_status',
  contains: '__fish_contains',
};

/** Bash-ord som inte finns i fish. */
const BASH_ONLY = new Set(['then', 'do', 'done', 'fi', 'esac', 'elif', 'local', 'declare', 'let', '[[', 'until', 'select']);

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const defaultMsg: Msg = (t) => t.en;

export function translateFish(text: string, msg: Msg = defaultMsg): string {
  return new FishTranslator(msg).translate(text);
}

function fishError(message: string, incomplete = false): ParseError {
  return new ParseError(message, incomplete);
}

/** Hittar slutet på ett citat som börjar vid i (pekar på citattecknet). Returnerar -1 om det saknas. */
function closingQuote(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\' && (q === '"' || s[j + 1] === "'" || s[j + 1] === '\\')) j++;
    else if (s[j] === q) return j;
  }
  return -1;
}

/** Hittar parentesen som stänger den vid i. Returnerar -1 om den saknas. */
function closingParen(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') j++;
    else if (c === "'" || c === '"') {
      const k = closingQuote(s, j);
      if (k < 0) return -1;
      j = k;
    } else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return j;
  }
  return -1;
}

function lex(text: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
    } else if (c === '\\' && text[i + 1] === '\n') {
      i += 2;
    } else if (c === '#') {
      while (i < n && text[i] !== '\n') i++;
    } else if (c === '\n' || c === ';') {
      toks.push({ t: 'op', op: ';' });
      i++;
    } else if (c === '|') {
      const two = text[i + 1] === '|';
      toks.push({ t: 'op', op: two ? '||' : '|' });
      i += two ? 2 : 1;
    } else if (c === '&' && text[i + 1] === '&') {
      toks.push({ t: 'op', op: '&&' });
      i += 2;
    } else if (c === '&' && text[i + 1] !== '>') {
      toks.push({ t: 'op', op: '&' });
      i++;
    } else {
      const start = i;
      while (i < n) {
        const ch = text[i];
        if (ch === '\\') {
          i += 2;
        } else if (ch === "'" || ch === '"') {
          const j = closingQuote(text, i);
          if (j < 0) throw fishError('Unexpected end of string, quotes are not balanced', true);
          i = j + 1;
        } else if (ch === '(') {
          const j = closingParen(text, i);
          if (j < 0) throw fishError('Unexpected end of string, parenthesis do not match', true);
          i = j + 1;
        } else if (ch === ')') {
          throw fishError("Unexpected ')' for unopened parenthesis");
        } else if (ch === '<' && text[i + 1] === '<') {
          throw fishError('Expected a string, but found a redirection');
        } else if (' \t\r\n;|'.includes(ch)) {
          break;
        } else if (ch === '&' && text[i - 1] !== '>' && text[i + 1] !== '>') {
          break;
        } else {
          i++;
        }
      }
      toks.push({ t: 'word', raw: text.slice(start, i) });
    }
  }
  return toks;
}

/** Ordet utan citattecken, om det är ett vanligt ord (för nyckelord). */
const bare = (t: Tok | undefined) => (t?.t === 'word' && /^[\w[\]-]+$/.test(t.raw) ? t.raw : null);

/** Tar bort citattecken (används för case-mönster, som ska fungera som jokertecken). */
const unquote = (raw: string) => raw.replace(/\\(.)|'([^']*)'|"([^"]*)"/g, (_m, esc, sq, dq) => esc ?? sq ?? dq ?? '');

class FishTranslator {
  private out = '';
  private pending: string | null = null;
  private needSep = false;
  private blocks: Block[] = [];

  constructor(private msg: Msg) {}

  translate(text: string): string {
    const toks = lex(text);
    let stmt: Tok[] = [];
    for (const t of toks) {
      if (t.t === 'op' && (t.op === ';' || t.op === '&')) {
        if (stmt.length) this.statement(stmt);
        else if (t.op === '&') throw fishError("Unexpected '&' found");
        if (t.op === '&' && stmt.length) {
          this.out += ' &';
          this.needSep = false;
        }
        stmt = [];
      } else {
        stmt.push(t);
      }
    }
    if (stmt.length) this.statement(stmt);
    if (this.blocks.length) {
      throw fishError(`Missing end to balance this ${this.blocks.at(-1)!.kind} block`, true);
    }
    return this.out;
  }

  private emit(code: string): void {
    if (this.pending !== null) {
      this.out += this.pending + ' ';
      this.pending = null;
    } else if (this.needSep) {
      this.out += '; ';
    } else if (this.out && !this.out.endsWith(' ')) {
      this.out += ' ';
    }
    this.out += code;
    this.needSep = true;
  }

  private open(kind: Block['kind'], header: string, after: string): void {
    this.emit(header);
    this.blocks.push({ kind, cases: 0 });
    this.pending = after;
  }

  private statement(toks: Tok[]): void {
    const kw = bare(toks[0]);
    const rest = toks.slice(1);
    switch (kw) {
      case 'if':
        return this.open('if', `if ${this.commands(rest)}`, '; then');
      case 'while':
        return this.open('while', `while ${this.commands(rest)}`, '; do');
      case 'else': {
        const top = this.blocks.at(-1);
        if (top?.kind !== 'if') throw fishError("'else' builtin not inside of if block");
        if (bare(rest[0]) === 'if') {
          this.emit(`elif ${this.commands(rest.slice(1))}`);
          this.pending = '; then';
        } else {
          this.emit('else');
          this.pending = '';
          if (rest.length) this.statement(rest);
        }
        return;
      }
      case 'for': {
        const name = bare(rest[0]);
        if (!name || !/^[A-Za-z_]\w*$/.test(name)) throw fishError("for: Variable name '' is not valid. See `help identifiers`.");
        if (bare(rest[1]) !== 'in') throw fishError("for: Expected 'in'");
        return this.open('for', `for ${name} in ${this.words(rest.slice(2))}`.trimEnd(), '; do');
      }
      case 'function':
        return this.functionHeader(rest);
      case 'begin':
        this.open('begin', '{', '');
        if (rest.length) this.statement(rest);
        return;
      case 'switch':
        return this.open('switch', `case ${this.words(rest)} in`, '');
      case 'case': {
        const top = this.blocks.at(-1);
        if (top?.kind !== 'switch') throw fishError("case: 'case' builtin not inside of switch block");
        const patterns = rest.filter((t) => t.t === 'word').map((t) => unquote((t as { raw: string }).raw));
        this.out += (top.cases++ > 0 ? ' ;; ' : ' ') + (patterns.join('|') || '""') + ')';
        this.pending = '';
        this.needSep = false;
        return;
      }
      case 'end': {
        const top = this.blocks.pop();
        if (!top) throw fishError("'end' outside of a block");
        if (this.pending !== null) {
          // Tomt block – bash kräver minst ett kommando.
          if (top.kind !== 'switch') this.emit('true');
          this.pending = null;
        }
        const close = { if: 'fi', for: 'done', while: 'done', function: '}', begin: '}', switch: 'esac' }[top.kind];
        if (top.kind === 'switch') {
          this.out += top.cases ? ' ;; esac' : ' esac';
          this.needSep = true;
        } else {
          this.emit(close);
        }
        // Omdirigeringar och pipes efter end: "end < fil", "end | sort".
        if (rest.length) this.out += ' ' + this.commands(rest, false);
        return;
      }
      case 'and':
      case 'or':
        if (!this.out) throw fishError(`'${kw}' must follow a command`);
        if (!rest.length) throw fishError(`Missing command after '${kw}'`);
        this.out += (kw === 'and' ? ' && ' : ' || ') + this.commands(rest);
        return;
    }
    this.emit(this.commands(toks));
  }

  /** function namn [--argument-names a b] [--description text] */
  private functionHeader(rest: Tok[]): void {
    const name = bare(rest[0]) ?? (rest[0]?.t === 'word' ? rest[0].raw : '');
    if (!name || name.startsWith('-')) throw fishError('function: Expected function name');
    const argNames: string[] = [];
    let mode: 'args' | 'skip' | null = null;
    for (const t of rest.slice(1)) {
      if (t.t !== 'word') continue;
      if (t.raw === '--argument-names' || t.raw === '-a') mode = 'args';
      else if (t.raw === '--description' || t.raw === '-d' || t.raw === '--wraps' || t.raw === '-w') mode = 'skip';
      else if (t.raw.startsWith('-')) mode = null;
      else if (mode === 'args') argNames.push(t.raw);
      else if (mode === 'skip') mode = null;
    }
    this.open('function', `${name}() {`, '');
    argNames.forEach((a, i) => this.emit(`local ${a}="\${${i + 1}}"`));
  }

  /** Ett eller flera kommandon med | && || emellan. */
  private commands(toks: Tok[], cmdPos = true): string {
    const parts: string[] = [];
    let words: string[] = [];
    let first = cmdPos;
    let cmdName: string | null = null;
    let assignOnly = true;
    let assignWord = '';
    const flush = () => {
      if (cmdPos && words.length && assignOnly && assignWord) {
        const [, name, value] = /^([A-Za-z_]\w*)=(.*)$/s.exec(assignWord)!;
        const shown = value ? ` ${value}` : '';
        throw fishError(
          `Unsupported use of '='. In fish, please use 'set ${name}${shown}'.\n${assignWord}\n` +
            (assignWord.length > 1 ? `^${'~'.repeat(assignWord.length - 2)}^` : '^'),
        );
      }
      parts.push(words.join(' '));
      words = [];
      first = true;
      assignOnly = true;
      assignWord = '';
      cmdName = null;
    };
    for (const t of toks) {
      if (t.t === 'op') {
        flush();
        parts.push(t.op);
        continue;
      }
      if (first) {
        // Variabeltilldelningar framför kommandot (X=1 kommando) fungerar i fish 3.1+.
        if (/^[A-Za-z_]\w*=/.test(t.raw)) {
          assignWord ||= t.raw;
          words.push(this.word(t.raw));
          continue;
        }
        first = false;
        assignOnly = false;
        if (t.raw === 'not' || t.raw === '!') {
          words.push('!');
          first = true;
          continue;
        }
        if (BASH_ONLY.has(t.raw)) {
          throw fishError(
            `Unknown command: ${t.raw}\n${DIM}${this.msg({
              sv: `Det där är bash-syntax. I fish avslutas if, for, while och function med "end" – utan then, do, done och fi.`,
              en: `That is bash syntax. In fish, if, for, while and function blocks are closed with "end" – no then, do, done or fi.`,
            })}${RESET}`,
          );
        }
        cmdName = t.raw;
        if (FISH_BUILTINS[t.raw]) {
          words.push(FISH_BUILTINS[t.raw]);
          continue;
        }
        words.push(this.word(t.raw));
        continue;
      }
      if (cmdName === 'read' && /^(-[lgxU]+|--(local|global|export|universal))$/.test(t.raw)) continue;
      if (cmdName === 'read' && t.raw === '-P') {
        words.push('-p');
        continue;
      }
      if (cmdName === 'alias' && words.length === 2 && !words[1].includes('=')) {
        // fish: alias ll 'ls -l'  ->  alias ll='ls -l'
        words[1] += '=' + this.word(t.raw);
        continue;
      }
      words.push(this.word(t.raw));
    }
    flush();
    return parts.join(' ').trim();
  }

  private words(toks: Tok[]): string {
    return toks.map((t) => (t.t === 'word' ? this.word(t.raw) : t.op)).join(' ');
  }

  /** Översätter ett ord: (kommando), $argv, $status, {$VAR} … */
  private word(raw: string): string {
    let out = '';
    for (let i = 0; i < raw.length; ) {
      const c = raw[i];
      if (c === '\\') {
        out += raw.slice(i, i + 2);
        i += 2;
      } else if (c === "'") {
        const j = closingQuote(raw, i);
        // fish tillåter \' inne i enkla citattecken – bash gör det inte.
        out += "'" + raw.slice(i + 1, j).replace(/\\'/g, `'\\''`).replace(/\\\\/g, '\\') + "'";
        i = j + 1;
      } else if (c === '"') {
        const j = closingQuote(raw, i);
        out += '"' + this.dollars(raw.slice(i + 1, j), true) + '"';
        i = j + 1;
      } else if (c === '(') {
        const j = closingParen(raw, i);
        out += '$(' + this.sub(raw.slice(i + 1, j)) + ')';
        i = j + 1;
      } else if (c === '{' && /^\{\$[A-Za-z_]\w*\}/.test(raw.slice(i))) {
        const name = /^\{\$([A-Za-z_]\w*)\}/.exec(raw.slice(i))![1];
        out += this.variable(name, '', false);
        i += name.length + 3;
      } else if (c === '$') {
        const [text, len] = this.dollar(raw.slice(i), false);
        out += text;
        i += len;
      } else {
        out += c;
        i++;
      }
    }
    return out;
  }

  /** Text inom dubbla citattecken: bara $-uttryck översätts. */
  private dollars(text: string, quoted: boolean): string {
    let out = '';
    for (let i = 0; i < text.length; ) {
      if (text[i] === '\\') {
        out += text.slice(i, i + 2);
        i += 2;
      } else if (text[i] === '$') {
        const [t, len] = this.dollar(text.slice(i), quoted);
        out += t;
        i += len;
      } else {
        out += text[i++];
      }
    }
    return out;
  }

  /** Ett $-uttryck i början av s. Returnerar [bash-text, antal tecken]. */
  private dollar(s: string, quoted: boolean): [string, number] {
    const next = s[1];
    if (next === '(') {
      if (s[2] === '(') throw fishError("$((...)) is not supported. In fish, please use 'math'.");
      const j = closingParen(s, 1);
      return ['$(' + this.sub(s.slice(2, j)) + ')', j + 1];
    }
    if (next === '{') {
      const name = /^\$\{([^}]*)\}/.exec(s)?.[1] ?? 'VAR';
      throw fishError(`Variables cannot be bracketed. In fish, please use {$${name}}.`);
    }
    const errors: Record<string, string> = {
      '?': '$? is not the exit status. In fish, please use $status.',
      $: '$$ is not the pid. In fish, please use $fish_pid.',
      '#': "$# is not supported. In fish, please use 'count $argv'.",
      '@': '$@ is not supported. In fish, please use $argv.',
      '*': '$* is not supported. In fish, please use $argv.',
    };
    if (next && errors[next]) throw fishError(errors[next]);
    const m = /^\$([A-Za-z_]\w*)(?:\[(-?\d+)\])?/.exec(s);
    if (!m) return ['$', 1];
    return [this.variable(m[1], m[2] ?? '', quoted), m[0].length];
  }

  private variable(name: string, index: string, quoted: boolean): string {
    if (name === 'argv') return index ? (Number(index) > 0 ? `\${${index}}` : `$(__fish_index ${index} "$@")`) : quoted ? '$*' : '$@';
    if (name === 'status') return '$?';
    if (name === 'fish_pid') return '$$';
    if (index) return `$(__fish_index ${index} \${${name}})`;
    return `\${${name}}`;
  }

  /** Kod inne i (…): översätts för sig. */
  private sub(code: string): string {
    return new FishTranslator(this.msg).translate(code);
  }
}
