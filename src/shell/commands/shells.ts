// Andra skal: zsh och fish (startas ovanpå bash och avslutas med exit), chsh för att
// byta inloggningsskal, zsh:s setopt/unsetopt och de dolda inbyggda kommandon som
// fish-översättningen använder (set, count, math, status, contains).

import { fishVersion, saveUniversalVar, ZSH_VERSION } from '../shellmode';
import type { CmdCtx, CommandDef } from '../types';
import { COLOR, fsMessage } from './util';

// ---------- zsh och fish ----------

function shellCommand(mode: 'zsh' | 'fish', def: Omit<CommandDef, 'run' | 'name'>): CommandDef {
  return {
    ...def,
    name: mode,
    run(ctx) {
      const sh = ctx.sh;
      const [first, ...rest] = ctx.args;
      if (first === '--version' || first === '-v' || (mode === 'fish' && first === '-V')) {
        const triplet = { debian: 'x86_64-ubuntu-linux-gnu', arch: 'x86_64-pc-linux-gnu', redhat: 'x86_64-redhat-linux-gnu' }[sh.distro.family];
        ctx.out(mode === 'zsh' ? `zsh ${ZSH_VERSION} (${triplet})\n` : `fish, version ${fishVersion(sh)}\n`);
        return 0;
      }
      if (first === '-c') return sh.runScript(rest[0] ?? '', mode, rest.slice(1), ctx, false, mode);
      if (first && !first.startsWith('-')) {
        try {
          const content = sh.vfs.readFile(sh.resolve(first), sh.currentUser());
          return sh.runScript(content, first, rest, ctx, false, mode);
        } catch (e) {
          const msg = fsMessage(e);
          ctx.err(mode === 'zsh' ? `zsh: ${msg.toLowerCase()}: ${first}\n` : `fish: Error reading script file '${first}':\n${msg}\n`);
          return 127;
        }
      }
      // Kod från en pipe: echo 'echo hej' | zsh
      if (ctx.stdin !== null) return sh.runScript(ctx.stdin, mode, [], ctx, false, mode);
      if (!sh.interactive) return 0;
      return sh.startShell(mode, ctx);
    },
  };
}

const zsh = shellCommand('zsh', {
  summary: 'Z-skalet – ett bash-kompatibelt skal med många extra finesser',
  summaryEn: 'The Z shell – a bash-compatible shell with many extras',
  man: `NAMN
       zsh - Z-skalet

SYNOPSIS
       zsh
       zsh SKRIPT [ARGUMENT]...
       zsh -c 'KOMMANDO'

BESKRIVNING
       zsh är ett skal som i stort sett är kompatibelt med bash, men med
       fler finesser: bättre tab-komplettering, ** för att leta i alla
       underkataloger (ls **/*.txt), teman via Oh My Zsh och inställningar
       med setopt (t.ex. setopt autocd). Standardskal i macOS.

       Utan argument startas ett nytt interaktivt zsh-skal. Med exit kommer
       du tillbaka till skalet du kom ifrån.

       Inställningarna läses från ~/.zshrc. Prompten ställs in med
       variabeln PROMPT, t.ex. PROMPT='%n@%m %1~ %# '.

SKILLNADER MOT BASH (urval)
       - Ociterade $variabler delas inte upp vid mellanslag.
       - ** matchar alla underkataloger (i bash krävs shopt -s globstar).
       - Listor (arrayer) börjar på index 1, inte 0.

EXEMPEL
       zsh
       ls **/*.txt
       exit`,
  manEn: `NAME
       zsh - the Z shell

SYNOPSIS
       zsh
       zsh SCRIPT [ARGUMENT]...
       zsh -c 'COMMAND'

DESCRIPTION
       zsh is a shell that is largely compatible with bash, with extras:
       better tab completion, ** to search all subdirectories
       (ls **/*.txt), themes through Oh My Zsh and options set with setopt
       (e.g. setopt autocd). The default shell on macOS.

       Without arguments a new interactive zsh is started. exit takes you
       back to the shell you came from.

       Settings are read from ~/.zshrc. The prompt is set with the PROMPT
       variable, e.g. PROMPT='%n@%m %1~ %# '.

DIFFERENCES FROM BASH (selection)
       - Unquoted $variables are not split on spaces.
       - ** matches all subdirectories (bash needs shopt -s globstar).
       - Arrays start at index 1, not 0.

EXAMPLES
       zsh
       ls **/*.txt
       exit`,
});

const fish = shellCommand('fish', {
  summary: 'fish – "the friendly interactive shell" med egen, enklare syntax',
  summaryEn: 'fish – the friendly interactive shell, with its own simpler syntax',
  man: `NAMN
       fish - the friendly interactive shell

SYNOPSIS
       fish
       fish SKRIPT [ARGUMENT]...
       fish -c 'KOMMANDO'

BESKRIVNING
       fish är ett skal som satsar på att vara lätt att använda: förslag
       medan du skriver (autosuggestions), färger och bra standardval utan
       konfiguration. Syntaxen skiljer sig från bash:

           set namn Kim              i stället för  namn=Kim
           set -x EDITOR nano        i stället för  export EDITOR=nano
           (pwd)                     i stället för  $(pwd)
           $status                   i stället för  $?
           $argv                     i stället för  $@
           if test -f fil; ...; end  i stället för  if ...; then ...; fi
           for x in a b c; ...; end  i stället för  for ...; do ...; done
           function hej; ...; end    i stället för  hej() { ...; }
           math 2 + 3                i stället för  $((2 + 3))

       Inställningar läses från ~/.config/fish/config.fish.

EXEMPEL
       fish
       set frukt äpple
       echo $frukt
       exit`,
  manEn: `NAME
       fish - the friendly interactive shell

SYNOPSIS
       fish
       fish SCRIPT [ARGUMENT]...
       fish -c 'COMMAND'

DESCRIPTION
       fish aims to be easy to use: suggestions while you type
       (autosuggestions), colours and good defaults without configuration.
       The syntax differs from bash:

           set name Kim              instead of  name=Kim
           set -x EDITOR nano        instead of  export EDITOR=nano
           (pwd)                     instead of  $(pwd)
           $status                   instead of  $?
           $argv                     instead of  $@
           if test -f file; ...; end instead of  if ...; then ...; fi
           for x in a b c; ...; end  instead of  for ...; do ...; done
           function hi; ...; end     instead of  hi() { ...; }
           math 2 + 3                instead of  $((2 + 3))

       Settings are read from ~/.config/fish/config.fish.

EXAMPLES
       fish
       set fruit apple
       echo $fruit
       exit`,
});

// ---------- chsh ----------

/** /bin/zsh och /usr/bin/zsh är samma fil (/bin pekar på /usr/bin i moderna distributioner). */
const realPath = (p: string) => p.replace(/^\/bin\//, '/usr/bin/').replace(/^\/sbin\//, '/usr/sbin/');

function changeShell(ctx: CmdCtx, user: string, shell: string, out: CmdCtx): number {
  const sh = ctx.sh;
  const root = sh.rootUser();
  const utilLinux = sh.distro.family !== 'debian';
  const shells = (sh.vfs.tryLookup('/etc/shells', root)?.content ?? '').split('\n').map((l) => l.trim());
  const isRoot = sh.currentUser().uid === 0;
  if (!shell.startsWith('/')) {
    out.err(utilLinux ? 'chsh: shell must be a full path name\n' : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  const node = sh.vfs.tryLookup(realPath(shell), root);
  if (!node || node.type !== 'file' || !(node.mode & 0o111)) {
    out.err(utilLinux ? `chsh: "${shell}" does not exist\n` : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  if (!shells.includes(shell) && !isRoot) {
    out.err(utilLinux ? `chsh: ${shell} is not listed in /etc/shells.\nchsh: Use chsh -l to see list.\n` : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  const passwd = sh.vfs.readFile('/etc/passwd', root);
  const lines = passwd.split('\n').map((line) => {
    const f = line.split(':');
    if (f[0] !== user || f.length < 7) return line;
    f[6] = shell;
    return f.join(':');
  });
  sh.vfs.writeFile('/etc/passwd', lines.join('\n'), root);
  if (utilLinux) out.out('Shell changed.\n');
  out.out(
    `${COLOR.dim}${sh.msg({
      sv: `Inloggningsskalet för ${user} är nu ${shell} (se /etc/passwd). Det gäller från nästa inloggning – terminalen du har öppen kör fortfarande sitt gamla skal.`,
      en: `The login shell for ${user} is now ${shell} (see /etc/passwd). It takes effect at the next login – the terminal you have open still runs its old shell.`,
    })}${COLOR.reset}\n`,
  );
  return 0;
}

const chsh: CommandDef = {
  name: 'chsh',
  summary: 'Byter inloggningsskal (change shell)',
  summaryEn: 'Change login shell',
  man: `NAMN
       chsh - byt inloggningsskal

SYNOPSIS
       chsh [-s SKAL] [ANVÄNDARE]
       chsh -l

BESKRIVNING
       Ändrar vilket skal som startas när du loggar in. Skalet står i
       sista fältet på din rad i /etc/passwd. Bara skal som finns med i
       /etc/shells godtas (de läggs dit när skalet installeras). Ändringen
       gäller från nästa inloggning.

       Utan -s frågar chsh efter det nya skalet.

FLAGGOR
       -s SKAL    det nya skalet, med hela sökvägen (t.ex. /usr/bin/zsh)
       -l         lista skalen i /etc/shells (Arch och Fedora)

EXEMPEL
       cat /etc/shells
       chsh -s /usr/bin/zsh
       grep elev /etc/passwd
       chsh -s /bin/bash`,
  manEn: `NAME
       chsh - change login shell

SYNOPSIS
       chsh [-s SHELL] [USER]
       chsh -l

DESCRIPTION
       Changes which shell is started when you log in. The shell is the
       last field of your line in /etc/passwd. Only shells listed in
       /etc/shells are accepted (they are added there when the shell is
       installed). The change takes effect at the next login.

       Without -s, chsh asks for the new shell.

OPTIONS
       -s SHELL   the new shell, with its full path (e.g. /usr/bin/zsh)
       -l         list the shells in /etc/shells (Arch and Fedora)

EXAMPLES
       cat /etc/shells
       chsh -s /usr/bin/zsh
       grep elev /etc/passwd
       chsh -s /bin/bash`,
  run(ctx) {
    const sh = ctx.sh;
    const utilLinux = sh.distro.family !== 'debian';
    let shell: string | undefined;
    const operands: string[] = [];
    for (let i = 0; i < ctx.args.length; i++) {
      const a = ctx.args[i];
      if (a === '-s' || a === '--shell') {
        shell = ctx.args[++i];
        if (shell === undefined) {
          ctx.err(`chsh: option requires an argument -- 's'\n`);
          return 1;
        }
      } else if (a.startsWith('--shell=')) shell = a.slice(8);
      else if ((a === '-l' || a === '--list-shells') && utilLinux) {
        ctx.out(sh.vfs.readFile('/etc/shells', sh.rootUser()).replace(/^#.*\n/gm, ''));
        return 0;
      } else if (a.startsWith('-')) {
        ctx.err(`chsh: invalid option -- '${a.replace(/^-+/, '')}'\n`);
        return 1;
      } else operands.push(a);
    }
    const me = sh.currentUser();
    const user = operands[0] ?? me.name;
    const line = sh.vfs
      .readFile('/etc/passwd', sh.rootUser())
      .split('\n')
      .find((l) => l.split(':')[0] === user);
    if (!line) {
      ctx.err(utilLinux ? `chsh: user "${user}" does not exist.\n` : `chsh: user '${user}' does not exist\n`);
      return 1;
    }
    if (user !== me.name && me.uid !== 0) {
      ctx.err(utilLinux ? "chsh: running UID doesn't match UID of user we're altering, shell change denied\n" : `chsh: You may not change the shell for '${user}'.\n`);
      return 1;
    }
    if (utilLinux) ctx.out(`Changing shell for ${user}.\n`);
    if (me.uid !== 0) ctx.err(`Password: ${COLOR.dim}${sh.msg({ sv: '(simulatorn hoppar över lösenordet)', en: '(the simulator skips the password)' })}${COLOR.reset}\n`);
    if (shell !== undefined) return changeShell(ctx, user, shell, ctx);
    const current = line.split(':')[6] ?? '/bin/bash';
    if (!utilLinux) ctx.out(`Changing the login shell for ${user}\nEnter the new value, or press ENTER for the default\n`);
    sh.askText(utilLinux ? `New shell [${current}]: ` : `\tLogin Shell [${current}]: `, (text, io) => {
      const value = text.trim();
      if (!value || value === current) {
        if (utilLinux) io.out('Shell not changed.\n');
        return 0;
      }
      return changeShell(ctx, user, value, { ...ctx, out: io.out, err: io.err });
    });
    return 0;
  },
};

// ---------- zsh: setopt och unsetopt ----------

const ZSH_OPTIONS = [
  'autocd', 'autopushd', 'correct', 'extendedglob', 'globdots', 'histignorealldups', 'histignoredups',
  'interactivecomments', 'nomatch', 'promptsubst', 'sharehistory', 'shwordsplit', 'appendhistory', 'notify',
];

function notFound(ctx: CmdCtx): number {
  const mode = ctx.sh.shellMode;
  ctx.err(mode === 'fish' ? `fish: Unknown command: ${ctx.name}\n` : `${mode}: ${ctx.name}: command not found\n`);
  ctx.err(`${COLOR.dim}${ctx.sh.msg({ sv: `${ctx.name} finns bara i zsh.`, en: `${ctx.name} only exists in zsh.` })}${COLOR.reset}\n`);
  return 127;
}

function optCommand(name: 'setopt' | 'unsetopt'): CommandDef {
  return {
    name,
    builtin: true,
    summary: name === 'setopt' ? 'Slår på en inställning i zsh (t.ex. autocd)' : 'Slår av en inställning i zsh',
    summaryEn: name === 'setopt' ? 'Turn on a zsh option (e.g. autocd)' : 'Turn off a zsh option',
    man: `NAMN
       ${name} - ${name === 'setopt' ? 'slå på' : 'slå av'} inställningar i zsh

SYNOPSIS
       ${name} [INSTÄLLNING]...

BESKRIVNING
       Finns bara i zsh. Utan argument listas inställningarna som är på.
       Lägg raden i ~/.zshrc för att den ska gälla varje gång.

       autocd       skriv ett katalognamn för att gå dit, utan cd
       shwordsplit  dela upp ociterade $variabler vid mellanslag, som bash
       correct      föreslå rättningar av felstavade kommandon

EXEMPEL
       setopt autocd
       dokument`,
    manEn: `NAME
       ${name} - turn zsh options ${name === 'setopt' ? 'on' : 'off'}

SYNOPSIS
       ${name} [OPTION]...

DESCRIPTION
       Only exists in zsh. Without arguments the options that are on are
       listed. Put the line in ~/.zshrc to make it permanent.

       autocd       type a directory name to go there, without cd
       shwordsplit  split unquoted $variables on spaces, like bash
       correct      suggest corrections for misspelled commands

EXAMPLES
       setopt autocd
       dokument`,
    run(ctx) {
      const sh = ctx.sh;
      if (sh.shellMode !== 'zsh') return notFound(ctx);
      const frame = sh.shellStack.at(-1);
      const options = frame?.mode === 'zsh' ? frame.options : {};
      if (!ctx.args.length) {
        for (const o of Object.keys(options).filter((k) => options[k]).sort()) ctx.out(o + '\n');
        return 0;
      }
      let code = 0;
      for (const a of ctx.args) {
        let opt = a.toLowerCase().replace(/_/g, '');
        let on = name === 'setopt';
        if (opt.startsWith('no') && ZSH_OPTIONS.includes(opt.slice(2))) {
          opt = opt.slice(2);
          on = !on;
        }
        if (!ZSH_OPTIONS.includes(opt)) {
          ctx.err(`${name}: no such option: ${a}\n`);
          code = 1;
          continue;
        }
        options[opt] = on;
      }
      return code;
    },
  };
}

// ---------- fish: inbyggda kommandon (anropas via översättningen) ----------

function fishBuiltin(name: string, run: (ctx: CmdCtx) => number): CommandDef {
  return { name: `__fish_${name}`, builtin: true, summary: `fish: ${name}`, run: (ctx) => run({ ...ctx, name }) };
}

const fishSet = fishBuiltin('set', (ctx) => {
  const sh = ctx.sh;
  const flags = new Set<string>();
  const LONG: Record<string, string> = { local: 'l', global: 'g', universal: 'U', export: 'x', unexport: 'u', erase: 'e', query: 'q', append: 'a', prepend: 'p', names: 'n' };
  let i = 0;
  for (; i < ctx.args.length; i++) {
    const a = ctx.args[i];
    if (a === '--') {
      i++;
      break;
    }
    if (a.startsWith('--') && LONG[a.slice(2)]) flags.add(LONG[a.slice(2)]);
    else if (/^-[lgUxueqapnS]+$/.test(a)) [...a.slice(1)].forEach((c) => flags.add(c));
    else if (a.startsWith('-') && a.length > 1) {
      ctx.err(`set: ${a}: unknown option\n`);
      return 2;
    } else break;
  }
  const [name, ...values] = ctx.args.slice(i);
  if (name === undefined) {
    for (const [k, v] of Object.entries(sh.env).sort()) ctx.out(flags.has('n') ? `${k}\n` : `${k} ${v}\n`);
    return 0;
  }
  if (flags.has('q')) return [name, ...values].filter((n) => !(n in sh.env)).length;
  if (!/^[A-Za-z_]\w*$/.test(name)) {
    ctx.err(`set: ${name}: invalid variable name. See \`help identifiers\`\n`);
    return 2;
  }
  if (flags.has('e')) {
    if (flags.has('U')) saveUniversalVar(sh, name, null);
    if (!(name in sh.env)) return 4;
    delete sh.env[name];
    return 0;
  }
  // fish har listor; i simulatorn lagras de med mellanslag emellan (PATH-listor med kolon).
  const sep = name.endsWith('PATH') ? ':' : ' ';
  const old = sh.env[name] ? [sh.env[name]] : [];
  const value = (flags.has('a') ? [...old, ...values] : flags.has('p') ? [...values, ...old] : values).join(sep);
  if (flags.has('U')) saveUniversalVar(sh, name, value);
  // Utan -g/-U blir en ny variabel i en funktion lokal för funktionen (som -l).
  const local = flags.has('l') || (!flags.has('g') && !flags.has('U') && sh.funcDepth > 0 && !(name in sh.env));
  if (local && sh.declareLocal(name, value)) return 0;
  sh.setVar(name, value);
  return 0;
});

const fishCount = fishBuiltin('count', (ctx) => {
  ctx.out(`${ctx.args.length}\n`);
  return ctx.args.length ? 0 : 1;
});

const fishIndex = fishBuiltin('index', (ctx) => {
  const [n, ...list] = ctx.args;
  const idx = Number(n);
  const item = idx > 0 ? list[idx - 1] : list[list.length + idx];
  if (item === undefined) return 1;
  ctx.out(item + '\n');
  return 0;
});

const fishContains = fishBuiltin('contains', (ctx) => {
  const args = [...ctx.args];
  const printIndex = args[0] === '-i' || args[0] === '--index';
  if (printIndex) args.shift();
  const [needle, ...hay] = args;
  if (needle === undefined) {
    ctx.err('contains: Key not specified\n');
    return 2;
  }
  const i = hay.indexOf(needle);
  if (i >= 0 && printIndex) ctx.out(`${i + 1}\n`);
  return i >= 0 ? 0 : 1;
});

const fishStatus = fishBuiltin('status', (ctx) => {
  const sh = ctx.sh;
  switch (ctx.args[0]) {
    case undefined:
      ctx.out('This is not a login shell\nJob control: Only on interactive jobs\n');
      return 0;
    case 'is-interactive':
      return sh.interactive ? 0 : 1;
    case 'is-login':
      return 1;
    case 'current-command':
      ctx.out('status\n');
      return 0;
    case 'fish-path':
      ctx.out('/usr/bin/fish\n');
      return 0;
    default:
      ctx.err(`status: ${ctx.args[0]}: invalid subcommand\n`);
      return 2;
  }
});

class MathError extends Error {}

/** fish:s math: + - * x / % ^ och parenteser, med decimaltal. */
export function fishMath(expr: string): number {
  const toks = expr.match(/\d+(?:\.\d+)?|\.\d+|[-+*/%^()x]|pi|e|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const primary = (): number => {
    const t = toks[i++];
    if (t === undefined) throw new MathError('Too few arguments');
    if (t === '(') {
      const v = sum();
      if (toks[i++] !== ')') throw new MathError('Missing closing parenthesis');
      return v;
    }
    if (t === '-') return -power();
    if (t === '+') return power();
    if (t === 'pi') return Math.PI;
    if (t === 'e') return Math.E;
    if (/^[\d.]/.test(t)) return Number(t);
    throw new MathError('Unexpected token');
  };
  const power = (): number => {
    const base = primary();
    if (peek() === '^') {
      i++;
      return base ** power();
    }
    return base;
  };
  const product = (): number => {
    let v = power();
    while (['*', 'x', '/', '%'].includes(peek())) {
      const op = toks[i++];
      const r = power();
      if ((op === '/' || op === '%') && r === 0) throw new MathError('Division by zero');
      v = op === '/' ? v / r : op === '%' ? v % r : v * r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === '+' || peek() === '-') v = toks[i++] === '+' ? v + product() : v - product();
    return v;
  };
  const v = sum();
  if (i < toks.length) throw new MathError('Unexpected token');
  return v;
}

const fishMathCmd = fishBuiltin('math', (ctx) => {
  const args = [...ctx.args];
  let scale = 6;
  while (args[0]?.startsWith('-s') || args[0]?.startsWith('--scale')) {
    const a = args.shift()!;
    const v = a.includes('=') ? a.split('=')[1] : a.length > 2 && !a.startsWith('--') ? a.slice(2) : args.shift();
    scale = Number(v);
  }
  if (!args.length) {
    ctx.err('math: expected >= 1 arguments; got 0\n');
    return 2;
  }
  try {
    const v = fishMath(args.join(' '));
    if (!Number.isFinite(v)) throw new MathError('Result is infinite');
    const s = scale === 0 ? String(Math.trunc(v)) : String(Number(v.toFixed(scale)));
    ctx.out(s + '\n');
    return 0;
  } catch (e) {
    if (!(e instanceof MathError)) throw e;
    ctx.err(`math: Error: ${e.message}\n'${args.join(' ')}'\n`);
    return 1;
  }
});

/** I zsh och fish startar `bash` ett nytt bash-skal. */
export function startBash(ctx: CmdCtx): number | null {
  const sh = ctx.sh;
  if (sh.shellMode === 'bash' || !sh.interactive || ctx.stdin !== null) return null;
  return sh.startShell('bash', ctx);
}

export const SHELL_COMMANDS: CommandDef[] = [
  zsh,
  fish,
  chsh,
  optCommand('setopt'),
  optCommand('unsetopt'),
  fishSet,
  fishCount,
  fishIndex,
  fishContains,
  fishStatus,
  fishMathCmd,
];
