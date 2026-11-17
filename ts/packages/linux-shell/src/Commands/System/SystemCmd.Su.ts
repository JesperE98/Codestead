// Port of Commands/System/SystemCmd.Su.cs – the su command: switches user.

import type { CmdCtx } from "../../Types/CmdCtx.js";
import { IO } from "../../Types/IO.js";
import type { Sink } from "../../Types/Sink.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

function runSu(ctx: CmdCtx): number {
  const sh = ctx.sh;
  let login = false;
  let command: string | null = null;
  const operands: string[] = [];
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i]!;
    if (a === "-" || a === "-l" || a === "--login") login = true;
    else if (a === "-c" || a === "--command") command = ++i < ctx.args.length ? ctx.args[i]! : "";
    else if (a.startsWith("--command=")) command = a.slice(10);
    else if (a.startsWith("-") && a.length > 1) return UtilCmd.badOption(ctx, `invalid option -- '${a.replace(/^-+/, "")}'`);
    else operands.push(a);
  }
  const target = operands.length > 0 ? operands[0]! : "root";
  const entry = UsersLib.findUser(sh, target);
  if (entry === null && target !== "root") {
    ctx.err(`su: user ${target} does not exist or the user entry does not contain all the required fields\n`);
    return 1;
  }
  const become = (io: Sink): number => {
    if (entry !== null && UsersLib.isNologin(entry.shell)) {
      io.out("This account is currently not available.\n");
      return 1;
    }
    if (command !== null) {
      const cmd = command;
      const scriptIo = new IO(io.outFn, io.errFn, null, ctx.isTTY, io instanceof IO ? io.reader : null);
      return sh.runAs(target, () => sh.runScript(cmd, "bash", [], scriptIo));
    }
    UsersLib.switchUser(sh, target, login, (m) => io.err(`su: warning: ${m}\n`));
    return 0;
  };
  if (sh.currentUser().uid === 0) return become(ctx);
  if (!sh.canAskInteractively()) {
    ctx.err("su: must be run from a terminal\n");
    return 1;
  }
  sh.askText(
    "Password: ",
    (password, io) => {
      const hash = UsersLib.shadowHash(sh, target) ?? "!";
      if (!hash.startsWith("!") && !hash.startsWith("*") && UsersLib.verifyPassword(sh, target, password)) return become(io);
      io.err("su: Authentication failure\n");
      if (target === "root" && (hash.startsWith("*") || hash.startsWith("!"))) {
        io.err(`${UtilCmd.Color.dim}${sh.msg("system.suRootNoPassword")}${UtilCmd.Color.reset}\n`);
      } else if (hash.startsWith("!") || hash.startsWith("*")) {
        io.err(`${UtilCmd.Color.dim}${sh.msg("system.suUserNoPassword", { user: target })}${UtilCmd.Color.reset}\n`);
      }
      return 1;
    },
    true,
  );
  return 0;
}

export const su = simple("su", "Byter användare", runSu, `NAMN
       su - byt användare (substitute user)

SYNOPSIS
       su [-] [ANVÄNDARE]
       su -c KOMMANDO [ANVÄNDARE]

BESKRIVNING
       Startar ett skal som en annan användare (root om ingen anges).
       Du måste skriva den andra användarens lösenord – inte ditt eget.
       Är du redan root behövs inget lösenord. Gå tillbaka med exit.

       På Ubuntu är root-kontot låst, så där används "sudo -i" i stället
       för "su -".

FLAGGOR
       -, -l     inloggningsskal: gå till användarens hemkatalog
       -c CMD    kör bara ett kommando som användaren

EXEMPEL
       su - kim
       su -c whoami kim`);
