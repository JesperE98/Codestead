// Port of Commands/Text/TextCmd.Uniq.cs – the uniq command: removes repeated lines (that are next to each other).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const uniq: CommandDef = {
  name: "uniq",
  summary: "Tar bort upprepade rader (som står bredvid varandra)",
  man: `NAMN
       uniq - rapportera eller ta bort upprepade rader

SYNOPSIS
       uniq [FLAGGA]... [FIL]

BESKRIVNING
       Tar bort rader som är likadana som raden direkt ovanför. Därför
       används uniq nästan alltid efter sort.

FLAGGOR
       -c    skriv antalet förekomster framför varje rad
       -d    visa bara rader som förekommer flera gånger
       -u    visa bara rader som är unika
       -i    ignorera skillnad mellan stora och små bokstäver

EXEMPEL
       sort frukter.txt | uniq -c`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "cdui", long: { count: "c", repeated: "d", unique: "u", "ignore-case": "i" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands.slice(0, 1));
    if (failed) return 1;
    const lines = UtilCmd.splitLines(inputs.length > 0 ? inputs[0]!.content : "");
    const same = (a: string, b: string): boolean => (o.flags.has("i") ? a.toLowerCase() === b.toLowerCase() : a === b);
    const groups: { line: string; count: number }[] = [];
    for (const l of lines) {
      const last = groups.at(-1);
      if (last !== undefined && same(last.line, l)) last.count++;
      else groups.push({ line: l, count: 1 });
    }
    for (const g of groups) {
      if (o.flags.has("d") && g.count < 2) continue;
      if (o.flags.has("u") && g.count > 1) continue;
      ctx.out(o.flags.has("c") ? `${Js.num(g.count).padStart(7)} ${g.line}\n` : `${g.line}\n`);
    }
    return 0;
  },
};
