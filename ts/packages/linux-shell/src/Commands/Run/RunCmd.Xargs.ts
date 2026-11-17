// Port of Commands/Run/RunCmd.Xargs.cs – the xargs command: build command lines from standard input.

import { isWhiteSpace, netTrim } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import * as RunCmd from "./RunCmd.js";

/** Splits xargs input into words: blanks separate, quotes and backslashes keep blanks. */
function splitWords(input: string): { words: string[] | null; error: string | null } {
  const words: string[] = [];
  let cur = "";
  let inWord = false;
  let quote = "";
  const unmatched = (): { words: null; error: string } => ({
    words: null,
    error: `unmatched ${quote === "'" ? "single" : "double"} quote; by default quotes are special to xargs unless you use the -0 option`,
  });
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quote !== "") {
      if (c === quote) quote = "";
      else if (c === "\n") return unmatched();
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    if (c === "\\" && i + 1 < input.length) {
      cur += input[++i];
      inWord = true;
      continue;
    }
    if (isWhiteSpace(c)) {
      if (inWord) words.push(cur);
      cur = "";
      inWord = false;
      continue;
    }
    cur += c;
    inWord = true;
  }
  if (quote !== "") return unmatched();
  if (inWord) words.push(cur);
  return { words, error: null };
}

export const xargs: CommandDef = {
  name: "xargs",
  summary: "Gör om indata till argument till ett kommando",
  summaryEn: "Build command lines from standard input",
  man: `NAMN
       xargs - gör om indata till argument

SYNOPSIS
       ... | xargs [-n N] [-I ERSÄTT] [-0] [-t] [KOMMANDO [ARGUMENT]...]

BESKRIVNING
       Många kommandon läser inte från en pipe utan vill ha filnamn som
       argument, t.ex. rm, mkdir och wc. xargs läser orden från sin
       indata och sätter dem efter KOMMANDO. Utan KOMMANDO används echo.

           find . -name "*.tmp" | xargs rm
       blir samma sak som
           rm ./a.tmp ./b.tmp

FLAGGOR
       -n N        högst N argument per körning
       -I ERSÄTT   kör KOMMANDO en gång per rad och byt ut ERSÄTT
                   (ofta {}) mot raden
       -0          orden skiljs åt av NUL-tecken (find -print0)
       -d TECKEN   orden skiljs åt av TECKEN, t.ex. -d '\\n'
       -t          visa varje kommando innan det körs
       -r          kör inte KOMMANDO alls om indata är tom

EXEMPEL
       ls *.txt | xargs wc -l
       cat namn.txt | xargs -n 1 echo Hej
       ls *.log | xargs -I {} cp {} backup/`,
  manEn: `NAME
       xargs - build command lines from standard input

SYNOPSIS
       ... | xargs [-n N] [-I REPLACE] [-0] [-t] [COMMAND [ARGUMENT]...]

DESCRIPTION
       Many commands do not read from a pipe but want file names as
       arguments, for example rm, mkdir and wc. xargs reads the words in
       its input and puts them after COMMAND. Without COMMAND, echo is used.

           find . -name "*.tmp" | xargs rm
       is the same as
           rm ./a.tmp ./b.tmp

OPTIONS
       -n N        at most N arguments per run
       -I REPLACE  run COMMAND once per line, with REPLACE (often {})
                   replaced by the line
       -0          words are separated by NUL characters (find -print0)
       -d CHAR     words are separated by CHAR, for example -d '\\n'
       -t          show each command before it runs
       -r          do not run COMMAND at all if the input is empty

EXAMPLES
       ls *.txt | xargs wc -l
       cat names.txt | xargs -n 1 echo Hello
       ls *.log | xargs -I {} cp {} backup/`,
  run: (ctx) => {
    // Options come before the command; everything from the command on belongs to it.
    const args = [...ctx.args];
    let maxArgs = 0;
    let replace: string | null = null;
    let delimiter: string | null = null;
    let trace = false;
    let noEmpty = false;
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i]!;
      if (!a.startsWith("-") || a === "-") break;
      if (a === "--") {
        i++;
        break;
      }
      const value = (flag: string): string | null => {
        if (a.length > flag.length) return a.slice(flag.length);
        return ++i < args.length ? args[i]! : null;
      };
      if (a.startsWith("-n")) {
        const v = value("-n");
        // int.TryParse(v, NumberStyles.None): only digits, and it must fit in an int.
        maxArgs = v !== null && /^[0-9]+$/.test(v) && Number(v) <= 2147483647 ? Number(v) : 0;
        if (v === null || maxArgs < 1) {
          ctx.err(`xargs: invalid number "${v ?? ""}" for -n option\n`);
          return 1;
        }
      } else if (a.startsWith("-I") || a.startsWith("-i")) {
        replace = a.startsWith("-i") ? (a.length > 2 ? a.slice(2) : "{}") : value("-I");
        if (replace === null) return UtilCmd.badOption(ctx, "option requires an argument -- 'I'");
      } else if (a.startsWith("-d")) {
        const v = value("-d");
        if (v === null) return UtilCmd.badOption(ctx, "option requires an argument -- 'd'");
        delimiter = v === "\\n" ? "\n" : v === "\\t" ? "\t" : v === "\\0" ? "\0" : v.slice(0, 1);
      } else if (a === "-0" || a === "--null") delimiter = "\0";
      else if (a === "-t" || a === "--verbose") trace = true;
      else if (a === "-r" || a === "--no-run-if-empty") noEmpty = true;
      else return UtilCmd.badOption(ctx, `invalid option -- '${a.replace(/^-+/, "")}'`);
    }
    const command = args.slice(i);
    if (command.length === 0) command.push("echo");
    const input = ctx.stdin ?? "";

    let items: string[];
    if (replace !== null) {
      items = input
        .split("\n")
        .map((l) => netTrim(l))
        .filter((l) => l !== "");
    } else if (delimiter !== null) {
      items = input.split(delimiter[0]!);
      if (items.length > 0 && items.at(-1) === "") items.pop();
      if (delimiter === "\n") items = items.map((l) => l.replace(/\r+$/, ""));
    } else {
      const { words, error } = splitWords(input);
      if (words === null) {
        ctx.err(`xargs: ${error}\n`);
        return 1;
      }
      items = words;
    }

    const runs: string[][] = [];
    if (replace !== null) {
      const r = replace;
      for (const item of items) runs.push(command.map((w) => w.replaceAll(r, item)));
    } else if (items.length === 0) {
      if (!noEmpty) runs.push([...command]);
    } else {
      const per = maxArgs > 0 ? maxArgs : items.length;
      for (let k = 0; k < items.length; k += per) runs.push([...command, ...items.slice(k, k + per)]);
    }

    let result = 0;
    for (const argv of runs) {
      if (trace) ctx.err(argv.join(" ") + "\n");
      const io = new IO(ctx.outFn, ctx.errFn, null, ctx.isTTY);
      const code = RunCmd.exec(ctx, "xargs", argv, io);
      if (code === 127 || code === 126) return code;
      if (code === 255) {
        ctx.err(`xargs: ${argv[0]}: exited with status 255; aborting\n`);
        return 124;
      }
      if (code !== 0) result = 123;
    }
    return result;
  },
};
