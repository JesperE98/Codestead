// Port of Commands/Shells/ShellsCmd.FishSet.cs – fish's builtin set (called through the fish translation).

import * as ShellmodeLib from "../../Shellmode/ShellmodeLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

const setLong = new Map<string, string>([
  ["local", "l"],
  ["global", "g"],
  ["universal", "U"],
  ["export", "x"],
  ["unexport", "u"],
  ["erase", "e"],
  ["query", "q"],
  ["append", "a"],
  ["prepend", "p"],
  ["names", "n"],
]);

const setShortRe = /^-[lgUxueqapnS]+$/;
const varNameRe = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const fishSet: CommandDef = ShellsCmd.fishBuiltin("set", (ctx) => {
  const sh = ctx.sh;
  const flags = new Set<string>();
  let i = 0;
  for (; i < ctx.args.length; i++) {
    const a = ctx.args[i]!;
    if (a === "--") {
      i++;
      break;
    }
    const longFlag = a.startsWith("--") ? setLong.get(a.slice(2)) : undefined;
    if (longFlag !== undefined) flags.add(longFlag);
    else if (setShortRe.test(a)) for (const c of a.slice(1)) flags.add(c);
    else if (a.startsWith("-") && a.length > 1) {
      ctx.err(`set: ${a}: unknown option\n`);
      return 2;
    } else break;
  }
  const restArgs = ctx.args.slice(i);
  if (restArgs.length === 0) {
    // Object.entries(sh.env).sort() compares the entries as "key,value" strings.
    const entries = [...sh.env].sort((x, y) => {
      const a = x[0] + "," + x[1];
      const b = y[0] + "," + y[1];
      return a < b ? -1 : a > b ? 1 : 0;
    });
    for (const [k, v] of entries) ctx.out(flags.has("n") ? `${k}\n` : `${k} ${v}\n`);
    return 0;
  }
  const name = restArgs[0]!;
  const values = restArgs.slice(1);
  if (flags.has("q")) return restArgs.filter((n) => !sh.env.has(n)).length;
  if (!varNameRe.test(name)) {
    ctx.err(`set: ${name}: invalid variable name. See \`help identifiers\`\n`);
    return 2;
  }
  if (flags.has("e")) {
    if (flags.has("U")) ShellmodeLib.saveUniversalVar(sh, name, null);
    if (!sh.env.has(name)) return 4;
    sh.env.delete(name);
    return 0;
  }
  // fish has lists; the simulator stores them separated by spaces (PATH lists with colons).
  const sep = name.endsWith("PATH") ? ":" : " ";
  const oldValue = sh.env.get(name);
  const old = oldValue !== undefined && oldValue !== "" ? [oldValue] : [];
  const list = flags.has("a") ? [...old, ...values] : flags.has("p") ? [...values, ...old] : values;
  const value = list.join(sep);
  if (flags.has("U")) ShellmodeLib.saveUniversalVar(sh, name, value);
  // Without -g/-U a new variable in a function is local to the function (like -l).
  const local = flags.has("l") || (!flags.has("g") && !flags.has("U") && sh.funcDepth > 0 && !sh.env.has(name));
  if (local && sh.declareLocal(name, value)) return 0;
  sh.setVar(name, value);
  return 0;
});
