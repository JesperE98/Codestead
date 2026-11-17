// Port of Commands/Extras/ExtrasCmd.Cowsay.cs – the cowsay command: a cow that says something.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as TextCmd from "../Text/TextCmd.js";

export const cowsay: CommandDef = {
  name: "cowsay",
  summary: "En ko som säger något",
  man: `NAMN
       cowsay - en pratande ko

EXEMPEL
       cowsay Hej!
       fortune | cowsay`,
  run: (ctx) => {
    let text = ctx.args.length > 0 ? ctx.args.join(" ") : TextCmd.jsTrim(ctx.stdin ?? "");
    if (text === "") text = "Muu!";
    const lines = text.split("\n");
    const w = Math.max(...lines.map((l) => Js.codePointLength(l)));
    const pad = (l: string): string => l + Js.repeat(" ", w - Js.codePointLength(l));
    let bubble = ` ${Js.repeat("_", w + 2)}\n`;
    if (lines.length === 1) bubble += `< ${pad(lines[0]!)} >\n`;
    else {
      for (let i = 0; i < lines.length; i++) {
        const [a, b] = i === 0 ? ["/", "\\"] : i === lines.length - 1 ? ["\\", "/"] : ["|", "|"];
        bubble += `${a} ${pad(lines[i]!)} ${b}\n`;
      }
    }
    bubble += ` ${Js.repeat("-", w + 2)}\n`;
    ctx.out(bubble + "        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n");
    return 0;
  },
};
