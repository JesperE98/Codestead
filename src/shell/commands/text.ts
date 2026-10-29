// Kommandon för text: echo, cat, less, head, tail, wc, grep, sort, uniq, cut, tee.

import { escapeRegex } from '../parser';
import type { CmdCtx, CommandDef } from '../types';
import { hasPerm, type FsNode } from '../vfs';
import { badOption, COLOR, fsMessage, joinLines, parseOpts, readInputs, splitLines } from './util';

const echo: CommandDef = {
  name: 'echo',
  builtin: true,
  summary: 'Skriver ut text',
  man: `NAMN
       echo - skriv ut en rad text

SYNOPSIS
       echo [-n] [-e] [TEXT]...

FLAGGOR
       -n    skriv inte ut någon radbrytning på slutet
       -e    tolka \\n (ny rad) och \\t (tabb)

EXEMPEL
       echo Hej världen
       echo "Min hemkatalog är $HOME"
       echo 'Enkla citattecken: $HOME skrivs ut som det står'`,
  run(ctx) {
    let newline = true;
    let escapes = false;
    const args = [...ctx.args];
    while (args.length && /^-[neE]+$/.test(args[0])) {
      const f = args.shift()!;
      if (f.includes('n')) newline = false;
      if (f.includes('e')) escapes = true;
      if (f.includes('E')) escapes = false;
    }
    let text = args.join(' ');
    if (escapes) text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
    ctx.out(text + (newline ? '\n' : ''));
    return 0;
  },
};

function catLike(name: string, summary: string, man: string): CommandDef {
  return {
    name,
    summary,
    man,
    run(ctx) {
      const o = parseOpts(ctx.args, { flags: 'n', long: { number: 'n' } });
      if (o.error) return badOption(ctx, o.error);
      const { inputs, failed } = readInputs(ctx, o.operands);
      let lineNo = 1;
      for (const input of inputs) {
        if (o.flags.has('n')) {
          for (const line of splitLines(input.content)) ctx.out(`${String(lineNo++).padStart(6)}\t${line}\n`);
        } else {
          ctx.out(input.content);
        }
      }
      return failed ? 1 : 0;
    },
  };
}

const cat = catLike(
  'cat',
  'Visar innehållet i filer',
  `NAMN
       cat - slå ihop filer och skriv ut dem (concatenate)

SYNOPSIS
       cat [-n] [FIL]...

BESKRIVNING
       Skriver ut innehållet i en eller flera filer. Utan FIL läser cat
       från standard input, t.ex. från en pipe.

FLAGGOR
       -n    numrera raderna

EXEMPEL
       cat /etc/os-release
       cat del1.txt del2.txt > allt.txt`,
);

const less = catLike(
  'less',
  'Bläddrar i en fil (sida för sida)',
  `NAMN
       less - visa en fil en sida i taget

BESKRIVNING
       I en riktig terminal bläddrar du med piltangenterna, mellanslag och
       b, söker med /ord och avslutar med q. I simulatorn visas hela filen
       direkt.`,
);

const more = catLike(
  'more',
  'Visar en fil sida för sida (äldre variant av less)',
  `NAMN
       more - visa en fil en sida i taget

BESKRIVNING
       Föregångaren till less. I simulatorn visas hela filen direkt.`,
);

function headTail(name: 'head' | 'tail'): CommandDef {
  return {
    name,
    summary: name === 'head' ? 'Visar början av en fil' : 'Visar slutet av en fil',
    man: `NAMN
       ${name} - visa ${name === 'head' ? 'de första' : 'de sista'} raderna i filer

SYNOPSIS
       ${name} [-n ANTAL] [FIL]...

FLAGGOR
       -n ANTAL, -ANTAL   visa ANTAL rader (standard är 10)${
         name === 'tail' ? '\n       -n +N              visa från och med rad N\n       -f                 följ filen när den växer (stöds inte i simulatorn)' : ''
       }

EXEMPEL
       ${name} -n 3 server.log
       ${name === 'head' ? 'ls -l /etc | head -5' : 'tail -n 20 /var/log/syslog'}`,
    run(ctx) {
      const args = ctx.args.map((a) => (/^-\d+$/.test(a) ? `-n${a.slice(1)}` : a));
      const o = parseOpts(args, { flags: 'fqv', values: 'n', long: { lines: 'n', follow: 'f' } });
      if (o.error) return badOption(ctx, o.error);
      const spec = o.values.n ?? '10';
      const fromStart = name === 'tail' && spec.startsWith('+');
      const n = Number(spec.replace(/^[+-]/, ''));
      if (!Number.isInteger(n)) {
        ctx.err(`${name}: invalid number of lines: '${spec}'\n`);
        return 1;
      }
      const { inputs, failed } = readInputs(ctx, o.operands, (l, m) => `${name}: cannot open '${l}' for reading: ${m}`);
      inputs.forEach((input, i) => {
        if (inputs.length > 1) ctx.out(`${i > 0 ? '\n' : ''}==> ${input.label} <==\n`);
        const lines = splitLines(input.content);
        const picked =
          name === 'head' ? lines.slice(0, n) : fromStart ? lines.slice(Math.max(0, n - 1)) : n === 0 ? [] : lines.slice(-n);
        ctx.out(joinLines(picked));
      });
      if (o.flags.has('f')) ctx.out(`${COLOR.dim}(simulatorn: -f följer inte filen – i en riktig terminal avslutar du med Ctrl+C)${COLOR.reset}\n`);
      return failed ? 1 : 0;
    },
  };
}

const wc: CommandDef = {
  name: 'wc',
  summary: 'Räknar rader, ord och tecken',
  man: `NAMN
       wc - räkna rader, ord och byte (word count)

SYNOPSIS
       wc [-l] [-w] [-c] [FIL]...

FLAGGOR
       -l    antal rader
       -w    antal ord
       -c    antal byte
       -m    antal tecken

EXEMPEL
       wc -l dokument/frukter.txt
       ls /etc | wc -l`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'lwcm', long: { lines: 'l', words: 'w', bytes: 'c', chars: 'm' } });
    if (o.error) return badOption(ctx, o.error);
    const chosen = ['l', 'w', 'm', 'c'].filter((f) => o.flags.has(f));
    const fields = chosen.length ? chosen : ['l', 'w', 'c'];
    const { inputs, failed } = readInputs(ctx, o.operands);
    const count = (s: string): Record<string, number> => ({
      l: (s.match(/\n/g) ?? []).length,
      w: s.split(/\s+/).filter(Boolean).length,
      c: new TextEncoder().encode(s).length,
      m: [...s].length,
    });
    const rows = inputs.map((i) => ({ label: o.operands.length ? i.label : '', counts: count(i.content) }));
    if (rows.length > 1) {
      const total: Record<string, number> = { l: 0, w: 0, c: 0, m: 0 };
      rows.forEach((r) => Object.keys(total).forEach((k) => (total[k] += r.counts[k])));
      rows.push({ label: 'total', counts: total });
    }
    const single = fields.length === 1 && rows.length === 1;
    const width = single ? 0 : Math.max(...rows.flatMap((r) => fields.map((f) => String(r.counts[f]).length)), o.operands.length ? 1 : 7);
    for (const r of rows) {
      const nums = fields.map((f) => String(r.counts[f]).padStart(width)).join(' ');
      ctx.out(r.label ? `${nums} ${r.label}\n` : `${nums}\n`);
    }
    return failed ? 1 : 0;
  },
};

/** Gör om ett grundläggande reguljärt uttryck (BRE, som grep använder) till JavaScript. */
export function breToJs(p: string): string {
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) {
      const n = p[++i];
      out += '|(){}+?'.includes(n) ? n : '\\' + n;
    } else if ('|(){}+?'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return out;
}

const grep: CommandDef = {
  name: 'grep',
  summary: 'Söker efter rader som matchar ett mönster',
  man: `NAMN
       grep - skriv ut rader som matchar ett mönster

SYNOPSIS
       grep [FLAGGA]... MÖNSTER [FIL]...

BESKRIVNING
       Söker igenom filer (eller standard input) och skriver ut raderna som
       innehåller MÖNSTER. MÖNSTER är ett reguljärt uttryck.

FLAGGOR
       -i    ignorera skillnad mellan stora och små bokstäver
       -v    visa rader som INTE matchar
       -n    visa radnummer
       -c    visa bara antalet matchande rader
       -l    visa bara namnen på filer som matchar
       -r    sök rekursivt i kataloger
       -w    matcha bara hela ord
       -o    visa bara den del som matchar
       -E    utökade reguljära uttryck (t.ex. "ERROR|WARN")
       -F    mönstret är vanlig text, inte ett reguljärt uttryck

EXEMPEL
       grep ERROR server.log
       grep -in "varning" *.txt
       grep -E "ERROR|WARN" server.log
       ps aux | grep firefox`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'ivnclrRwqhHEFos',
      values: 'e',
      long: {
        'ignore-case': 'i',
        'invert-match': 'v',
        'line-number': 'n',
        count: 'c',
        'files-with-matches': 'l',
        recursive: 'r',
        'word-regexp': 'w',
        quiet: 'q',
        'extended-regexp': 'E',
        'fixed-strings': 'F',
        'only-matching': 'o',
        color: 'C',
        colour: 'C',
      },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    const ops = [...o.operands];
    const pattern = o.values.e ?? ops.shift();
    if (pattern === undefined) {
      ctx.err(`Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n`);
      return 2;
    }
    let source = o.flags.has('F') ? escapeRegex(pattern) : o.flags.has('E') ? pattern : breToJs(pattern);
    if (o.flags.has('w')) source = `\\b(?:${source})\\b`;
    let re: RegExp;
    try {
      re = new RegExp(source, o.flags.has('i') ? 'gi' : 'g');
    } catch {
      ctx.err(`grep: Invalid regular expression\n`);
      return 2;
    }

    const sh = ctx.sh;
    const user = sh.currentUser();
    const recursive = o.flags.has('r') || o.flags.has('R');
    const files: { label: string; content: string }[] = [];
    let failed = false;
    if (recursive) {
      const walk = (label: string, node: FsNode) => {
        if (node.type === 'file') {
          if (hasPerm(node, user, 'r')) files.push({ label, content: node.content ?? '' });
          else {
            ctx.err(`grep: ${label}: Permission denied\n`);
            failed = true;
          }
          return;
        }
        if (!hasPerm(node, user, 'r') || !hasPerm(node, user, 'x')) {
          ctx.err(`grep: ${label}: Permission denied\n`);
          failed = true;
          return;
        }
        for (const n of Object.keys(node.children!).sort()) walk(label.endsWith('/') ? label + n : `${label}/${n}`, node.children![n]);
      };
      for (const p of ops.length ? ops : ['.']) {
        try {
          walk(p, sh.vfs.lookup(sh.resolve(p), user));
        } catch (e) {
          ctx.err(`grep: ${p}: ${fsMessage(e)}\n`);
          failed = true;
        }
      }
    } else {
      for (const p of ops.length ? ops : ['-']) {
        if (p === '-') {
          files.push({ label: '(standard input)', content: ctx.stdin ?? '' });
          continue;
        }
        const node = sh.vfs.tryLookup(sh.resolve(p), user);
        if (node?.type === 'dir') {
          ctx.err(`grep: ${p}: Is a directory\n`);
          continue;
        }
        try {
          files.push({ label: p, content: sh.vfs.readFile(sh.resolve(p), user) });
        } catch (e) {
          ctx.err(`grep: ${p}: ${fsMessage(e)}\n`);
          failed = true;
        }
      }
    }

    const showName = (files.length > 1 || recursive) && !o.flags.has('h') ? true : o.flags.has('H');
    const color = ctx.isTTY;
    const paint = (code: string, s: string) => (color ? `${code}${s}${COLOR.reset}` : s);
    let matchedAny = false;
    for (const f of files) {
      let count = 0;
      splitLines(f.content).forEach((line, idx) => {
        re.lastIndex = 0;
        const matches = re.test(line);
        if (matches === o.flags.has('v')) return;
        count++;
        matchedAny = true;
        if (o.flags.has('q') || o.flags.has('c') || o.flags.has('l')) return;
        const prefix =
          (showName ? paint(COLOR.magenta, f.label) + paint(COLOR.cyan, ':') : '') +
          (o.flags.has('n') ? paint(COLOR.green, String(idx + 1)) + paint(COLOR.cyan, ':') : '');
        if (o.flags.has('o') && !o.flags.has('v')) {
          for (const m of line.matchAll(re)) if (m[0]) ctx.out(prefix + paint(COLOR.red, m[0]) + '\n');
          return;
        }
        const body = color && !o.flags.has('v') ? line.replace(re, (m) => paint(COLOR.red, m)) : line;
        ctx.out(prefix + body + '\n');
      });
      if (o.flags.has('q')) continue;
      if (o.flags.has('c')) ctx.out((showName ? paint(COLOR.magenta, f.label) + paint(COLOR.cyan, ':') : '') + count + '\n');
      else if (o.flags.has('l') && count) ctx.out(paint(COLOR.magenta, f.label) + '\n');
    }
    if (failed && !(o.flags.has('q') && matchedAny)) return 2;
    return matchedAny ? 0 : 1;
  },
};

const sort: CommandDef = {
  name: 'sort',
  summary: 'Sorterar rader',
  man: `NAMN
       sort - sortera rader i textfiler

SYNOPSIS
       sort [FLAGGA]... [FIL]...

FLAGGOR
       -r    omvänd ordning
       -n    sortera numeriskt (2 före 10)
       -u    ta bort dubbletter
       -f    ignorera skillnad mellan stora och små bokstäver
       -k N  sortera på fält nummer N

EXEMPEL
       sort frukter.txt
       sort frukter.txt | uniq -c | sort -rn`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'rnuf',
      values: 'k',
      long: { reverse: 'r', 'numeric-sort': 'n', unique: 'u', 'ignore-case': 'f', key: 'k' },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    const { inputs, failed } = readInputs(ctx, o.operands, (l, m) => `sort: cannot read: ${l}: ${m}`);
    if (failed) return 2;
    let lines = inputs.flatMap((i) => splitLines(i.content));
    const field = o.values.k ? Number(o.values.k.split(',')[0]) : 0;
    const key = (l: string) => (field ? l.trim().split(/\s+/).slice(field - 1).join(' ') : l);
    const cmp = (a: string, b: string) => {
      const ka = key(a);
      const kb = key(b);
      if (o.flags.has('n')) {
        const d = (parseFloat(ka) || 0) - (parseFloat(kb) || 0);
        if (d !== 0) return d;
      } else {
        const c = ka.localeCompare(kb, 'sv', { sensitivity: o.flags.has('f') ? 'base' : 'variant' });
        if (c !== 0) return c;
      }
      return a < b ? -1 : a > b ? 1 : 0;
    };
    lines.sort(cmp);
    if (o.flags.has('r')) lines.reverse();
    if (o.flags.has('u')) lines = lines.filter((l, i) => i === 0 || cmp(l, lines[i - 1]) !== 0);
    ctx.out(joinLines(lines));
    return 0;
  },
};

const uniq: CommandDef = {
  name: 'uniq',
  summary: 'Tar bort upprepade rader (som står bredvid varandra)',
  man: `NAMN
       uniq - rapportera eller ta bort upprepade rader

SYNOPSIS
       uniq [FLAGGA]... [FIL]

BESKRIVNING
       Tar bort rader som är likadana som raden direkt ovanför. Därför
       används uniq nästan alltid efter sort.

FLAGGOR
       -c    skriv antalet förekomster framför varje rad
       -d    visa bara rader som förekommer flera gånger
       -u    visa bara rader som är unika
       -i    ignorera skillnad mellan stora och små bokstäver

EXEMPEL
       sort frukter.txt | uniq -c`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'cdui', long: { count: 'c', repeated: 'd', unique: 'u', 'ignore-case': 'i' } });
    if (o.error) return badOption(ctx, o.error);
    const { inputs, failed } = readInputs(ctx, o.operands.slice(0, 1));
    if (failed) return 1;
    const lines = splitLines(inputs[0]?.content ?? '');
    const same = (a: string, b: string) => (o.flags.has('i') ? a.toLowerCase() === b.toLowerCase() : a === b);
    const groups: { line: string; count: number }[] = [];
    for (const l of lines) {
      const last = groups.at(-1);
      if (last && same(last.line, l)) last.count++;
      else groups.push({ line: l, count: 1 });
    }
    for (const g of groups) {
      if (o.flags.has('d') && g.count < 2) continue;
      if (o.flags.has('u') && g.count > 1) continue;
      ctx.out(o.flags.has('c') ? `${String(g.count).padStart(7)} ${g.line}\n` : `${g.line}\n`);
    }
    return 0;
  },
};

function parseList(spec: string): ((n: number) => boolean) | null {
  const ranges = spec.split(',').map((part) => {
    const m = /^(\d*)(-?)(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) return null;
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : Infinity) : from;
    return [from, to] as const;
  });
  if (ranges.some((r) => r === null)) return null;
  return (n) => ranges.some((r) => n >= r![0] && n <= r![1]);
}

const cut: CommandDef = {
  name: 'cut',
  summary: 'Plockar ut kolumner ur rader',
  man: `NAMN
       cut - plocka ut delar av varje rad

SYNOPSIS
       cut -d AVGRÄNSARE -f FÄLT [FIL]...
       cut -c TECKEN [FIL]...

FLAGGOR
       -d TECKEN   använd TECKEN som fältavgränsare (standard är tabb)
       -f LISTA    välj fält, t.ex. 1 eller 1,3 eller 2-4
       -c LISTA    välj tecken på samma sätt

EXEMPEL
       cut -d: -f1 /etc/passwd      alla användarnamn`,
  run(ctx) {
    const o = parseOpts(ctx.args, { values: 'dfc', long: { delimiter: 'd', fields: 'f', characters: 'c' } });
    if (o.error) return badOption(ctx, o.error);
    const spec = o.values.f ?? o.values.c;
    if (!spec) return badOption(ctx, 'you must specify a list of bytes, characters, or fields');
    const pick = parseList(spec);
    if (!pick) return badOption(ctx, `invalid field value '${spec}'`);
    const delim = o.values.d ?? '\t';
    const { inputs, failed } = readInputs(ctx, o.operands);
    for (const input of inputs) {
      for (const line of splitLines(input.content)) {
        if (o.values.c) {
          ctx.out([...line].filter((_, i) => pick(i + 1)).join('') + '\n');
        } else if (!line.includes(delim)) {
          ctx.out(line + '\n');
        } else {
          ctx.out(line.split(delim).filter((_, i) => pick(i + 1)).join(delim) + '\n');
        }
      }
    }
    return failed ? 1 : 0;
  },
};

const tee: CommandDef = {
  name: 'tee',
  summary: 'Skriver indata både till skärmen och till filer',
  man: `NAMN
       tee - läs från standard input och skriv till både standard output och filer

SYNOPSIS
       tee [-a] [FIL]...

FLAGGOR
       -a    lägg till i filerna i stället för att skriva över

EXEMPEL
       ls | tee lista.txt
       echo "127.0.0.1 test" | sudo tee -a /etc/hosts

TIPS
       "sudo echo text > /etc/fil" fungerar inte, eftersom det är ditt eget
       skal (inte sudo) som öppnar filen. Använd "echo text | sudo tee /etc/fil".`,
  run(ctx: CmdCtx) {
    const o = parseOpts(ctx.args, { flags: 'a', long: { append: 'a' } });
    if (o.error) return badOption(ctx, o.error);
    const data = ctx.stdin ?? '';
    const sh = ctx.sh;
    let code = 0;
    for (const f of o.operands) {
      try {
        sh.vfs.writeFile(sh.resolve(f), data, sh.currentUser(), o.flags.has('a'));
      } catch (e) {
        ctx.err(`tee: ${f}: ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    ctx.out(data);
    return code;
  },
};

export const TEXT_COMMANDS: CommandDef[] = [echo, cat, less, more, headTail('head'), headTail('tail'), wc, grep, sort, uniq, cut, tee];
