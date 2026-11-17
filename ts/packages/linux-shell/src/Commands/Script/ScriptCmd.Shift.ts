// Port of Commands/Script/ScriptCmd.Shift.cs – the shift command: shifts the script's arguments one step ($2
// becomes $1).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";

export const shift: CommandDef = {
  name: "shift",
  builtin: true,
  summary: "Flyttar skriptets argument ett steg ($2 blir $1)",
  man: `NAMN
       shift - flytta positionsparametrarna

SYNOPSIS
       shift [N]

BESKRIVNING
       $2 blir $1, $3 blir $2 och så vidare. Med N flyttas de N steg.`,
  run: (ctx) => {
    const n = Js.number(ctx.args.length > 0 ? ctx.args[0] : "1");
    const args = ctx.sh.args;
    if (n > args.length) return 1;
    // slice(n): NaN is 0, fractions are truncated.
    const start = Number.isNaN(n) ? 0 : Math.trunc(n);
    ctx.sh.setArgs(args.slice(start));
    return 0;
  },
};
