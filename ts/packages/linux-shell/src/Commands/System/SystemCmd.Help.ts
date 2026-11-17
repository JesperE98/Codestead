// Port of Commands/System/SystemCmd.Help.cs – the help command: lists all available commands.

import * as IndexCmd from "../IndexCmd.js";
import * as ManEnCmd from "../Man/ManEnCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

const lowercaseStartRe = /^[a-z]/;

export const help = simple(
  "help",
  "Listar alla kommandon som finns",
  (ctx) => {
    const sh = ctx.sh;
    const names = sh.availableCommands().filter((n) => lowercaseStartRe.test(n) && IndexCmd.commands().get(n)?.name === n);
    ctx.out(sh.msg("system.helpHeader", { distro: sh.distro.name }));
    ctx.out(sh.msg("system.helpManHint"));
    for (const n of names) ctx.out(`  ${n.padEnd(11)} ${ManEnCmd.summaryFor(IndexCmd.commands().get(n)!, sh)}\n`);
    ctx.out(`\n${UtilCmd.Color.dim}${sh.msg("system.helpMissingProgram", { pm: sh.distro.packageManager })}${UtilCmd.Color.reset}\n`);
    return 0;
  },
  `NAMN
       help - lista kommandon i simulatorn`,
  true,
);
