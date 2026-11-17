// Port of Commands/Text/TextCmd.Cut.cs – the cut command: picks out columns from lines.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

const listPartRe = /^([0-9]*)(-?)([0-9]*)$/;

function parseList(spec: string): ((n: number) => boolean) | null {
  const ranges: { from: number; to: number }[] = [];
  for (const part of spec.split(",")) {
    const m = listPartRe.exec(part);
    if (!m || (m[1] === "" && m[3] === "")) return null;
    const from = m[1] !== "" ? Js.number(m[1]) : 1;
    const to = m[2] !== "" ? (m[3] !== "" ? Js.number(m[3]) : Number.POSITIVE_INFINITY) : from;
    ranges.push({ from, to });
  }
  return (n) => ranges.some((r) => n >= r.from && n <= r.to);
}

export const cut: CommandDef = {
  name: "cut",
  summary: "Plockar ut kolumner ur rader",
  man: `NAMN
       cut - plocka ut delar av varje rad

SYNOPSIS
       cut -d AVGRÄNSARE -f FÄLT [FIL]...
       cut -c TECKEN [FIL]...

FLAGGOR
       -d TECKEN   använd TECKEN som fältavgränsare (standard är tabb)
       -f LISTA    välj fält, t.ex. 1 eller 1,3 eller 2-4
       -c LISTA    välj tecken på samma sätt

EXEMPEL
       cut -d: -f1 /etc/passwd      alla användarnamn`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { values: "dfc", long: { delimiter: "d", fields: "f", characters: "c" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const spec = o.values.get("f") ?? o.values.get("c");
    if (spec === undefined || spec === "") return UtilCmd.badOption(ctx, "you must specify a list of bytes, characters, or fields");
    const pick = parseList(spec);
    if (pick === null) return UtilCmd.badOption(ctx, `invalid field value '${spec}'`);
    const delim = o.values.get("d") ?? "\t";
    const chars = o.values.get("c");
    const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands);
    for (const input of inputs) {
      for (const line of UtilCmd.splitLines(input.content)) {
        if (chars !== undefined && chars !== "") {
          // C# enumerated runes (a lone surrogate became U+FFFD); the code points here.
          ctx.out([...line].filter((_, i) => pick(i + 1)).join("") + "\n");
        } else if (!line.includes(delim)) {
          ctx.out(line + "\n");
        } else {
          ctx.out(
            line
              .split(delim)
              .filter((_, i) => pick(i + 1))
              .join(delim) + "\n",
          );
        }
      }
    }
    return failed ? 1 : 0;
  },
};
