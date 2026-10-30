// Textbearbetning: tr, sed och awk.

import type { CmdCtx, CommandDef } from '../types';
import { dirname } from '../vfs';
import { AwkFatal, AwkInterpreter, AwkSyntaxError, parseAwk } from './awk';
import { groupCount, toJsRegex } from './regex';
import { COLOR, fsMessage, splitLines } from './util';

const dimNote = (ctx: CmdCtx, text: string) => ctx.err(`${COLOR.dim}(simulatorn: ${text})${COLOR.reset}\n`);

// =====================================================================
// tr
// =====================================================================

const TR_CLASSES: Record<string, string> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digit: '0123456789',
  space: ' \t\n\r\f\v',
  blank: ' \t',
  punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
  xdigit: '0123456789ABCDEFabcdef',
};
TR_CLASSES.alpha = TR_CLASSES.upper + TR_CLASSES.lower;
TR_CLASSES.alnum = TR_CLASSES.digit + TR_CLASSES.alpha;

class TrError extends Error {}

/** Expanderar en tr-mängd: intervall (a-z), klasser ([:upper:]) och escape (\n). */
export function expandTrSet(spec: string): string[] {
  const chars = [...spec];
  const out: string[] = [];
  let i = 0;
  const readChar = (): string => {
    const c = chars[i++];
    if (c !== '\\' || i >= chars.length) return c;
    const n = chars[i++];
    const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', a: '\x07', b: '\b', '\\': '\\' };
    if (n in map) return map[n];
    if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(chars[i] ?? '')) oct += chars[i++];
      return String.fromCharCode(parseInt(oct, 8));
    }
    return n;
  };
  while (i < chars.length) {
    if (chars[i] === '[' && chars[i + 1] === ':') {
      const rest = chars.slice(i).join('');
      const end = rest.indexOf(':]');
      if (end > 0) {
        const name = rest.slice(2, end);
        const cls = TR_CLASSES[name];
        if (cls === undefined) throw new TrError(`invalid character class '${name}'`);
        out.push(...cls);
        i += [...rest.slice(0, end + 2)].length;
        continue;
      }
    }
    const c = readChar();
    if (chars[i] === '-' && i + 1 < chars.length) {
      i++;
      const d = readChar();
      const from = c.codePointAt(0)!;
      const to = d.codePointAt(0)!;
      if (to < from) throw new TrError(`range-endpoints of '${c}-${d}' are in reverse collating sequence order`);
      for (let cp = from; cp <= to; cp++) out.push(String.fromCodePoint(cp));
      continue;
    }
    out.push(c);
  }
  return out;
}

const tr: CommandDef = {
  name: 'tr',
  summary: 'Byter ut eller tar bort tecken',
  man: `NAMN
       tr - översätt (translate), ta bort eller pressa ihop tecken

SYNOPSIS
       tr [-c] [-d] [-s] MÄNGD1 [MÄNGD2]

BESKRIVNING
       Läser standard input, byter varje tecken i MÄNGD1 mot tecknet på
       samma plats i MÄNGD2 och skriver resultatet till standard output.
       tr läser bara från standard input – aldrig från filer. Använd en pipe
       eller <.

       Mängder skrivs som vanliga tecken, intervall eller klasser:
       a-z  A-Z  0-9           intervall
       [:upper:] [:lower:]     stora / små bokstäver
       [:digit:] [:space:]     siffror / blanktecken
       [:alpha:] [:alnum:] [:punct:]
       \\n  \\t                  ny rad, tabb

       Obs! tr arbetar med enskilda byte, så a-z och [:lower:] omfattar
       inte å, ä och ö.

FLAGGOR
       -d    ta bort (delete) alla tecken i MÄNGD1
       -s    pressa ihop (squeeze) upprepade tecken till ett
       -c    använd komplementet till MÄNGD1 (alla tecken som INTE finns där)

EXEMPEL
       echo hej | tr a-z A-Z            HEJ
       echo $PATH | tr ':' '\\n'         en katalog per rad
       tr -d '0-9' < fil.txt            ta bort alla siffror
       echo "a   b    c" | tr -s ' '    a b c`,
  run(ctx) {
    const flags = new Set<string>();
    const ops: string[] = [];
    let i = 0;
    for (; i < ctx.args.length; i++) {
      const a = ctx.args[i];
      if (a === '--') {
        i++;
        break;
      }
      const long: Record<string, string> = { '--delete': 'd', '--squeeze-repeats': 's', '--complement': 'c' };
      if (a in long) {
        flags.add(long[a]);
        continue;
      }
      if (/^-[a-zA-Z]+$/.test(a)) {
        for (const c of a.slice(1)) {
          if (!'dscC'.includes(c)) {
            ctx.err(`tr: invalid option -- '${c}'\nTry 'tr --help' for more information.\n`);
            return 1;
          }
          flags.add(c === 'C' ? 'c' : c);
        }
        continue;
      }
      if (a.startsWith('--')) {
        ctx.err(`tr: unrecognized option '${a}'\nTry 'tr --help' for more information.\n`);
        return 1;
      }
      ops.push(a);
    }
    ops.push(...ctx.args.slice(i));

    const del = flags.has('d');
    const squeeze = flags.has('s');
    const usage = (msg: string) => {
      ctx.err(`tr: ${msg}\nTry 'tr --help' for more information.\n`);
      return 1;
    };
    if (ops.length === 0) return usage('missing operand');
    if (del && !squeeze && ops.length > 1)
      return usage(`extra operand '${ops[1]}'\nOnly one string may be given when deleting without squeezing repeated characters.`);
    if (del && squeeze && ops.length < 2)
      return usage(`missing operand after '${ops[0]}'\nTwo strings must be given when both deleting and squeezing repeats.`);
    if (!del && !squeeze && ops.length < 2) return usage(`missing operand after '${ops[0]}'\nTwo strings must be given when translating.`);
    if (ops.length > 2) return usage(`extra operand '${ops[2]}'`);

    let set1: string[];
    let set2: string[];
    try {
      set1 = expandTrSet(ops[0]);
      set2 = ops.length > 1 ? expandTrSet(ops[1]) : [];
    } catch (e) {
      if (!(e instanceof TrError)) throw e;
      ctx.err(`tr: ${e.message}\n`);
      return 1;
    }
    const in1 = new Set(set1);
    const inSet1 = flags.has('c') ? (c: string) => !in1.has(c) : (c: string) => in1.has(c);
    const translating = !del && ops.length === 2;
    if (translating && set2.length === 0) {
      ctx.err(`tr: when not truncating set1, string2 must be non-empty\n`);
      return 1;
    }
    const map = new Map<string, string>();
    if (translating && !flags.has('c')) set1.forEach((c, idx) => map.set(c, set2[Math.min(idx, set2.length - 1)]));
    const squeezeSet = new Set(del || translating ? set2 : set1);
    const squeezeTest = del || translating ? (c: string) => squeezeSet.has(c) : inSet1;

    let out = '';
    let last = '';
    for (let c of ctx.stdin ?? '') {
      if (del && inSet1(c)) continue;
      if (translating) {
        if (flags.has('c')) {
          if (inSet1(c)) c = set2[set2.length - 1];
        } else c = map.get(c) ?? c;
      }
      if (squeeze && c === last && squeezeTest(c)) continue;
      out += c;
      last = c;
    }
    ctx.out(out);
    return 0;
  },
};

// =====================================================================
// sed
// =====================================================================

class SedError extends Error {}
class SedUnsupported extends Error {}

type SedAddr =
  | { kind: 'line'; n: number }
  | { kind: 'step'; first: number; step: number }
  | { kind: 'last' }
  | { kind: 're'; re: RegExp };

type ReplPart = string | { group: number } | { caseOp: 'U' | 'L' | 'E' | 'u' | 'l' };

interface SedCmd {
  a1?: SedAddr;
  a2?: SedAddr;
  neg: boolean;
  name: string;
  /** s: */
  re?: RegExp;
  repl?: ReplPart[];
  global?: boolean;
  nth?: number;
  print?: boolean;
  /** y: */
  map?: Map<string, string>;
  /** a, i, c: */
  text?: string;
  /** q, Q: */
  exitCode?: number;
  /** Om ett intervall pågår. */
  active?: boolean;
}

interface SedState {
  lastRe?: RegExp;
}

const SED_UNSUPPORTED = 'nNDPhHgGxbtTlrRwWeFzv:{}';

function parseSedScript(script: string, exprNo: number, ere: boolean, state: SedState, cmds: SedCmd[]) {
  let i = 0;
  const fail = (msg: string): never => {
    throw new SedError(`-e expression #${exprNo}, char ${Math.max(i, 1)}: ${msg}`);
  };
  const skipSpace = () => {
    while (script[i] === ' ' || script[i] === '\t') i++;
  };
  const endOfCmd = () => {
    skipSpace();
    const c = script[i];
    if (c === undefined || c === ';' || c === '\n') return;
    if (c === '#') {
      while (i < script.length && script[i] !== '\n') i++;
      return;
    }
    if (c === '}') throw new SedUnsupported('{ }');
    fail('extra characters after command');
  };
  /** Läser fram till (oescapat) avgränsningstecken. \avgränsare blir avgränsaren själv. */
  const readDelimited = (delim: string, what: string): string => {
    let s = '';
    while (i < script.length && script[i] !== delim) {
      if (script[i] === '\n' && delim !== '\n') fail(what);
      if (script[i] === '\\' && i + 1 < script.length) {
        const n = script[i + 1];
        s += n === delim ? delim : '\\' + n;
        i += 2;
        continue;
      }
      s += script[i++];
    }
    if (i >= script.length) fail(what);
    i++;
    return s;
  };
  const makeRe = (src: string, flags: string, what: string): RegExp => {
    if (src === '') {
      if (!state.lastRe) fail('no previous regular expression');
      return new RegExp(state.lastRe!.source, flags);
    }
    try {
      const re = new RegExp(toJsRegex(src, ere), flags);
      state.lastRe = re;
      return re;
    } catch {
      return fail(`Invalid ${what}`);
    }
  };
  const readAddr = (): SedAddr | undefined => {
    const c = script[i];
    if (c !== undefined && /[0-9]/.test(c)) {
      let n = '';
      while (/[0-9]/.test(script[i] ?? '')) n += script[i++];
      if (script[i] === '~') {
        // GNU-tillägg: första~steg, t.ex. 1~2 = varannan rad.
        i++;
        let step = '';
        while (/[0-9]/.test(script[i] ?? '')) step += script[i++];
        return { kind: 'step', first: Number(n), step: Number(step || '0') };
      }
      if (Number(n) === 0) fail('invalid usage of line address 0');
      return { kind: 'line', n: Number(n) };
    }
    if (c === '$') {
      i++;
      return { kind: 'last' };
    }
    if (c === '/' || c === '\\') {
      i++;
      const delim = c === '/' ? '/' : script[i++];
      if (delim === undefined) fail('unexpected end of expression');
      const src = readDelimited(delim, 'unterminated address regex');
      let flags = '';
      while (script[i] === 'I' || script[i] === 'M') {
        if (script[i] === 'I') flags = 'i';
        i++;
      }
      return { kind: 're', re: makeRe(src, flags, 'regular expression') };
    }
    return undefined;
  };

  while (i < script.length) {
    while (i < script.length && /[\s;]/.test(script[i])) i++;
    if (i >= script.length) break;
    if (script[i] === '#') {
      while (i < script.length && script[i] !== '\n') i++;
      continue;
    }
    const cmd: SedCmd = { neg: false, name: '' };
    cmd.a1 = readAddr();
    if (cmd.a1 && script[i] === ',') {
      i++;
      skipSpace();
      cmd.a2 = readAddr();
      if (!cmd.a2) fail("unexpected `,'");
    }
    skipSpace();
    if (script[i] === '!') {
      cmd.neg = true;
      i++;
      skipSpace();
      if (script[i] === '!') fail('multiple `!\'s');
    }
    if (i >= script.length || script[i] === ';' || script[i] === '\n') fail('missing command');
    if (!cmd.a1 && script[i] === ',') fail("unexpected `,'");
    const name = script[i++];
    cmd.name = name;
    switch (name) {
      case 's': {
        const delim = script[i++];
        if (delim === undefined || delim === '\n' || delim === '\\') fail("unterminated `s' command");
        const pat = readDelimited(delim, "unterminated `s' command");
        const rawRepl = readDelimited(delim, "unterminated `s' command");
        let flags = '';
        cmd.nth = 1;
        let nthSet = false;
        for (;;) {
          const f = script[i];
          if (f === 'g') cmd.global = true;
          else if (f === 'p') cmd.print = true;
          else if (f === 'i' || f === 'I') flags = 'i';
          else if (f !== undefined && /[0-9]/.test(f)) {
            let n = '';
            while (/[0-9]/.test(script[i] ?? '')) n += script[i++];
            if (Number(n) === 0) fail("number option to `s' command may not be zero");
            if (nthSet) fail("multiple number options to `s' command");
            cmd.nth = Number(n);
            nthSet = true;
            continue;
          } else if (f === 'w' || f === 'e' || f === 'm' || f === 'M') throw new SedUnsupported(`s///${f}`);
          else break;
          i++;
        }
        const c = script[i];
        if (c !== undefined && !' \t;\n#}'.includes(c)) fail("unknown option to `s'");
        endOfCmd();
        cmd.re = makeRe(pat, 'g' + flags, 'regular expression');
        const groups = groupCount(cmd.re);
        const parts: ReplPart[] = [];
        let lit = '';
        const flush = () => {
          if (lit) parts.push(lit);
          lit = '';
        };
        for (let j = 0; j < rawRepl.length; j++) {
          const ch = rawRepl[j];
          if (ch === '&') {
            flush();
            parts.push({ group: 0 });
          } else if (ch === '\\' && j + 1 < rawRepl.length) {
            const n = rawRepl[++j];
            if (/[0-9]/.test(n)) {
              if (Number(n) > groups) fail(`invalid reference \\${n} on \`s' command's RHS`);
              flush();
              parts.push({ group: Number(n) });
            } else if ('ULEul'.includes(n)) {
              flush();
              parts.push({ caseOp: n as 'U' });
            } else lit += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          } else lit += ch;
        }
        flush();
        cmd.repl = parts;
        break;
      }
      case 'y': {
        const delim = script[i++];
        if (delim === undefined || delim === '\n' || delim === '\\') fail("unterminated `y' command");
        const unesc = (s: string) => s.replace(/\\(.)/g, (_m, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
        const from = [...unesc(readDelimited(delim, "unterminated `y' command"))];
        const to = [...unesc(readDelimited(delim, "unterminated `y' command"))];
        if (from.length !== to.length) fail("strings for `y' command are different lengths");
        cmd.map = new Map(from.map((c, k) => [c, to[k]]));
        endOfCmd();
        break;
      }
      case 'd':
      case 'p':
      case '=':
        endOfCmd();
        break;
      case 'q':
      case 'Q': {
        if (cmd.a2) fail('command only uses one address');
        skipSpace();
        let n = '';
        while (/[0-9]/.test(script[i] ?? '')) n += script[i++];
        cmd.exitCode = n ? Number(n) : 0;
        endOfCmd();
        break;
      }
      case 'a':
      case 'i':
      case 'c': {
        // GNU-varianten på en rad: "a text", "a\text" eller "a\" + ny rad + text.
        skipSpace();
        if (script[i] === '\\') {
          i++;
          if (script[i] === '\n') i++;
        }
        let text = '';
        while (i < script.length && script[i] !== '\n') {
          if (script[i] === '\\' && i + 1 < script.length) {
            text += script[i + 1] === 'n' ? '\n' : script[i + 1] === 't' ? '\t' : script[i + 1];
            i += 2;
          } else text += script[i++];
        }
        if (text === '') fail(`expected \\ after \`a', \`c' or \`i'`);
        cmd.text = text;
        break;
      }
      default:
        if (SED_UNSUPPORTED.includes(name)) throw new SedUnsupported(name);
        i--;
        fail(`unknown command: \`${name}'`);
    }
    cmds.push(cmd);
  }
}

function substitute(ps: string, cmd: SedCmd): string | null {
  const re = cmd.re!;
  re.lastIndex = 0;
  let count = 0;
  let out = '';
  let last = 0;
  let did = false;
  for (const m of ps.matchAll(re)) {
    count++;
    const take = cmd.global ? count >= cmd.nth! : count === cmd.nth;
    if (!take) continue;
    out += ps.slice(last, m.index) + buildReplacement(cmd.repl!, m);
    last = m.index! + m[0].length;
    did = true;
    if (!cmd.global) break;
  }
  return did ? out + ps.slice(last) : null;
}

function buildReplacement(parts: ReplPart[], m: RegExpMatchArray): string {
  let out = '';
  let mode: 'U' | 'L' | null = null;
  let once: 'u' | 'l' | null = null;
  const add = (s: string) => {
    if (!s) return;
    if (mode === 'U') s = s.toUpperCase();
    else if (mode === 'L') s = s.toLowerCase();
    if (once) {
      s = (once === 'u' ? s[0].toUpperCase() : s[0].toLowerCase()) + s.slice(1);
      once = null;
    }
    out += s;
  };
  for (const p of parts) {
    if (typeof p === 'string') add(p);
    else if ('group' in p) add(m[p.group] ?? '');
    else if (p.caseOp === 'u' || p.caseOp === 'l') once = p.caseOp;
    else mode = p.caseOp === 'E' ? null : p.caseOp;
  }
  return out;
}

interface SedRun {
  quit: boolean;
  exitCode: number;
}

/** Kör sed-programmet på en ström av rader. */
function runSedStream(cmds: SedCmd[], content: string, quiet: boolean, out: (s: string) => void, run: SedRun) {
  const lines = splitLines(content);
  const missingNewline = content !== '' && !content.endsWith('\n');
  const lastNo = lines.length;
  for (const c of cmds) c.active = false;

  const test = (a: SedAddr, n: number, ps: string) => {
    if (a.kind === 'line') return n === a.n;
    if (a.kind === 'last') return n === lastNo;
    if (a.kind === 'step') return a.step > 0 ? n >= a.first && (n - a.first) % a.step === 0 : n === a.first;
    a.re.lastIndex = 0;
    return a.re.test(ps);
  };
  const matches = (cmd: SedCmd, n: number, ps: string): boolean => {
    let m: boolean;
    if (!cmd.a1) m = true;
    else if (!cmd.a2) m = test(cmd.a1, n, ps);
    else if (!cmd.active) {
      m = test(cmd.a1, n, ps);
      if (m) {
        const a2 = cmd.a2;
        cmd.active = !(a2.kind === 'line' ? a2.n <= n : a2.kind === 'last' ? n === lastNo : false);
      }
    } else {
      m = true;
      const a2 = cmd.a2;
      if (a2.kind === 'line' ? n >= a2.n : a2.kind === 'last' ? n === lastNo : test(a2, n, ps)) cmd.active = false;
    }
    return cmd.neg ? !m : m;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const n = idx + 1;
    let ps = lines[idx];
    let deleted = false;
    const appended: string[] = [];
    for (const cmd of cmds) {
      if (!matches(cmd, n, ps)) continue;
      if (cmd.name === 's') {
        const r = substitute(ps, cmd);
        if (r !== null) {
          ps = r;
          if (cmd.print) out(ps + '\n');
        }
      } else if (cmd.name === 'y') {
        ps = [...ps].map((c) => cmd.map!.get(c) ?? c).join('');
      } else if (cmd.name === 'p') {
        out(ps + '\n');
      } else if (cmd.name === '=') {
        out(n + '\n');
      } else if (cmd.name === 'a') {
        appended.push(cmd.text!);
      } else if (cmd.name === 'i') {
        out(cmd.text! + '\n');
      } else if (cmd.name === 'c') {
        if (!cmd.a2 || cmd.neg || !cmd.active) out(cmd.text! + '\n');
        deleted = true;
        break;
      } else if (cmd.name === 'd') {
        deleted = true;
        break;
      } else if (cmd.name === 'q' || cmd.name === 'Q') {
        run.quit = true;
        run.exitCode = cmd.exitCode!;
        if (cmd.name === 'Q') deleted = true;
        break;
      }
    }
    if (!deleted && !quiet) out(ps + (n === lastNo && missingNewline && !appended.length ? '' : '\n'));
    for (const a of appended) out(a + '\n');
    if (run.quit) return;
  }
}

const sed: CommandDef = {
  name: 'sed',
  summary: 'Strömeditor: byter ut, tar bort och skriver ut rader',
  man: `NAMN
       sed - strömeditor (stream editor) för att filtrera och ändra text

SYNOPSIS
       sed [FLAGGA]... SKRIPT [FIL]...
       sed [FLAGGA]... -e SKRIPT [-e SKRIPT]... [FIL]...

BESKRIVNING
       sed läser filer (eller standard input) rad för rad, kör SKRIPT på
       varje rad och skriver ut resultatet. Filen ändras inte – om du inte
       använder -i.

       Ett skript består av kommandon, valfritt med en ADRESS framför som
       väljer vilka rader kommandot gäller. Flera kommandon skiljs åt med ;
       eller ges med flera -e.

FLAGGOR
       -n        skriv bara ut det som p-kommandot ber om
       -E, -r    utökade reguljära uttryck (som grep -E)
       -i[SUFFIX]
                 ändra filen på plats (in-place). Med SUFFIX sparas en
                 säkerhetskopia, t.ex. -i.bak
       -e SKRIPT lägg till SKRIPT (kan anges flera gånger)

KOMMANDON
       s/MÖNSTER/ERSÄTTNING/FLAGGOR
                 byt ut (substitute). FLAGGOR: g = alla träffar på raden,
                 i = skiftlägesokänsligt, p = skriv ut raden, N = bara
                 träff nummer N. I ERSÄTTNING betyder & hela träffen och
                 \\1 ... \\9 grupperna \\( \\) (eller ( ) med -E).
                 Vilket tecken som helst kan avgränsa: s|/usr|/opt|
       d         ta bort raden (delete)
       p         skriv ut raden (print) – oftast tillsammans med -n
       q         avsluta (quit) efter den här raden
       y/abc/xyz/   byt tecken mot tecken
       =         skriv ut radnumret
       a TEXT, i TEXT, c TEXT
                 lägg till text efter / före raden, eller ersätt raden

ADRESSER
       5         rad 5
       1~2       varannan rad (första~steg)
       $         sista raden
       /regex/   rader som matchar
       2,4       rad 2 till 4
       /a/,/b/   från en rad som matchar a till nästa som matchar b
       ADRESS!   alla rader UTOM de som matchar

EXEMPEL
       sed 's/ERROR/FEL/' server.log
       sed -n '5,8p' server.log
       sed '/^#/d' inställningar.conf
       sed -i 's/gammal/ny/g' fil.txt
       sed -E 's/([0-9]+)-([0-9]+)/\\2-\\1/' datum.txt

SIMULATORN
       Stöder s, d, p, q, Q, y, =, a, i och c. Kommandon som arbetar med
       hållutrymmet (h, H, g, G, x), hopp (b, t) och { } stöds inte.`,
  run(ctx) {
    const scripts: string[] = [];
    const operands: string[] = [];
    let quiet = false;
    let ere = false;
    let inPlace: string | null = null;
    const bad = (msg: string) => {
      ctx.err(`sed: ${msg}\nUsage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n`);
      return 1;
    };
    const args = ctx.args;
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === '--') {
        operands.push(...args.slice(k + 1));
        break;
      }
      if (a.startsWith('--')) {
        const [key, val] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
        if (key === '--quiet' || key === '--silent') quiet = true;
        else if (key === '--regexp-extended') ere = true;
        else if (key === '--in-place') inPlace = val ?? '';
        else if (key === '--expression') {
          const v = val ?? args[++k];
          if (v === undefined) return bad("option '--expression' requires an argument");
          scripts.push(v);
        } else return bad(`unrecognized option '${a}'`);
        continue;
      }
      if (a.startsWith('-') && a.length > 1) {
        for (let j = 1; j < a.length; j++) {
          const c = a[j];
          if (c === 'n') quiet = true;
          else if (c === 'E' || c === 'r') ere = true;
          else if (c === 's' || c === 'u') continue;
          else if (c === 'i') {
            inPlace = a.slice(j + 1);
            break;
          } else if (c === 'e' || c === 'f') {
            const v = a.slice(j + 1) || args[++k];
            if (v === undefined) return bad(`option requires an argument -- '${c}'`);
            if (c === 'e') scripts.push(v);
            else {
              try {
                scripts.push(ctx.sh.vfs.readFile(ctx.sh.resolve(v), ctx.sh.currentUser()).replace(/\n$/, ''));
              } catch (e) {
                ctx.err(`sed: couldn't open file ${v}: ${fsMessage(e)}\n`);
                return 1;
              }
            }
            break;
          } else return bad(`invalid option -- '${c}'`);
        }
        continue;
      }
      operands.push(a);
    }
    if (!scripts.length) {
      const s = operands.shift();
      if (s === undefined) {
        ctx.err(
          'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\n' +
            '  -n, --quiet, --silent\n                 suppress automatic printing of pattern space\n' +
            '  -e script, --expression=script\n                 add the script to the commands to be executed\n' +
            '  -i[SUFFIX], --in-place[=SUFFIX]\n                 edit files in place (makes backup if SUFFIX supplied)\n' +
            '  -E, -r, --regexp-extended\n                 use extended regular expressions in the script\n',
        );
        return 1;
      }
      scripts.push(s);
    }

    const cmds: SedCmd[] = [];
    const state: SedState = {};
    try {
      scripts.forEach((s, k) => parseSedScript(s, k + 1, ere, state, cmds));
    } catch (e) {
      if (e instanceof SedError) {
        ctx.err(`sed: ${e.message}\n`);
        return 1;
      }
      if (e instanceof SedUnsupported) {
        ctx.err(`sed: unsupported command: \`${e.message}'\n`);
        dimNote(ctx, `sed-kommandot ${e.message} stöds inte här – bara s, d, p, q, Q, y, =, a, i och c. Se \`man sed\`.`);
        return 1;
      }
      throw e;
    }

    const sh = ctx.sh;
    const user = sh.currentUser();
    const run: SedRun = { quit: false, exitCode: 0 };
    let code = 0;

    if (inPlace !== null) {
      if (!operands.length) {
        ctx.err('sed: no input files\n');
        return 1;
      }
      for (const f of operands) {
        const path = sh.resolve(f);
        const node = sh.vfs.tryLookup(path, user);
        if (node?.type === 'dir') {
          ctx.err(`sed: couldn't edit ${f}: not a regular file\n`);
          code = 4;
          continue;
        }
        let content: string;
        try {
          content = sh.vfs.readFile(path, user);
        } catch (e) {
          ctx.err(`sed: can't read ${f}: ${fsMessage(e)}\n`);
          code = 2;
          continue;
        }
        let result = '';
        runSedStream(cmds, content, quiet, (s) => (result += s), run);
        try {
          if (inPlace) sh.vfs.writeFile(sh.resolve(f + inPlace), content, user);
          sh.vfs.writeFile(path, result, user);
        } catch (e) {
          ctx.err(`sed: couldn't open temporary file ${dirname(path)}/sedXyZ12a: ${fsMessage(e)}\n`);
          code = 4;
        }
        if (run.quit) break;
      }
      return run.quit ? run.exitCode : code;
    }

    // Utan -i läses alla filer som en enda lång ström.
    let content = '';
    for (const f of operands.length ? operands : ['-']) {
      let text: string;
      if (f === '-') text = ctx.stdin ?? '';
      else {
        const path = sh.resolve(f);
        if (sh.vfs.tryLookup(path, user)?.type === 'dir') {
          ctx.err(`sed: read error on ${f}: Is a directory\n`);
          code = 2;
          continue;
        }
        try {
          text = sh.vfs.readFile(path, user);
        } catch (e) {
          ctx.err(`sed: can't read ${f}: ${fsMessage(e)}\n`);
          code = 2;
          continue;
        }
      }
      if (content && !content.endsWith('\n')) content += '\n';
      content += text;
    }
    runSedStream(cmds, content, quiet, (s) => ctx.out(s), run);
    return run.quit ? run.exitCode : code;
  },
};

// =====================================================================
// awk
// =====================================================================

const AWK_NOTE = 'här finns bara en del av awk: mönster, BEGIN/END, fält, variabler, arrayer, if/while/for, print, printf och de vanligaste funktionerna. Se `man awk`.';

const awk: CommandDef = {
  name: 'awk',
  summary: 'Bearbetar text kolumn för kolumn (ett litet programspråk)',
  man: `NAMN
       awk - mönsterstyrt språk för att bearbeta text i kolumner

SYNOPSIS
       awk [-F AVGRÄNSARE] [-v VAR=VÄRDE] 'PROGRAM' [FIL]...
       awk [-F AVGRÄNSARE] -f PROGRAMFIL [FIL]...

BESKRIVNING
       awk läser filer (eller standard input) rad för rad och delar upp
       varje rad i fält. Fälten heter $1, $2, ... och hela raden $0.
       Standard är att fälten skiljs åt av mellanslag och tabbar.

       Ett PROGRAM består av par: MÖNSTER { ÅTGÄRD }
       Åtgärden körs för varje rad som matchar mönstret. Utan mönster körs
       den för alla rader; utan åtgärd skrivs raden ut.

FLAGGOR
       -F TECKEN   fältavgränsare, t.ex. -F: eller -F,
       -v VAR=VÄRDE
                   sätt en variabel innan programmet startar
       -f FIL      läs programmet från FIL

MÖNSTER
       BEGIN { ... }      körs en gång innan första raden
       END { ... }        körs en gång efter sista raden
       /regex/            rader som matchar
       $3 > 10            jämförelser: == != < <= > >=
       $1 ~ /^a/          fält som matchar (!~ = matchar inte)
       NR > 1 && $2 == "x"    && (och), || (eller), ! (inte)

ÅTGÄRDER
       print $1, $3       komma ger mellanslag (OFS) mellan fälten
       printf "%-10s %5.1f\\n", $1, $2
       summa += $3        variabler behöver inte deklareras
       antal[$1]++        arrayer med text som index
       if (...) ... else ...   while (...) ...   for (i = 1; i <= NF; i++) ...
       for (nyckel in antal) ...   next   exit

INBYGGDA VARIABLER
       NR    radnummer         NF    antal fält på raden
       $NF   sista fältet      FS / OFS   fältavgränsare in / ut
       FILENAME              filen som läses

FUNKTIONER
       length(s)  substr(s, start, antal)  index(s, t)  split(s, arr, sep)
       sub(/re/, "ny")  gsub(/re/, "ny")  match(s, /re/)  sprintf(...)
       toupper(s)  tolower(s)  int(x)  sqrt(x)

EXEMPEL
       awk '{print $1}' fil.txt
       awk -F: '{print $1, $7}' /etc/passwd
       awk -F, 'NR > 1 {summa += $3} END {print summa}' betyg.csv
       awk '$3 > 50 {print NR": "$0}' data.txt
       ls -l | awk '{print $5, $NF}'

SIMULATORN
       Egna funktioner (function), getline, omdirigering av utdata
       (print > fil) och intervallmönster stöds inte.`,
  run(ctx) {
    const args = ctx.args;
    const assigns: [string, string][] = [];
    let fs: string | undefined;
    let program: string | undefined;
    let label = 'cmd. line';
    const usage = () => {
      ctx.err("Usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nUsage: awk [POSIX or GNU style options] [--] 'program' file ...\n");
      return 2;
    };
    let k = 0;
    for (; k < args.length; k++) {
      const a = args[k];
      if (a === '--') {
        k++;
        break;
      }
      if (!a.startsWith('-') || a === '-') break;
      const opt = a[1];
      if (opt === 'F' || opt === 'v' || opt === 'f') {
        const v = a.length > 2 ? a.slice(2) : args[++k];
        if (v === undefined) {
          ctx.err(`awk: option requires an argument -- ${opt}\n`);
          return usage();
        }
        if (opt === 'F') fs = v;
        else if (opt === 'v') {
          const eq = v.indexOf('=');
          if (eq < 1) {
            ctx.err(`awk: \`${v}' argument to \`-v' not in \`var=value' form\n`);
            return usage();
          }
          assigns.push([v.slice(0, eq), v.slice(eq + 1)]);
        } else {
          try {
            program = ctx.sh.vfs.readFile(ctx.sh.resolve(v), ctx.sh.currentUser());
            label = v;
          } catch (e) {
            ctx.err(`awk: fatal: can't open source file \`${v}' for reading: ${fsMessage(e)}\n`);
            return 2;
          }
        }
        continue;
      }
      ctx.err(`awk: ${a.startsWith('--') ? `unrecognized option '${a}'` : `invalid option -- '${opt}'`}\n`);
      return usage();
    }
    const operands = args.slice(k);
    if (program === undefined) {
      program = operands.shift();
      if (program === undefined) return usage();
    }

    let rules;
    try {
      rules = parseAwk(program);
    } catch (e) {
      if (!(e instanceof AwkSyntaxError)) throw e;
      const before = program.slice(0, e.pos);
      const lineNo = before.split('\n').length;
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = program.indexOf('\n', lineStart);
      const srcLine = program.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      const prefix = `awk: ${label}:${lineNo}: `;
      ctx.err(`${prefix}${srcLine}\n${prefix}${' '.repeat(e.pos - lineStart)}^ ${e.message}\n`);
      dimNote(ctx, e.unsupported ? `${e.unsupported} stöds inte – ${AWK_NOTE}` : AWK_NOTE);
      return 1;
    }

    const sh = ctx.sh;
    const interp = new AwkInterpreter(rules, {
      // Debian och Ubuntu har mawk, som inte gör om å, ä och ö.
      asciiCase: sh.distro.family === 'debian',
      out: (s) => ctx.out(s),
      readInput: (op) => {
        const path = sh.resolve(op);
        if (sh.vfs.tryLookup(path, sh.currentUser())?.type === 'dir') {
          ctx.err(`awk: warning: command line argument \`${op}' is a directory: skipped\n`);
          return null;
        }
        try {
          return { name: op, content: sh.vfs.readFile(path, sh.currentUser()) };
        } catch (e) {
          ctx.err(`awk: fatal: cannot open file \`${op}' for reading: ${fsMessage(e)}\n`);
          throw new AwkFatal('__reported__');
        }
      },
    });
    if (fs !== undefined) interp.assign('FS', fs === 't' ? '\t' : fs);
    for (const [name, value] of assigns) interp.assign(name, value);
    try {
      return interp.run(operands, ctx.stdin ?? '');
    } catch (e) {
      if (!(e instanceof AwkFatal)) throw e;
      if (e.message === '__reported__') return 2;
      if (e.message === '__steps__') {
        ctx.err(`awk: ${label}: fatal: program stopped\n`);
        dimNote(ctx, 'programmet avbröts efter för många steg – kanske en oändlig loop?');
      } else ctx.err(`awk: ${label}:1: fatal: ${e.message}\n`);
      return 2;
    }
  },
};

export const TEXTPROC_COMMANDS: CommandDef[] = [tr, sed, awk];
