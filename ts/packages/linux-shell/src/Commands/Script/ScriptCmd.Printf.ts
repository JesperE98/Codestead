// Port of Commands/Script/ScriptCmd.Printf.cs – the printf command: prints formatted text.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as ScriptCmd from "./ScriptCmd.js";

export const printf: CommandDef = {
  name: "printf",
  builtin: true,
  summary: "Skriver ut formaterad text",
  man: `NAMN
       printf - skriv ut formaterad text

SYNOPSIS
       printf FORMAT [ARGUMENT]...

BESKRIVNING
       Som echo, men du styr exakt hur utskriften ser ut. Ingen radbrytning
       läggs till automatiskt – skriv \\n där du vill ha en.

FORMAT
       %s     text            %d     heltal
       %5s    högerjustera i 5 tecken   %-10s  vänsterjustera i 10 tecken
       %.2f   decimaltal med 2 decimaler
       %%     ett procenttecken

EXEMPEL
       printf "Hej %s!\\n" "$USER"
       printf "%-10s %5d\\n" äpplen 3`,
  run: (ctx) => {
    if (ctx.args.length === 0) {
      ctx.err("printf: usage: printf format [arguments]\n");
      return 2;
    }
    ctx.out(ScriptCmd.formatPrintf(ctx.args[0]!, ctx.args.slice(1)));
    return 0;
  },
};
