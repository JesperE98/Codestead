// Port of Commands/Procs/ProcsCmd.Top.cs – the top command: shows the processes using the most resources.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { topScreen } from "./ProcsCmd.js";

export const top: CommandDef = {
  name: "top",
  summary: "Visar processerna som använder mest resurser",
  man: `NAMN
       top - visa processer och resursanvändning, uppdateras hela tiden

BESKRIVNING
       Överst visas belastning (load average), antal processer, CPU och
       minne. Sedan alla processer, sorterade efter CPU-användning.
       I en riktig terminal uppdateras top varje sekund: tryck M för att
       sortera på minne, k för att döda en process och q för att avsluta.
       I simulatorn visas en ögonblicksbild.

FLAGGOR
       -b -n 1   skriv ut en gång (bra i skript)`,
  run: (ctx) => {
    topScreen(ctx, "top");
    if (ctx.isTTY) ctx.out(`${UtilCmd.Color.dim}(${ctx.sh.msg("procs.topSnapshot")})${UtilCmd.Color.reset}\n`);
    return 0;
  },
};
