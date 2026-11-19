// Port of Commands/Shells/ShellsCmd.FishMath.cs – fish's builtin math (called through the fish translation).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ShellsCmd from "./ShellsCmd.js";

/** String(Number(v.toFixed(digits))) – rounds to the given number of decimals. */
function roundJs(v: number, scale: number): string {
  // toFixed converts its argument with ToIntegerOrInfinity (NaN -> 0, fractions truncated).
  const d = Number.isNaN(scale) ? 0 : Math.trunc(scale);
  if (d < 0 || d > 100) throw new RangeError("toFixed() digits argument must be between 0 and 100");
  // Beyond 15 decimals toFixed(d) parses back to the same double.
  if (d > 15) return Js.num(v);
  return Js.num(Js.number(Js.toFixed(v, d)));
}

export const fishMathCmd: CommandDef = ShellsCmd.fishBuiltin("math", (ctx) => {
  const args = [...ctx.args];
  let scale = 6;
  while (args.length > 0 && (args[0]!.startsWith("-s") || args[0]!.startsWith("--scale"))) {
    const a = args.shift()!;
    let v: string | null;
    if (a.includes("=")) v = a.split("=")[1]!;
    else if (a.length > 2 && !a.startsWith("--")) v = a.slice(2);
    else if (args.length > 0) v = args.shift()!;
    else v = null;
    scale = Js.number(v);
  }
  if (args.length === 0) {
    ctx.err("math: expected >= 1 arguments; got 0\n");
    return 2;
  }
  try {
    const v = ShellsCmd.fishMath(args.join(" "));
    if (!Number.isFinite(v)) throw new ShellsCmd.MathError("Result is infinite");
    const s = scale === 0 ? Js.num(Math.trunc(v)) : roundJs(v, scale);
    ctx.out(s + "\n");
    return 0;
  } catch (e) {
    if (!(e instanceof ShellsCmd.MathError)) throw e;
    ctx.err(`math: Error: ${e.message}\n'${args.join(" ")}'\n`);
    return 1;
  }
});
