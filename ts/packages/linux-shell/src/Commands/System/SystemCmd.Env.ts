// Port of Commands/System/SystemCmd.Env.cs – the env and printenv commands.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as RunCmd from "../Run/RunCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple, sortedEntries } from "./SystemCmd.js";

const assignRe = /^([^=]+)=(.*)$/s;

export function envCmd(name: string): CommandDef {
  return simple(
    name,
    "Visar miljövariabler",
    (ctx) => {
      const sh = ctx.sh;
      // Like every program, env and printenv only see the environment variables (export), not plain shell variables.
      let env = sh.environment();
      if (name === "printenv") {
        if (ctx.args.length === 0) {
          for (const [k, v] of sortedEntries(env)) ctx.out(`${k}=${v}\n`);
          return 0;
        }
        let code = 0;
        for (const k of ctx.args) {
          const v = env.get(k);
          if (v !== undefined) ctx.out(v + "\n");
          else code = 1;
        }
        return code;
      }
      // env [-i] [-u NAME]... [NAME=VALUE]... [COMMAND [ARG]...]: runs the command with a changed environment.
      const args = [...ctx.args];
      while (args.length > 0 && args[0]!.startsWith("-") && args[0] !== "-" && args[0] !== "--") {
        const a = args.shift()!;
        if (a === "-i" || a === "--ignore-environment") env = Js.obj<string>();
        else if (a === "-u" || a.startsWith("--unset=")) {
          const n = a === "-u" ? args.shift() : a.slice(8);
          if (n === undefined) return UtilCmd.badOption(ctx, "option requires an argument -- 'u'", 125);
          env.delete(n);
        } else if (a.startsWith("-u")) env.delete(a.slice(2));
        else return UtilCmd.badOption(ctx, `invalid option -- '${a.replace(/^-+/, "")}'`, 125);
      }
      if (args[0] === "-") {
        args.shift();
        env = Js.obj<string>();
      } else if (args[0] === "--") args.shift();
      for (let m = assignRe.exec(args[0] ?? ""); m !== null; m = assignRe.exec(args[0] ?? "")) {
        env.set(m[1]!, m[2]!);
        args.shift();
      }
      if (args.length === 0) {
        for (const [k, v] of sortedEntries(env)) ctx.out(`${k}=${v}\n`);
        return 0;
      }
      // Without PATH (env -i) a command is looked for where execvp looks by default.
      if (!env.has("PATH") && !args[0]!.includes("/")) {
        const found = ["/usr/bin", "/bin"].map((d) => `${d}/${args[0]}`).find((p) => sh.vfs.tryLookup(p, sh.currentUser())?.type === "file");
        if (found !== undefined) args[0] = found;
      }
      return sh.asChild(() => RunCmd.exec(ctx, "env", args, ctx), env);
    },
    "NAMN\n" +
      `       ${name} - visa miljövariabler\n` +
      "\n" +
      "SYNOPSIS\n" +
      `       ${name === "env" ? "env\n       env NAMN=VÄRDE... KOMMANDO [ARGUMENT]..." : "printenv [VARIABEL]..."}\n` +
      "\n" +
      "BESKRIVNING\n" +
      "       Miljövariabler är namngivna värden som program kan läsa, t.ex.\n" +
      "       HOME (din hemkatalog), PATH (var kommandon letas efter) och USER.\n" +
      "       Bara variabler som har gjorts till miljövariabler med export visas;\n" +
      "       set visar alla skalets variabler." +
      (name === "env" ? "\n\n       env NAMN=VÄRDE KOMMANDO kör kommandot med variabeln tillagd." : ""),
  );
}
