// Port of Commands/System/SystemCmd.Seq.cs – the seq command: prints a sequence of numbers.

import { Js } from "../../Js.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

export const seq = simple(
  "seq",
  "Skriver ut en talföljd",
  (ctx) => {
    const n = ctx.args.map((a) => Js.number(a));
    if (n.length === 0 || n.some(Number.isNaN)) return UtilCmd.badOption(ctx, "missing operand");
    const [first, inc, last] = n.length === 1 ? [1, 1, n[0]!] : n.length === 2 ? [n[0]!, 1, n[1]!] : [n[0]!, n[1]!, n[2]!];
    if (inc === 0) return 1;
    let c = 0;
    for (let i = first; inc > 0 ? i <= last : i >= last; i += inc, c++) {
      if (c > 10_000) break;
      ctx.out(Js.num(i) + "\n");
    }
    return 0;
  },
  `NAMN
       seq - skriv ut en talföljd

SYNOPSIS
       seq SISTA
       seq FÖRSTA SISTA
       seq FÖRSTA STEG SISTA`,
);
