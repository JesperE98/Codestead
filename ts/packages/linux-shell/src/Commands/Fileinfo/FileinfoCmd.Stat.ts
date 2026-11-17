// Port of Commands/Fileinfo/FileinfoCmd.Stat.cs – the stat command: display everything about a file: size,
// permissions, owner, inode and times.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import { VFS } from "../../Vfs/VFS.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { octal, statTime } from "./FileinfoCmd.js";

function fileType(n: FsNode): string {
  return n.type === "dir"
    ? "directory"
    : n.type === "link"
      ? "symbolic link"
      : (n.content ?? "") === "" && (n.size === null || n.size === undefined)
        ? "regular empty file"
        : "regular file";
}

function uidOf(sh: Shell, name: string): number {
  return UsersLib.findUser(sh, name)?.uid ?? (name === "root" ? 0 : 65534);
}

function gidOf(sh: Shell, group: string): number {
  return UsersLib.gidOf(sh, group) ?? (group === "root" ? 0 : 65534);
}

function statFormat(sh: Shell, format: string, name: string, n: FsNode): string {
  let sb = "";
  for (let i = 0; i < format.length; i++) {
    const c = format[i]!;
    if (c === "\\" && i + 1 < format.length) {
      const e = format[++i]!;
      sb += e === "n" ? "\n" : e === "t" ? "\t" : e === "\\" ? "\\" : "\\" + e;
      continue;
    }
    if (c !== "%" || i + 1 >= format.length) {
      sb += c;
      continue;
    }
    const f = format[++i]!;
    switch (f) {
      case "n": sb += name; break;
      case "N": sb += n.type === "link" ? `'${name}' -> '${n.content}'` : `'${name}'`; break;
      case "s": sb += Js.num(VfsLib.nodeSize(n)); break;
      case "a": sb += octal(n.mode); break;
      case "A": sb += UtilCmd.modeString(n); break;
      case "U": sb += n.owner; break;
      case "u": sb += Js.num(uidOf(sh, n.owner)); break;
      case "G": sb += n.group; break;
      case "g": sb += Js.num(gidOf(sh, n.group)); break;
      case "i": sb += Js.num(sh.vfs.inoOf(n)); break;
      case "h": sb += Js.num(VFS.linkCount(n)); break;
      case "F": sb += fileType(n); break;
      case "y": case "x": case "z": sb += statTime(n.mtime); break;
      case "Y": case "X": case "Z": sb += Js.num(Math.trunc(n.mtime / 1000)); break;
      case "b": sb += Js.num(blocks(n)); break;
      case "%": sb += "%"; break;
      default: sb += "?"; break;
    }
  }
  return sb;
}

function blocks(n: FsNode): number {
  return n.type === "link" ? 0 : Math.ceil(VfsLib.nodeSize(n) / 4096) * 8;
}

export const stat: CommandDef = {
  name: "stat",
  summary: "Visar allt om en fil: storlek, rättigheter, ägare, inod och tider",
  summaryEn: "Display everything about a file: size, permissions, owner, inode and times",
  man: `NAMN
       stat - visa information om filer

SYNOPSIS
       stat [-L] [-c FORMAT] FIL...

BESKRIVNING
       Visar filens typ, storlek, inodnummer, antal hårda länkar,
       rättigheter (både som siffror och som rwx), ägare och grupp och
       när filen ändrades. En symbolisk länk visas som länk; med -L
       visas filen den pekar på.

FLAGGOR
       -L          följ symboliska länkar
       -c FORMAT   skriv bara det FORMAT ber om, t.ex.:
                   %n namn   %s storlek   %a rättigheter (644)
                   %A rättigheter (-rw-r--r--)   %U ägare   %G grupp
                   %i inod   %h antal länkar   %F filtyp   %y ändrad

EXEMPEL
       stat anteckningar.txt
       stat -c '%a %U %n' *.txt`,
  manEn: `NAME
       stat - display file status

SYNOPSIS
       stat [-L] [-c FORMAT] FILE...

DESCRIPTION
       Shows the file's type, size, inode number, number of hard links,
       permissions (both as digits and as rwx), owner and group and when
       the file was changed. A symbolic link is shown as a link; with -L
       the file it points to is shown.

OPTIONS
       -L          follow symbolic links
       -c FORMAT   print only what FORMAT asks for, for example:
                   %n name   %s size   %a permissions (644)
                   %A permissions (-rw-r--r--)   %U owner   %G group
                   %i inode   %h number of links   %F file type   %y modified

EXAMPLES
       stat notes.txt
       stat -c '%a %U %n' *.txt`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "Lt", values: "c", long: { dereference: "L", terse: "t" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing operand");
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const arg of o.operands) {
      let n: FsNode;
      try {
        n = sh.vfs.lookup(sh.resolve(arg), user, o.flags.has("L"));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`stat: cannot statx '${arg}': ${e.message}\n`);
        code = 1;
        continue;
      }
      const format = o.values.get("c");
      if (format !== undefined) {
        ctx.out(statFormat(sh, format, arg, n) + "\n");
        continue;
      }
      const shown = n.type === "link" ? `${arg} -> ${n.content}` : arg;
      const size = Js.num(VfsLib.nodeSize(n));
      const blockCount = Js.num(blocks(n));
      const t = statTime(n.mtime);
      ctx.out(
        `  File: ${shown}\n` +
          `  Size: ${size.padEnd(10)}\tBlocks: ${blockCount.padEnd(10)} IO Block: 4096   ${fileType(n)}\n` +
          `Device: 8,3\tInode: ${Js.num(sh.vfs.inoOf(n)).padEnd(11)} Links: ${Js.num(VFS.linkCount(n))}\n` +
          `Access: (${octal(n.mode).padStart(4, "0")}/${UtilCmd.modeString(n)})  Uid: (${Js.num(uidOf(sh, n.owner)).padStart(5)}/${n.owner.padStart(8)})   Gid: (${Js.num(gidOf(sh, n.group)).padStart(5)}/${n.group.padStart(8)})\n` +
          `Access: ${t}\nModify: ${t}\nChange: ${t}\n Birth: ${t}\n`,
      );
    }
    return code;
  },
};
