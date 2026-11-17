// Port of Commands/Text/TextCmd.Sort.cs – the sort command: sorts lines.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { collation, jsTrim, toIndex } from "./TextCmd.js";

export const sort: CommandDef = {
  name: "sort",
  summary: "Sorterar rader",
  man: `NAMN
       sort - sortera rader i textfiler

SYNOPSIS
       sort [FLAGGA]... [FIL]...

FLAGGOR
       -r    omvänd ordning
       -n    sortera numeriskt (2 före 10)
       -u    ta bort dubbletter
       -f    ignorera skillnad mellan stora och små bokstäver
       -k N  sortera på fält nummer N

EXEMPEL
       sort frukter.txt
       sort frukter.txt | uniq -c | sort -rn`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "rnuf",
      values: "k",
      long: { reverse: "r", "numeric-sort": "n", unique: "u", "ignore-case": "f", key: "k" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands, (l, m) => `sort: cannot read: ${l}: ${m}`);
    if (failed) return 2;
    let lines = inputs.flatMap((i) => UtilCmd.splitLines(i.content));
    const k = o.values.get("k");
    const field = k !== undefined && k !== "" ? Js.number(k.split(",")[0]) : 0;
    const hasField = field !== 0 && !Number.isNaN(field);
    const key = (l: string): string => (hasField ? splitWordsKeepEmpty(jsTrim(l)).slice(toIndex(field - 1)).join(" ") : l);
    // -f: CompareOptions.IgnoreCase | IgnoreNonSpace in C# – the base letters only.
    const ci = collation(ctx.sh);
    const coll = o.flags.has("f") ? new Intl.Collator(ci.resolvedOptions().locale, { sensitivity: "base" }) : ci;
    const cmp = (a: string, b: string): number => {
      const ka = key(a);
      const kb = key(b);
      if (o.flags.has("n")) {
        const na = Js.parseFloat(ka);
        const nb = Js.parseFloat(kb);
        const d = (Number.isNaN(na) ? 0 : na) - (Number.isNaN(nb) ? 0 : nb);
        // A NaN result counts as "equal" in a JS sort comparator.
        if (Number.isNaN(d)) return 0;
        if (d !== 0) return d < 0 ? -1 : 1;
      } else {
        const c = coll.compare(ka, kb);
        if (c !== 0) return c;
      }
      return Js.ordinal(a, b);
    };
    lines.sort(cmp);
    if (o.flags.has("r")) lines.reverse();
    if (o.flags.has("u")) {
      const all = lines;
      lines = all.filter((l, i) => i === 0 || cmp(l, all[i - 1]!) !== 0);
    }
    ctx.out(UtilCmd.joinLines(lines));
    return 0;
  },
};

/** s.split(/\s+/) in JavaScript (without dropping empty strings). */
function splitWordsKeepEmpty(s: string): string[] {
  return s.split(/\s+/);
}
