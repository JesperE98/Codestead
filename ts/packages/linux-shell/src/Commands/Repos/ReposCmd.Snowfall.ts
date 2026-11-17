// Port of Commands/Repos/ReposCmd.Snowfall.cs – the snowfall command: lets it snow in the terminal (made-up AUR
// package).

import type { CommandDef } from "../../Types/CommandDef.js";
import { dim } from "./ReposCmd.js";

export const snowfall: CommandDef = {
  name: "snowfall",
  summary: "Låter det snöa i terminalen (påhittat AUR-paket)",
  summaryEn: "Lets it snow in the terminal (made-up AUR package)",
  man: `NAMN
       snowfall - låt det snöa i terminalen

BESKRIVNING
       Ett påhittat program från AUR. Tryck q för att avsluta.`,
  manEn: `NAME
       snowfall - let it snow in the terminal

DESCRIPTION
       A made-up program from the AUR. Press q to quit.`,
  run: (ctx) => {
    ctx.out(
      "   *        .     *       .    *\n .     *       .      *         .\n     .    *        .      *  .\n" +
        "  *      .     *      .     *    \n    .  *     .     *     .    *\n__/\\___/\\__/\\____/\\___/\\___/\\___\n",
    );
    ctx.out(dim(ctx.sh, "repos.snowQuit"));
    return 0;
  },
};
