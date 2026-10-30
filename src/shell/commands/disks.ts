// Kommandon för diskar och filsystem: df, lsblk, blkid, mount, umount, findmnt,
// fdisk, swapon, sync och mkfs (mkfs.ext4, mkfs.vfat ...).
// Själva diskmodellen finns i ../disks.ts.

import {
  allBlocks,
  blockSize,
  findBlock,
  lsblkSize,
  mountFor,
  mountsOf,
  mountUsage,
  newUuid,
  partitionUsage,
  SECTOR,
  writeProcMounts,
  type Block,
  type Disk,
  type Mount,
  type Partition,
} from '../disks';
import { STUDENT } from '../initfs';
import type { CmdCtx, CommandDef } from '../types';
import { makeDir, normalizePath, type FsNode } from '../vfs';
import { badOption, COLOR, humanSize, parseOpts } from './util';

const isRoot = (ctx: CmdCtx) => ctx.sh.currentUser().uid === 0;
const tip = (ctx: CmdCtx, text: { sv: string; en: string }) => ctx.err(`${COLOR.dim}${ctx.sh.msg(text)}${COLOR.reset}\n`);

type Align = 'l' | 'r';

/**
 * Skriver en tabell med kolumner. Celler kan ha flera rader (\n), t.ex. när en
 * partition är monterad på flera ställen. Sista kolumnen fylls inte ut.
 */
function table(rows: string[][], align: Align[], minWidths: number[] = []): string {
  const sep = ' ';
  const widths = align.map((_, i) =>
    Math.max(minWidths[i] ?? 0, ...rows.map((r) => Math.max(...(r[i] ?? '').split('\n').map((s) => s.length)))),
  );
  let out = '';
  for (const row of rows) {
    const cells = row.map((c) => (c ?? '').split('\n'));
    const height = Math.max(...cells.map((c) => c.length));
    for (let line = 0; line < height; line++) {
      const parts = align.map((a, i) => {
        const text = cells[i]?.[line] ?? '';
        if (i === align.length - 1 && a === 'l') return text;
        return a === 'r' ? text.padStart(widths[i]) : text.padEnd(widths[i]);
      });
      out += parts.join(sep).trimEnd() + '\n';
    }
  }
  return out;
}

/** Trädgrenar som lsblk och findmnt ritar. */
function branch(isLast: boolean): string {
  return isLast ? '└─' : '├─';
}

function userFromSpec(spec: string): string {
  if (spec === '0' || spec === 'root') return 'root';
  if (spec === '1000' || spec === STUDENT) return STUDENT;
  return spec;
}

function uidOf(name: string): string {
  return name === 'root' ? '0' : name === STUDENT ? '1000' : name;
}

/** Alla värden för en flagga som får upprepas, t.ex. `df -x tmpfs -x devtmpfs`. */
function repeated(args: string[], short: string, long: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') break;
    if (a === `-${short}` || a === `--${long}`) values.push(args[++i] ?? '');
    else if (a.startsWith(`--${long}=`)) values.push(a.slice(long.length + 3));
    else if (a.startsWith(`-${short}`) && !a.startsWith('--')) values.push(a.slice(2));
  }
  return values.flatMap((v) => v.split(',')).filter(Boolean);
}

// ---------- df ----------

const df: CommandDef = {
  name: 'df',
  summary: 'Visar hur mycket plats som finns på filsystemen',
  summaryEn: 'Show free and used space on file systems',
  man: `NAMN
       df - visa ledigt och använt utrymme på filsystemen (disk free)

SYNOPSIS
       df [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storlek, använt och ledigt utrymme för varje monterat
       filsystem. Med FIL visas bara filsystemet som filen ligger på.

       Kolumnen "Mounted on" är monteringspunkten: var i katalogträdet
       filsystemet syns. På ext4 reserveras 5 % åt root, därför blir
       Used + Avail lite mindre än Size.

FLAGGOR
       -h, --human-readable   läsbara storlekar (1.6M, 49G)
       -T, --print-type       visa filsystemets typ (ext4, vfat, tmpfs ...)
       -t, --type=TYP         visa bara filsystem av typen TYP
       -x, --exclude-type=TYP visa inte filsystem av typen TYP
       -a, --all              visa även låtsasfilsystem som proc och sysfs

EXEMPEL
       df -h                  allt, med läsbara storlekar
       df -hT                 med typen
       df -h ~                hur mycket plats finns där hemkatalogen ligger?
       df -h -x tmpfs         bara riktiga diskar`,
  manEn: `NAME
       df - report file system disk space usage (disk free)

SYNOPSIS
       df [OPTION]... [FILE]...

DESCRIPTION
       Shows size, used and available space for every mounted file
       system. With FILE, only the file system that FILE is on is shown.

       The "Mounted on" column is the mount point: where in the directory
       tree the file system appears. ext4 reserves 5 % for root, so
       Used + Avail is a little less than Size.

OPTIONS
       -h, --human-readable   human-readable sizes (1.6M, 49G)
       -T, --print-type       show the file system type (ext4, vfat, tmpfs ...)
       -t, --type=TYPE        only show file systems of type TYPE
       -x, --exclude-type=TYPE  do not show file systems of type TYPE
       -a, --all              also show pseudo file systems such as proc and sysfs

EXAMPLES
       df -h                  everything, human-readable
       df -hT                 with the type
       df -h ~                how much space is there where my home is?
       df -h -x tmpfs         only real disks`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'hTakP',
      values: 'tx',
      long: { 'human-readable': 'h', 'print-type': 'T', all: 'a', type: 't', 'exclude-type': 'x', portability: 'P' },
    });
    if (o.error) return badOption(ctx, o.error);
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    let code = 0;
    let mounts: Mount[] = [];
    if (o.operands.length) {
      for (const op of o.operands) {
        const block = op.startsWith('/dev/') ? findBlock(state, op) : null;
        const byDev = block ? mountsOf(state, block.name)[0] : undefined;
        if (byDev) {
          mounts.push(byDev);
          continue;
        }
        const path = sh.resolve(op);
        if (!sh.vfs.tryLookup(path, root)) {
          ctx.err(`df: ${op}: No such file or directory\n`);
          code = 1;
          continue;
        }
        const m = mountFor(state, path);
        if (m) mounts.push(m);
      }
    } else {
      mounts = state.mounts.filter((m) => o.flags.has('a') || (m.fstype !== 'proc' && m.fstype !== 'sysfs'));
    }
    const only = repeated(ctx.args, 't', 'type');
    const skip = repeated(ctx.args, 'x', 'exclude-type');
    if (only.length) mounts = mounts.filter((m) => only.includes(m.fstype));
    if (skip.length) mounts = mounts.filter((m) => !skip.includes(m.fstype));
    if (!mounts.length) {
      if (code === 0) ctx.err('df: no file systems processed\n');
      return 1;
    }
    const h = o.flags.has('h');
    const T = o.flags.has('T');
    const header = ['Filesystem', ...(T ? ['Type'] : []), h ? 'Size' : '1K-blocks', 'Used', h ? 'Avail' : 'Available', 'Use%', 'Mounted on'];
    const rows = [header];
    for (const m of mounts) {
      const u = mountUsage(sh.vfs, state, m, root);
      const size = Math.floor(u.size / 1024);
      const used = Math.ceil(u.used / 1024);
      const avail = Math.floor(u.avail / 1024);
      const pct = used + avail > 0 ? `${Math.ceil((used * 100) / (used + avail))}%` : '-';
      const fmt = (kb: number) => (h ? humanSize(kb * 1024) : String(kb));
      rows.push([m.source, ...(T ? [m.fstype] : []), fmt(size), fmt(used), fmt(avail), pct, m.target]);
    }
    // Minsta kolumnbredder som i GNU df.
    ctx.out(table(rows, ['l', ...(T ? (['l'] as Align[]) : []), 'r', 'r', 'r', 'r', 'l'], [14, ...(T ? [4] : []), 5, 5, 5, 4]));
    return code;
  },
};

// ---------- lsblk ----------

interface LsblkRow {
  block: Block;
  prefix: string;
}

function lsblkColumns(ctx: CmdCtx): Record<string, { align: Align; get: (r: LsblkRow, full: boolean) => string }> {
  const sh = ctx.sh;
  const state = sh.disks;
  const root = sh.rootUser();
  const mountpoints = (b: Block) => {
    if (b.dev.swapActive) return ['[SWAP]'];
    return mountsOf(state, b.name)
      .map((m) => m.target)
      .reverse();
  };
  const usage = (b: Block) => (mountsOf(state, b.name).length ? partitionUsage(sh.vfs, state, b.dev, b.name, root) : null);
  const minor = (b: Block) => (b.part ? b.disk.minor + b.disk.partitions.indexOf(b.part) + 1 : b.disk.minor);
  return {
    NAME: { align: 'l', get: (r, full) => r.prefix + (full ? r.block.path : r.block.name) },
    KNAME: { align: 'l', get: (r) => r.block.name },
    PATH: { align: 'l', get: (r) => r.block.path },
    'MAJ:MIN': { align: 'l', get: (r) => `${String(r.block.disk.major).padStart(3)}:${String(minor(r.block)).padEnd(3)}` },
    RM: { align: 'r', get: (r) => (r.block.disk.removable ? '1' : '0') },
    SIZE: { align: 'r', get: (r) => lsblkSize(blockSize(r.block.dev)) },
    RO: { align: 'r', get: () => '0' },
    TYPE: { align: 'l', get: (r) => (r.block.part ? 'part' : 'disk') },
    MOUNTPOINT: { align: 'l', get: (r) => mountpoints(r.block)[0] ?? '' },
    MOUNTPOINTS: { align: 'l', get: (r) => mountpoints(r.block).join('\n') },
    FSTYPE: { align: 'l', get: (r) => r.block.dev.fstype ?? '' },
    FSVER: { align: 'l', get: (r) => r.block.dev.fsver ?? '' },
    LABEL: { align: 'l', get: (r) => r.block.dev.label ?? '' },
    UUID: { align: 'l', get: (r) => r.block.dev.uuid ?? '' },
    PARTUUID: { align: 'l', get: (r) => r.block.part?.partuuid ?? '' },
    PTTYPE: { align: 'l', get: (r) => r.block.disk.pttype ?? '' },
    FSSIZE: { align: 'r', get: (r) => { const u = usage(r.block); return u ? lsblkSize(u.size) : ''; } },
    FSUSED: { align: 'r', get: (r) => { const u = usage(r.block); return u ? lsblkSize(u.used) : ''; } },
    FSAVAIL: { align: 'r', get: (r) => { const u = usage(r.block); return u ? lsblkSize(u.avail) : ''; } },
    'FSUSE%': {
      align: 'r',
      get: (r) => {
        const u = usage(r.block);
        return u ? `${u.used + u.avail ? Math.ceil((u.used * 100) / (u.used + u.avail)) : 0}%` : '';
      },
    },
    MODEL: { align: 'l', get: (r) => (r.block.part ? '' : r.block.disk.model) },
    TRAN: { align: 'l', get: (r) => (r.block.part ? '' : r.block.disk.tran) },
    HOTPLUG: { align: 'r', get: (r) => (r.block.disk.removable ? '1' : '0') },
  };
}

const lsblk: CommandDef = {
  name: 'lsblk',
  summary: 'Listar diskar och partitioner (blockenheter)',
  summaryEn: 'List disks and partitions (block devices)',
  man: `NAMN
       lsblk - lista blockenheter: diskar och partitioner

SYNOPSIS
       lsblk [FLAGGA]... [ENHET]...

BESKRIVNING
       Visar diskarna som ett träd, med partitionerna under varje disk.
       RM = 1 betyder en löstagbar enhet (t.ex. en USB-sticka), TYPE är
       disk eller part, och MOUNTPOINTS visar var filsystemet är monterat
       ([SWAP] betyder att partitionen används som swap).

FLAGGOR
       -f, --fs           visa filsystemen: typ, etikett, UUID och ledigt
       -o, --output LISTA välj kolumner, t.ex. NAME,SIZE,FSTYPE,MOUNTPOINTS
                          (+UUID lägger till en kolumn till standardlistan)
       -d, --nodeps       bara diskarna, inte partitionerna
       -p, --paths        visa hela sökvägen (/dev/sda1)
       -l, --list         lista i stället för träd
       -n, --noheadings   ingen rubrikrad

KOLUMNER
       NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
       FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

EXEMPEL
       lsblk
       lsblk -f
       lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
       lsblk /dev/sdb`,
  manEn: `NAME
       lsblk - list block devices: disks and partitions

SYNOPSIS
       lsblk [OPTION]... [DEVICE]...

DESCRIPTION
       Shows the disks as a tree, with the partitions under each disk.
       RM = 1 means a removable device (such as a USB stick), TYPE is
       disk or part, and MOUNTPOINTS shows where the file system is
       mounted ([SWAP] means the partition is used as swap).

OPTIONS
       -f, --fs           show file systems: type, label, UUID and free space
       -o, --output LIST  choose columns, e.g. NAME,SIZE,FSTYPE,MOUNTPOINTS
                          (+UUID adds a column to the default list)
       -d, --nodeps       only the disks, not the partitions
       -p, --paths        print full paths (/dev/sda1)
       -l, --list         list instead of tree
       -n, --noheadings   no header line

COLUMNS
       NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
       FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

EXAMPLES
       lsblk
       lsblk -f
       lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
       lsblk /dev/sdb`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'fdplnab',
      values: 'o',
      long: { fs: 'f', nodeps: 'd', paths: 'p', list: 'l', noheadings: 'n', all: 'a', bytes: 'b', output: 'o' },
    });
    if (o.error) return badOption(ctx, o.error);
    const state = ctx.sh.disks;
    const cols = lsblkColumns(ctx);
    const defaults = o.flags.has('f')
      ? ['NAME', 'FSTYPE', 'FSVER', 'LABEL', 'UUID', 'FSAVAIL', 'FSUSE%', 'MOUNTPOINTS']
      : ['NAME', 'MAJ:MIN', 'RM', 'SIZE', 'RO', 'TYPE', 'MOUNTPOINTS'];
    let names = defaults;
    if (o.values.o !== undefined) {
      const list = o.values.o.replace(/^\+/, '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      names = o.values.o.startsWith('+') ? [...defaults, ...list] : list;
    }
    for (const n of names) {
      if (!cols[n]) {
        ctx.err(`lsblk: unknown column: ${n}\n`);
        return 1;
      }
    }
    let disks: Disk[] = state.disks;
    let onlyPart: Partition | null = null;
    let code = 0;
    if (o.operands.length) {
      disks = [];
      for (const op of o.operands) {
        const b = op.startsWith('/') ? findBlock(state, op) : null;
        if (!b) {
          ctx.err(`lsblk: ${op}: not a block device\n`);
          code = 32;
          continue;
        }
        if (b.part) onlyPart = b.part;
        if (!disks.includes(b.disk)) disks.push(b.disk);
      }
      if (!disks.length) return code;
    }
    const rows: LsblkRow[] = [];
    const tree = !o.flags.has('l');
    for (const disk of disks) {
      if (onlyPart && disk.partitions.includes(onlyPart)) {
        rows.push({ block: allBlocks(state).find((b) => b.part === onlyPart)!, prefix: '' });
        continue;
      }
      rows.push({ block: { path: `/dev/${disk.name}`, name: disk.name, disk, dev: disk }, prefix: '' });
      if (o.flags.has('d')) continue;
      disk.partitions.forEach((p, i) => {
        const prefix = tree ? branch(i === disk.partitions.length - 1) : '';
        rows.push({ block: { path: `/dev/${p.name}`, name: p.name, disk, part: p, dev: p }, prefix });
      });
    }
    const full = o.flags.has('p');
    const table_ = rows.map((r) => names.map((n) => cols[n].get(r, full)));
    if (!o.flags.has('n')) table_.unshift(names);
    ctx.out(table(table_, names.map((n) => cols[n].align)));
    return code;
  },
};

// ---------- blkid ----------

function blkidTags(b: Block): [string, string][] {
  const d = b.dev;
  const tags: [string, string][] = [];
  if (!d.fstype) {
    if (!b.part && b.disk.pttype) {
      tags.push(['PTUUID', b.disk.pttype === 'dos' ? b.disk.diskId!.replace(/^0x/, '') : b.disk.diskId!.toLowerCase()]);
      tags.push(['PTTYPE', b.disk.pttype]);
    }
    return tags;
  }
  if (d.label) tags.push(['LABEL', d.label]);
  if (d.uuid) tags.push(['UUID', d.uuid]);
  if (d.fstype !== 'swap') tags.push(['BLOCK_SIZE', d.fstype === 'vfat' ? '512' : '4096']);
  tags.push(['TYPE', d.fstype]);
  if (b.part) tags.push(['PARTUUID', b.part.partuuid]);
  return tags;
}

const blkid: CommandDef = {
  name: 'blkid',
  summary: 'Visar filsystemens typ, etikett och UUID',
  summaryEn: 'Show the type, label and UUID of file systems',
  man: `NAMN
       blkid - visa attribut för blockenheter (typ, etikett, UUID)

SYNOPSIS
       blkid [FLAGGA]... [ENHET]...
       blkid -L ETIKETT | -U UUID

BESKRIVNING
       Visar vilket filsystem som finns på varje partition: TYPE (ext4,
       vfat, btrfs, swap ...), LABEL (etiketten) och UUID – ett unikt id
       som skapas när filsystemet skapas. UUID används i /etc/fstab
       eftersom det inte ändras om diskarna byter namn (sda/sdb).

FLAGGOR
       -s TAGG          visa bara taggen TAGG (t.ex. UUID eller TYPE)
       -o FORMAT        value (bara värdet), full, export eller device
       -L ETIKETT       vilken enhet har etiketten?
       -U UUID          vilken enhet har detta UUID?

EXEMPEL
       blkid
       blkid /dev/sdb1
       blkid -s UUID -o value /dev/sdb1
       blkid -L USBMINNE`,
  manEn: `NAME
       blkid - locate/print block device attributes (type, label, UUID)

SYNOPSIS
       blkid [OPTION]... [DEVICE]...
       blkid -L LABEL | -U UUID

DESCRIPTION
       Shows which file system is on each partition: TYPE (ext4, vfat,
       btrfs, swap ...), LABEL and UUID – a unique id created together
       with the file system. /etc/fstab uses the UUID because it does not
       change if the disks get new names (sda/sdb).

OPTIONS
       -s TAG           only show the tag TAG (e.g. UUID or TYPE)
       -o FORMAT        value (just the value), full, export or device
       -L LABEL         which device has this label?
       -U UUID          which device has this UUID?

EXAMPLES
       blkid
       blkid /dev/sdb1
       blkid -s UUID -o value /dev/sdb1
       blkid -L USBMINNE`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'cp',
      values: 'soLU',
      long: { 'match-tag': 's', output: 'o', label: 'L', uuid: 'U' },
    });
    if (o.error) return badOption(ctx, o.error);
    const state = ctx.sh.disks;
    if (o.values.L !== undefined || o.values.U !== undefined) {
      const b = findBlock(state, o.values.L !== undefined ? `LABEL=${o.values.L}` : `UUID=${o.values.U}`);
      if (!b) return 2;
      ctx.out(b.path + '\n');
      return 0;
    }
    const format = o.values.o ?? 'full';
    if (!['full', 'value', 'export', 'device', 'list'].includes(format)) {
      ctx.err(`blkid: unsupported output format ${format}\n`);
      return 2;
    }
    let blocks: Block[];
    if (o.operands.length) {
      blocks = [];
      for (const op of o.operands) {
        const b = findBlock(state, op);
        if (b) blocks.push(b);
      }
    } else {
      blocks = allBlocks(state).filter((b) => b.dev.fstype);
    }
    let found = false;
    for (const b of blocks) {
      let tags = blkidTags(b);
      if (o.values.s) tags = tags.filter(([k]) => k === o.values.s!.toUpperCase());
      if (!tags.length) continue;
      found = true;
      if (format === 'value') for (const [, v] of tags) ctx.out(v + '\n');
      else if (format === 'device') ctx.out(b.path + '\n');
      else if (format === 'export') ctx.out(`DEVNAME=${b.path}\n${tags.map(([k, v]) => `${k}=${v}\n`).join('')}\n`);
      else ctx.out(`${b.path}: ${tags.map(([k, v]) => `${k}="${v}"`).join(' ')}\n`);
    }
    return found ? 0 : 2;
  },
};

// ---------- mount / umount ----------

const VFAT_EXTRA = 'codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro';
const GENERIC = new Set(['nosuid', 'nodev', 'noexec', 'noatime', 'sync', 'dirsync', 'nodiratime']);

interface ParsedOpts {
  ro: boolean;
  uid?: string;
  gid?: string;
  fmask: number;
  dmask: number;
  size?: number;
  generic: string[];
  user: boolean;
  noauto: boolean;
}

function parseMountOptions(list: string[]): ParsedOpts {
  const p: ParsedOpts = { ro: false, fmask: 0o022, dmask: 0o022, generic: [], user: false, noauto: false };
  for (const opt of list.flatMap((l) => l.split(',')).filter(Boolean)) {
    const [k, v = ''] = opt.split('=');
    if (k === 'ro') p.ro = true;
    else if (k === 'rw') p.ro = false;
    else if (k === 'uid') p.uid = userFromSpec(v);
    else if (k === 'gid') p.gid = userFromSpec(v);
    else if (k === 'umask') p.fmask = p.dmask = parseInt(v, 8) || 0;
    else if (k === 'fmask') p.fmask = parseInt(v, 8) || 0;
    else if (k === 'dmask') p.dmask = parseInt(v, 8) || 0;
    else if (k === 'size') {
      const m = /^(\d+)([kKmMgG%]?)$/.exec(v);
      if (m) {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        p.size = unit === 'k' ? n * 1024 : unit === 'm' ? n * 1024 ** 2 : unit === 'g' ? n * 1024 ** 3 : n;
      }
    } else if (k === 'user' || k === 'users') p.user = true;
    else if (k === 'noauto') p.noauto = true;
    else if (GENERIC.has(k)) p.generic.push(k);
  }
  return p;
}

function optionString(fstype: string, p: ParsedOpts): string {
  const head = [p.ro ? 'ro' : 'rw', ...p.generic, 'relatime'];
  const oct = (n: number) => n.toString(8).padStart(4, '0');
  switch (fstype) {
    case 'vfat': {
      const ids = [...(p.uid ? [`uid=${uidOf(p.uid)}`] : []), ...(p.gid ? [`gid=${uidOf(p.gid)}`] : [])];
      return [...head, ...ids, `fmask=${oct(p.fmask)}`, `dmask=${oct(p.dmask)}`, VFAT_EXTRA].join(',');
    }
    case 'tmpfs':
      return [...head, ...(p.size ? [`size=${Math.floor(p.size / 1024)}k`] : []), 'inode64'].join(',');
    default:
      return head.join(',');
  }
}

/** FAT har inga rättigheter i Linux: alla filer får samma ägare och rättigheter vid monteringen. */
function applyFatOwnership(node: FsNode, owner: string, group: string, fileMode: number, dirMode: number): void {
  node.owner = owner;
  node.group = group;
  node.mode = node.type === 'dir' ? dirMode : fileMode;
  for (const child of Object.values(node.children ?? {})) applyFatOwnership(child, owner, group, fileMode, dirMode);
}

function wrongFs(ctx: CmdCtx, target: string, source: string): number {
  ctx.err(
    `mount: ${target}: wrong fs type, bad option, bad superblock on ${source}, missing codepage or helper program, or other error.\n` +
      `       dmesg(1) may have more information after failed mount system call.\n`,
  );
  return 32;
}

interface FstabEntry {
  spec: string;
  file: string;
  type: string;
  options: string;
}

function readFstab(ctx: CmdCtx): FstabEntry[] {
  const sh = ctx.sh;
  const text = sh.vfs.tryLookup('/etc/fstab', sh.rootUser())?.content ?? '';
  const entries: FstabEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [spec, file, type = 'auto', options = 'defaults'] = line.split(/\s+/);
    if (spec && file) entries.push({ spec, file: file === 'none' ? file : normalizePath(file), type, options });
  }
  return entries;
}

/** Monterar en enhet (eller tmpfs) på en katalog. Returnerar slutstatus. */
function doMount(ctx: CmdCtx, sourceSpec: string, targetArg: string, type: string | undefined, opts: ParsedOpts, verbose: boolean, fromFstab = false): number {
  const sh = ctx.sh;
  const state = sh.disks;
  const root = sh.rootUser();
  const target = sh.resolve(targetArg);
  if (!isRoot(ctx) && !(fromFstab && opts.user)) {
    ctx.err(`mount: ${target}: must be superuser to use mount.\n`);
    return 1;
  }
  const node = sh.vfs.tryLookup(target, root);
  if (!node) {
    ctx.err(`mount: ${target}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (node.type !== 'dir') {
    ctx.err(`mount: ${target}: mount point is not a directory.\n`);
    return 32;
  }
  const busyTarget = state.mounts.find((m) => m.target === target);

  // tmpfs: ett nytt, tomt filsystem i RAM-minnet.
  if (type === 'tmpfs') {
    if (busyTarget) {
      ctx.err(`mount: ${target}: ${sourceSpec} already mounted or mount point busy.\n`);
      return 32;
    }
    const fresh = makeDir('root', 0o1777);
    const { dir, name } = sh.vfs.parent(target, root);
    const under = dir.children![name];
    dir.children![name] = fresh;
    state.mounts.push({ source: sourceSpec, target, fstype: 'tmpfs', options: optionString('tmpfs', opts), size: opts.size ?? Math.floor(8_073_420 / 2) * 1024, under });
    writeProcMounts(sh.vfs, state);
    if (verbose) ctx.out(`mount: ${sourceSpec} mounted on ${target}.\n`);
    return 0;
  }

  const block = findBlock(state, sourceSpec);
  if (!block) {
    if (/^(LABEL|UUID|PARTUUID)=/.test(sourceSpec)) ctx.err(`mount: ${target}: can't find ${sourceSpec}.\n`);
    else ctx.err(`mount: ${target}: special device ${sourceSpec} does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  const dev = block.dev;
  if (dev.fstype === 'swap') {
    ctx.err(`mount: ${target}: unknown filesystem type 'swap'.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (!dev.fstype) {
    const code = wrongFs(ctx, target, block.path);
    if (!block.part && block.disk.partitions.length) {
      tip(ctx, {
        sv: `Tips från simulatorn: ${block.path} är hela disken. Filsystemet ligger på en partition – prova ${block.path}${block.disk.partitions[0].name.slice(block.disk.name.length)}.`,
        en: `Simulator tip: ${block.path} is the whole disk. The file system is on a partition – try ${block.path}${block.disk.partitions[0].name.slice(block.disk.name.length)}.`,
      });
    }
    return code;
  }
  const fstype = dev.fstype;
  const wanted = type === 'auto' ? undefined : type === 'msdos' || type === 'fat' ? 'vfat' : type;
  if (wanted && wanted !== fstype) {
    if (!['ext2', 'ext3', 'ext4', 'vfat', 'btrfs', 'xfs', 'ntfs', 'ntfs3', 'exfat', 'iso9660'].includes(wanted)) {
      ctx.err(`mount: ${target}: unknown filesystem type '${type}'.\n       dmesg(1) may have more information after failed mount system call.\n`);
      return 32;
    }
    return wrongFs(ctx, target, block.path);
  }
  const already = mountsOf(state, block.name);
  if (already.length) {
    ctx.err(`mount: ${target}: ${block.path} already mounted on ${already[already.length - 1].target}.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (busyTarget) {
    ctx.err(`mount: ${target}: ${block.path} already mounted or mount point busy.\n`);
    return 32;
  }
  const fsRoot = dev.root ?? makeDir();
  delete dev.root;
  if (fstype === 'vfat') {
    const owner = opts.uid ?? (fromFstab && opts.user ? sh.currentUser().name : 'root');
    const group = opts.gid ?? (owner === 'root' ? 'root' : owner);
    applyFatOwnership(fsRoot, owner, group, 0o777 & ~opts.fmask, 0o777 & ~opts.dmask);
  }
  const { dir, name } = sh.vfs.parent(target, root);
  const under = dir.children![name];
  dir.children![name] = fsRoot;
  state.mounts.push({ source: block.path, target, fstype, options: optionString(fstype, opts), dev: block.name, under });
  writeProcMounts(sh.vfs, state);
  if (verbose) ctx.out(`mount: ${block.path} mounted on ${target}.\n`);
  return 0;
}

function listMounts(ctx: CmdCtx, types: string | undefined, labels: boolean): number {
  const state = ctx.sh.disks;
  const only = types?.split(',');
  for (const m of state.mounts) {
    if (only && !only.includes(m.fstype)) continue;
    const label = labels && m.dev ? findBlock(state, m.dev)?.dev.label : undefined;
    ctx.out(`${m.source} on ${m.target} type ${m.fstype} (${m.options})${label ? ` [${label}]` : ''}\n`);
  }
  return 0;
}

const mount: CommandDef = {
  name: 'mount',
  summary: 'Monterar ett filsystem i katalogträdet',
  summaryEn: 'Mount a file system into the directory tree',
  man: `NAMN
       mount - montera ett filsystem

SYNOPSIS
       mount
       mount [-t TYP] [-o FLAGGOR] ENHET KATALOG
       mount KATALOG | ENHET
       mount -a

BESKRIVNING
       I Linux finns bara ett katalogträd, som börjar i /. Att montera
       betyder att filsystemet på en enhet (en partition, en USB-sticka)
       kopplas in i trädet på en katalog – monteringspunkten. Efteråt
       syns filerna på enheten i den katalogen. Det som låg i katalogen
       innan döljs tills filsystemet avmonteras med umount.

       Utan argument listas allt som är monterat. Att montera kräver
       root (sudo). ENHET kan vara /dev/sdb1, LABEL=ETIKETT eller
       UUID=... Anges bara KATALOG eller ENHET hämtas resten från
       /etc/fstab.

FLAGGOR
       -t TYP       filsystemets typ (ext4, vfat, tmpfs ...). Behövs
                    sällan – mount känner igen typen själv.
       -o FLAGGOR   kommaseparerade monteringsflaggor, t.ex.
                    ro (skrivskyddat), uid=1000,gid=1000 (vem som äger
                    filerna på FAT), noexec, size=100M (tmpfs)
       -a           montera allt i /etc/fstab som inte redan är monterat
       -l           visa etiketter när allt listas
       -v           berätta vad som händer

EXEMPEL
       mount                              lista monterade filsystem
       mount -t vfat                      bara FAT-filsystem
       sudo mkdir -p /mnt/usb
       sudo mount /dev/sdb1 /mnt/usb      montera USB-stickan
       sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb
       sudo mount -t tmpfs tmpfs /mnt/ram  ett filsystem i RAM-minnet`,
  manEn: `NAME
       mount - mount a file system

SYNOPSIS
       mount
       mount [-t TYPE] [-o OPTIONS] DEVICE DIRECTORY
       mount DIRECTORY | DEVICE
       mount -a

DESCRIPTION
       Linux has only one directory tree, starting at /. Mounting means
       attaching the file system on a device (a partition, a USB stick)
       to the tree at a directory – the mount point. Afterwards the files
       on the device appear in that directory. Whatever was in the
       directory before is hidden until the file system is unmounted
       with umount.

       Without arguments, everything that is mounted is listed. Mounting
       requires root (sudo). DEVICE can be /dev/sdb1, LABEL=LABEL or
       UUID=... If only DIRECTORY or DEVICE is given, the rest is taken
       from /etc/fstab.

OPTIONS
       -t TYPE      file system type (ext4, vfat, tmpfs ...). Rarely
                    needed – mount detects the type itself.
       -o OPTIONS   comma-separated mount options, e.g. ro (read-only),
                    uid=1000,gid=1000 (who owns the files on FAT),
                    noexec, size=100M (tmpfs)
       -a           mount everything in /etc/fstab that is not mounted yet
       -l           show labels when listing
       -v           verbose

EXAMPLES
       mount                              list mounted file systems
       mount -t vfat                      only FAT file systems
       sudo mkdir -p /mnt/usb
       sudo mount /dev/sdb1 /mnt/usb      mount the USB stick
       sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb
       sudo mount -t tmpfs tmpfs /mnt/ram  a file system in RAM`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'alvrwnf',
      values: 'to',
      long: { all: 'a', 'show-labels': 'l', verbose: 'v', 'read-only': 'r', rw: 'w', 'read-write': 'w', types: 't', options: 'o', fake: 'f' },
    });
    if (o.error) return badOption(ctx, o.error);
    const sh = ctx.sh;
    const optList = [...(o.values.o ? [o.values.o] : []), ...(o.flags.has('r') ? ['ro'] : []), ...(o.flags.has('w') ? ['rw'] : [])];
    const verbose = o.flags.has('v');
    if (o.flags.has('a')) {
      if (!isRoot(ctx)) {
        ctx.err('mount: only root can use "--all" option\n');
        return 1;
      }
      let code = 0;
      for (const e of readFstab(ctx)) {
        if (e.type === 'swap' || e.file === 'none') continue;
        const opts = parseMountOptions([e.options]);
        if (opts.noauto) continue;
        const b = findBlock(sh.disks, e.spec);
        if (b && mountsOf(sh.disks, b.name).some((m) => m.target === e.file)) continue;
        if (!b && e.type !== 'tmpfs' && sh.disks.mounts.some((m) => m.target === e.file)) continue;
        const r = doMount(ctx, e.spec, e.file, e.type === 'auto' ? undefined : e.type, opts, verbose, true);
        if (r !== 0) code = r;
      }
      return code;
    }
    if (o.operands.length === 0) return listMounts(ctx, o.values.t, o.flags.has('l'));
    if (o.operands.length === 1) {
      const arg = o.operands[0];
      const entries = readFstab(ctx);
      const path = sh.resolve(arg);
      const b = findBlock(sh.disks, arg);
      const e = entries.find(
        (x) => x.file === path || x.spec === arg || (b && findBlock(sh.disks, x.spec)?.name === b.name),
      );
      if (!e) {
        if (!isRoot(ctx)) ctx.err(`mount: ${path}: must be superuser to use mount.\n`);
        else ctx.err(`mount: ${arg}: can't find in /etc/fstab.\n`);
        return 1;
      }
      const opts = parseMountOptions([e.options, ...optList]);
      return doMount(ctx, e.spec, e.file, o.values.t ?? (e.type === 'auto' ? undefined : e.type), opts, verbose, true);
    }
    if (o.operands.length > 2) return badOption(ctx, 'bad usage');
    return doMount(ctx, o.operands[0], o.operands[1], o.values.t, parseMountOptions(optList), verbose);
  },
};

const umount: CommandDef = {
  name: 'umount',
  summary: 'Avmonterar ett filsystem',
  summaryEn: 'Unmount a file system',
  man: `NAMN
       umount - avmontera ett filsystem

SYNOPSIS
       umount KATALOG | ENHET

BESKRIVNING
       Kopplar bort filsystemet från katalogträdet. Allt som ännu inte
       skrivits till enheten skrivs först, så att inget går förlorat.
       Avmontera alltid en USB-sticka innan du drar ut den!

       Notera stavningen: umount, utan n.

       Om något använder filsystemet – till exempel om ditt skal står i
       katalogen – vägrar umount med "target is busy". Gå då därifrån
       (cd ~) och försök igen.

FLAGGOR
       -v           berätta vad som händer

EXEMPEL
       sudo umount /mnt/usb
       sudo umount /dev/sdb1`,
  manEn: `NAME
       umount - unmount a file system

SYNOPSIS
       umount DIRECTORY | DEVICE

DESCRIPTION
       Detaches the file system from the directory tree. Everything that
       has not been written to the device yet is written first, so that
       nothing is lost. Always unmount a USB stick before unplugging it!

       Note the spelling: umount, without an n.

       If something is using the file system – for example if your shell
       is in the directory – umount refuses with "target is busy". Leave
       the directory (cd ~) and try again.

OPTIONS
       -v           verbose

EXAMPLES
       sudo umount /mnt/usb
       sudo umount /dev/sdb1`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'vfl', long: { verbose: 'v', force: 'f', lazy: 'l' } });
    if (o.error) return badOption(ctx, o.error);
    if (!o.operands.length) {
      ctx.err('umount: bad usage\nTry \'umount --help\' for more information.\n');
      return 1;
    }
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    let code = 0;
    for (const arg of o.operands) {
      const block = arg.startsWith('/dev/') || /^(LABEL|UUID)=/.test(arg) ? findBlock(state, arg) : null;
      let m: Mount | undefined;
      let shown = arg;
      if (block) {
        shown = block.path;
        m = mountsOf(state, block.name).at(-1);
      } else {
        const target = sh.resolve(arg);
        shown = target;
        m = state.mounts.filter((x) => x.target === target).at(-1);
        if (!m && !sh.vfs.tryLookup(target, root)) {
          ctx.err(`umount: ${arg}: no mount point specified.\n`);
          code = 1;
          continue;
        }
      }
      if (!isRoot(ctx)) {
        ctx.err(`umount: ${shown}: must be superuser to use umount.\n`);
        code = 1;
        continue;
      }
      if (!m) {
        ctx.err(`umount: ${shown}: not mounted.\n`);
        code = 32;
        continue;
      }
      const t = m.target;
      const inside = (p: string) => p === t || p.startsWith(t === '/' ? '/' : t + '/');
      const nested = state.mounts.some((x) => x !== m && x.target !== t && inside(x.target));
      if (m.system || nested || inside(sh.cwd)) {
        ctx.err(`umount: ${t}: target is busy.\n`);
        if (inside(sh.cwd) && !m.system) {
          tip(ctx, {
            sv: 'Tips från simulatorn: ditt skal står i katalogen. Gå därifrån först, t.ex. med cd ~.',
            en: 'Simulator tip: your shell is inside the directory. Leave it first, e.g. with cd ~.',
          });
        }
        code = 32;
        continue;
      }
      const { dir, name } = sh.vfs.parent(t, root);
      const fsRoot = dir.children![name];
      if (m.dev) {
        const b = findBlock(state, m.dev);
        if (b) b.dev.root = fsRoot?.type === 'dir' ? fsRoot : makeDir();
      }
      if (m.under) dir.children![name] = m.under;
      else dir.children![name] = makeDir();
      state.mounts = state.mounts.filter((x) => x !== m);
      writeProcMounts(sh.vfs, state);
      if (o.flags.has('v')) ctx.out(`umount: ${t} unmounted\n`);
    }
    return code;
  },
};

// ---------- findmnt ----------

const findmnt: CommandDef = {
  name: 'findmnt',
  summary: 'Visar monterade filsystem som ett träd',
  summaryEn: 'Show mounted file systems as a tree',
  man: `NAMN
       findmnt - hitta och visa monterade filsystem

SYNOPSIS
       findmnt [FLAGGA]... [KATALOG | ENHET]

BESKRIVNING
       Visar allt som är monterat som ett träd: varje filsystem under
       det som det är monterat i. Med en KATALOG eller ENHET visas bara
       den monteringen.

FLAGGOR
       -l, --list         lista i stället för träd
       -n, --noheadings   ingen rubrikrad
       -t, --types TYP    bara filsystem av typen TYP (t.ex. ext4,vfat)
       -T, --target FIL   filsystemet som FIL ligger på
       -o, --output LISTA kolumner: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                          LABEL,SIZE,USED,AVAIL,USE%

EXEMPEL
       findmnt
       findmnt /
       findmnt -t ext4,btrfs,vfat
       findmnt -n -o UUID /`,
  manEn: `NAME
       findmnt - find and show mounted file systems

SYNOPSIS
       findmnt [OPTION]... [DIRECTORY | DEVICE]

DESCRIPTION
       Shows everything that is mounted as a tree: each file system below
       the one it is mounted in. With a DIRECTORY or DEVICE, only that
       mount is shown.

OPTIONS
       -l, --list         list instead of tree
       -n, --noheadings   no header line
       -t, --types TYPE   only file systems of type TYPE (e.g. ext4,vfat)
       -T, --target FILE  the file system that FILE is on
       -o, --output LIST  columns: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                          LABEL,SIZE,USED,AVAIL,USE%

EXAMPLES
       findmnt
       findmnt /
       findmnt -t ext4,btrfs,vfat
       findmnt -n -o UUID /`,
  run(ctx) {
    const o = parseOpts(ctx.args, {
      flags: 'lnr',
      values: 'toT',
      long: { list: 'l', noheadings: 'n', raw: 'r', types: 't', output: 'o', target: 'T' },
    });
    if (o.error) return badOption(ctx, o.error);
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    const cols: Record<string, { align: Align; get: (m: Mount) => string }> = {
      TARGET: { align: 'l', get: (m) => m.target },
      SOURCE: { align: 'l', get: (m) => (m.subvol ? `${m.source}[${m.subvol}]` : m.source) },
      FSTYPE: { align: 'l', get: (m) => m.fstype },
      OPTIONS: { align: 'l', get: (m) => m.options },
      UUID: { align: 'l', get: (m) => (m.dev ? findBlock(state, m.dev)?.dev.uuid ?? '' : '') },
      LABEL: { align: 'l', get: (m) => (m.dev ? findBlock(state, m.dev)?.dev.label ?? '' : '') },
      SIZE: { align: 'r', get: (m) => lsblkSize(mountUsage(sh.vfs, state, m, root).size) },
      USED: { align: 'r', get: (m) => lsblkSize(mountUsage(sh.vfs, state, m, root).used) },
      AVAIL: { align: 'r', get: (m) => lsblkSize(mountUsage(sh.vfs, state, m, root).avail) },
      'USE%': {
        align: 'r',
        get: (m) => {
          const u = mountUsage(sh.vfs, state, m, root);
          return u.size ? `${Math.ceil((u.used * 100) / Math.max(1, u.used + u.avail))}%` : '0%';
        },
      },
    };
    const names = (o.values.o ?? 'TARGET,SOURCE,FSTYPE,OPTIONS').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    for (const n of names) {
      if (!cols[n]) {
        ctx.err(`findmnt: unknown column: ${n}\n`);
        return 1;
      }
    }
    let mounts = state.mounts;
    let tree = !o.flags.has('l') && !o.flags.has('r');
    if (o.values.t) {
      const types = o.values.t.split(',');
      mounts = mounts.filter((m) => types.includes(m.fstype));
      tree = false;
    }
    const pick = o.values.T ?? o.operands[0];
    if (pick !== undefined) {
      tree = false;
      if (o.values.T !== undefined) {
        const m = mountFor(state, sh.resolve(pick));
        mounts = m ? [m] : [];
      } else {
        const b = pick.startsWith('/dev/') || /^(LABEL|UUID)=/.test(pick) ? findBlock(state, pick) : null;
        const path = sh.resolve(pick);
        mounts = mounts.filter((m) => m.target === path || (b && m.dev === b.name));
      }
    }
    if (!mounts.length) return 1;
    const rows: { m: Mount; prefix: string }[] = [];
    if (tree) {
      const parentOf = (m: Mount): Mount | undefined => {
        let best: Mount | undefined;
        for (const p of mounts) {
          if (p === m) continue;
          const under = p.target === '/' ? m.target !== '/' : m.target.startsWith(p.target + '/');
          if (under && (!best || p.target.length > best.target.length)) best = p;
        }
        return best;
      };
      const children = (p: Mount | undefined) => mounts.filter((m) => parentOf(m) === p);
      const walk = (m: Mount, indent: string, isLast: boolean, top: boolean) => {
        rows.push({ m, prefix: top ? '' : indent + branch(isLast) });
        const kids = children(m);
        kids.forEach((k, i) => walk(k, top ? '' : indent + (isLast ? '  ' : '│ '), i === kids.length - 1, false));
      };
      for (const top of children(undefined)) walk(top, '', true, true);
    } else {
      for (const m of mounts) rows.push({ m, prefix: '' });
    }
    const out = rows.map((r) => names.map((n, i) => (i === 0 && n === 'TARGET' ? r.prefix : '') + cols[n].get(r.m)));
    if (!o.flags.has('n')) out.unshift(names);
    ctx.out(table(out, names.map((n) => cols[n].align)));
    return 0;
  },
};

// ---------- fdisk ----------

function fdiskSize(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${Number(v.toFixed(2))} ${units[u]}`;
}

function fdiskList(disk: Disk): string {
  const bytes = disk.sectors * SECTOR;
  let out =
    `Disk /dev/${disk.name}: ${fdiskSize(bytes)}, ${bytes} bytes, ${disk.sectors} sectors\n` +
    (disk.model ? `Disk model: ${disk.model.padEnd(16)}\n` : '') +
    `Units: sectors of 1 * 512 = 512 bytes\n` +
    `Sector size (logical/physical): 512 bytes / ${disk.tran === 'usb' || !disk.tran ? 512 : 4096} bytes\n` +
    `I/O size (minimum/optimal): ${disk.tran === 'sata' ? 4096 : 512} bytes / ${disk.tran === 'sata' ? 4096 : 512} bytes\n`;
  if (!disk.pttype) return out;
  out += `Disklabel type: ${disk.pttype}\nDisk identifier: ${disk.diskId}\n\n`;
  const dos = disk.pttype === 'dos';
  const rows: string[][] = [dos ? ['Device', 'Boot', 'Start', 'End', 'Sectors', 'Size', 'Id', 'Type'] : ['Device', 'Start', 'End', 'Sectors', 'Size', 'Type']];
  for (const p of disk.partitions) {
    const nums = [String(p.start), String(p.start + p.sectors - 1), String(p.sectors), lsblkSize(p.sectors * SECTOR)];
    rows.push(dos ? [`/dev/${p.name}`, '', ...nums, p.ptypeId ?? '83', p.ptype] : [`/dev/${p.name}`, ...nums, p.ptype]);
  }
  out += table(rows, dos ? ['l', 'l', 'r', 'r', 'r', 'r', 'r', 'l'] : ['l', 'r', 'r', 'r', 'r', 'l']);
  return out;
}

const fdisk: CommandDef = {
  name: 'fdisk',
  summary: 'Visar och ändrar partitionstabeller',
  summaryEn: 'Show and change partition tables',
  man: `NAMN
       fdisk - visa och ändra partitionstabellen på en disk

SYNOPSIS
       fdisk -l [DISK]...
       fdisk DISK

BESKRIVNING
       En disk delas in i partitioner. Partitionstabellen (GPT eller den
       äldre MBR/dos) beskriver var varje partition börjar och slutar.
       fdisk -l visar tabellen. Kräver root.

       VARNING: fdisk DISK ändrar partitionstabellen. Ett misstag på ett
       riktigt system kan göra att allt på disken blir oläsbart. Kontrollera
       alltid med lsblk att du har rätt disk – och ha en backup. I
       simulatorn går det bara att lista (-l).

FLAGGOR
       -l, --list   lista partitionstabellerna

EXEMPEL
       sudo fdisk -l
       sudo fdisk -l /dev/sdb`,
  manEn: `NAME
       fdisk - show and change the partition table of a disk

SYNOPSIS
       fdisk -l [DISK]...
       fdisk DISK

DESCRIPTION
       A disk is divided into partitions. The partition table (GPT or the
       older MBR/dos) describes where each partition starts and ends.
       fdisk -l shows the table. Requires root.

       WARNING: fdisk DISK changes the partition table. A mistake on a
       real system can make everything on the disk unreadable. Always
       check with lsblk that you have the right disk – and have a backup.
       The simulator can only list (-l).

OPTIONS
       -l, --list   list the partition tables

EXAMPLES
       sudo fdisk -l
       sudo fdisk -l /dev/sdb`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'l', long: { list: 'l' } });
    if (o.error) return badOption(ctx, o.error);
    const state = ctx.sh.disks;
    if (!o.flags.has('l')) {
      if (o.operands.length !== 1) {
        ctx.err(' fdisk: bad usage\nTry \'fdisk --help\' for more information.\n');
        return 1;
      }
      const b = findBlock(state, o.operands[0]);
      if (!b || !isRoot(ctx)) {
        ctx.err(`fdisk: cannot open ${o.operands[0]}: ${b ? 'Permission denied' : 'No such file or directory'}\n`);
        return 1;
      }
      ctx.out(`\nWelcome to fdisk (util-linux 2.39.3).\nChanges will remain in memory only, until you decide to write them.\nBe careful before using the write command.\n\n`);
      tip(ctx, {
        sv: 'Simulatorn låtsas inte ändra partitionstabeller – det är här man på riktigt kan förstöra en disk. Använd fdisk -l för att titta.',
        en: 'The simulator does not pretend to change partition tables – this is where you can really destroy a disk. Use fdisk -l to look.',
      });
      return 1;
    }
    let disks = state.disks;
    if (o.operands.length) {
      disks = [];
      for (const op of o.operands) {
        const b = findBlock(state, op);
        if (!b) {
          ctx.err(`fdisk: cannot open ${op}: No such file or directory\n`);
          continue;
        }
        if (!disks.includes(b.disk)) disks.push(b.disk);
      }
    }
    if (!isRoot(ctx)) {
      for (const d of disks) ctx.err(`fdisk: cannot open /dev/${d.name}: Permission denied\n`);
      return 1;
    }
    ctx.out(disks.map(fdiskList).join('\n\n'));
    return 0;
  },
};

// ---------- swapon ----------

const swapon: CommandDef = {
  name: 'swapon',
  summary: 'Visar och slår på swap',
  summaryEn: 'Show and enable swap',
  man: `NAMN
       swapon - visa och slå på swap

SYNOPSIS
       swapon [--show]

BESKRIVNING
       Swap är utrymme som används när RAM-minnet tar slut: sidor av minnet
       som inte används just nu flyttas dit. Swap kan vara en partition,
       en fil eller – som i Fedora – komprimerat RAM (zram).

       Utan argument, eller med --show, visas swap som används.

EXEMPEL
       swapon --show
       free -h`,
  manEn: `NAME
       swapon - show and enable swap

SYNOPSIS
       swapon [--show]

DESCRIPTION
       Swap is space used when RAM runs out: pages of memory that are not
       used right now are moved there. Swap can be a partition, a file or
       – as in Fedora – compressed RAM (zram).

       Without arguments, or with --show, the swap in use is shown.

EXAMPLES
       swapon --show
       free -h`,
  run(ctx) {
    const args = ctx.args;
    const state = ctx.sh.disks;
    const active = allBlocks(state).filter((b) => b.dev.swapActive);
    if (!args.length || args[0] === '--show' || args[0] === '-s' || args[0] === '--summary') {
      if (args[0] === '-s' || args[0] === '--summary') {
        ctx.out('Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority\n');
        for (const b of active) ctx.out(`${b.path.padEnd(40)}partition\t${blockSize(b.dev) / 1024}\t\t0\t\t${b.disk.tran ? -2 : 100}\n`);
        return 0;
      }
      const rows = [['NAME', 'TYPE', 'SIZE', 'USED', 'PRIO']];
      for (const b of active) rows.push([b.path, 'partition', lsblkSize(blockSize(b.dev)), '0B', b.disk.tran ? '-2' : '100']);
      ctx.out(table(rows, ['l', 'l', 'r', 'r', 'r']));
      return 0;
    }
    if (args[0] === '-a' || args[0] === '--all') return isRoot(ctx) ? 0 : 1;
    const b = findBlock(state, args[0]);
    if (!b) {
      ctx.err(`swapon: cannot open ${args[0]}: No such file or directory\n`);
      return 1;
    }
    if (!isRoot(ctx)) {
      ctx.err(`swapon: ${b.path}: swapon failed: Operation not permitted\n`);
      return 1;
    }
    if (b.dev.swapActive) ctx.err(`swapon: ${b.path}: swapon failed: Device or resource busy\n`);
    else ctx.err(`swapon: ${b.path}: read swap header failed\n`);
    return 1;
  },
};

// ---------- sync ----------

const sync: CommandDef = {
  name: 'sync',
  summary: 'Skriver allt som väntar i minnet till diskarna',
  summaryEn: 'Write everything waiting in memory to the disks',
  man: `NAMN
       sync - skriv cachat innehåll till diskarna

SYNOPSIS
       sync

BESKRIVNING
       Linux väntar ofta med att skriva till disken och samlar ändringarna
       i RAM-minnet (cache), eftersom det går mycket snabbare. sync tvingar
       fram skrivningen direkt. umount gör samma sak innan den kopplar
       bort ett filsystem.`,
  manEn: `NAME
       sync - write cached data to the disks

SYNOPSIS
       sync

DESCRIPTION
       Linux often delays writing to disk and collects the changes in RAM
       (cache), because that is much faster. sync forces the write right
       away. umount does the same thing before detaching a file system.`,
  run() {
    return 0;
  },
};

// ---------- mkfs ----------

type MkfsType = 'ext2' | 'ext3' | 'ext4' | 'vfat';

/** Skapar ett nytt, tomt filsystem på en partition – allt som fanns där försvinner. */
function makeFs(ctx: CmdCtx, fstype: MkfsType, spec: string | undefined, label: string | undefined, force: boolean): number {
  const ext = fstype !== 'vfat';
  const prog = ext ? `mkfs.${fstype}` : 'mkfs.fat';
  if (ext) ctx.out(ctx.sh.distro.family === 'debian' ? 'mke2fs 1.47.0 (5-Feb-2023)\n' : 'mke2fs 1.47.3 (8-Jul-2025)\n');
  else ctx.out('mkfs.fat 4.2 (2021-01-31)\n');
  if (!spec) {
    ctx.err(ext ? `Usage: mke2fs [-L volume-label] [-t fs-type] [-F] device [blocks-count]\n` : `No device specified.\nUsage: mkfs.fat [OPTIONS] TARGET [BLOCKS]\n`);
    return 1;
  }
  const state = ctx.sh.disks;
  const b = findBlock(state, spec);
  if (!b) {
    ctx.err(ext ? `The file ${spec} does not exist and no size was specified.\n` : `mkfs.fat: unable to open ${spec}: No such file or directory\n`);
    return 1;
  }
  if (!isRoot(ctx)) {
    ctx.err(ext ? `${prog}: Permission denied while trying to determine filesystem size\n` : `mkfs.fat: unable to open ${b.path}: Permission denied\n`);
    return 1;
  }
  const dev = b.dev;
  if (mountsOf(state, b.name).length) {
    ctx.err(ext ? `${b.path} is mounted; will not make a filesystem here!\n` : `mkfs.fat: ${b.path} contains a mounted filesystem.\n`);
    return 1;
  }
  if (dev.swapActive) {
    ctx.err(ext ? `${b.path} is apparently in use by the system; will not make a filesystem here!\n` : `mkfs.fat: unable to open ${b.path}: Device or resource busy\n`);
    return 1;
  }
  if (!b.part && b.disk.partitions.length) {
    ctx.out(`Found a ${b.disk.pttype} partition table in ${b.path}\n`);
    tip(ctx, {
      sv: 'Simulatorn formaterar bara partitioner (t.ex. /dev/sdb1), inte hela diskar.',
      en: 'The simulator only formats partitions (e.g. /dev/sdb1), not whole disks.',
    });
    return 1;
  }
  const sh = ctx.sh;
  const finish = (io: { out(s: string): void; err(s: string): void }): number => {
    const uuid = newUuid(fstype);
    dev.fstype = fstype;
    dev.fsver = ext ? '1.0' : 'FAT32';
    dev.uuid = uuid;
    dev.label = label || undefined;
    dev.base = 0;
    const fresh = makeDir('root', 0o755);
    if (ext) fresh.children = { 'lost+found': makeDir('root', 0o700) };
    dev.root = fresh;
    if (ext) {
      const blocks = Math.floor(blockSize(dev) / 4096);
      io.out(
        `Creating filesystem with ${blocks} 4k blocks and ${Math.floor(blocks / 4 / 8192) * 8192} inodes\n` +
          `Filesystem UUID: ${uuid}\n` +
          `Superblock backups stored on blocks: \n\t32768, 98304, 163840, 229376, 294912, 819200, 884736, 1605632, 2654208\n\n` +
          `Allocating group tables: done                            \n` +
          `Writing inode tables: done                            \n` +
          (fstype === 'ext2' ? '' : `Creating journal (16384 blocks): done\n`) +
          `Writing superblocks and filesystem accounting information: done   \n\n`,
      );
    } else if (label && label !== label.toUpperCase()) {
      io.err('mkfs.fat: Warning: lowercase labels might not work properly on some systems\n');
    }
    return 0;
  };
  if (ext && dev.fstype && !force) {
    ctx.out(`${b.path} contains a ${dev.fstype} file system${dev.label ? ` labelled '${dev.label}'` : ''}\n`);
    sh.ask('Proceed anyway? (y,N) ', false, (yes, io) => (yes ? finish(io) : 1));
    return 0;
  }
  return finish(ctx);
}

function mkfsExt(fixed?: MkfsType): CommandDef['run'] {
  return (ctx) => {
    const o = parseOpts(ctx.args, { flags: 'Fqv', values: 'Ltb', long: { label: 'L', type: 't' } });
    if (o.error) return badOption(ctx, o.error);
    const type = (fixed ?? o.values.t ?? 'ext2') as MkfsType;
    if (!['ext2', 'ext3', 'ext4'].includes(type)) {
      ctx.err(`mke2fs: invalid fs type '${type}'\n`);
      return 1;
    }
    return makeFs(ctx, type, o.operands[0], o.values.L, o.flags.has('F'));
  };
}

const mkfsVfatRun: CommandDef['run'] = (ctx) => {
  const o = parseOpts(ctx.args, { flags: 'cIv', values: 'nFs' });
  if (o.error) return badOption(ctx, o.error);
  const label = o.values.n;
  if (label && label.length > 11) {
    ctx.err('mkfs.fat: Label can be no longer than 11 characters\n');
    return 1;
  }
  return makeFs(ctx, 'vfat', o.operands[0], label, true);
};

const MKFS_MAN = `NAMN
       mkfs.ext4, mkfs.vfat - skapa ett filsystem (formatera)

SYNOPSIS
       mkfs.ext4 [-L ETIKETT] PARTITION
       mkfs.vfat [-n ETIKETT] PARTITION
       mkfs -t TYP PARTITION

BESKRIVNING
       Skapar ett nytt, tomt filsystem på en partition. ALLT som fanns på
       partitionen försvinner. Partitionen får ett nytt UUID.

       VARNING: på ett riktigt system är det här ett av de farligaste
       kommandona som finns. Kontrollera alltid med lsblk -f att du har
       rätt enhet (sdb är inte alltid USB-stickan!) och att partitionen
       inte är monterad.

       ext4 är standard i Linux. vfat (FAT32) fungerar i Windows, macOS
       och nästan alla andra prylar, men har inga Linux-rättigheter och
       klarar inte filer större än 4 GiB.

FLAGGOR
       -L ETIKETT   etikett för ext4 (mkfs.ext4)
       -n ETIKETT   etikett för FAT, högst 11 tecken (mkfs.vfat)
       -F           (mkfs.ext4) fråga inte, även om det finns ett filsystem
       -t TYP       (mkfs) ext2, ext3, ext4 eller vfat

EXEMPEL
       sudo umount /mnt/usb
       sudo mkfs.ext4 -L BACKUP /dev/sdb1
       sudo mkfs.vfat -n USBMINNE /dev/sdb1`;

const MKFS_MAN_EN = `NAME
       mkfs.ext4, mkfs.vfat - make a file system (format)

SYNOPSIS
       mkfs.ext4 [-L LABEL] PARTITION
       mkfs.vfat [-n LABEL] PARTITION
       mkfs -t TYPE PARTITION

DESCRIPTION
       Creates a new, empty file system on a partition. EVERYTHING that was
       on the partition is lost. The partition gets a new UUID.

       WARNING: on a real system this is one of the most dangerous commands
       there is. Always check with lsblk -f that you have the right device
       (sdb is not always the USB stick!) and that the partition is not
       mounted.

       ext4 is the Linux standard. vfat (FAT32) works in Windows, macOS
       and almost every other gadget, but has no Linux permissions and
       cannot store files larger than 4 GiB.

OPTIONS
       -L LABEL     label for ext4 (mkfs.ext4)
       -n LABEL     label for FAT, at most 11 characters (mkfs.vfat)
       -F           (mkfs.ext4) do not ask, even if there is a file system
       -t TYPE      (mkfs) ext2, ext3, ext4 or vfat

EXAMPLES
       sudo umount /mnt/usb
       sudo mkfs.ext4 -L BACKUP /dev/sdb1
       sudo mkfs.vfat -n USBMINNE /dev/sdb1`;

const mkfsDef = (name: string, run: CommandDef['run']): CommandDef => ({
  name,
  summary: 'Skapar ett filsystem på en partition (formaterar)',
  summaryEn: 'Make a file system on a partition (format)',
  man: MKFS_MAN,
  manEn: MKFS_MAN_EN,
  run,
});

const mkfs = mkfsDef('mkfs', (ctx) => {
  const o = parseOpts(ctx.args, { flags: 'FqvV', values: 'tLn', long: { type: 't' } });
  if (o.error) return badOption(ctx, o.error);
  const type = o.values.t ?? 'ext2';
  if (type === 'vfat' || type === 'fat' || type === 'msdos') {
    return makeFs(ctx, 'vfat', o.operands[0], o.values.n, true);
  }
  if (['ext2', 'ext3', 'ext4'].includes(type)) return makeFs(ctx, type as MkfsType, o.operands[0], o.values.L, o.flags.has('F'));
  ctx.err(`mkfs: failed to execute mkfs.${type}: No such file or directory\n`);
  return 1;
});

export const DISK_COMMANDS: CommandDef[] = [
  df,
  lsblk,
  blkid,
  mount,
  umount,
  findmnt,
  fdisk,
  swapon,
  sync,
  mkfs,
  mkfsDef('mkfs.ext4', mkfsExt('ext4')),
  mkfsDef('mke2fs', mkfsExt()),
  mkfsDef('mkfs.vfat', mkfsVfatRun),
  mkfsDef('mkfs.fat', mkfsVfatRun),
];
