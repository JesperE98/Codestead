// Kommandon för att navigera och hantera filer: cd, pwd, ls, mkdir, touch, rm, cp, mv, find, chmod, chown.

import { globToRegex } from '../parser';
import type { CmdCtx, CommandDef } from '../types';
import { basename, cloneNode, FsError, hasPerm, nodeSize, type FsNode, type User } from '../vfs';
import { badOption, colorName, fsMessage, humanSize, lsDate, modeString, parseOpts } from './util';
import { groupExists, userExists } from '../users';

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`;
}

function lsCompare(a: string, b: string): number {
  const ka = a.replace(/^\.+/, '').toLowerCase();
  const kb = b.replace(/^\.+/, '').toLowerCase();
  return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

const cd: CommandDef = {
  name: 'cd',
  builtin: true,
  summary: 'Byter aktuell katalog',
  man: `NAMN
       cd - byt katalog (change directory)

SYNOPSIS
       cd [KATALOG]

BESKRIVNING
       Gör KATALOG till den aktuella katalogen. Utan argument går du till
       din hemkatalog ($HOME).

       cd ..     gå upp en nivå
       cd ~      gå till hemkatalogen
       cd -      gå tillbaka till föregående katalog
       cd /      gå till rotkatalogen`,
  run(ctx) {
    const sh = ctx.sh;
    if (ctx.args.length > 1) {
      ctx.err('bash: cd: too many arguments\n');
      return 1;
    }
    let target = ctx.args[0] ?? sh.home;
    if (target === '-') {
      if (!sh.env.OLDPWD) {
        ctx.err('bash: cd: OLDPWD not set\n');
        return 1;
      }
      target = sh.env.OLDPWD;
      ctx.out(target + '\n');
    }
    if (target === '') return 0;
    const path = sh.resolve(target);
    const user = sh.currentUser();
    try {
      const node = sh.vfs.lookup(path, user);
      if (node.type !== 'dir') throw new FsError('ENOTDIR');
      if (!hasPerm(node, user, 'x')) throw new FsError('EACCES');
    } catch (e) {
      ctx.err(`bash: cd: ${target}: ${fsMessage(e)}\n`);
      return 1;
    }
    sh.env.OLDPWD = sh.cwd;
    sh.cwd = path;
    sh.env.PWD = path;
    return 0;
  },
};

const pwd: CommandDef = {
  name: 'pwd',
  builtin: true,
  summary: 'Skriver ut aktuell katalog',
  man: `NAMN
       pwd - skriv ut namnet på aktuell katalog (print working directory)

SYNOPSIS
       pwd

BESKRIVNING
       Skriver ut den absoluta sökvägen till katalogen du står i.`,
  run(ctx) {
    ctx.out(ctx.sh.cwd + '\n');
    return 0;
  },
};

interface Entry {
  name: string;
  node: FsNode;
}

const ls: CommandDef = {
  name: 'ls',
  summary: 'Listar innehållet i kataloger',
  man: `NAMN
       ls - lista innehållet i kataloger

SYNOPSIS
       ls [FLAGGA]... [FIL]...

BESKRIVNING
       Listar filer och kataloger. Utan argument listas aktuell katalog.

FLAGGOR
       -a, --all       visa även dolda filer (namn som börjar med .)
       -A              som -a, men utan . och ..
       -l              långt format: rättigheter, ägare, storlek, datum
       -h              läsbara storlekar (1K, 4.0M) tillsammans med -l
       -d              lista katalogen själv, inte dess innehåll
       -F              lägg till / efter kataloger och * efter körbara filer
       -1              en fil per rad

EXEMPEL
       ls -la ~        allt i hemkatalogen, i långt format`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'laAh1dF',
      long: { all: 'a', 'almost-all': 'A', 'human-readable': 'h', directory: 'd', classify: 'F' },
    });
    if (o.error) return badOption(ctx, o.error, 2);
    const sh = ctx.sh;
    const user = sh.currentUser();
    const long = o.flags.has('l');
    const targets = o.operands.length ? o.operands : ['.'];
    let code = 0;

    const files: Entry[] = [];
    const dirs: { label: string; path: string; node: FsNode }[] = [];
    for (const t of targets) {
      try {
        const path = sh.resolve(t);
        const node = sh.vfs.lookup(path, user);
        if (node.type === 'dir' && !o.flags.has('d')) dirs.push({ label: t, path, node });
        else files.push({ name: t, node });
      } catch (e) {
        ctx.err(`ls: cannot access '${t}': ${fsMessage(e)}\n`);
        code = 2;
      }
    }

    const suffix = (n: FsNode) => (!o.flags.has('F') ? '' : n.type === 'dir' ? '/' : n.mode & 0o111 ? '*' : '');
    const display = (e: Entry) => colorName(e.name, e.node, ctx.isTTY) + suffix(e.node);
    const size = (n: FsNode) => (o.flags.has('h') ? humanSize(nodeSize(n)) : String(nodeSize(n)));
    const links = (n: FsNode) =>
      n.type === 'dir' ? 2 + Object.values(n.children ?? {}).filter((c) => c.type === 'dir').length : 1;

    const render = (entries: Entry[], showTotal: boolean) => {
      if (long) {
        if (showTotal) {
          const blocks = entries.reduce((sum, e) => sum + Math.ceil(nodeSize(e.node) / 4096) * 4, 0);
          ctx.out(`total ${blocks}\n`);
        }
        const w = {
          links: Math.max(...entries.map((e) => String(links(e.node)).length), 1),
          owner: Math.max(...entries.map((e) => e.node.owner.length), 1),
          group: Math.max(...entries.map((e) => e.node.group.length), 1),
          size: Math.max(...entries.map((e) => size(e.node).length), 1),
        };
        for (const e of entries) {
          ctx.out(
            `${modeString(e.node)} ${String(links(e.node)).padStart(w.links)} ${e.node.owner.padEnd(w.owner)} ` +
              `${e.node.group.padEnd(w.group)} ${size(e.node).padStart(w.size)} ${lsDate(e.node.mtime)} ${display(e)}\n`,
          );
        }
      } else if (entries.length) {
        if (ctx.isTTY && !o.flags.has('1')) ctx.out(entries.map(display).join('  ') + '\n');
        else entries.forEach((e) => ctx.out(display(e) + '\n'));
      }
    };

    render(files, false);
    dirs.forEach((d, idx) => {
      if (targets.length > 1) ctx.out(`${files.length || idx > 0 ? '\n' : ''}${d.label}:\n`);
      if (!hasPerm(d.node, user, 'r')) {
        ctx.err(`ls: cannot open directory '${d.label}': Permission denied\n`);
        code = 2;
        return;
      }
      let names = Object.keys(d.node.children!);
      if (!o.flags.has('a') && !o.flags.has('A')) names = names.filter((n) => !n.startsWith('.'));
      names.sort(lsCompare);
      const entries: Entry[] = names.map((n) => ({ name: n, node: d.node.children![n] }));
      if (o.flags.has('a')) {
        const parent = sh.vfs.tryLookup(sh.resolve(d.path + '/..'), user) ?? d.node;
        entries.unshift({ name: '.', node: d.node }, { name: '..', node: parent });
      }
      render(entries, true);
    });
    return code;
  },
};

const mkdir: CommandDef = {
  name: 'mkdir',
  summary: 'Skapar kataloger',
  man: `NAMN
       mkdir - skapa kataloger (make directory)

SYNOPSIS
       mkdir [FLAGGA]... KATALOG...

FLAGGOR
       -p, --parents   skapa även föräldrakataloger som saknas, och ge
                       inget fel om katalogen redan finns
       -v, --verbose   berätta om varje katalog som skapas

EXEMPEL
       mkdir -p projekt/src/test`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'pv', long: { parents: 'p', verbose: 'v' } });
    if (o.error) return badOption(ctx, o.error);
    if (!o.operands.length) return badOption(ctx, 'missing operand');
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of o.operands) {
      const path = sh.resolve(t);
      try {
        if (o.flags.has('p')) {
          const segs = path.split('/').filter(Boolean);
          let cur = '';
          for (const seg of segs) {
            cur += '/' + seg;
            const existing = sh.vfs.tryLookup(cur, user);
            if (existing) {
              if (existing.type !== 'dir') throw new FsError('ENOTDIR');
              continue;
            }
            sh.vfs.mkdir(cur, user);
            if (o.flags.has('v')) ctx.out(`mkdir: created directory '${cur}'\n`);
          }
        } else {
          sh.vfs.mkdir(path, user);
          if (o.flags.has('v')) ctx.out(`mkdir: created directory '${t}'\n`);
        }
      } catch (e) {
        ctx.err(`mkdir: cannot create directory '${t}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

const rmdir: CommandDef = {
  name: 'rmdir',
  summary: 'Tar bort tomma kataloger',
  man: `NAMN
       rmdir - ta bort tomma kataloger

SYNOPSIS
       rmdir KATALOG...

BESKRIVNING
       Tar bort katalogen bara om den är tom. Använd rm -r för att ta bort
       en katalog med innehåll.`,
  run(ctx) {
    if (!ctx.args.length) return badOption(ctx, 'missing operand');
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of ctx.args) {
      try {
        const path = sh.resolve(t);
        const node = sh.vfs.lookup(path, user);
        if (node.type !== 'dir') throw new FsError('ENOTDIR');
        if (Object.keys(node.children!).length) throw new FsError('ENOTEMPTY');
        sh.vfs.remove(path, user);
      } catch (e) {
        ctx.err(`rmdir: failed to remove '${t}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

const touch: CommandDef = {
  name: 'touch',
  summary: 'Skapar tomma filer eller uppdaterar tidsstämpeln',
  man: `NAMN
       touch - ändra tidsstämpel på filer, eller skapa tomma filer

SYNOPSIS
       touch FIL...

BESKRIVNING
       Om FIL inte finns skapas en tom fil. Om den finns uppdateras dess
       ändringstid till nu.`,
  run(ctx) {
    if (!ctx.args.length) {
      ctx.err(`touch: missing file operand\nTry 'touch --help' for more information.\n`);
      return 1;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of ctx.args) {
      const path = sh.resolve(t);
      try {
        const node = sh.vfs.tryLookup(path, user);
        if (node) {
          if (!hasPerm(node, user, 'w') && node.owner !== user.name && user.uid !== 0) throw new FsError('EACCES');
          node.mtime = Date.now();
        } else {
          sh.vfs.writeFile(path, '', user);
        }
      } catch (e) {
        ctx.err(`touch: cannot touch '${t}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

const rm: CommandDef = {
  name: 'rm',
  summary: 'Tar bort filer och kataloger',
  man: `NAMN
       rm - ta bort filer eller kataloger (remove)

SYNOPSIS
       rm [FLAGGA]... FIL...

BESKRIVNING
       Tar bort filer. Det finns ingen papperskorg – det som tas bort är borta!

FLAGGOR
       -r, -R, --recursive   ta bort kataloger och allt innehåll
       -f, --force           ignorera filer som inte finns, fråga aldrig
       -v, --verbose         berätta vad som tas bort

VARNING
       rm -rf är kraftfullt. Dubbelkolla alltid sökvägen innan du trycker Enter.`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'rRfiv',
      long: { recursive: 'r', force: 'f', verbose: 'v', 'no-preserve-root': 'P' },
    });
    if (o.error) return badOption(ctx, o.error);
    const force = o.flags.has('f');
    const recursive = o.flags.has('r') || o.flags.has('R');
    if (!o.operands.length) {
      if (force) return 0;
      return badOption(ctx, 'missing operand');
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of o.operands) {
      const path = sh.resolve(t);
      const base = basename(t);
      if (base === '.' || base === '..') {
        ctx.err(`rm: refusing to remove '.' or '..' directory: skipping '${t}'\n`);
        code = 1;
        continue;
      }
      if (path === '/') {
        if (!recursive) {
          ctx.err(`rm: cannot remove '/': Is a directory\n`);
          code = 1;
          continue;
        }
        if (!o.flags.has('P')) {
          ctx.err(`rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n`);
          code = 1;
          continue;
        }
        if (user.uid !== 0) {
          ctx.err(`rm: cannot remove '/': Permission denied\n`);
          code = 1;
          continue;
        }
        sh.vfs.root.children = {};
        continue;
      }
      try {
        const node = sh.vfs.lookup(path, user);
        if (node.type === 'dir' && !recursive) throw new FsError('EISDIR');
        sh.vfs.remove(path, user);
        if (o.flags.has('v')) ctx.out(node.type === 'dir' ? `removed directory '${t}'\n` : `removed '${t}'\n`);
      } catch (e) {
        if (force && e instanceof FsError && e.code === 'ENOENT') continue;
        ctx.err(`rm: cannot remove '${t}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

function chownTree(node: FsNode, user: User): void {
  node.owner = user.name;
  node.group = user.groups[0];
  node.mtime = Date.now();
  for (const c of Object.values(node.children ?? {})) chownTree(c, user);
}

/** Gemensam logik för cp och mv. */
function copyOrMove(ctx: CmdCtx, move: boolean): number {
  const o = parseOpts(ctx.args, {
    flags: move ? 'fivn' : 'rRfivan',
    long: { recursive: 'r', force: 'f', verbose: 'v', archive: 'a', interactive: 'i' },
  });
  if (o.error) return badOption(ctx, o.error);
  const name = ctx.name;
  const ops = [...o.operands];
  if (ops.length === 0) return badOption(ctx, 'missing file operand');
  if (ops.length === 1) return badOption(ctx, `missing destination file operand after '${ops[0]}'`);
  const sh = ctx.sh;
  const user = sh.currentUser();
  const dest = ops.pop()!;
  const destPath = sh.resolve(dest);
  const destNode = sh.vfs.tryLookup(destPath, user);
  if (ops.length > 1 && destNode?.type !== 'dir') {
    ctx.err(`${name}: target '${dest}' is not a directory\n`);
    return 1;
  }
  const recursive = move || o.flags.has('r') || o.flags.has('R') || o.flags.has('a');
  let code = 0;
  for (const src of ops) {
    const srcPath = sh.resolve(src);
    let node: FsNode;
    try {
      node = sh.vfs.lookup(srcPath, user);
    } catch (e) {
      ctx.err(`${name}: cannot stat '${src}': ${fsMessage(e)}\n`);
      code = 1;
      continue;
    }
    if (node.type === 'dir' && !recursive) {
      ctx.err(`cp: -r not specified; omitting directory '${src}'\n`);
      code = 1;
      continue;
    }
    const target = destNode?.type === 'dir' ? joinPath(destPath, basename(srcPath)) : destPath;
    const targetLabel = destNode?.type === 'dir' ? joinPath(dest.replace(/\/+$/, '') || '/', basename(srcPath)) : dest;
    if (target === srcPath) {
      ctx.err(`${name}: '${src}' and '${targetLabel}' are the same file\n`);
      code = 1;
      continue;
    }
    if (node.type === 'dir' && target.startsWith(srcPath + '/')) {
      ctx.err(
        move
          ? `mv: cannot move '${src}' to a subdirectory of itself, '${targetLabel}'\n`
          : `cp: cannot copy a directory, '${src}', into itself, '${targetLabel}'\n`,
      );
      code = 1;
      continue;
    }
    const existing = sh.vfs.tryLookup(target, user);
    if (existing?.type === 'dir' && node.type !== 'dir') {
      ctx.err(`${name}: cannot overwrite directory '${targetLabel}' with non-directory\n`);
      code = 1;
      continue;
    }
    try {
      if (move) {
        const { dir } = sh.vfs.parent(srcPath, user);
        if (!hasPerm(dir, user, 'w')) throw new FsError('EACCES');
        sh.vfs.insert(target, node, user);
        delete dir.children![basename(srcPath)];
      } else {
        if (node.type === 'file' && !hasPerm(node, user, 'r')) {
          ctx.err(`cp: cannot open '${src}' for reading: Permission denied\n`);
          code = 1;
          continue;
        }
        if (existing?.type === 'file') {
          if (!hasPerm(existing, user, 'w')) throw new FsError('EACCES');
          existing.content = node.content;
          existing.size = node.size;
          existing.mtime = Date.now();
        } else {
          const copy = cloneNode(node);
          if (!o.flags.has('a')) chownTree(copy, user);
          sh.vfs.insert(target, copy, user);
        }
      }
      if (o.flags.has('v')) ctx.out(move ? `renamed '${src}' -> '${targetLabel}'\n` : `'${src}' -> '${targetLabel}'\n`);
    } catch (e) {
      const msg = fsMessage(e);
      ctx.err(
        move
          ? `mv: cannot move '${src}' to '${targetLabel}': ${msg}\n`
          : `cp: cannot create ${node.type === 'dir' ? 'directory' : 'regular file'} '${targetLabel}': ${msg}\n`,
      );
      code = 1;
    }
  }
  return code;
}

const cp: CommandDef = {
  name: 'cp',
  summary: 'Kopierar filer och kataloger',
  man: `NAMN
       cp - kopiera filer och kataloger (copy)

SYNOPSIS
       cp [FLAGGA]... KÄLLA MÅL
       cp [FLAGGA]... KÄLLA... KATALOG

FLAGGOR
       -r, -R, --recursive   kopiera kataloger med allt innehåll
       -a, --archive         som -r, men behåll ägare och rättigheter
       -v, --verbose         berätta vad som kopieras

EXEMPEL
       cp rapport.txt rapport-kopia.txt
       cp -r projekt/ backup/`,
  run: (ctx) => copyOrMove(ctx, false),
};

const mv: CommandDef = {
  name: 'mv',
  summary: 'Flyttar eller byter namn på filer',
  man: `NAMN
       mv - flytta eller byt namn på filer (move)

SYNOPSIS
       mv [FLAGGA]... KÄLLA MÅL
       mv [FLAGGA]... KÄLLA... KATALOG

BESKRIVNING
       Om MÅL är en befintlig katalog flyttas KÄLLA dit. Annars byter
       KÄLLA namn till MÅL. Kataloger kan flyttas utan -r.

FLAGGOR
       -v, --verbose   berätta vad som flyttas`,
  run: (ctx) => copyOrMove(ctx, true),
};

const find: CommandDef = {
  name: 'find',
  summary: 'Söker efter filer i en katalogstruktur',
  man: `NAMN
       find - sök efter filer i en katalogstruktur

SYNOPSIS
       find [SÖKVÄG...] [UTTRYCK]

UTTRYCK
       -name MÖNSTER     filnamnet matchar MÖNSTER (t.ex. "*.txt")
       -iname MÖNSTER    som -name men skiftlägesokänsligt
       -type f|d         bara filer (f) eller kataloger (d)
       -maxdepth N       gå högst N nivåer ner
       -mindepth N       visa inget på nivåer grundare än N

EXEMPEL
       find ~ -name "*.txt"
       find /etc -maxdepth 1 -type d

TIPS
       Sätt mönstret inom citattecken, annars expanderar skalet * innan
       find ens får se det.`,
  run(ctx) {
    const sh = ctx.sh;
    const user = sh.currentUser();
    const args = [...ctx.args];
    const paths: string[] = [];
    while (args.length && !args[0].startsWith('-')) paths.push(args.shift()!);
    if (!paths.length) paths.push('.');
    const tests: ((name: string, node: FsNode) => boolean)[] = [];
    let maxDepth = Infinity;
    let minDepth = 0;
    while (args.length) {
      const a = args.shift()!;
      const v = args.shift();
      if (v === undefined && a !== '-print') {
        ctx.err(`find: missing argument to \`${a}'\n`);
        return 1;
      }
      switch (a) {
        case '-name':
        case '-iname': {
          const re = globToRegex(v!);
          const rx = a === '-iname' ? new RegExp(re.source, 'i') : re;
          tests.push((name) => rx.test(name));
          break;
        }
        case '-type':
          if (v !== 'f' && v !== 'd') {
            ctx.err(`find: Unknown argument to -type: ${v}\n`);
            return 1;
          }
          tests.push((_n, node) => (v === 'f' ? node.type === 'file' : node.type === 'dir'));
          break;
        case '-maxdepth':
          maxDepth = Number(v);
          break;
        case '-mindepth':
          minDepth = Number(v);
          break;
        case '-print':
          if (v !== undefined) args.unshift(v);
          break;
        default:
          ctx.err(`find: unknown predicate \`${a}'\n`);
          return 1;
      }
    }
    let code = 0;
    const walk = (display: string, node: FsNode, depth: number) => {
      const name = basename(display);
      if (depth >= minDepth && tests.every((t) => t(name, node))) ctx.out(display + '\n');
      if (node.type !== 'dir' || depth >= maxDepth) return;
      if (!hasPerm(node, user, 'r') || !hasPerm(node, user, 'x')) {
        ctx.err(`find: '${display}': Permission denied\n`);
        code = 1;
        return;
      }
      for (const child of Object.keys(node.children!).sort()) {
        walk(display.endsWith('/') ? display + child : `${display}/${child}`, node.children![child], depth + 1);
      }
    };
    for (const p of paths) {
      try {
        walk(p, sh.vfs.lookup(sh.resolve(p), user), 0);
      } catch (e) {
        ctx.err(`find: '${p}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

const MODE_RE = /^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*$/;

export function applyMode(current: number, spec: string, isDir: boolean): number | null {
  if (/^[0-7]{1,4}$/.test(spec)) return parseInt(spec, 8);
  if (!MODE_RE.test(spec)) return null;
  let mode = current;
  for (const clause of spec.split(',')) {
    const m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clause)!;
    const who = m[1] || 'a';
    const classes = who.includes('a') ? ['u', 'g', 'o'] : [...new Set(who)];
    let bits = 0;
    let clear = 0;
    for (const c of classes) {
      const shift = c === 'u' ? 6 : c === 'g' ? 3 : 0;
      clear |= 7 << shift;
      for (const p of m[3]) {
        if (p === 'r') bits |= 4 << shift;
        if (p === 'w') bits |= 2 << shift;
        if (p === 'x') bits |= 1 << shift;
        if (p === 'X' && (isDir || current & 0o111)) bits |= 1 << shift;
        if (p === 's' && c === 'u') bits |= 0o4000;
        if (p === 's' && c === 'g') bits |= 0o2000;
        if (p === 't' && c === 'o') bits |= 0o1000;
      }
    }
    if (m[2] === '+') mode |= bits;
    else if (m[2] === '-') mode &= ~bits;
    else mode = (mode & ~clear) | bits;
  }
  return mode;
}

const chmod: CommandDef = {
  name: 'chmod',
  summary: 'Ändrar rättigheter på filer',
  man: `NAMN
       chmod - ändra rättigheter (change mode)

SYNOPSIS
       chmod [-R] LÄGE FIL...

BESKRIVNING
       LÄGE kan anges med siffror eller symboler.

       Siffror (oktalt): en siffra per grupp – ägare, grupp, övriga.
       r = 4, w = 2, x = 1. Lägg ihop dem:
           chmod 755 skript.sh   rwxr-xr-x
           chmod 644 fil.txt     rw-r--r--
           chmod 600 hemligt     rw-------

       Symboler: [ugoa][+-=][rwx]
           u = ägare (user), g = grupp, o = övriga (others), a = alla
           chmod +x skript.sh    gör körbar för alla
           chmod u+x,g-w fil     lägg till x för ägaren, ta bort w för gruppen
           chmod o= fil          ta bort alla rättigheter för övriga

FLAGGOR
       -R    ändra rekursivt i kataloger`,
  run(ctx) {
    const sh = ctx.sh;
    const user = sh.currentUser();
    let recursive = false;
    let mode: string | undefined;
    const files: string[] = [];
    for (const a of ctx.args) {
      if (a === '-R' || a === '--recursive') recursive = true;
      else if (mode === undefined) mode = a;
      else files.push(a);
    }
    if (mode === undefined) return badOption(ctx, 'missing operand');
    if (!files.length) return badOption(ctx, `missing operand after '${mode}'`);
    if (applyMode(0, mode, false) === null) return badOption(ctx, `invalid mode: '${mode}'`);
    let code = 0;
    const apply = (label: string, node: FsNode) => {
      if (user.uid !== 0 && node.owner !== user.name) {
        ctx.err(`chmod: changing permissions of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      node.mode = applyMode(node.mode, mode!, node.type === 'dir')!;
      if (recursive && node.type === 'dir') {
        for (const [n, c] of Object.entries(node.children!)) apply(`${label}/${n}`, c);
      }
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        ctx.err(`chmod: cannot access '${f}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

const chown: CommandDef = {
  name: 'chown',
  summary: 'Byter ägare på filer (kräver root)',
  man: `NAMN
       chown - byt ägare och grupp på filer (change owner)

SYNOPSIS
       chown [-R] ÄGARE[:GRUPP] FIL...

BESKRIVNING
       Bara root kan byta ägare på filer, så du behöver oftast sudo:
           sudo chown elev:elev fil.txt

FLAGGOR
       -R    ändra rekursivt i kataloger`,
  run(ctx) {
    const sh = ctx.sh;
    const user = sh.currentUser();
    let recursive = false;
    let spec: string | undefined;
    const files: string[] = [];
    for (const a of ctx.args) {
      if (a === '-R' || a === '--recursive') recursive = true;
      else if (spec === undefined) spec = a;
      else files.push(a);
    }
    if (spec === undefined) return badOption(ctx, 'missing operand');
    if (!files.length) return badOption(ctx, `missing operand after '${spec}'`);
    const [owner, groupSpec] = spec.split(':');
    // Användare och grupper finns i /etc/passwd och /etc/group. "kim:" betyder kims inloggningsgrupp.
    if (owner && !userExists(sh, owner)) {
      ctx.err(`chown: invalid user: '${spec}'\n`);
      return 1;
    }
    const group = groupSpec === '' && owner ? sh.getUser(owner).groups[0] : groupSpec;
    if (group && !groupExists(sh, group)) {
      ctx.err(`chown: invalid group: '${spec}'\n`);
      return 1;
    }
    let code = 0;
    const apply = (label: string, node: FsNode) => {
      // Vanliga användare får bara byta grupp på sina egna filer, till en grupp de själva är med i.
      const ownGroupChange = (!owner || owner === user.name) && node.owner === user.name && !!group && user.groups.includes(group);
      if (user.uid !== 0 && !ownGroupChange) {
        ctx.err(`chown: changing ownership of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      if (owner) node.owner = owner;
      if (group) node.group = group;
      if (recursive && node.type === 'dir') {
        for (const [n, c] of Object.entries(node.children!)) apply(`${label}/${n}`, c);
      }
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        ctx.err(`chown: cannot access '${f}': ${fsMessage(e)}\n`);
        code = 1;
      }
    }
    return code;
  },
};

export const FS_COMMANDS: CommandDef[] = [cd, pwd, ls, mkdir, rmdir, touch, rm, cp, mv, find, chmod, chown];
