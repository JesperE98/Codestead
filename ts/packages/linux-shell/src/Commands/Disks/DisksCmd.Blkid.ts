// Port of Commands/Disks/DisksCmd.Blkid.cs – the blkid command: shows the type, label and UUID of file systems.

import type { Block } from "../../Disks/Block.js";
import * as DisksLib from "../../Disks/DisksLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { long } from "./DisksCmd.js";

const blkidMan = `NAMN
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
       blkid -L USBSTICK`;

const blkidManEn = `NAME
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
       blkid -L USBSTICK`;

const leading0x = /^0x/;

function blkidTags(b: Block): [string, string][] {
  const d = b.dev;
  const tags: [string, string][] = [];
  if (d.fstype === null || d.fstype === undefined || d.fstype === "") {
    const pttype = b.disk.pttype ?? "";
    if ((b.part === null || b.part === undefined) && pttype !== "") {
      tags.push(["PTUUID", pttype === "dos" ? b.disk.diskId!.replace(leading0x, "") : b.disk.diskId!.toLowerCase()]);
      tags.push(["PTTYPE", pttype]);
    }
    return tags;
  }
  if (d.label !== null && d.label !== undefined && d.label !== "") tags.push(["LABEL", d.label]);
  if (d.uuid !== null && d.uuid !== undefined && d.uuid !== "") tags.push(["UUID", d.uuid]);
  if (d.fstype !== "swap") tags.push(["BLOCK_SIZE", d.fstype === "vfat" ? "512" : "4096"]);
  tags.push(["TYPE", d.fstype]);
  if (b.part !== null && b.part !== undefined) tags.push(["PARTUUID", b.part.partuuid]);
  return tags;
}

export const blkid: CommandDef = {
  name: "blkid",
  summary: "Visar filsystemens typ, etikett och UUID",
  summaryEn: "Show the type, label and UUID of file systems",
  man: blkidMan,
  manEn: blkidManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "cp",
      values: "soLU",
      long: long(["match-tag", "s"], ["output", "o"], ["label", "L"], ["uuid", "U"]),
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const state = ctx.sh.disks;
    const L = o.values.get("L");
    const U = o.values.get("U");
    if (L !== undefined || U !== undefined) {
      const b = DisksLib.findBlock(state, L !== undefined ? `LABEL=${L}` : `UUID=${U}`);
      if (b === null) return 2;
      ctx.out(b.path + "\n");
      return 0;
    }
    const format = o.values.get("o") ?? "full";
    if (!["full", "value", "export", "device", "list"].includes(format)) {
      ctx.err(`blkid: unsupported output format ${format}\n`);
      return 2;
    }
    let blocks: Block[];
    if (o.operands.length > 0) {
      blocks = [];
      for (const op of o.operands) {
        const b = DisksLib.findBlock(state, op);
        if (b !== null) blocks.push(b);
      }
    } else {
      blocks = DisksLib.allBlocks(state).filter((b) => b.dev.fstype !== null && b.dev.fstype !== undefined && b.dev.fstype !== "");
    }
    let found = false;
    const s = o.values.get("s");
    for (const b of blocks) {
      let tags = blkidTags(b);
      if (s !== undefined && s !== "") tags = tags.filter(([k]) => k === s.toUpperCase());
      if (tags.length === 0) continue;
      found = true;
      if (format === "value") for (const [, v] of tags) ctx.out(v + "\n");
      else if (format === "device") ctx.out(b.path + "\n");
      else if (format === "export") ctx.out(`DEVNAME=${b.path}\n${tags.map(([k, v]) => `${k}=${v}\n`).join("")}\n`);
      else ctx.out(`${b.path}: ${tags.map(([k, v]) => `${k}="${v}"`).join(" ")}\n`);
    }
    return found ? 0 : 2;
  },
};
