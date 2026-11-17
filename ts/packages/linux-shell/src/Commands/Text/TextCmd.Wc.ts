// Port of Commands/Text/TextCmd.Wc.cs – the wc command: counts lines, words and characters.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { splitWords } from "./TextCmd.js";

type Counts = Record<string, number>;

export const wc: CommandDef = {
  name: "wc",
  summary: "Räknar rader, ord och tecken",
  man: `NAMN
       wc - räkna rader, ord och byte (word count)

SYNOPSIS
       wc [-l] [-w] [-c] [FIL]...

FLAGGOR
       -l    antal rader
       -w    antal ord
       -c    antal byte
       -m    antal tecken

EXEMPEL
       wc -l dokument/frukter.txt
       ls /etc | wc -l`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "lwcm", long: { lines: "l", words: "w", bytes: "c", chars: "m" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const chosen = ["l", "w", "m", "c"].filter((f) => o.flags.has(f));
    const fields = chosen.length > 0 ? chosen : ["l", "w", "c"];
    const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands);
    const count = (s: string): Counts => ({
      l: s.split("\n").length - 1,
      w: splitWords(s).length,
      c: Js.utf8Length(s),
      m: Js.codePointLength(s),
    });
    const rows: { label: string; counts: Counts }[] = inputs.map((i) => ({ label: o.operands.length > 0 ? i.label : "", counts: count(i.content) }));
    if (rows.length > 1) {
      const total: Counts = { l: 0, w: 0, c: 0, m: 0 };
      for (const r of rows) for (const k of Object.keys(total)) total[k]! += r.counts[k]!;
      rows.push({ label: "total", counts: total });
    }
    const single = fields.length === 1 && rows.length === 1;
    let width = 0;
    if (!single) {
      width = o.operands.length > 0 ? 1 : 7;
      for (const r of rows) for (const f of fields) width = Math.max(width, Js.num(r.counts[f]!).length);
    }
    for (const r of rows) {
      const nums = fields.map((f) => Js.num(r.counts[f]!).padStart(width)).join(" ");
      ctx.out(r.label !== "" ? `${nums} ${r.label}\n` : `${nums}\n`);
    }
    return failed ? 1 : 0;
  },
};
