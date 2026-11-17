// Port of Commands/Textproc/TextprocCmd.Tr.cs – the tr command: replaces or deletes characters.

import type { CommandDef } from "../../Types/CommandDef.js";
import { codePoints, expandTrSet, TrError } from "./TextprocCmd.js";

const trShortFlagsRe = /^-[a-zA-Z]+$/;

export const tr: CommandDef = {
  name: "tr",
  summary: "Byter ut eller tar bort tecken",
  man: `NAMN
       tr - översätt (translate), ta bort eller pressa ihop tecken

SYNOPSIS
       tr [-c] [-d] [-s] MÄNGD1 [MÄNGD2]

BESKRIVNING
       Läser standard input, byter varje tecken i MÄNGD1 mot tecknet på
       samma plats i MÄNGD2 och skriver resultatet till standard output.
       tr läser bara från standard input – aldrig från filer. Använd en pipe
       eller <.

       Mängder skrivs som vanliga tecken, intervall eller klasser:
       a-z  A-Z  0-9           intervall
       [:upper:] [:lower:]     stora / små bokstäver
       [:digit:] [:space:]     siffror / blanktecken
       [:alpha:] [:alnum:] [:punct:]
       \\n  \\t                  ny rad, tabb

       Obs! tr arbetar med enskilda byte, så a-z och [:lower:] omfattar
       inte å, ä och ö.

FLAGGOR
       -d    ta bort (delete) alla tecken i MÄNGD1
       -s    pressa ihop (squeeze) upprepade tecken till ett
       -c    använd komplementet till MÄNGD1 (alla tecken som INTE finns där)

EXEMPEL
       echo hej | tr a-z A-Z            HEJ
       echo $PATH | tr ':' '\\n'         en katalog per rad
       tr -d '0-9' < fil.txt            ta bort alla siffror
       echo "a   b    c" | tr -s ' '    a b c`,
  run: (ctx) => {
    const flags = new Set<string>();
    const ops: string[] = [];
    let i = 0;
    const longFlags = new Map([
      ["--delete", "d"],
      ["--squeeze-repeats", "s"],
      ["--complement", "c"],
    ]);
    for (; i < ctx.args.length; i++) {
      const a = ctx.args[i]!;
      if (a === "--") {
        i++;
        break;
      }
      const lf = longFlags.get(a);
      if (lf !== undefined) {
        flags.add(lf);
        continue;
      }
      if (trShortFlagsRe.test(a)) {
        for (const c of a.slice(1)) {
          if (!"dscC".includes(c)) {
            ctx.err(`tr: invalid option -- '${c}'\nTry 'tr --help' for more information.\n`);
            return 1;
          }
          flags.add(c === "C" ? "c" : c);
        }
        continue;
      }
      if (a.startsWith("--")) {
        ctx.err(`tr: unrecognized option '${a}'\nTry 'tr --help' for more information.\n`);
        return 1;
      }
      ops.push(a);
    }
    ops.push(...ctx.args.slice(i));

    const del = flags.has("d");
    const squeeze = flags.has("s");
    const usage = (msg: string): number => {
      ctx.err(`tr: ${msg}\nTry 'tr --help' for more information.\n`);
      return 1;
    };
    if (ops.length === 0) return usage("missing operand");
    if (del && !squeeze && ops.length > 1)
      return usage(`extra operand '${ops[1]}'\nOnly one string may be given when deleting without squeezing repeated characters.`);
    if (del && squeeze && ops.length < 2)
      return usage(`missing operand after '${ops[0]}'\nTwo strings must be given when both deleting and squeezing repeats.`);
    if (!del && !squeeze && ops.length < 2) return usage(`missing operand after '${ops[0]}'\nTwo strings must be given when translating.`);
    if (ops.length > 2) return usage(`extra operand '${ops[2]}'`);

    let set1: string[];
    let set2: string[];
    try {
      set1 = expandTrSet(ops[0]!);
      set2 = ops.length > 1 ? expandTrSet(ops[1]!) : [];
    } catch (e) {
      if (!(e instanceof TrError)) throw e;
      ctx.err(`tr: ${e.message}\n`);
      return 1;
    }
    const in1 = new Set(set1);
    const complement = flags.has("c");
    const inSet1 = (c: string): boolean => (complement ? !in1.has(c) : in1.has(c));
    const translating = !del && ops.length === 2;
    if (translating && set2.length === 0) {
      ctx.err("tr: when not truncating set1, string2 must be non-empty\n");
      return 1;
    }
    const map = new Map<string, string>();
    if (translating && !complement) for (let idx = 0; idx < set1.length; idx++) map.set(set1[idx]!, set2[Math.min(idx, set2.length - 1)]!);
    const squeezeSet = new Set(del || translating ? set2 : set1);
    const squeezeTest = (c: string): boolean => (del || translating ? squeezeSet.has(c) : inSet1(c));

    let o = "";
    let last = "";
    for (const ch of codePoints(ctx.stdin ?? "")) {
      let c = ch;
      if (del && inSet1(c)) continue;
      if (translating) {
        if (complement) {
          if (inSet1(c)) c = set2.at(-1)!;
        } else c = map.get(c) ?? c;
      }
      if (squeeze && c === last && squeezeTest(c)) continue;
      o += c;
      last = c;
    }
    ctx.out(o);
    return 0;
  },
};
