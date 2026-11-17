// Port of Commands/Disks/DisksCmd.Mount.cs – the mount command: mounts a file system into the directory tree.

import * as DisksLib from "../../Disks/DisksLib.js";
import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isRoot, long, tip } from "./DisksCmd.js";

const mountMan = `NAMN
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
       sudo mount -t tmpfs tmpfs /mnt/ram  ett filsystem i RAM-minnet`;

const mountManEn = `NAME
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
       sudo mount -t tmpfs tmpfs /mnt/ram  a file system in RAM`;

function userFromSpec(sh: Shell, spec: string): string {
  if (spec === "0" || spec === "root") return "root";
  if (spec === "1000" || spec === sh.world.user) return sh.world.user;
  return spec;
}

function uidOf(sh: Shell, name: string): string {
  return name === "root" ? "0" : name === sh.world.user ? "1000" : name;
}

const vfatExtra = "codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro";
const generic = new Set(["nosuid", "nodev", "noexec", "noatime", "sync", "dirsync", "nodiratime"]);

interface ParsedOpts {
  ro: boolean;
  uid: string | null;
  gid: string | null;
  fmask: number;
  dmask: number;
  size: number | null;
  generic: string[];
  user: boolean;
  noauto: boolean;
}

const sizeRe = /^([0-9]+)([kKmMgG%]?)$/;

/** parseInt(v, 8) || 0 */
function octOrZero(v: string): number {
  const n = Js.parseInt(v, 8);
  return Number.isNaN(n) ? 0 : Math.trunc(n);
}

function parseMountOptions(sh: Shell, list: Iterable<string>): ParsedOpts {
  const p: ParsedOpts = { ro: false, uid: null, gid: null, fmask: Js.oct(22), dmask: Js.oct(22), size: null, generic: [], user: false, noauto: false };
  for (const opt of [...list].flatMap((l) => l.split(",")).filter((s) => s !== "")) {
    const kv = opt.split("=");
    const k = kv[0]!;
    const v = kv.length > 1 ? kv[1]! : "";
    if (k === "ro") p.ro = true;
    else if (k === "rw") p.ro = false;
    else if (k === "uid") p.uid = userFromSpec(sh, v);
    else if (k === "gid") p.gid = userFromSpec(sh, v);
    else if (k === "umask") p.fmask = p.dmask = octOrZero(v);
    else if (k === "fmask") p.fmask = octOrZero(v);
    else if (k === "dmask") p.dmask = octOrZero(v);
    else if (k === "size") {
      const m = sizeRe.exec(v);
      if (m !== null) {
        const n = Js.number(m[1]!);
        const unit = m[2]!.toLowerCase();
        p.size = unit === "k" ? n * 1024 : unit === "m" ? n * Math.pow(1024, 2) : unit === "g" ? n * Math.pow(1024, 3) : n;
      }
    } else if (k === "user" || k === "users") p.user = true;
    else if (k === "noauto") p.noauto = true;
    else if (generic.has(k)) p.generic.push(k);
  }
  return p;
}

/** n.toString(8).padStart(4, '0') */
function oct4(n: number): string {
  return n.toString(8).padStart(4, "0");
}

function optionString(sh: Shell, fstype: string, p: ParsedOpts): string {
  const head = [p.ro ? "ro" : "rw"];
  head.push(...p.generic);
  head.push("relatime");
  switch (fstype) {
    case "vfat": {
      const ids: string[] = [];
      if (p.uid !== null && p.uid !== "") ids.push(`uid=${uidOf(sh, p.uid)}`);
      if (p.gid !== null && p.gid !== "") ids.push(`gid=${uidOf(sh, p.gid)}`);
      return [...head, ...ids, `fmask=${oct4(p.fmask)}`, `dmask=${oct4(p.dmask)}`, vfatExtra].join(",");
    }
    case "tmpfs": {
      const parts = [...head];
      if (p.size !== null && p.size !== 0 && !Number.isNaN(p.size)) parts.push(`size=${Js.num(Math.floor(p.size / 1024))}k`);
      parts.push("inode64");
      return parts.join(",");
    }
    default:
      return head.join(",");
  }
}

/** FAT has no permissions in Linux: all files get the same owner and permissions when mounted. */
function applyFatOwnership(node: FsNode, owner: string, group: string, fileMode: number, dirMode: number): void {
  node.owner = owner;
  node.group = group;
  node.mode = node.type === "dir" ? dirMode : fileMode;
  if (node.children !== null && node.children !== undefined) for (const child of node.children.values()) applyFatOwnership(child, owner, group, fileMode, dirMode);
}

function wrongFs(ctx: CmdCtx, target: string, source: string): number {
  ctx.err(
    `mount: ${target}: wrong fs type, bad option, bad superblock on ${source}, missing codepage or helper program, or other error.\n` +
      "       dmesg(1) may have more information after failed mount system call.\n",
  );
  return 32;
}

interface FstabEntry {
  spec: string;
  file: string;
  type: string;
  options: string;
}

const whitespace = /\s+/;

function readFstab(ctx: CmdCtx): FstabEntry[] {
  const sh = ctx.sh;
  const text = sh.vfs.tryLookup("/etc/fstab", sh.rootUser())?.content ?? "";
  const entries: FstabEntry[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const f = line.split(whitespace);
    const spec = f[0]!;
    const file = f.length > 1 ? f[1]! : "";
    const type = f.length > 2 ? f[2]! : "auto";
    const options = f.length > 3 ? f[3]! : "defaults";
    if (spec !== "" && file !== "") entries.push({ spec, file: file === "none" ? file : VfsLib.normalizePath(file), type, options });
  }
  return entries;
}

const specPrefix = /^(LABEL|UUID|PARTUUID)=/;
const knownFs = ["ext2", "ext3", "ext4", "vfat", "btrfs", "xfs", "ntfs", "ntfs3", "exfat", "iso9660"];

/** Mounts a device (or tmpfs) on a directory. Returns the exit status. */
function doMount(ctx: CmdCtx, sourceSpec: string, targetArg: string, type: string | null, opts: ParsedOpts, verbose: boolean, fromFstab = false): number {
  const sh = ctx.sh;
  const state = sh.disks;
  const root = sh.rootUser();
  const target = sh.resolve(targetArg);
  if (!isRoot(ctx) && !(fromFstab && opts.user)) {
    ctx.err(`mount: ${target}: must be superuser to use mount.\n`);
    return 1;
  }
  const node = sh.vfs.tryLookup(target, root);
  if (node === null) {
    ctx.err(`mount: ${target}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (node.type !== "dir") {
    ctx.err(`mount: ${target}: mount point is not a directory.\n`);
    return 32;
  }
  const busyTarget = state.mounts.find((m) => m.target === target) ?? null;
  // tmpfs: a new, empty file system in RAM.
  if (type === "tmpfs") {
    if (busyTarget !== null) {
      ctx.err(`mount: ${target}: ${sourceSpec} already mounted or mount point busy.\n`);
      return 32;
    }
    const fresh = VfsLib.makeDir("root", Js.oct(1777));
    const { dir: tdir, name: tname } = sh.vfs.parent(target, root);
    const tunder = tdir.children!.get(tname) ?? null;
    tdir.children!.set(tname, fresh);
    state.mounts.push({
      source: sourceSpec,
      target,
      fstype: "tmpfs",
      options: optionString(ctx.sh, "tmpfs", opts),
      size: opts.size !== null ? Math.trunc(opts.size) : Math.trunc(8_073_420 / 2) * 1024,
      under: tunder,
    });
    DisksLib.writeProcMounts(sh.vfs, state);
    if (verbose) ctx.out(`mount: ${sourceSpec} mounted on ${target}.\n`);
    return 0;
  }
  const block = DisksLib.findBlock(state, sourceSpec);
  if (block === null) {
    if (specPrefix.test(sourceSpec)) ctx.err(`mount: ${target}: can't find ${sourceSpec}.\n`);
    else ctx.err(`mount: ${target}: special device ${sourceSpec} does not exist.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  const dev = block.dev;
  if (dev.fstype === "swap") {
    ctx.err(`mount: ${target}: unknown filesystem type 'swap'.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (dev.fstype === null || dev.fstype === undefined || dev.fstype === "") {
    const code = wrongFs(ctx, target, block.path);
    if ((block.part === null || block.part === undefined) && block.disk.partitions.length > 0) {
      const suffix = block.disk.partitions[0]!.name.slice(block.disk.name.length);
      tip(ctx, "disks.wholeDiskTip", { disk: block.path, suffix });
    }
    return code;
  }
  const fstype = dev.fstype;
  const wanted = type === "auto" ? null : type === "msdos" || type === "fat" ? "vfat" : type;
  if (wanted !== null && wanted !== "" && wanted !== fstype) {
    if (!knownFs.includes(wanted)) {
      ctx.err(`mount: ${target}: unknown filesystem type '${type}'.\n       dmesg(1) may have more information after failed mount system call.\n`);
      return 32;
    }
    return wrongFs(ctx, target, block.path);
  }
  const already = DisksLib.mountsOf(state, block.name);
  if (already.length > 0) {
    ctx.err(`mount: ${target}: ${block.path} already mounted on ${already.at(-1)!.target}.\n       dmesg(1) may have more information after failed mount system call.\n`);
    return 32;
  }
  if (busyTarget !== null) {
    ctx.err(`mount: ${target}: ${block.path} already mounted or mount point busy.\n`);
    return 32;
  }
  const fsRoot = dev.root ?? VfsLib.makeDir();
  dev.root = null;
  if (fstype === "vfat") {
    const owner = opts.uid ?? (fromFstab && opts.user ? sh.currentUser().name : "root");
    const group = opts.gid ?? (owner === "root" ? "root" : owner);
    applyFatOwnership(fsRoot, owner, group, Js.oct(777) & ~opts.fmask, Js.oct(777) & ~opts.dmask);
  }
  const { dir, name } = sh.vfs.parent(target, root);
  const under = dir.children!.get(name) ?? null;
  dir.children!.set(name, fsRoot);
  state.mounts.push({ source: block.path, target, fstype, options: optionString(ctx.sh, fstype, opts), dev: block.name, under });
  DisksLib.writeProcMounts(sh.vfs, state);
  if (verbose) ctx.out(`mount: ${block.path} mounted on ${target}.\n`);
  return 0;
}

function listMounts(ctx: CmdCtx, types: string | null, labels: boolean): number {
  const state = ctx.sh.disks;
  const only = types?.split(",") ?? null;
  for (const m of state.mounts) {
    if (only !== null && !only.includes(m.fstype)) continue;
    const label = labels && m.dev !== null && m.dev !== undefined ? (DisksLib.findBlock(state, m.dev)?.dev.label ?? null) : null;
    ctx.out(`${m.source} on ${m.target} type ${m.fstype} (${m.options})${label !== null && label !== "" ? ` [${label}]` : ""}\n`);
  }
  return 0;
}

export const mountCmd: CommandDef = {
  name: "mount",
  summary: "Monterar ett filsystem i katalogträdet",
  summaryEn: "Mount a file system into the directory tree",
  man: mountMan,
  manEn: mountManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "alvrwnf",
      values: "to",
      long: long(
        ["all", "a"],
        ["show-labels", "l"],
        ["verbose", "v"],
        ["read-only", "r"],
        ["rw", "w"],
        ["read-write", "w"],
        ["types", "t"],
        ["options", "o"],
        ["fake", "f"],
      ),
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const sh = ctx.sh;
    const optList: string[] = [];
    const oVal = o.values.get("o");
    if (oVal !== undefined && oVal !== "") optList.push(oVal);
    if (o.flags.has("r")) optList.push("ro");
    if (o.flags.has("w")) optList.push("rw");
    const verbose = o.flags.has("v");
    if (o.flags.has("a")) {
      if (!isRoot(ctx)) {
        ctx.err('mount: only root can use "--all" option\n');
        return 1;
      }
      let code = 0;
      for (const e of readFstab(ctx)) {
        if (e.type === "swap" || e.file === "none") continue;
        const opts = parseMountOptions(ctx.sh, [e.options]);
        if (opts.noauto) continue;
        const b = DisksLib.findBlock(sh.disks, e.spec);
        if (b !== null && DisksLib.mountsOf(sh.disks, b.name).some((m) => m.target === e.file)) continue;
        if (b === null && e.type !== "tmpfs" && sh.disks.mounts.some((m) => m.target === e.file)) continue;
        const r = doMount(ctx, e.spec, e.file, e.type === "auto" ? null : e.type, opts, verbose, true);
        if (r !== 0) code = r;
      }
      return code;
    }
    if (o.operands.length === 0) return listMounts(ctx, o.values.get("t") ?? null, o.flags.has("l"));
    if (o.operands.length === 1) {
      const arg = o.operands[0]!;
      const entries = readFstab(ctx);
      const path = sh.resolve(arg);
      const b = DisksLib.findBlock(sh.disks, arg);
      const e = entries.find((x) => x.file === path || x.spec === arg || (b !== null && DisksLib.findBlock(sh.disks, x.spec)?.name === b.name)) ?? null;
      if (e === null) {
        if (!isRoot(ctx)) ctx.err(`mount: ${path}: must be superuser to use mount.\n`);
        else ctx.err(`mount: ${arg}: can't find in /etc/fstab.\n`);
        return 1;
      }
      const opts = parseMountOptions(ctx.sh, [e.options, ...optList]);
      return doMount(ctx, e.spec, e.file, o.values.get("t") ?? (e.type === "auto" ? null : e.type), opts, verbose, true);
    }
    if (o.operands.length > 2) return UtilCmd.badOption(ctx, "bad usage");
    return doMount(ctx, o.operands[0]!, o.operands[1]!, o.values.get("t") ?? null, parseMountOptions(ctx.sh, optList), verbose);
  },
};
