// Port of Commands/Text/TextCmd.Echo.cs – the echo command: prints text.

import type { CommandDef } from "../../Types/CommandDef.js";

const echoFlagRe = /^-[neE]+$/;

export const echo: CommandDef = {
  name: "echo",
  builtin: true,
  summary: "Skriver ut text",
  man: `NAMN
       echo - skriv ut en rad text

SYNOPSIS
       echo [-n] [-e] [TEXT]...

FLAGGOR
       -n    skriv inte ut någon radbrytning på slutet
       -e    tolka \\n (ny rad) och \\t (tabb)

EXEMPEL
       echo Hej världen
       echo "Min hemkatalog är $HOME"
       echo 'Enkla citattecken: $HOME skrivs ut som det står'`,
  run: (ctx) => {
    let newline = true;
    let escapes = false;
    const args = [...ctx.args];
    while (args.length > 0 && echoFlagRe.test(args[0]!)) {
      const f = args.shift()!;
      if (f.includes("n")) newline = false;
      if (f.includes("e")) escapes = true;
      if (f.includes("E")) escapes = false;
    }
    let text = args.join(" ");
    if (escapes) text = text.replaceAll("\\n", "\n").replaceAll("\\t", "\t").replaceAll("\\\\", "\\");
    ctx.out(text + (newline ? "\n" : ""));
    return 0;
  },
};
