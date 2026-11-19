// Port of Commands/Disks/DisksCmd.Swapon.cs – the swapon command: shows and enables swap.

import * as DisksLib from "../../Disks/DisksLib.js";
import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { isRoot, table } from "./DisksCmd.js";

const swaponMan = `NAMN
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
       free -h`;

const swaponManEn = `NAME
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
       free -h`;

export const swapon: CommandDef = {
  name: "swapon",
  summary: "Visar och slår på swap",
  summaryEn: "Show and enable swap",
  man: swaponMan,
  manEn: swaponManEn,
  run: (ctx) => {
    const args = ctx.args;
    const state = ctx.sh.disks;
    const active = DisksLib.allBlocks(state).filter((b) => b.dev.swapActive === true);
    const a0 = args.length > 0 ? args[0]! : null;
    if (args.length === 0 || a0 === "--show" || a0 === "-s" || a0 === "--summary") {
      if (a0 === "-s" || a0 === "--summary") {
        ctx.out("Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority\n");
        for (const b of active)
          ctx.out(`${b.path.padEnd(40)}partition\t${Js.num(DisksLib.blockSize(b.dev) / 1024.0)}\t\t0\t\t${b.disk.tran !== "" ? -2 : 100}\n`);
        return 0;
      }
      const rows: string[][] = [["NAME", "TYPE", "SIZE", "USED", "PRIO"]];
      for (const b of active) rows.push([b.path, "partition", DisksLib.lsblkSize(DisksLib.blockSize(b.dev)), "0B", b.disk.tran !== "" ? "-2" : "100"]);
      ctx.out(table(rows, ["l", "l", "r", "r", "r"]));
      return 0;
    }
    if (a0 === "-a" || a0 === "--all") return isRoot(ctx) ? 0 : 1;
    const blk = DisksLib.findBlock(state, a0!);
    if (blk === null) {
      ctx.err(`swapon: cannot open ${a0}: No such file or directory\n`);
      return 1;
    }
    if (!isRoot(ctx)) {
      ctx.err(`swapon: ${blk.path}: swapon failed: Operation not permitted\n`);
      return 1;
    }
    if (blk.dev.swapActive === true) ctx.err(`swapon: ${blk.path}: swapon failed: Device or resource busy\n`);
    else ctx.err(`swapon: ${blk.path}: read swap header failed\n`);
    return 1;
  },
};
