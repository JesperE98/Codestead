// Port of Commands/Archive/ArchiveCmd.Tar.cs – the tar command: bundles files into an archive (.tar, .tar.gz) and
// unpacks them.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import type { Opts } from "../Util/Opts.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import {
  entryLabel,
  extractEntries,
  gunzipString,
  gzipString,
  isoDate,
  leadingSlashesRe,
  makeTar,
  readTar,
  selectEntries,
  trailingSlashesRe,
  walkTree,
} from "./ArchiveCmd.js";
import { entrySize } from "./ArchiveCmd.Sizes.js";
import type { ArchiveEntry } from "./ArchiveEntry.js";

function entryNode(e: ArchiveEntry): FsNode {
  return { type: e.type as FsNode["type"], mode: e.mode, owner: e.owner, group: e.group, mtime: e.mtime, content: null };
}

const leadingDotDotRe = /^(\.\.(\/|$))+/;

const TarTry = "Try 'tar --help' or 'tar --usage' for more information.\n";
const TarFatal = "tar: Error is not recoverable: exiting now\n";
const TarFailed = "tar: Exiting with failure status due to previous errors\n";

const oldStyleRe = /^[a-zA-Z]+$/;

/** Parses tar options, also the old style without a dash: tar czvf x.tar.gz dir */
function parseTarArgs(args: readonly string[]): Opts {
  let list = [...args];
  if (list.length > 0 && oldStyleRe.test(list[0]!) && !list[0]!.startsWith("-")) {
    const letters = list.shift()!;
    const expanded: string[] = [];
    for (const ch of letters) {
      expanded.push("-" + ch);
      if ((ch === "f" || ch === "C") && list.length > 0) expanded.push(list.shift()!);
    }
    list = [...expanded, ...list];
  }
  return UtilCmd.parseOpts(list, {
    flags: "cxtvzp",
    values: "fC",
    long: {
      create: "c",
      extract: "x",
      get: "x",
      list: "t",
      verbose: "v",
      gzip: "z",
      gunzip: "z",
      ungzip: "z",
      file: "f",
      directory: "C",
      "preserve-permissions": "p",
      "same-permissions": "p",
    },
  });
}

function tarLong(e: ArchiveEntry): string {
  const ug = `${e.owner}/${e.group}`;
  const size = Js.num(entrySize(e));
  return `${UtilCmd.modeString(entryNode(e))} ${ug}${" ".repeat(Math.max(1, 19 - ug.length - size.length))}${size} ${isoDate(e.mtime)} ${entryLabel(e)}`;
}

function tarCreate(ctx: CmdCtx, o: Opts): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  if (o.operands.length === 0) {
    ctx.err("tar: Cowardly refusing to create an empty archive\n" + TarTry);
    return 2;
  }
  const file = o.values.get("f") ?? null;
  const toStdout = file === null || file === "-";
  if (toStdout && ctx.isTTY) {
    ctx.err("tar: Refusing to write archive contents to terminal (missing -f option?)\n" + TarFatal);
    return 2;
  }
  let base = sh.cwd;
  const cdir = o.values.get("C");
  if (cdir !== undefined) {
    base = sh.resolve(cdir);
    if (sh.vfs.tryLookup(base, user)?.type !== "dir") {
      ctx.err(`tar: ${cdir}: Cannot chdir: No such file or directory\n` + TarFatal);
      return 2;
    }
  }
  const archivePath = toStdout ? null : sh.resolve(file);
  if (archivePath !== null) {
    // Just like real tar, the archive file is created (emptied) before anything is read.
    try {
      sh.vfs.writeFile(archivePath, "", user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`tar: ${file}: Cannot open: ${e.message}\n` + TarFatal);
      return 2;
    }
  }
  // When the archive goes to stdout, the list from -v goes to stderr.
  const verbose = (s: string): void => {
    if (toStdout) ctx.err(s);
    else ctx.out(s);
  };
  const entries: ArchiveEntry[] = [];
  const warned = new Set<string>();
  let failed = false;
  for (const op of o.operands) {
    const abs = VfsLib.resolvePath(base, op);
    // The archive must be extractable anywhere, so the paths are made relative.
    let name = op === "/" ? "/" : op.replace(trailingSlashesRe, "");
    const strip = (re: RegExp, prefix: string): void => {
      if (!re.test(name)) return;
      name = name.replace(re, "");
      if (!warned.has(prefix)) ctx.err(`tar: Removing leading \`${prefix}' from member names\n`);
      warned.add(prefix);
    };
    strip(leadingSlashesRe, "/");
    strip(leadingDotDotRe, "../");
    let node: FsNode;
    try {
      node = sh.vfs.lookup(abs, user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`tar: ${op}: Cannot stat: ${e.message}\n`);
      failed = true;
      continue;
    }
    walkTree(user, node, abs, name, true, {
      add: (e) => {
        entries.push(e);
        if (o.flags.has("v")) verbose(entryLabel(e) + "\n");
      },
      error: (n, msg) => {
        ctx.err(`tar: ${n}: Cannot open: ${msg}\n`);
        failed = true;
      },
      skip: (a, n) => {
        if (a !== archivePath) return false;
        ctx.err(`tar: ${n}: file is the archive; not dumped\n`);
        return true;
      },
    });
  }
  let data = makeTar(entries);
  if (o.flags.has("z")) data = gzipString(data);
  if (archivePath !== null) {
    try {
      sh.vfs.writeFile(archivePath, data, user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`tar: ${file}: Cannot write: ${e.message}\n` + TarFatal);
      return 2;
    }
  } else {
    ctx.out(data);
  }
  if (failed) ctx.err(TarFailed);
  return failed ? 2 : 0;
}

function tarRead(ctx: CmdCtx, o: Opts, extract: boolean): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  const file = o.values.get("f") ?? null;
  let raw: string;
  if (file === null || file === "-") {
    if (ctx.stdin === null) {
      ctx.err("tar: Refusing to read archive contents from terminal (missing -f option?)\n" + TarFatal);
      return 2;
    }
    raw = ctx.stdin;
  } else {
    try {
      raw = sh.vfs.readFile(sh.resolve(file), user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      const isDir = e.code === "EISDIR";
      ctx.err(`tar: ${file}: ${isDir ? "Cannot read" : "Cannot open"}: ${e.message}\n` + TarFatal);
      return 2;
    }
  }
  if (raw === "") return 0; // an empty archive contains nothing
  const gz = gunzipString(raw);
  if (o.flags.has("z") && gz === null) {
    ctx.err("gzip: stdin: not in gzip format\ntar: Child returned status 1\n" + TarFatal);
    return 2;
  }
  // GNU tar recognises compressed archives by itself when reading, even without -z.
  const entries = readTar(gz !== null ? gz.d : raw);
  if (entries === null) {
    ctx.err("tar: This does not look like a tar archive\n" + TarFailed);
    return 2;
  }
  const { selected, missing } = selectEntries(entries, o.operands);
  let failed = false;

  if (!extract) {
    for (const e of selected) ctx.out((o.flags.has("v") ? tarLong(e) : entryLabel(e)) + "\n");
  } else {
    let base = sh.cwd;
    const cdir = o.values.get("C");
    if (cdir !== undefined) {
      base = sh.resolve(cdir);
      let dir: FsNode | null = null;
      let msg = "No such file or directory";
      try {
        dir = sh.vfs.lookup(base, user);
        if (dir.type !== "dir") msg = "Not a directory";
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        msg = e.message;
      }
      if (dir?.type !== "dir") {
        ctx.err(`tar: ${cdir}: Cannot chdir: ${msg}\n` + TarFatal);
        return 2;
      }
    }
    const ok = extractEntries(ctx, selected, base, {
      keepOwner: user.uid === 0,
      umask: o.flags.has("p") || user.uid === 0 ? 0 : Js.oct(22),
      before: (e) => {
        if (o.flags.has("v")) ctx.out(entryLabel(e) + "\n");
        return true;
      },
      error: (e, what, msg) => ctx.err(`tar: ${e.path}: ${what === "dir" ? "Cannot mkdir" : "Cannot open"}: ${msg}\n`),
    });
    if (!ok) failed = true;
  }
  for (const m of missing) ctx.err(`tar: ${m}: Not found in archive\n`);
  if (missing.length > 0) failed = true;
  if (failed) ctx.err(TarFailed);
  return failed ? 2 : 0;
}

export const tar: CommandDef = {
  name: "tar",
  summary: "Packar ihop filer till ett arkiv (.tar, .tar.gz) och packar upp dem",
  man: `NAMN
       tar - packa ihop filer till ett arkiv, och packa upp dem igen
             (tape archive)

SYNOPSIS
       tar -c [-v] [-z] -f ARKIV FIL...      skapa ett arkiv
       tar -t [-v] [-z] -f ARKIV             lista innehållet
       tar -x [-v] [-z] -f ARKIV [-C KAT]    packa upp

BESKRIVNING
       tar samlar många filer och kataloger i EN fil, ett arkiv. Rättigheter,
       ägare och tidsstämplar följer med. tar komprimerar inte själv – med
       -z skickas arkivet genom gzip, och då brukar filen heta .tar.gz
       eller .tgz.

       Flaggorna kan skrivas ihop, och bindestrecket kan utelämnas:
       tar -czvf, tar czvf och tar -c -z -v -f betyder samma sak.

FLAGGOR
       -c, --create       skapa ett nytt arkiv (create)
       -x, --extract      packa upp (extract)
       -t, --list         lista innehållet (table of contents)
       -v, --verbose      visa filerna som hanteras; med -t i ls -l-format
       -f, --file=ARKIV   arkivfilen. Lägg f sist bland ihopskrivna flaggor,
                          eftersom filnamnet ska komma direkt efter
       -z, --gzip         komprimera/dekomprimera med gzip
       -C, --directory=KAT  byt till katalogen KAT först (vid -x: packa
                          upp där i stället för i aktuell katalog)
       -p                 behåll rättigheterna exakt vid uppackning

EXEMPEL
       tar -czvf dokument.tar.gz dokument     packa ihop och komprimera
       tar -tzvf dokument.tar.gz              titta i arkivet
       tar -xzvf dokument.tar.gz -C /tmp      packa upp i /tmp

MINNESREGEL
       c = create, x = extract, t = list, z = gzip, v = verbose, f = file.
       "Create Zipped Verbose File" – czvf.`,
  run: (ctx) => {
    const o = parseTarArgs(ctx.args);
    if (o.error !== null) {
      ctx.err(`tar: ${o.error}\n` + TarTry);
      return 2;
    }
    const ops = ["c", "x", "t"].filter((f) => o.flags.has(f));
    if (ops.length === 0) {
      ctx.err("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\n" + TarTry);
      return 2;
    }
    if (ops.length > 1) {
      ctx.err("tar: You may not specify more than one '-Acdtrux', '--delete' or  '--test-label' option\n" + TarTry);
      return 2;
    }
    if (ops[0] === "c") return tarCreate(ctx, o);
    return tarRead(ctx, o, ops[0] === "x");
  },
};
