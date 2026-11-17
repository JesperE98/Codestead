// Port of Commands/Fs/FsCmd.Ls.cs – the ls command: lists the contents of directories.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import { VFS } from "../../Vfs/VFS.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { joinPath } from "./FsCmd.js";

function lsCompare(a: string, b: string): number {
  const ka = a.replace(/^\.+/, "").toLowerCase();
  const kb = b.replace(/^\.+/, "").toLowerCase();
  const c = Js.ordinal(ka, kb);
  if (c !== 0) return c;
  return Js.ordinal(a, b);
}

/** A name ls shows. path is where it is (to follow a symbolic link). */
interface Entry {
  name: string;
  node: FsNode;
  path: string;
}

export const ls: CommandDef = {
  name: "ls",
  summary: "Listar innehållet i kataloger",
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
       -F              lägg till / efter kataloger, * efter körbara filer och
                       @ efter symboliska länkar
       -i              visa inodnumret före varje namn
       -1              en fil per rad

EXEMPEL
       ls -la ~        allt i hemkatalogen, i långt format`,
  run: (ctx) => runLs(ctx),
};

function runLs(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "laAh1dFi",
    long: { all: "a", "almost-all": "A", "human-readable": "h", directory: "d", classify: "F" },
  });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
  const sh = ctx.sh;
  const user = sh.currentUser();
  const isLong = o.flags.has("l");
  const targets = o.operands.length > 0 ? o.operands : ["."];
  let code = 0;

  const files: Entry[] = [];
  const dirs: { label: string; path: string; node: FsNode }[] = [];
  for (const t of targets) {
    try {
      const path = sh.resolve(t);
      // A symbolic link given by name is shown as a link with -l and -d (ls link/ follows it).
      const node = (isLong || o.flags.has("d")) && !t.endsWith("/") ? sh.vfs.lookup(path, user, false) : sh.vfs.lookup(path, user);
      if (node.type === "dir" && !o.flags.has("d")) dirs.push({ label: t, path, node });
      else files.push({ name: t, node, path });
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`ls: cannot access '${t}': ${e.message}\n`);
      code = 2;
    }
  }

  const broken = (e: Entry): boolean => e.node.type === "link" && sh.vfs.tryLookup(e.path, user) === null;
  const suffix = (n: FsNode): string =>
    !o.flags.has("F") ? "" : n.type === "dir" ? "/" : n.type === "link" ? (isLong ? "" : "@") : (n.mode & Js.oct(111)) !== 0 ? "*" : "";
  const display = (e: Entry): string =>
    (o.flags.has("i") && !isLong ? `${Js.num(sh.vfs.inoOf(e.node))} ` : "") +
    UtilCmd.colorName(e.name, e.node, ctx.isTTY, broken(e)) +
    suffix(e.node) +
    (isLong && e.node.type === "link" ? ` -> ${e.node.content}` : "");
  const size = (n: FsNode): string => (o.flags.has("h") ? UtilCmd.humanSize(VfsLib.nodeSize(n)) : Js.num(VfsLib.nodeSize(n)));
  const links = (n: FsNode): number => VFS.linkCount(n);
  const maxLen = (xs: string[]): number => Math.max(1, ...xs.map((x) => x.length));

  const render = (entries: Entry[], showTotal: boolean): void => {
    if (isLong) {
      if (showTotal) {
        let blocks = 0;
        for (const e of entries) blocks += Math.ceil(VfsLib.nodeSize(e.node) / 4096) * 4;
        ctx.out(`total ${blocks}\n`);
      }
      const wLinks = maxLen(entries.map((e) => Js.num(links(e.node))));
      const wOwner = maxLen(entries.map((e) => e.node.owner));
      const wGroup = maxLen(entries.map((e) => e.node.group));
      const wSize = maxLen(entries.map((e) => size(e.node)));
      const wIno = o.flags.has("i") ? maxLen(entries.map((e) => Js.num(sh.vfs.inoOf(e.node)))) : 0;
      for (const e of entries) {
        ctx.out(
          (o.flags.has("i") ? Js.num(sh.vfs.inoOf(e.node)).padStart(wIno) + " " : "") +
            `${UtilCmd.modeString(e.node)} ${Js.num(links(e.node)).padStart(wLinks)} ${e.node.owner.padEnd(wOwner)} ` +
            `${e.node.group.padEnd(wGroup)} ${size(e.node).padStart(wSize)} ${UtilCmd.lsDate(e.node.mtime)} ${display(e)}\n`,
        );
      }
    } else if (entries.length > 0) {
      if (ctx.isTTY && !o.flags.has("1")) ctx.out(entries.map(display).join("  ") + "\n");
      else for (const e of entries) ctx.out(display(e) + "\n");
    }
  };

  render(files, false);
  for (let idx = 0; idx < dirs.length; idx++) {
    const d = dirs[idx]!;
    if (targets.length > 1) ctx.out(`${files.length > 0 || idx > 0 ? "\n" : ""}${d.label}:\n`);
    if (!VfsLib.hasPerm(d.node, user, "r")) {
      ctx.err(`ls: cannot open directory '${d.label}': Permission denied\n`);
      code = 2;
      continue;
    }
    let names = [...d.node.children!.keys()];
    if (!o.flags.has("a") && !o.flags.has("A")) names = names.filter((n) => !n.startsWith("."));
    names.sort(lsCompare);
    const entries: Entry[] = names.map((n) => ({ name: n, node: d.node.children!.get(n)!, path: joinPath(d.path, n) }));
    if (o.flags.has("a")) {
      const parent = sh.vfs.tryLookup(sh.resolve(d.path + "/.."), user) ?? d.node;
      entries.unshift({ name: ".", node: d.node, path: d.path }, { name: "..", node: parent, path: VfsLib.dirname(d.path) });
    }
    render(entries, true);
  }
  return code;
}
