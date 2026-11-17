// Port of Commands/System/SystemCmd.Man.cs – the man command: shows the manual for a command.

import * as IndexCmd from "../IndexCmd.js";
import * as ManEnCmd from "../Man/ManEnCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

const sectionRe = /^[0-9]$/;

export const man = simple(
  "man",
  "Visar manualen för ett kommando",
  (ctx) => {
    const name = ctx.args.find((a) => !sectionRe.test(a)) ?? null;
    if (name === null || name === "") {
      ctx.err("What manual page do you want?\nFor example, try 'man man'.\n");
      return 1;
    }
    const def = IndexCmd.commands().get(name) ?? null;
    const available = def?.builtin === true || ctx.sh.resolveCommand(name).kind !== "notfound";
    if (def === null || !available) {
      ctx.err(`No manual entry for ${name}\n`);
      return 16;
    }
    ctx.out(UtilCmd.formatMan(name, ManEnCmd.manFor(def, ctx.sh)));
    if (ctx.isTTY) {
      ctx.out(`${UtilCmd.Color.dim}(${ctx.sh.msg("system.manScrollHint")})${UtilCmd.Color.reset}\n`);
    }
    return 0;
  },
  `NAMN
       man - visa manualsidor

SYNOPSIS
       man KOMMANDO

BESKRIVNING
       Nästan alla kommandon har en manualsida. Det är det första stället
       att leta på när du undrar vad en flagga gör. I simulatorn är
       manualerna förenklade och på svenska.`,
);
