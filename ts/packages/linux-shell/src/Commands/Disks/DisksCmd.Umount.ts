// Port of Commands/Disks/DisksCmd.Umount.cs – the umount command: unmounts a file system.

import * as DisksLib from "../../Disks/DisksLib.js";
import type { Mount } from "../../Disks/Mount.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isRoot, labelUuidPrefix, long, tip } from "./DisksCmd.js";

const umountMan = `NAMN
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
       sudo umount /dev/sdb1`;

const umountManEn = `NAME
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
       sudo umount /dev/sdb1`;

export const umount: CommandDef = {
  name: "umount",
  summary: "Avmonterar ett filsystem",
  summaryEn: "Unmount a file system",
  man: umountMan,
  manEn: umountManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "vfl", long: long(["verbose", "v"], ["force", "f"], ["lazy", "l"]) });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) {
      ctx.err("umount: bad usage\nTry 'umount --help' for more information.\n");
      return 1;
    }
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    let code = 0;
    for (const arg of o.operands) {
      const block = arg.startsWith("/dev/") || labelUuidPrefix.test(arg) ? DisksLib.findBlock(state, arg) : null;
      let m: Mount | null;
      let shown: string;
      if (block !== null) {
        shown = block.path;
        m = DisksLib.mountsOf(state, block.name).at(-1) ?? null;
      } else {
        const target = sh.resolve(arg);
        shown = target;
        m = state.mounts.findLast((x) => x.target === target) ?? null;
        if (m === null && sh.vfs.tryLookup(target, root) === null) {
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
      if (m === null) {
        ctx.err(`umount: ${shown}: not mounted.\n`);
        code = 32;
        continue;
      }
      const t = m.target;
      const inside = (p: string): boolean => p === t || p.startsWith(t === "/" ? "/" : t + "/");
      const cur = m;
      const nested = state.mounts.some((x) => x !== cur && x.target !== t && inside(x.target));
      if (m.system === true || nested || inside(sh.cwd)) {
        ctx.err(`umount: ${t}: target is busy.\n`);
        if (inside(sh.cwd) && m.system !== true) {
          tip(ctx, "disks.shellInsideDir");
        }
        code = 32;
        continue;
      }
      const { dir, name } = sh.vfs.parent(t, root);
      const fsRoot = dir.children!.get(name) ?? null;
      if (m.dev !== null && m.dev !== undefined) {
        const b = DisksLib.findBlock(state, m.dev);
        if (b !== null) b.dev.root = fsRoot?.type === "dir" ? fsRoot : VfsLib.makeDir();
      }
      if (m.under !== null && m.under !== undefined) dir.children!.set(name, m.under);
      else dir.children!.set(name, VfsLib.makeDir());
      const removed = m;
      state.mounts = state.mounts.filter((x) => x !== removed);
      DisksLib.writeProcMounts(sh.vfs, state);
      if (o.flags.has("v")) ctx.out(`umount: ${t} unmounted\n`);
    }
    return code;
  },
};
