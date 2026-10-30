// Skal- och systemkommandon: sudo, su, man, help, which, type, export, alias, history, uname m.fl.

import type { CmdCtx, CommandDef } from '../types';
import { basename, dirname } from '../vfs';
import { badOption, COLOR, formatMan, fsMessage, longDate } from './util';
import { COMMANDS } from './index';
import { manFor, summaryFor } from './man-en';
import { startBash } from './shells';

function simple(name: string, summary: string, run: (ctx: CmdCtx) => number, man?: string, builtin = false): CommandDef {
  return { name, summary, run, man, builtin };
}

const whoami = simple('whoami', 'Visar vilken användare du är', (ctx) => {
  ctx.out(ctx.sh.currentUser().name + '\n');
  return 0;
}, `NAMN
       whoami - skriv ut ditt användarnamn

BESKRIVNING
       Visar namnet på användaren som kör kommandot. Prova "sudo whoami"!`);

const id = simple('id', 'Visar användar- och grupp-id', (ctx) => {
  const sh = ctx.sh;
  const name = ctx.args[0] ?? sh.currentUser().name;
  if (name !== 'root' && name !== 'elev') {
    ctx.err(`id: '${name}': no such user\n`);
    return 1;
  }
  const u = sh.getUser(name);
  const gid = (g: string) => (g === 'root' ? 0 : g === sh.distro.adminGroup ? sh.distro.adminGid : 1000);
  ctx.out(`uid=${u.uid}(${u.name}) gid=${gid(u.groups[0])}(${u.groups[0]}) groups=${u.groups.map((g) => `${gid(g)}(${g})`).join(',')}\n`);
  return 0;
}, `NAMN
       id - visa användar-id (uid), grupp-id (gid) och grupper

SYNOPSIS
       id [ANVÄNDARE]`);

const groups = simple('groups', 'Visar vilka grupper du tillhör', (ctx) => {
  const u = ctx.sh.getUser(ctx.args[0] ?? ctx.sh.currentUser().name);
  ctx.out((ctx.args[0] ? `${u.name} : ` : '') + u.groups.join(' ') + '\n');
  return 0;
}, `NAMN
       groups - visa vilka grupper en användare tillhör

BESKRIVNING
       Medlemmar i gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       får använda sudo.`);

const hostname = simple('hostname', 'Visar datorns namn', (ctx) => {
  ctx.out(ctx.sh.distro.hostname + '\n');
  return 0;
}, `NAMN
       hostname - visa systemets värdnamn

BESKRIVNING
       Namnet finns också i filen /etc/hostname.`);

const uname = simple('uname', 'Visar information om systemet och kärnan', (ctx) => {
  const d = ctx.sh.distro;
  const flags = new Set(ctx.args.flatMap((a) => (a.startsWith('-') ? [...a.slice(1)] : [])));
  const parts: string[] = [];
  const all = flags.has('a');
  if (all || flags.has('s') || flags.size === 0) parts.push('Linux');
  if (all || flags.has('n')) parts.push(d.hostname);
  if (all || flags.has('r')) parts.push(d.kernel);
  if (all || flags.has('v')) parts.push('#1 SMP PREEMPT_DYNAMIC');
  if (all || flags.has('m')) parts.push('x86_64');
  if (all || flags.has('o')) parts.push('GNU/Linux');
  ctx.out(parts.join(' ') + '\n');
  return 0;
}, `NAMN
       uname - visa systeminformation

FLAGGOR
       -a    allt
       -r    kärnans version (kernel release)
       -n    värdnamnet
       -m    hårdvaruarkitektur (t.ex. x86_64)`);

const date = simple('date', 'Visar datum och tid', (ctx) => {
  ctx.out(longDate() + '\n');
  return 0;
}, `NAMN
       date - visa datum och tid`);

const envCmd = (name: string): CommandDef =>
  simple(name, 'Visar miljövariabler', (ctx) => {
    const env = ctx.sh.env;
    if (name === 'printenv' && ctx.args.length) {
      let code = 0;
      for (const k of ctx.args) {
        if (k in env) ctx.out(env[k] + '\n');
        else code = 1;
      }
      return code;
    }
    for (const [k, v] of Object.entries(env).sort()) ctx.out(`${k}=${v}\n`);
    return 0;
  }, `NAMN
       ${name} - visa miljövariabler

SYNOPSIS
       ${name === 'env' ? 'env' : 'printenv [VARIABEL]...'}

BESKRIVNING
       Miljövariabler är namngivna värden som program kan läsa, t.ex.
       HOME (din hemkatalog), PATH (var kommandon letas efter) och USER.`);

const exportCmd = simple('export', 'Sätter en miljövariabel', (ctx) => {
  const env = ctx.sh.env;
  if (!ctx.args.length || ctx.args[0] === '-p') {
    for (const [k, v] of Object.entries(env).sort()) ctx.out(`declare -x ${k}="${v}"\n`);
    return 0;
  }
  for (const a of ctx.args) {
    const eq = a.indexOf('=');
    const key = eq >= 0 ? a.slice(0, eq) : a;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      ctx.err(`bash: export: \`${a}': not a valid identifier\n`);
      return 1;
    }
    if (eq >= 0) env[key] = a.slice(eq + 1);
    else env[key] ??= '';
  }
  return 0;
}, `NAMN
       export - gör en variabel tillgänglig för program som startas

SYNOPSIS
       export NAMN=VÄRDE

EXEMPEL
       export EDITOR=nano
       export PATH="$HOME/bin:$PATH"

BESKRIVNING
       Variabler som sätts med export gäller bara i den aktuella sessionen.
       Lägg raden i ~/.bashrc om den ska gälla varje gång du öppnar en terminal.`, true);

const unset = simple('unset', 'Tar bort en variabel eller funktion', (ctx) => {
  let functions = false;
  for (const k of ctx.args) {
    if (k === '-f') functions = true;
    else if (k === '-v') functions = false;
    else if (functions) delete ctx.sh.functions[k];
    else delete ctx.sh.env[k];
  }
  return 0;
}, `NAMN
       unset - ta bort en variabel eller funktion

SYNOPSIS
       unset NAMN...
       unset -f FUNKTION...`, true);

const alias = simple('alias', 'Skapar ett kortkommando för ett kommando', (ctx) => {
  const aliases = ctx.sh.aliases;
  if (!ctx.args.length) {
    for (const [k, v] of Object.entries(aliases).sort()) ctx.out(`alias ${k}='${v}'\n`);
    return 0;
  }
  let code = 0;
  for (const a of ctx.args) {
    const eq = a.indexOf('=');
    if (eq > 0) aliases[a.slice(0, eq)] = a.slice(eq + 1);
    else if (a in aliases) ctx.out(`alias ${a}='${aliases[a]}'\n`);
    else {
      ctx.err(`bash: alias: ${a}: not found\n`);
      code = 1;
    }
  }
  return code;
}, `NAMN
       alias - skapa kortkommandon

SYNOPSIS
       alias NAMN='KOMMANDO'
       alias

EXEMPEL
       alias ll='ls -la'
       alias ..='cd ..'

BESKRIVNING
       Utan argument listas alla alias. Lägg alias i ~/.bashrc för att
       spara dem permanent.`, true);

const unalias = simple('unalias', 'Tar bort ett alias', (ctx) => {
  if (ctx.args[0] === '-a') {
    for (const k of Object.keys(ctx.sh.aliases)) delete ctx.sh.aliases[k];
    return 0;
  }
  let code = 0;
  for (const a of ctx.args) {
    if (a in ctx.sh.aliases) delete ctx.sh.aliases[a];
    else {
      ctx.err(`bash: unalias: ${a}: not found\n`);
      code = 1;
    }
  }
  return code;
}, undefined, true);

const history = simple('history', 'Visar tidigare kommandon', (ctx) => {
  if (ctx.args[0] === '-c') {
    ctx.sh.history.length = 0;
    return 0;
  }
  ctx.sh.history.forEach((l, i) => ctx.out(`${String(i + 1).padStart(5)}  ${l}\n`));
  return 0;
}, `NAMN
       history - visa kommandohistoriken

BESKRIVNING
       Använd pil upp/ned för att bläddra bland tidigare kommandon.

FLAGGOR
       -c    töm historiken`, true);

const type = simple('type', 'Visar vad ett kommandonamn är (alias, inbyggt, fil)', (ctx) => {
  const sh = ctx.sh;
  let code = 0;
  for (const n of ctx.args) {
    if (n in sh.aliases) ctx.out(`${n} is aliased to \`${sh.aliases[n]}'\n`);
    else if (n in sh.functions) ctx.out(`${n} is a function\n`);
    else if (COMMANDS[n]?.builtin) ctx.out(`${n} is a shell builtin\n`);
    else {
      const r = sh.resolveCommand(n);
      if (r.kind === 'binary' || r.kind === 'script') ctx.out(`${n} is ${r.path}\n`);
      else {
        ctx.err(`bash: type: ${n}: not found\n`);
        code = 1;
      }
    }
  }
  return code;
}, `NAMN
       type - visa hur ett kommandonamn tolkas

EXEMPEL
       type cd      cd is a shell builtin
       type ls      ls is /usr/bin/ls`, true);

const which = simple('which', 'Visar var ett kommando finns', (ctx) => {
  const sh = ctx.sh;
  let code = 0;
  for (const n of ctx.args) {
    const r = sh.resolveCommand(n);
    if (r.kind === 'binary' || r.kind === 'script') ctx.out(r.path + '\n');
    else {
      code = 1;
      if (sh.distro.family !== 'debian') ctx.err(`which: no ${n} in (${sh.env.PATH ?? ''})\n`);
    }
  }
  return code;
}, `NAMN
       which - visa den fullständiga sökvägen till ett kommando

BESKRIVNING
       Letar igenom katalogerna i $PATH. Inbyggda skalkommandon (som cd)
       är inga filer och hittas därför inte – använd "type" för dem.

EXEMPEL
       which ls`);

const man = simple('man', 'Visar manualen för ett kommando', (ctx) => {
  const name = ctx.args.filter((a) => !/^\d$/.test(a))[0];
  if (!name) {
    ctx.err(`What manual page do you want?\nFor example, try 'man man'.\n`);
    return 1;
  }
  const def = COMMANDS[name];
  const available = def?.builtin || ctx.sh.resolveCommand(name).kind !== 'notfound';
  if (!def || !available) {
    ctx.err(`No manual entry for ${name}\n`);
    return 16;
  }
  ctx.out(formatMan(name, manFor(def, ctx.sh)));
  if (ctx.isTTY) ctx.out(`${COLOR.dim}(${ctx.sh.msg({ sv: 'I en riktig terminal bläddrar du i manualen med piltangenterna och avslutar med q.', en: 'In a real terminal you scroll through the manual with the arrow keys and quit with q.' })})${COLOR.reset}\n`);
  return 0;
}, `NAMN
       man - visa manualsidor

SYNOPSIS
       man KOMMANDO

BESKRIVNING
       Nästan alla kommandon har en manualsida. Det är det första stället
       att leta på när du undrar vad en flagga gör. I simulatorn är
       manualerna förenklade och på svenska.`);

const help = simple('help', 'Listar alla kommandon som finns', (ctx) => {
  const sh = ctx.sh;
  const names = sh.availableCommands().filter((n) => /^[a-z]/.test(n) && COMMANDS[n]?.name === n);
  ctx.out(sh.msg({ sv: `Kommandon i den här simulerade terminalen (${sh.distro.name}):\n`, en: `Commands in this simulated terminal (${sh.distro.name}):\n` }));
  ctx.out(sh.msg({ sv: `Skriv 'man <kommando>' för mer information om ett kommando.\n\n`, en: `Type 'man <command>' for more information about a command.\n\n` }));
  for (const n of names) ctx.out(`  ${n.padEnd(11)} ${summaryFor(COMMANDS[n], sh)}\n`);
  ctx.out(`\n${COLOR.dim}${sh.msg({ sv: `Saknas ett program? Det kanske går att installera med pakethanteraren (${sh.distro.packageManager}).`, en: `Missing a program? Maybe you can install it with the package manager (${sh.distro.packageManager}).` })}${COLOR.reset}\n`);
  return 0;
}, `NAMN
       help - lista kommandon i simulatorn`, true);

const clear = simple('clear', 'Rensar skärmen', (ctx) => {
  ctx.sh.requestClear();
  return 0;
}, `NAMN
       clear - rensa terminalfönstret

TIPS
       Kortkommandot Ctrl+L gör samma sak.`);

const exit = simple('exit', 'Avslutar skalet (eller lämnar root-skalet)', (ctx) => ctx.sh.exit(Number(ctx.args[0] ?? 0) || 0, ctx), `NAMN
       exit - avsluta skalet

BESKRIVNING
       Om du blivit root med "sudo -i" tar exit dig tillbaka till din
       vanliga användare.`, true);

const logout = { ...exit, name: 'logout', summary: 'Loggar ut från ett inloggningsskal' };

function sudoNotice(ctx: CmdCtx): void {
  const sh = ctx.sh;
  if (sh.flags.sudoNoticeShown) return;
  sh.flags.sudoNoticeShown = true;
  ctx.err(`[sudo] password for ${sh.currentUser().name}: ${COLOR.dim}(${sh.msg({ sv: 'simulatorn hoppar över lösenordet', en: 'the simulator skips the password' })})${COLOR.reset}\n`);
}

function becomeRoot(ctx: CmdCtx, login: boolean): number {
  const sh = ctx.sh;
  sh.userStack.push('root');
  sh.env.USER = 'root';
  sh.env.HOME = '/root';
  if (login) sh.cwd = '/root';
  return 0;
}

const sudo = simple('sudo', 'Kör ett kommando som root (administratör)', (ctx) => {
  const sh = ctx.sh;
  const user = sh.currentUser();
  const args = [...ctx.args];
  if (!args.length || args[0] === '-h') {
    ctx.err('usage: sudo -h | -K | -k | -V\nusage: sudo [-AbEHknPS] [-u user] [-i | -s] [command [arg ...]]\n');
    return 1;
  }
  if (args[0] === '-V' || args[0] === '--version') {
    ctx.out('Sudo version 1.9.17p2\n');
    return 0;
  }
  if (user.uid !== 0 && !user.groups.includes(sh.distro.adminGroup)) {
    ctx.err(`${user.name} is not in the sudoers file.\n`);
    return 1;
  }
  if (user.uid !== 0) sudoNotice(ctx);
  if (args[0] === '-i' || args[0] === '-s') return becomeRoot(ctx, args[0] === '-i');
  if (args[0] === 'su' && (args.length === 1 || args[1] === '-')) return becomeRoot(ctx, args[1] === '-');
  let target = 'root';
  if (args[0] === '-u') {
    target = args[1] ?? 'root';
    args.splice(0, 2);
  }
  if (args[0] === '--') args.shift();
  if (!args.length) return 1;
  return sh.runAs(target, () => sh.invoke(args, ctx, { viaSudo: true }));
}, `NAMN
       sudo - kör ett kommando som en annan användare (oftast root)

SYNOPSIS
       sudo KOMMANDO [ARGUMENT]...
       sudo -i

BESKRIVNING
       root är systemets administratör och får göra allt. Vanliga användare
       som tillhör gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       kan köra enstaka kommandon som root genom att sätta sudo framför.
       Du får då ange ditt eget lösenord.

       sudo -i    starta ett root-skal (avsluta med exit)

EXEMPEL
       sudo apt update
       sudo cat /etc/shadow

VARNING
       Med sudo finns inga skyddsnät. Kör bara kommandon du förstår.`);

const su = simple('su', 'Byter användare', (ctx) => {
  if (ctx.sh.currentUser().uid === 0) return becomeRoot(ctx, ctx.args[0] === '-' || ctx.args[0] === '-l');
  ctx.err(`Password: \nsu: Authentication failure\n`);
  ctx.err(`${COLOR.dim}${ctx.sh.msg({ sv: "Tips: root-kontot har ofta inget lösenord. Använd 'sudo -i' i stället.", en: "Tip: the root account often has no password. Use 'sudo -i' instead." })}${COLOR.reset}\n`);
  return 1;
}, `NAMN
       su - byt användare (substitute user)

BESKRIVNING
       "su -" loggar in som root, men kräver root-lösenordet. På Ubuntu är
       root-kontot låst, så där används "sudo -i" i stället.`);

const bash = simple('bash', 'Kör ett skript i ett nytt bash-skal', (ctx) => {
  const sh = ctx.sh;
  const [first, ...rest] = ctx.args;
  if (first === '--version') {
    ctx.out('GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\n');
    return 0;
  }
  if (first === '-c') return sh.runScript(rest[0] ?? '', 'bash', rest.slice(1), ctx, false, 'bash');
  if (!first) {
    const started = startBash(ctx);
    if (started !== null) return started;
    ctx.out(`${COLOR.dim}${sh.msg({ sv: 'Du kör redan bash! Simulatorn kan inte starta ett nytt interaktivt skal.', en: "You're already running bash! The simulator can't start a new interactive shell." })}${COLOR.reset}\n`);
    return 0;
  }
  try {
    const content = sh.vfs.readFile(sh.resolve(first), sh.currentUser());
    return sh.runScript(content, first, rest, ctx, false, 'bash');
  } catch (e) {
    ctx.err(`bash: ${first}: ${fsMessage(e)}\n`);
    return 127;
  }
}, `NAMN
       bash - GNU Bourne-Again SHell

SYNOPSIS
       bash SKRIPT [ARGUMENT]...
       bash -c 'KOMMANDO'

BESKRIVNING
       bash är skalet du skriver kommandon i. "bash skript.sh" kör ett
       skript utan att det behöver vara körbart (chmod +x).`);

const source = simple('source', 'Kör ett skript i det aktuella skalet', (ctx) => {
  const sh = ctx.sh;
  const [file, ...rest] = ctx.args;
  if (!file) {
    ctx.err(`bash: source: filename argument required\n`);
    return 2;
  }
  try {
    const content = sh.vfs.readFile(sh.resolve(file), sh.currentUser());
    return sh.runScript(content, file, rest, ctx, true);
  } catch (e) {
    ctx.err(`bash: ${file}: ${fsMessage(e)}\n`);
    return 1;
  }
}, `NAMN
       source - läs in och kör kommandon från en fil i det aktuella skalet

BESKRIVNING
       Till skillnad från att köra ett skript påverkar source ditt skal:
       alias, variabler och cd stannar kvar. Används ofta så här:
           source ~/.bashrc
       Punkt (.) är en kortare variant: . ~/.bashrc`, true);

const dot = { ...source, name: '.' };

const trueCmd = simple('true', 'Gör ingenting, lyckas alltid', () => 0);
const falseCmd = simple('false', 'Gör ingenting, misslyckas alltid', () => 1);
const sleep = simple('sleep', 'Väntar en stund', () => 0, `NAMN
       sleep - vänta ett antal sekunder

BESKRIVNING
       I simulatorn returnerar sleep direkt.`);

const seq = simple('seq', 'Skriver ut en talföljd', (ctx) => {
  const n = ctx.args.map(Number);
  if (!n.length || n.some(Number.isNaN)) return badOption(ctx, 'missing operand');
  const [first, inc, last] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : n;
  if (inc === 0) return 1;
  for (let i = first, c = 0; inc > 0 ? i <= last : i >= last; i += inc, c++) {
    if (c > 10_000) break;
    ctx.out(i + '\n');
  }
  return 0;
}, `NAMN
       seq - skriv ut en talföljd

SYNOPSIS
       seq SISTA
       seq FÖRSTA SISTA
       seq FÖRSTA STEG SISTA`);

const basenameCmd = simple('basename', 'Tar bort katalogdelen från en sökväg', (ctx) => {
  if (!ctx.args.length) return badOption(ctx, 'missing operand');
  let b = basename(ctx.args[0]);
  if (ctx.args[1] && b.endsWith(ctx.args[1]) && b !== ctx.args[1]) b = b.slice(0, -ctx.args[1].length);
  ctx.out(b + '\n');
  return 0;
});

const dirnameCmd = simple('dirname', 'Tar bort filnamnet från en sökväg', (ctx) => {
  if (!ctx.args.length) return badOption(ctx, 'missing operand');
  const p = ctx.args[0];
  ctx.out((p.includes('/') ? (p.startsWith('/') ? dirname(p) : dirname('/' + p).slice(1) || '.') : '.') + '\n');
  return 0;
});

export const SYSTEM_COMMANDS: CommandDef[] = [
  whoami, id, groups, hostname, uname, date, envCmd('env'), envCmd('printenv'), exportCmd, unset, alias, unalias,
  history, type, which, man, help, clear, exit, logout, sudo, su, bash, { ...bash, name: 'sh' }, source, dot,
  trueCmd, falseCmd, sleep, seq, basenameCmd, dirnameCmd,
];
