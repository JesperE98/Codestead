// Port of Commands/Text/TextCmd.HeadTail.cs – the head and tail commands.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { toIndex } from "./TextCmd.js";

const dashNumberRe = /^-[0-9]+$/;
const leadingSignRe = /^[+-]/;

export function headTail(name: string): CommandDef {
  const extra =
    name === "tail"
      ? "\n       -n +N              visa från och med rad N\n       -f                 följ filen när den växer (stöds inte i simulatorn)"
      : "";
  const man =
    "NAMN\n" +
    `       ${name} - visa ${name === "head" ? "de första" : "de sista"} raderna i filer\n` +
    "\n" +
    "SYNOPSIS\n" +
    `       ${name} [-n ANTAL] [FIL]...\n` +
    "\n" +
    "FLAGGOR\n" +
    `       -n ANTAL, -ANTAL   visa ANTAL rader (standard är 10)${extra}\n` +
    "\n" +
    "EXEMPEL\n" +
    `       ${name} -n 3 server.log\n` +
    `       ${name === "head" ? "ls -l /etc | head -5" : "tail -n 20 /var/log/syslog"}`;
  return {
    name,
    summary: name === "head" ? "Visar början av en fil" : "Visar slutet av en fil",
    man,
    run: (ctx) => {
      const args = ctx.args.map((a) => (dashNumberRe.test(a) ? `-n${a.slice(1)}` : a));
      const o = UtilCmd.parseOpts(args, { flags: "fqv", values: "n", long: { lines: "n", follow: "f" } });
      if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
      const spec = o.values.get("n") ?? "10";
      const fromStart = name === "tail" && spec.startsWith("+");
      const n = Js.number(spec.replace(leadingSignRe, ""));
      if (Number.isNaN(n) || !Number.isFinite(n) || n !== Math.floor(n)) {
        ctx.err(`${name}: invalid number of lines: '${spec}'\n`);
        return 1;
      }
      const { inputs, failed } = UtilCmd.readInputs(ctx, o.operands, (l, m) => `${name}: cannot open '${l}' for reading: ${m}`);
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i]!;
        if (inputs.length > 1) ctx.out(`${i > 0 ? "\n" : ""}==> ${input.label} <==\n`);
        const lines = UtilCmd.splitLines(input.content);
        const picked =
          name === "head"
            ? lines.slice(0, toIndex(n))
            : fromStart
              ? lines.slice(toIndex(Math.max(0, n - 1)))
              : n === 0
                ? []
                : lines.slice(toIndex(-n));
        ctx.out(UtilCmd.joinLines(picked));
      }
      if (o.flags.has("f")) {
        ctx.out(`${UtilCmd.Color.dim}(${ctx.sh.msg("text.tailFollow")})${UtilCmd.Color.reset}\n`);
      }
      return failed ? 1 : 0;
    },
  };
}
