// Program som inte är förinstallerade, utan installeras med pakethanteraren:
// tree, htop, fastfetch, cowsay, git, curl, wget, python3, vim, nano, ssh.

import type { CmdCtx, CommandDef } from '../types';
import { hasPerm, type FsNode } from '../vfs';
import { badOption, colorName, COLOR, fsMessage, parseOpts } from './util';
import { isInstalled, PACKAGES } from '../packages';
import { currentProcs } from './procs';

const note = (ctx: CmdCtx, text: string) => ctx.out(`${COLOR.dim}${text}${COLOR.reset}\n`);

const tree: CommandDef = {
  name: 'tree',
  summary: 'Visar kataloger som ett träd',
  man: `NAMN
       tree - visa innehållet i kataloger som ett träd

SYNOPSIS
       tree [-a] [-d] [-L NIVÅ] [KATALOG]

FLAGGOR
       -a       visa även dolda filer
       -d       visa bara kataloger
       -L NIVÅ  gå högst NIVÅ nivåer ner`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'ad', values: 'L' });
    if (o.error) return badOption(ctx, o.error);
    const sh = ctx.sh;
    const user = sh.currentUser();
    const maxLevel = o.values.L ? Number(o.values.L) : Infinity;
    let dirs = 0;
    let files = 0;
    const walk = (node: FsNode, prefix: string, level: number) => {
      if (level > maxLevel) return;
      if (!hasPerm(node, user, 'r')) return;
      const names = Object.keys(node.children!)
        .filter((n) => o.flags.has('a') || !n.startsWith('.'))
        .filter((n) => !o.flags.has('d') || node.children![n].type === 'dir')
        .sort((a, b) => a.localeCompare(b));
      names.forEach((n, i) => {
        const child = node.children![n];
        const last = i === names.length - 1;
        ctx.out(`${prefix}${last ? '└── ' : '├── '}${colorName(n, child, ctx.isTTY)}\n`);
        if (child.type === 'dir') {
          dirs++;
          walk(child, prefix + (last ? '    ' : '│   '), level + 1);
        } else {
          files++;
        }
      });
    };
    const target = o.operands[0] ?? '.';
    try {
      const node = sh.vfs.lookup(sh.resolve(target), user);
      if (node.type !== 'dir') {
        ctx.out(`${target}  [error opening dir]\n\n0 directories, 0 files\n`);
        return 2;
      }
      ctx.out(colorName(target, node, ctx.isTTY) + '\n');
      walk(node, '', 1);
    } catch (e) {
      ctx.out(`${target}  [error opening dir: ${fsMessage(e)}]\n`);
      return 2;
    }
    ctx.out(`\n${dirs} director${dirs === 1 ? 'y' : 'ies'}${o.flags.has('d') ? '' : `, ${files} file${files === 1 ? '' : 's'}`}\n`);
    return 0;
  },
};

const htop: CommandDef = {
  name: 'htop',
  summary: 'Visar processer och resursanvändning',
  man: `NAMN
       htop - interaktiv processvisare

BESKRIVNING
       Visar CPU, minne och alla processer som körs. I en riktig terminal
       sorterar du med F6, söker med F3, avslutar processer med F9 och
       stänger htop med q eller F10. I simulatorn visas en ögonblicksbild.`,
  run(ctx) {
    const procs = currentProcs(ctx, 'htop').sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);
    const load = procs.reduce((sum, p) => sum + p.cpu, 0);
    const bar = (pct: number) => `[${COLOR.green}${'|'.repeat(Math.round(Math.min(pct, 100) / 4)).padEnd(25)}${COLOR.reset}${pct.toFixed(1).padStart(5)}%]`;
    const mb = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)}M` : `${kb}K`);
    ctx.out(
      `    0${bar(Math.min(100, load))}   Tasks: ${procs.length}, 1 running\n` +
        `    1${bar(3.2)}   Load average: ${(load / 100).toFixed(2)} ${((load / 100) * 0.9).toFixed(2)} ${((load / 100) * 0.8).toFixed(2)}\n` +
        `  Mem[${COLOR.green}||||||||||||             ${COLOR.reset}1.84G/7.70G]   Uptime: 02:14:07\n` +
        `  Swp[                             0K/2.00G]\n\n` +
        `\x1b[30;42m    PID USER       PRI  NI  VIRT   RES S CPU% MEM%   TIME+  Command              ${COLOR.reset}\n`,
    );
    for (const p of procs) {
      ctx.out(
        `${String(p.pid).padStart(7)} ${p.user.slice(0, 9).padEnd(10)} 20   0 ${mb(p.vsz).padStart(5)} ${mb(p.rss).padStart(5)} ${p.stat[0]} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${(p.time + '.00').padStart(8)} ${p.cmd}\n`,
      );
    }
    ctx.out(`\nF1Help  F2Setup  F3Search  F4Filter  F5Tree  F6SortBy  F7Nice-  F8Nice+  F9Kill  F10Quit\n`);
    note(
      ctx,
      ctx.sh.msg({
        sv: '(Simulerad ögonblicksbild. I en riktig terminal är htop interaktivt – avsluta med q.)',
        en: '(Simulated snapshot. In a real terminal htop is interactive – quit with q.)',
      }),
    );
    return 0;
  },
};

const LOGOS: Record<string, string[]> = {
  ubuntu: [
    '            .-/+oossssoo+/-.     ',
    '        `:+ssssssssssssssssss+:` ',
    '      -+ssssssssssssssssssyyssss+-',
    '    .ossssssssssssssssssdMMMNysssso.',
    '   /ssssssssssshdmmNNmmyNMMMMhssssss/',
    '  +ssssssssshmydMMMMMMMNddddyssssssss+',
    ' /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/',
    ' +sssshhhyNMMNyssssssssssssyNMMMysssssss+',
  ],
  debian: [
    '       _,met$$$$$gg.       ',
    '    ,g$$$$$$$$$$$$$$$P.    ',
    '  ,g$$P"     """Y$$.".     ',
    " ,$$P'              `$$$.  ",
    "',$$P       ,ggs.     `$$b:",
    "`d$$'     ,$P\"'   .    $$$ ",
    " $$P      d$'     ,    $$P ",
    ' $$:      $$.   -    ,d$$\' ',
  ],
  arch: [
    '                  -`                ',
    '                 .o+`               ',
    '                `ooo/               ',
    '               `+oooo:              ',
    '              `+oooooo:             ',
    '              -+oooooo+:            ',
    '            `/:-:++oooo+:           ',
    '           `/++++/+++++++:          ',
  ],
  fedora: [
    '             .\',;::::;,\'.          ',
    "         .';:cccccccccccc:;,.      ",
    "      .;cccccccccccccccccccccc;.   ",
    "    .:cccccccccccccccccccccccccc:. ",
    "  .;ccccccccccccc;.:dddl:.;ccccccc;.",
    " .:ccccccccccccc;OWMKOOXMWd;ccccccc:.",
    ".:ccccccccccccc;KMMc;cc;xMMc;ccccccc:.",
    ",cccccccccccccc;MMM.;cc;;WW:;cccccccc,",
  ],
};

const fastfetch: CommandDef = {
  name: 'fastfetch',
  summary: 'Visar systeminformation med distro-logga',
  man: `NAMN
       fastfetch - visa systeminformation tillsammans med distributionens logga

BESKRIVNING
       En snabb efterföljare till neofetch. Populär i skärmdumpar!`,
  run(ctx) {
    const sh = ctx.sh;
    const d = sh.distro;
    const u = sh.currentUser().name;
    const count = PACKAGES.filter((p) => isInstalled(sh, p)).length;
    const pm = d.family === 'debian' ? 'dpkg' : d.family === 'arch' ? 'pacman' : 'rpm';
    const info = [
      `${COLOR.bold}${u}@${d.hostname}${COLOR.reset}`,
      '-'.repeat(u.length + d.hostname.length + 1),
      `OS: ${d.name} x86_64`,
      `Kernel: Linux ${d.kernel}`,
      `Uptime: 2 hours, 14 mins`,
      `Packages: ${count + 600} (${pm})`,
      `Shell: bash 5.2`,
      `Terminal: LinuxLearningTool`,
    ];
    const logo = LOGOS[d.id] ?? LOGOS.debian;
    const width = Math.max(...logo.map((l) => l.length));
    const color = `\x1b[1;3${d.family === 'arch' ? '6' : d.family === 'redhat' ? '4' : '1'}m`;
    for (let i = 0; i < Math.max(logo.length, info.length); i++) {
      ctx.out(`${color}${(logo[i] ?? '').padEnd(width)}${COLOR.reset}  ${info[i] ?? ''}\n`);
    }
    return 0;
  },
};

const cowsay: CommandDef = {
  name: 'cowsay',
  summary: 'En ko som säger något',
  man: `NAMN
       cowsay - en pratande ko

EXEMPEL
       cowsay Hej!
       fortune | cowsay`,
  run(ctx) {
    const text = (ctx.args.length ? ctx.args.join(' ') : (ctx.stdin ?? '').trim()) || 'Muu!';
    const lines = text.split('\n');
    const w = Math.max(...lines.map((l) => [...l].length));
    const pad = (l: string) => l + ' '.repeat(w - [...l].length);
    let bubble = ` ${'_'.repeat(w + 2)}\n`;
    if (lines.length === 1) bubble += `< ${pad(lines[0])} >\n`;
    else
      lines.forEach((l, i) => {
        const [a, b] = i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
        bubble += `${a} ${pad(l)} ${b}\n`;
      });
    bubble += ` ${'-'.repeat(w + 2)}\n`;
    ctx.out(bubble + '        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n');
    return 0;
  },
};

const git: CommandDef = {
  name: 'git',
  summary: 'Versionshantering',
  man: `NAMN
       git - distribuerad versionshantering

BESKRIVNING
       git kommer att få ett eget kapitel. I simulatorn stöds än så länge
       bara "git --version".`,
  run(ctx) {
    if (ctx.args[0] === '--version' || ctx.args[0] === 'version') {
      ctx.out('git version 2.51.1\n');
      return 0;
    }
    if (!ctx.args.length) {
      ctx.out('usage: git [-v | --version] [-h | --help] <command> [<args>]\n');
      return 1;
    }
    note(
      ctx,
      ctx.sh.msg({
        sv: `git ${ctx.args[0]} stöds inte ännu i simulatorn – det kommer i ett eget kapitel om git.`,
        en: `git ${ctx.args[0]} is not supported in the simulator yet – it will get its own chapter about git.`,
      }),
    );
    return 1;
  },
};

function noNetwork(name: string, summary: string): CommandDef {
  return {
    name,
    summary,
    man: `NAMN
       ${name} - ${summary.toLowerCase()}

BESKRIVNING
       Simulatorn har inget nätverk, så ${name} kan inte hämta något.`,
    run(ctx) {
      const url = ctx.args.find((a) => !a.startsWith('-'));
      if (!url) {
        ctx.err(name === 'curl' ? "curl: try 'curl --help' or 'curl --manual' for more information\n" : 'wget: missing URL\n');
        return 2;
      }
      const host = url.replace(/^\w+:\/\//, '').split('/')[0];
      if (name === 'curl') ctx.err(`curl: (6) Could not resolve host: ${host}\n`);
      else ctx.err(`--2026-10-29 12:00:00--  ${url}\nResolving ${host} (${host})... failed: Name or service not known.\nwget: unable to resolve host address '${host}'\n`);
      note(ctx, ctx.sh.msg({ sv: '(Simulatorn har inget nätverk.)', en: '(The simulator has no network.)' }));
      return name === 'curl' ? 6 : 4;
    },
  };
}

const python3: CommandDef = {
  name: 'python3',
  summary: 'Programspråket Python',
  man: `NAMN
       python3 - tolk för programspråket Python

BESKRIVNING
       I simulatorn stöds "python3 --version". Ett interaktivt Python-läge
       finns inte ännu.`,
  run(ctx) {
    const v = ctx.sh.installed.python?.split('-')[0] ?? '3.12.3';
    if (ctx.args[0] === '--version' || ctx.args[0] === '-V') {
      ctx.out(`Python ${v}\n`);
      return 0;
    }
    note(
      ctx,
      ctx.sh.msg({
        sv: `Python ${v} – det interaktiva läget stöds inte i simulatorn ännu.`,
        en: `Python ${v} – interactive mode is not supported in the simulator yet.`,
      }),
    );
    return 0;
  },
};

function editor(name: string, summary: string, man: string): CommandDef {
  return {
    name,
    summary,
    man,
    run(ctx) {
      note(
        ctx,
        ctx.sh.msg({
          sv:
            `${name} är en interaktiv texteditor och stöds inte i simulatorn ännu.\n` +
            `Skapa filer med t.ex.  echo 'text' > fil.txt  eller  echo 'mer text' >> fil.txt`,
          en:
            `${name} is an interactive text editor and is not supported in the simulator yet.\n` +
            `Create files with e.g.  echo 'text' > file.txt  or  echo 'more text' >> file.txt`,
        }),
      );
      return 0;
    },
  };
}

const ssh: CommandDef = {
  name: 'ssh',
  summary: 'Loggar in på en annan dator säkert',
  man: `NAMN
       ssh - logga in på en annan dator via SSH (Secure Shell)

SYNOPSIS
       ssh ANVÄNDARE@VÄRD

BESKRIVNING
       Simulatorn har inget nätverk, så ssh kan inte ansluta någonstans.`,
  run(ctx) {
    const target = ctx.args.find((a) => !a.startsWith('-'));
    if (!target) {
      ctx.err('usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-p port] destination [command [argument ...]]\n');
      return 255;
    }
    ctx.err(`ssh: Could not resolve hostname ${target.split('@').pop()}: Name or service not known\n`);
    note(ctx, ctx.sh.msg({ sv: '(Simulatorn har inget nätverk.)', en: '(The simulator has no network.)' }));
    return 255;
  },
};

export const EXTRA_COMMANDS: CommandDef[] = [
  tree,
  htop,
  fastfetch,
  cowsay,
  git,
  noNetwork('curl', 'Överför data från eller till en server'),
  noNetwork('wget', 'Laddar ner filer från webben'),
  python3,
  editor('vim', 'Kraftfull texteditor', `NAMN
       vim - Vi IMproved, en kraftfull texteditor

BESKRIVNING
       vim har lägen: tryck i för att skriva, Esc för att gå tillbaka,
       :w för att spara och :q för att avsluta (:q! utan att spara).`),
  editor('nano', 'Enkel texteditor', `NAMN
       nano - en enkel texteditor

BESKRIVNING
       Kommandona visas längst ner: ^O betyder Ctrl+O (spara) och ^X
       betyder Ctrl+X (avsluta).`),
  ssh,
];
