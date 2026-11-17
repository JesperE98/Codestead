// Port of Commands/Textproc/TextprocCmd.Awk.cs – the awk command: processes text column by column (a small
// programming language).

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as AwkCmd from "../Awk/AwkCmd.js";
import { AwkFatal } from "../Awk/AwkFatal.js";
import { AwkInterpreter } from "../Awk/AwkInterpreter.js";
import { AwkSyntaxError } from "../Awk/AwkSyntaxError.js";
import type { Rule } from "../Awk/Rule.js";
import { dimNote } from "./TextprocCmd.js";

export const awk: CommandDef = {
  name: "awk",
  summary: "Bearbetar text kolumn för kolumn (ett litet programspråk)",
  man: `NAMN
       awk - mönsterstyrt språk för att bearbeta text i kolumner

SYNOPSIS
       awk [-F AVGRÄNSARE] [-v VAR=VÄRDE] 'PROGRAM' [FIL]...
       awk [-F AVGRÄNSARE] -f PROGRAMFIL [FIL]...

BESKRIVNING
       awk läser filer (eller standard input) rad för rad och delar upp
       varje rad i fält. Fälten heter $1, $2, ... och hela raden $0.
       Standard är att fälten skiljs åt av mellanslag och tabbar.

       Ett PROGRAM består av par: MÖNSTER { ÅTGÄRD }
       Åtgärden körs för varje rad som matchar mönstret. Utan mönster körs
       den för alla rader; utan åtgärd skrivs raden ut.

FLAGGOR
       -F TECKEN   fältavgränsare, t.ex. -F: eller -F,
       -v VAR=VÄRDE
                   sätt en variabel innan programmet startar
       -f FIL      läs programmet från FIL

MÖNSTER
       BEGIN { ... }      körs en gång innan första raden
       END { ... }        körs en gång efter sista raden
       /regex/            rader som matchar
       $3 > 10            jämförelser: == != < <= > >=
       $1 ~ /^a/          fält som matchar (!~ = matchar inte)
       NR > 1 && $2 == "x"    && (och), || (eller), ! (inte)

ÅTGÄRDER
       print $1, $3       komma ger mellanslag (OFS) mellan fälten
       printf "%-10s %5.1f\\n", $1, $2
       summa += $3        variabler behöver inte deklareras
       antal[$1]++        arrayer med text som index
       if (...) ... else ...   while (...) ...   for (i = 1; i <= NF; i++) ...
       for (nyckel in antal) ...   next   exit

INBYGGDA VARIABLER
       NR    radnummer         NF    antal fält på raden
       $NF   sista fältet      FS / OFS   fältavgränsare in / ut
       FILENAME              filen som läses

FUNKTIONER
       length(s)  substr(s, start, antal)  index(s, t)  split(s, arr, sep)
       sub(/re/, "ny")  gsub(/re/, "ny")  match(s, /re/)  sprintf(...)
       toupper(s)  tolower(s)  int(x)  sqrt(x)

EXEMPEL
       awk '{print $1}' fil.txt
       awk -F: '{print $1, $7}' /etc/passwd
       awk -F, 'NR > 1 {summa += $3} END {print summa}' betyg.csv
       awk '$3 > 50 {print NR": "$0}' data.txt
       ls -l | awk '{print $5, $NF}'

SIMULATORN
       Egna funktioner (function), getline, omdirigering av utdata
       (print > fil) och intervallmönster stöds inte.`,
  run: (ctx) => {
    const args = ctx.args;
    const assigns: { name: string; value: string }[] = [];
    let fs: string | null = null;
    let program: string | null = null;
    let label = "cmd. line";
    const usage = (): number => {
      ctx.err("Usage: awk [POSIX or GNU style options] -f progfile [--] file ...\nUsage: awk [POSIX or GNU style options] [--] 'program' file ...\n");
      return 2;
    };
    let k = 0;
    for (; k < args.length; k++) {
      const a = args[k]!;
      if (a === "--") {
        k++;
        break;
      }
      if (!a.startsWith("-") || a === "-") break;
      const opt = a[1]!;
      if (opt === "F" || opt === "v" || opt === "f") {
        const v = a.length > 2 ? a.slice(2) : ++k < args.length ? args[k]! : null;
        if (v === null) {
          ctx.err(`awk: option requires an argument -- ${opt}\n`);
          return usage();
        }
        if (opt === "F") fs = v;
        else if (opt === "v") {
          const eq = v.indexOf("=");
          if (eq < 1) {
            ctx.err(`awk: \`${v}' argument to \`-v' not in \`var=value' form\n`);
            return usage();
          }
          assigns.push({ name: v.slice(0, eq), value: v.slice(eq + 1) });
        } else {
          try {
            program = ctx.sh.vfs.readFile(ctx.sh.resolve(v), ctx.sh.currentUser());
            label = v;
          } catch (e) {
            if (!(e instanceof FsError)) throw e;
            ctx.err(`awk: fatal: can't open source file \`${v}' for reading: ${e.message}\n`);
            return 2;
          }
        }
        continue;
      }
      ctx.err(`awk: ${a.startsWith("--") ? `unrecognized option '${a}'` : `invalid option -- '${opt}'`}\n`);
      return usage();
    }
    const operands = args.slice(k);
    if (program === null) {
      if (operands.length === 0) return usage();
      program = operands.shift()!;
    }

    let rules: Rule[];
    try {
      rules = AwkCmd.parseAwk(program);
    } catch (e) {
      if (!(e instanceof AwkSyntaxError)) throw e;
      const before = program.slice(0, Math.min(e.pos, program.length));
      const lineNo = before.split("\n").length;
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineEnd = program.indexOf("\n", lineStart);
      const srcLine = lineEnd < 0 ? program.slice(lineStart) : program.slice(lineStart, lineEnd);
      const prefix = `awk: ${label}:${lineNo}: `;
      ctx.err(`${prefix}${srcLine}\n${prefix}${" ".repeat(Math.max(0, e.pos - lineStart))}^ ${e.message}\n`);
      if (e.unsupported !== null)
        dimNote(ctx, "textproc.awkUnsupported", { feature: e.unsupported.describe(ctx.sh), note: ctx.sh.msg("textproc.awkNote") });
      else dimNote(ctx, "textproc.awkNote");
      return 1;
    }

    const sh = ctx.sh;
    const interp = new AwkInterpreter(rules, {
      // Debian and Ubuntu have mawk, which does not change å, ä and ö.
      asciiCase: sh.distro.family === "debian",
      out: (s) => ctx.out(s),
      readInput: (op) => {
        const path = sh.resolve(op);
        if (sh.vfs.tryLookup(path, sh.currentUser())?.type === "dir") {
          ctx.err(`awk: warning: command line argument \`${op}' is a directory: skipped\n`);
          return null;
        }
        try {
          return { name: op, content: sh.vfs.readFile(path, sh.currentUser()) };
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`awk: fatal: cannot open file \`${op}' for reading: ${e.message}\n`);
          throw new AwkFatal("__reported__");
        }
      },
    });
    if (fs !== null) interp.assign("FS", fs === "t" ? "\t" : fs);
    for (const { name, value } of assigns) interp.assign(name, value);
    try {
      return interp.run(operands, ctx.stdin ?? "");
    } catch (e) {
      if (!(e instanceof AwkFatal)) throw e;
      if (e.message === "__reported__") return 2;
      if (e.message === "__steps__") {
        ctx.err(`awk: ${label}: fatal: program stopped\n`);
        dimNote(ctx, "textproc.awkTooManySteps");
      } else ctx.err(`awk: ${label}:1: fatal: ${e.message}\n`);
      return 2;
    }
  },
};
