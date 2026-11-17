// Port of Commands/Ssh/SshCmd.Rsync.cs – the rsync command: synchronize directories (locally or over SSH), copying
// only what changed.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { copyFor, joinPath, localPlace, type Place, remotePlace, splitRemote, withServer } from "./SshCmd.Transfer.js";

export const rsync: CommandDef = {
  name: "rsync",
  summary: "Synkroniserar kataloger (lokalt eller över SSH) och kopierar bara det som ändrats",
  summaryEn: "Synchronize directories (locally or over SSH), copying only what changed",
  man: `NAMN
       rsync - synkronisera filer och kataloger

SYNOPSIS
       rsync [-av] [--delete] [-n] KÄLLA... MÅL

BESKRIVNING
       Kopierar KÄLLA till MÅL, men bara filer som saknas eller har
       ändrats – andra gången går det därför mycket fortare. KÄLLA eller
       MÅL kan ligga på en annan dator ([ANVÄNDARE@]VÄRD:SÖKVÄG, över
       ssh).

       Ett snedstreck sist i KÄLLA är viktigt:
           rsync -a bilder  backup/   ger backup/bilder/...
           rsync -a bilder/ backup/   ger backup/... (bara innehållet)

FLAGGOR
       -a, --archive   kopiera kataloger rekursivt och behåll
                       rättigheter och tider (det du nästan alltid vill)
       -r              kopiera kataloger rekursivt
       -v, --verbose   visa vilka filer som kopieras
       -n, --dry-run   visa vad som skulle hända, men gör inget
       --delete        ta bort filer i MÅL som inte finns i KÄLLA
       -z              komprimera under överföringen
       -P, --progress  visa förloppet

EXEMPEL
       rsync -av projekt/ backup/projekt/
       rsync -av --delete projekt/ $USER@server.lan:projekt/
       rsync -avn --delete projekt/ backup/   (prova först!)`,
  manEn: `NAME
       rsync - synchronize files and directories

SYNOPSIS
       rsync [-av] [--delete] [-n] SOURCE... TARGET

DESCRIPTION
       Copies SOURCE to TARGET, but only files that are missing or have
       changed – so the second time is much faster. SOURCE or TARGET can
       be on another computer ([USER@]HOST:PATH, over ssh).

       A slash at the end of SOURCE matters:
           rsync -a pictures  backup/   gives backup/pictures/...
           rsync -a pictures/ backup/   gives backup/... (just the content)

OPTIONS
       -a, --archive   copy directories recursively and keep permissions
                       and times (what you almost always want)
       -r              copy directories recursively
       -v, --verbose   show which files are copied
       -n, --dry-run   show what would happen, but do nothing
       --delete        delete files in TARGET that are not in SOURCE
       -z              compress during the transfer
       -P, --progress  show the progress

EXAMPLES
       rsync -av project/ backup/project/
       rsync -av --delete project/ $USER@server.lan:project/
       rsync -avn --delete project/ backup/   (try it first!)`,
  run: runRsync,
};

function runRsync(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "avrnzPhuqtpogD",
    values: "e",
    long: {
      archive: "a", verbose: "v", recursive: "r", "dry-run": "n", compress: "z",
      progress: "P", "human-readable": "h", update: "u", quiet: "q", delete: "X",
      times: "t", perms: "p",
    },
  });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
  const sh = ctx.sh;
  if (o.operands.length < 2) {
    ctx.err("rsync  version 3.4.1  protocol version 32\nUsage: rsync [OPTION]... SRC [SRC]... DEST\n");
    return 1;
  }
  const remotes = o.operands.map(splitRemote);
  const hosts = [...new Set(remotes.filter((r) => r !== null).map((r) => r.raw))];
  const last = remotes.at(-1) ?? null;
  if (hosts.length > 1 || (last !== null && remotes.slice(0, -1).some((r) => r !== null))) {
    ctx.err("The source and destination cannot both be remote.\nrsync error: syntax or usage error (code 1) at main.c(1494) [Receiver=3.4.1]\n");
    return 1;
  }
  const opts: SyncOptions = {
    recursive: o.flags.has("a") || o.flags.has("r"),
    archive: o.flags.has("a") || o.flags.has("t"),
    verbose: o.flags.has("v") || o.flags.has("P"),
    dryRun: o.flags.has("n"),
    delete: o.flags.has("X"),
  };
  const sourceArgs = o.operands.slice(0, -1);
  const target = o.operands.at(-1)!;
  if (hosts.length === 0) {
    return sync(
      sourceArgs.map((s) => localPlace(sh, s)),
      localPlace(sh, target),
      opts,
      ctx,
    );
  }
  return withServer(ctx, "rsync", hosts[0]!, null, (server, io) => {
    const toServer = last !== null;
    const dest = last !== null ? remotePlace(server, last.path, target) : localPlace(sh, target);
    const from = sourceArgs.map((s) => (toServer ? localPlace(sh, s) : remotePlace(server, splitRemote(s)!.path, s)));
    return sync(from, dest, opts, io);
  });
}

interface SyncOptions {
  recursive: boolean;
  archive: boolean;
  verbose: boolean;
  dryRun: boolean;
  delete: boolean;
}

/**
 * rsync: makes the target like the sources, transferring only files whose content differs.
 * The list of what changed is shown with -v (directories end with /).
 */
function sync(sources: Place[], dest: Place, o: SyncOptions, io: Sink): number {
  const lines: string[] = [];
  let sent = 0;
  let total = 0;
  let code = 0;
  const dry = o.dryRun;
  const dsh = dest.sh;
  const du = dest.user;

  // The target directory is created if it is missing (one level, like rsync).
  const destNode = dsh.vfs.tryLookup(dest.path, du);
  // The target is a directory when it is one already, ends with /, or gets several things or a directory.
  const intoDir =
    destNode?.type === "dir" || dest.slash || sources.length > 1 || sources.some((s) => s.slash || (o.recursive && s.sh.vfs.tryLookup(s.path, s.user)?.type === "dir"));
  const createdRoot = destNode === null && intoDir;
  if (createdRoot) {
    if (!dry) {
      try {
        dsh.vfs.mkdir(dest.path, du);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`rsync: [Receiver] mkdir "${dest.path}" failed: ${e.message} (2)\nrsync error: error in file IO (code 11) at main.c(791) [Receiver=3.4.1]\n`);
        return 11;
      }
    }
    lines.push(`created directory ${dest.label.replace(/\/+$/, "")}`);
  }

  const put = (src: FsNode, targetPath: string, rel: string): void => {
    let existing = dsh.vfs.tryLookupLink(targetPath, du);
    if (src.type === "dir") {
      if (existing !== null && existing.type !== "dir") {
        if (!dry) dsh.vfs.remove(targetPath, du);
        existing = null;
      }
      if (existing === null || (rel === "" && createdRoot)) {
        if (existing === null && !dry) dsh.vfs.mkdir(targetPath, du);
        lines.push(rel === "" ? "./" : rel + "/");
      }
      const have = [...((existing ?? (dry ? null : dsh.vfs.tryLookup(targetPath, du)))?.children?.keys() ?? [])];
      // rsync sends the files sorted by name.
      for (const [name, child] of [...src.children!].sort((a, b) => Js.ordinal(a[0], b[0]))) {
        if (child.type === "dir" && !o.recursive) continue;
        put(child, joinPath(targetPath, name), rel === "" ? name : `${rel}/${name}`);
      }
      if (o.delete) {
        for (const name of have.filter((n) => !src.children!.has(n)).sort()) {
          lines.push(`deleting ${rel === "" ? name : `${rel}/${name}`}`);
          if (!dry) dsh.vfs.remove(joinPath(targetPath, name), du);
        }
      }
      if (!dry && o.archive) dsh.vfs.tryLookup(targetPath, du)!.mode = src.mode;
      return;
    }
    total += VfsLib.nodeSize(src);
    // rsync's quick check: the same size and modification time means the same file. Without -a (-t)
    // the copies get new times, so every run sends everything again.
    const same = existing !== null && existing.type === src.type && VfsLib.nodeSize(existing) === VfsLib.nodeSize(src) && existing.mtime === src.mtime;
    if (same) return;
    sent += VfsLib.nodeSize(src);
    lines.push(rel);
    if (dry) return;
    if (existing?.type === "dir") throw new FsError("EISDIR");
    const copy = copyFor(src, du, o.archive);
    if (!o.archive) copy.mode = dsh.vfs.newFileMode | (src.mode & Js.oct(111) & ~dsh.vfs.umask);
    dsh.vfs.insert(targetPath, copy, du);
  };

  for (const s of sources) {
    let node: FsNode;
    try {
      node = s.sh.vfs.lookup(s.path, s.user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      io.err(`rsync: [sender] link_stat "${s.path}" failed: ${e.message} (2)\n`);
      code = 23;
      continue;
    }
    if (node.type === "dir" && !o.recursive) {
      const l = s.label.replace(/\/+$/, "");
      lines.push(`skipping directory ${l.length > 0 ? l : "."}`);
      continue;
    }
    try {
      const name = VfsLib.basename(s.path);
      if (node.type === "dir" && s.slash) put(node, dest.path, "");
      else if (intoDir) put(node, joinPath(dest.path, name), name);
      else put(node, dest.path, name);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      io.err(`rsync: [Receiver] ${s.label}: ${e.message} (13)\n`);
      code = 23;
    }
  }

  if (o.verbose) {
    io.out("sending incremental file list\n");
    for (const l of lines) io.out(l + "\n");
    io.out(`\nsent ${formatBytes(sent + 60 + 20 * lines.length)} bytes  received ${formatBytes(35 + 12 * lines.length)} bytes  ${formatBytes(sent + 100)}.00 bytes/sec\n`);
    const speedup = total === 0 ? 0 : total / (sent + 95 + 32 * lines.length);
    io.out(`total size is ${formatBytes(total)}  speedup is ${Js.toFixed(speedup, 2)}${dry ? " (DRY RUN)" : ""}\n`);
  } else {
    for (const l of lines.filter((l) => l.startsWith("skipping directory"))) io.out(l + "\n");
  }
  if (code === 23) io.err("rsync error: some files/attrs were not transferred (see previous errors) (code 23) at main.c(1338) [sender=3.4.1]\n");
  return code;
}

/** n.ToString("#,0", CultureInfo.InvariantCulture): digits grouped by three with commas. */
function formatBytes(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
