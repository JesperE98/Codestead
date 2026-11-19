// Port of Commands/Procs/ProcsCmd.Free.cs – the free command: shows how much memory is used.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { jsRound } from "./ProcsCmd.js";

export const free: CommandDef = {
  name: "free",
  summary: "Visar hur mycket minne som används",
  man: `NAMN
       free - visa använt och ledigt minne

FLAGGOR
       -h    läsbara enheter (Mi, Gi)
       -m    i mebibyte`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "hmgk", long: { human: "h" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const total = 8_073_420,
      used = 1_929_820,
      free = 5_327_976,
      shared = 102_400,
      cache = 815_624,
      avail = 6_143_600,
      swap = 2_097_148;
    const f = (n: number): string =>
      o.flags.has("h")
        ? n >= 1_048_576
          ? `${Js.toFixed(n / 1_048_576.0, 1)}Gi`
          : `${Js.num(jsRound(n / 1024.0))}Mi`
        : o.flags.has("m")
          ? Js.num(jsRound(n / 1024.0))
          : Js.num(n);
    const c = (n: number): string => f(n).padStart(12);
    ctx.out(`${"".padEnd(7)}${"total".padStart(12)}${"used".padStart(12)}${"free".padStart(12)}${"shared".padStart(12)}${"buff/cache".padStart(12)}${"available".padStart(12)}\n`);
    ctx.out(`Mem:   ${c(total)}${c(used)}${c(free)}${c(shared)}${c(cache)}${c(avail)}\n`);
    ctx.out(`Swap:  ${c(swap)}${c(0)}${c(swap)}\n`);
    return 0;
  },
};
