// Inbyggda kommandon för skript: test/[ ]/[[ ]], read, printf, local, return,
// break, continue, shift, let och set.

import { ArithError, evalArith } from '../arith';
import { globToRegex } from '../parser';
import { LoopSignal, ReturnSignal } from '../signals';
import type { CmdCtx, CommandDef } from '../types';
import { hasPerm, nodeSize } from '../vfs';
import { COLOR } from './util';

class TestError extends Error {}

const UNARY = new Set(['-e', '-f', '-d', '-r', '-w', '-x', '-s', '-z', '-n', '-L', '-h']);
const BINARY = new Set(['=', '==', '!=', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '=~']);

/** Utvärderar uttrycket i test / [ ] / [[ ]]. */
function evalTest(args: string[], ctx: CmdCtx, extended: boolean): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  let i = 0;

  const toInt = (s: string): number => {
    if (!/^\s*-?\d+\s*$/.test(s)) throw new TestError(`${s}: integer expression expected`);
    return Number(s);
  };

  const unary = (op: string, arg: string): boolean => {
    if (op === '-z') return arg === '';
    if (op === '-n') return arg !== '';
    const node = sh.vfs.tryLookup(sh.resolve(arg), user);
    switch (op) {
      case '-e':
        return !!node;
      case '-f':
        return node?.type === 'file';
      case '-d':
        return node?.type === 'dir';
      case '-r':
        return !!node && hasPerm(node, user, 'r');
      case '-w':
        return !!node && hasPerm(node, user, 'w');
      case '-x':
        return !!node && hasPerm(node, user, 'x');
      case '-s':
        return !!node && nodeSize(node) > 0;
      default:
        return false;
    }
  };

  const binary = (a: string, op: string, b: string): boolean => {
    switch (op) {
      case '=':
      case '==':
        return extended ? globToRegex(b, true).test(a) : a === b;
      case '!=':
        return extended ? !globToRegex(b, true).test(a) : a !== b;
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '=~':
        try {
          return new RegExp(b).test(a);
        } catch {
          throw new TestError(`${b}: ogiltigt reguljärt uttryck`);
        }
      case '-eq':
        return toInt(a) === toInt(b);
      case '-ne':
        return toInt(a) !== toInt(b);
      case '-lt':
        return toInt(a) < toInt(b);
      case '-le':
        return toInt(a) <= toInt(b);
      case '-gt':
        return toInt(a) > toInt(b);
      case '-ge':
        return toInt(a) >= toInt(b);
    }
    return false;
  };

  const orOps = extended ? ['-o', '||'] : ['-o'];
  const andOps = extended ? ['-a', '&&'] : ['-a'];

  const primary = (): boolean => {
    const a = args[i];
    if (a === undefined) throw new TestError('argument expected');
    if (a === '!') {
      i++;
      return !primary();
    }
    if (a === '(' && args.length - i > 2) {
      i++;
      const v = or();
      if (args[i] !== ')') throw new TestError("`)' expected");
      i++;
      return v;
    }
    if (BINARY.has(args[i + 1] ?? '') && i + 2 < args.length) {
      i += 3;
      return binary(a, args[i - 2], args[i - 1]);
    }
    if (UNARY.has(a) && i + 1 < args.length) {
      i += 2;
      return unary(a, args[i - 1]);
    }
    i++;
    return a !== '';
  };
  const and = (): boolean => {
    let v = primary();
    while (andOps.includes(args[i])) {
      i++;
      const r = primary();
      v = v && r;
    }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (orOps.includes(args[i])) {
      i++;
      const r = and();
      v = v || r;
    }
    return v;
  };

  if (!args.length) return false;
  const v = or();
  if (i < args.length) throw new TestError(`${args[i]}: unexpected operator`);
  return v;
}

function testCommand(name: string): CommandDef {
  return {
    name,
    builtin: true,
    summary: name === 'test' ? 'Testar villkor (filer, text och tal)' : name === '[' ? 'Samma som test, skrivs [ villkor ]' : 'Utökat test i bash: [[ villkor ]]',
    man: `NAMN
       test, [ ], [[ ]] - testa ett villkor

SYNOPSIS
       test UTTRYCK
       [ UTTRYCK ]
       [[ UTTRYCK ]]

BESKRIVNING
       Slutkoden blir 0 (sant) om villkoret stämmer, annars 1 (falskt).
       Används nästan alltid tillsammans med if, while, && och ||.
       Mellanslagen innanför hakparenteserna är obligatoriska!

FILER
       -e FIL    filen finns
       -f FIL    är en vanlig fil
       -d FIL    är en katalog
       -r/-w/-x  går att läsa / skriva / köra
       -s FIL    finns och är inte tom

TEXT
       -z TEXT   texten är tom
       -n TEXT   texten är inte tom
       A = B     lika        A != B   olika

TAL
       -eq  lika med          -ne  inte lika med
       -lt  mindre än         -le  mindre än eller lika med
       -gt  större än         -ge  större än eller lika med

KOMBINERA
       ! UTTRYCK          inte
       A -a B / A -o B    och / eller   (i [[ ]]: && och ||)

EXEMPEL
       if [ -f ~/.bashrc ]; then echo "finns"; fi
       [ "$svar" = "ja" ] && echo "Bra!"
       [[ $fil == *.txt ]] && echo "en textfil"`,
    run(ctx) {
      let args = [...ctx.args];
      if (name === '[') {
        if (args.at(-1) !== ']') {
          ctx.err("bash: [: missing `]'\n");
          return 2;
        }
        args = args.slice(0, -1);
      } else if (name === '[[') {
        if (args.at(-1) !== ']]') {
          ctx.err("bash: syntax error: missing `]]'\n");
          return 2;
        }
        args = args.slice(0, -1);
      }
      try {
        return evalTest(args, ctx, name === '[[') ? 0 : 1;
      } catch (e) {
        if (!(e instanceof TestError)) throw e;
        ctx.err(`bash: ${name}: ${e.message}\n`);
        return 2;
      }
    },
  };
}

const read: CommandDef = {
  name: 'read',
  builtin: true,
  summary: 'Läser en rad indata till variabler',
  man: `NAMN
       read - läs en rad från standard input till en eller flera variabler

SYNOPSIS
       read [-r] [-p FRÅGA] NAMN...

BESKRIVNING
       Läser en rad och lägger den i variabeln NAMN (eller REPLY). Med flera
       namn delas raden upp vid mellanslag; sista variabeln får resten.

FLAGGOR
       -p FRÅGA   visa FRÅGA innan raden läses
       -r         behandla \\ som ett vanligt tecken

EXEMPEL
       read -p "Vad heter du? " namn
       while read rad; do echo "> $rad"; done < fil.txt

I SIMULATORN
       Inne i skript kan read bara läsa från en pipe eller en fil (< fil),
       inte från tangentbordet.`,
  run(ctx) {
    const sh = ctx.sh;
    const names: string[] = [];
    let promptText = '';
    for (let i = 0; i < ctx.args.length; i++) {
      const a = ctx.args[i];
      if (a === '-p') promptText = ctx.args[++i] ?? '';
      else if (a === '-r' || a === '-s' || a === '-e') continue;
      else names.push(a);
    }
    if (!names.length) names.push('REPLY');
    const assign = (line: string) => {
      const fields = line.trim().split(/\s+/).filter(Boolean);
      names.forEach((n, idx) => {
        const value = idx === names.length - 1 ? fields.slice(idx).join(' ') : (fields[idx] ?? '');
        sh.setVar(n, n === 'REPLY' && names.length === 1 ? line : value);
      });
    };
    const reader = ctx.reader;
    if (reader) {
      if (reader.pos >= reader.data.length) {
        names.forEach((n) => sh.setVar(n, ''));
        return 1;
      }
      const nl = reader.data.indexOf('\n', reader.pos);
      const end = nl < 0 ? reader.data.length : nl;
      assign(reader.data.slice(reader.pos, end));
      reader.pos = nl < 0 ? reader.data.length : nl + 1;
      return 0;
    }
    if (sh.canAskInteractively()) {
      sh.askText(promptText, (text) => {
        assign(text);
        return 0;
      });
      return 0;
    }
    ctx.err(
      `bash: read: ingen indata\n${COLOR.dim}I simulatorn kan read inne i skript bara läsa från en pipe eller en fil, t.ex. "echo text | ./skript.sh".${COLOR.reset}\n`,
    );
    return 1;
  },
};

/** Formaterar som printf(1): %s %d %i %f %x %o %c %b %% med flaggor, bredd och precision. */
export function formatPrintf(format: string, args: string[]): string {
  const escapes = (s: string) =>
    s.replace(/\\(n|t|r|\\|"|a|e|0[0-7]{0,3})/g, (_m, c: string) => {
      if (c === 'n') return '\n';
      if (c === 't') return '\t';
      if (c === 'r') return '\r';
      if (c === 'e') return '\x1b';
      if (c === 'a') return '';
      if (c.startsWith('0')) return String.fromCharCode(parseInt(c, 8) || 0);
      return c;
    });
  const fmt = escapes(format);
  let out = '';
  let argi = 0;
  const specRe = /%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifxXoceb%])/g;
  do {
    let consumed = false;
    out += fmt.replace(specRe, (_m, flags: string, width: string | undefined, prec: string | undefined, conv: string) => {
      if (conv === '%') return '%';
      const arg = args[argi++] ?? '';
      consumed = true;
      let s: string;
      switch (conv) {
        case 'd':
        case 'i':
          s = String(Math.trunc(Number(arg) || 0));
          if (flags.includes('+') && !s.startsWith('-')) s = '+' + s;
          break;
        case 'f':
        case 'e':
          s = conv === 'f' ? (Number(arg) || 0).toFixed(prec !== undefined ? Number(prec) : 6) : (Number(arg) || 0).toExponential(prec !== undefined ? Number(prec) : 6);
          break;
        case 'x':
        case 'X':
          s = Math.trunc(Number(arg) || 0).toString(16);
          if (conv === 'X') s = s.toUpperCase();
          break;
        case 'o':
          s = Math.trunc(Number(arg) || 0).toString(8);
          break;
        case 'c':
          s = arg.charAt(0);
          break;
        case 'b':
          s = escapes(arg);
          break;
        default:
          s = prec !== undefined ? arg.slice(0, Number(prec)) : arg;
      }
      const w = Number(width ?? 0);
      if (s.length < w) {
        if (flags.includes('-')) s = s.padEnd(w);
        else if (flags.includes('0') && /[dfixXo]/.test(conv)) s = s.startsWith('-') ? '-' + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0');
        else s = s.padStart(w);
      }
      return s;
    });
    if (!consumed) break;
  } while (argi < args.length);
  return out;
}

const printf: CommandDef = {
  name: 'printf',
  builtin: true,
  summary: 'Skriver ut formaterad text',
  man: `NAMN
       printf - skriv ut formaterad text

SYNOPSIS
       printf FORMAT [ARGUMENT]...

BESKRIVNING
       Som echo, men du styr exakt hur utskriften ser ut. Ingen radbrytning
       läggs till automatiskt – skriv \\n där du vill ha en.

FORMAT
       %s     text            %d     heltal
       %5s    högerjustera i 5 tecken   %-10s  vänsterjustera i 10 tecken
       %.2f   decimaltal med 2 decimaler
       %%     ett procenttecken

EXEMPEL
       printf "Hej %s!\\n" "$USER"
       printf "%-10s %5d\\n" äpplen 3`,
  run(ctx) {
    if (!ctx.args.length) {
      ctx.err('printf: usage: printf format [arguments]\n');
      return 2;
    }
    ctx.out(formatPrintf(ctx.args[0], ctx.args.slice(1)));
    return 0;
  },
};

const local: CommandDef = {
  name: 'local',
  builtin: true,
  summary: 'Skapar en variabel som bara finns i funktionen',
  man: `NAMN
       local - skapa en lokal variabel i en funktion

SYNOPSIS
       local NAMN[=VÄRDE]...

BESKRIVNING
       En lokal variabel försvinner när funktionen är klar och påverkar
       inte en variabel med samma namn utanför funktionen.`,
  run(ctx) {
    for (const a of ctx.args) {
      const eq = a.indexOf('=');
      const name = eq >= 0 ? a.slice(0, eq) : a;
      if (!ctx.sh.declareLocal(name, eq >= 0 ? a.slice(eq + 1) : undefined)) {
        ctx.err('bash: local: can only be used in a function\n');
        return 1;
      }
    }
    return 0;
  },
};

const returnCmd: CommandDef = {
  name: 'return',
  builtin: true,
  summary: 'Avslutar en funktion med en slutkod',
  man: `NAMN
       return - avsluta en funktion

SYNOPSIS
       return [SLUTKOD]

BESKRIVNING
       Avslutar funktionen. Slutkoden (0–255) blir funktionens $?.
       Utan argument används slutkoden från det senaste kommandot.`,
  run(ctx) {
    if (ctx.sh.funcDepth === 0 && ctx.sh.scriptDepth === 0) {
      ctx.err("bash: return: can only `return' from a function or sourced script\n");
      return 1;
    }
    throw new ReturnSignal(ctx.args[0] !== undefined ? Number(ctx.args[0]) & 255 : ctx.sh.lastExit);
  },
};

function loopControl(kind: 'break' | 'continue'): CommandDef {
  return {
    name: kind,
    builtin: true,
    summary: kind === 'break' ? 'Avbryter en loop' : 'Hoppar till nästa varv i en loop',
    man: `NAMN
       ${kind} - ${kind === 'break' ? 'avbryt en for-, while- eller until-loop' : 'hoppa direkt till nästa varv i en loop'}

SYNOPSIS
       ${kind} [N]

BESKRIVNING
       Med N påverkas N nivåer av nästlade loopar.`,
    run(ctx) {
      if (ctx.sh.loopDepth === 0) {
        ctx.err(`bash: ${kind}: only meaningful in a \`for', \`while', or \`until' loop\n`);
        return 0;
      }
      const n = Math.max(1, Number(ctx.args[0] ?? 1) || 1);
      throw new LoopSignal(kind, Math.min(n, ctx.sh.loopDepth));
    },
  };
}

const shift: CommandDef = {
  name: 'shift',
  builtin: true,
  summary: 'Flyttar skriptets argument ett steg ($2 blir $1)',
  man: `NAMN
       shift - flytta positionsparametrarna

SYNOPSIS
       shift [N]

BESKRIVNING
       $2 blir $1, $3 blir $2 och så vidare. Med N flyttas de N steg.`,
  run(ctx) {
    const n = Number(ctx.args[0] ?? 1);
    const args = ctx.sh.args;
    if (n > args.length) return 1;
    ctx.sh.setArgs(args.slice(n));
    return 0;
  },
};

const letCmd: CommandDef = {
  name: 'let',
  builtin: true,
  summary: 'Räknar med heltal',
  man: `NAMN
       let - räkna med heltal

SYNOPSIS
       let UTTRYCK...

EXEMPEL
       let "summa = 2 + 3"
       let i++

TIPS
       Det vanligaste sättet idag är (( i++ )) eller summa=$(( 2 + 3 )).`,
  run(ctx) {
    let last = 0;
    for (const expr of ctx.args) {
      try {
        last = evalArith(ctx.sh.expandString(expr), { get: (n) => ctx.sh.getVar(n), set: (n, v) => ctx.sh.setVar(n, v) });
      } catch (e) {
        if (!(e instanceof ArithError)) throw e;
        ctx.err(`bash: let: ${expr}: ${e.message}\n`);
        return 1;
      }
    }
    return last !== 0 ? 0 : 1;
  },
};

const set: CommandDef = {
  name: 'set',
  builtin: true,
  summary: 'Visar variabler eller ändrar skalets inställningar',
  man: `NAMN
       set - visa variabler eller ändra inställningar i skalet

SYNOPSIS
       set
       set -- ARGUMENT...
       set -e / -u / -x / -o pipefail

BESKRIVNING
       Utan argument listas alla variabler. "set -- a b c" sätter $1, $2, $3.
       Flaggorna -e (avbryt vid fel), -u och -x är vanliga överst i skript.
       I simulatorn godtas de men har ingen effekt ännu.`,
  run(ctx) {
    const sh = ctx.sh;
    if (!ctx.args.length) {
      for (const [k, v] of Object.entries(sh.env).sort()) ctx.out(`${k}=${/\s/.test(v) ? `'${v}'` : v}\n`);
      return 0;
    }
    const dd = ctx.args.indexOf('--');
    if (dd >= 0) sh.setArgs(ctx.args.slice(dd + 1));
    return 0;
  },
};

export const SCRIPT_COMMANDS: CommandDef[] = [
  testCommand('test'),
  testCommand('['),
  testCommand('[['),
  read,
  printf,
  local,
  returnCmd,
  loopControl('break'),
  loopControl('continue'),
  shift,
  letCmd,
  set,
];
