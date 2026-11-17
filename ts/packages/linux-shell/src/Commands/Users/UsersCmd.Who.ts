// Port of Commands/Users/UsersCmd.Who.cs – the who command: shows who is logged in.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { LoginTime, loginName } from "./UsersCmd.js";

function isoDay(offsetDays = 0): string {
  const d = Js.localDate(Js.now() - offsetDays * 86_400_000);
  return `${d.getFullYear()}-${Js.pad2(d.getMonth() + 1)}-${Js.pad2(d.getDate())}`;
}

export const who: CommandDef = {
  name: "who",
  summary: "Visar vilka som är inloggade",
  summaryEn: "Show who is logged in",
  man: `NAMN
       who - visa vilka som är inloggade

SYNOPSIS
       who [-b] [am i]

BESKRIVNING
       Visar en rad per inloggning: användare, terminal och tid.
       "su" och "sudo" räknas inte som nya inloggningar.

FLAGGOR
       -b    när datorn startades`,
  manEn: `NAME
       who - show who is logged on

SYNOPSIS
       who [-b] [am i]

DESCRIPTION
       Prints one line per login: user, terminal and time.
       "su" and "sudo" do not count as new logins.

OPTIONS
       -b    time of last system boot`,
  run: (ctx) => {
    if (ctx.args.includes("-b")) {
      ctx.out(`         system boot  ${isoDay()} 08:11\n`);
      return 0;
    }
    ctx.out(`${loginName(ctx.sh).padEnd(8)} pts/0        ${isoDay()} ${LoginTime}\n`);
    return 0;
  },
};
