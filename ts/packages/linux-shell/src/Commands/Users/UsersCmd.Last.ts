// Port of Commands/Users/UsersCmd.Last.cs – the last command: shows the latest logins.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { LoginTime, loginName, Months } from "./UsersCmd.js";

export const last: CommandDef = {
  name: "last",
  summary: "Visar de senaste inloggningarna",
  summaryEn: "Show the latest logins",
  man: `NAMN
       last - visa de senaste inloggningarna

SYNOPSIS
       last [-n ANTAL] [ANVÄNDARE]

BESKRIVNING
       Läser loggen /var/log/wtmp och visar inloggningar och omstarter,
       nyaste först.`,
  manEn: `NAME
       last - show a listing of the latest logins

SYNOPSIS
       last [-n NUMBER] [USER]

DESCRIPTION
       Reads the log /var/log/wtmp and shows logins and reboots, newest
       first.`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { values: "n" });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const kernel = ctx.sh.distro.kernel.slice(0, 16).padEnd(16);
    const day = (offset: number): string => {
      const d = Js.localDate(Js.now() - offset * 86_400_000);
      return `${UtilCmd.Days[d.getDay()]} ${Months[d.getMonth()]} ${String(d.getDate()).padStart(2)}`;
    };
    const me = loginName(ctx.sh);
    const rows = [
      { user: me, line: `${me.padEnd(8)} pts/0        :0               ${day(0)} ${LoginTime}   still logged in` },
      { user: "reboot", line: `reboot   system boot  ${kernel} ${day(0)} 08:11   still running` },
      { user: me, line: `${me.padEnd(8)} pts/0        :0               ${day(1)} 13:55 - 17:02  (03:07)` },
      { user: "reboot", line: `reboot   system boot  ${kernel} ${day(1)} 13:54 - 17:03  (03:08)` },
    ].filter((r) => o.operands.length === 0 || o.operands.includes(r.user));
    // rows.slice(0, n): NaN counts as 0, fractions are truncated.
    let n = rows.length;
    const nv = o.values.get("n");
    if (nv !== undefined) {
      const num = Js.number(nv);
      n = Number.isNaN(num) ? 0 : Math.min(Math.max(Math.trunc(num), -1e9), 1e9);
    }
    for (const r of rows.slice(0, n)) ctx.out(r.line + "\n");
    ctx.out(`\nwtmp begins ${day(10)} 10:10:12 ${Js.localNow().getFullYear()}\n`);
    return 0;
  },
};
