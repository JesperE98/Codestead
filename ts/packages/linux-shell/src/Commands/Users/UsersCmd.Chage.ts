// Port of Commands/Users/UsersCmd.Chage.cs – the chage command: shows or changes password and account expiry.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { daysOf, Months, shadowFor } from "./UsersCmd.js";

function dayDate(days: number): string {
  const ms = days * 86_400_000;
  // An invalid date prints like JS: "undefined NaN, NaN".
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return "undefined NaN, NaN";
  const d = new Date(Math.trunc(ms));
  return `${Months[d.getUTCMonth()]} ${Js.pad2(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

const digitsRe = /^[0-9]+$/;

export const chage: CommandDef = {
  name: "chage",
  summary: "Visar eller ändrar när lösenord och konton går ut",
  summaryEn: "Show or change password and account expiry",
  man: `NAMN
       chage - ändra när lösenord och konton går ut

SYNOPSIS
       chage -l ANVÄNDARE
       chage [FLAGGOR] ANVÄNDARE

FLAGGOR
       -l          visa uppgifterna (fälten i /etc/shadow, i klartext)
       -M DAGAR    lösenordet måste bytas efter så här många dagar
       -m DAGAR    minsta antal dagar mellan byten
       -W DAGAR    varna så här många dagar innan lösenordet går ut
       -E DATUM    kontot slutar gälla (ÅÅÅÅ-MM-DD, -1 = aldrig)
       -d 0        tvinga fram ett lösenordsbyte vid nästa inloggning

EXEMPEL
       chage -l $USER
       sudo chage -M 90 kim
       sudo chage -E 2026-12-31 vikarie`,
  manEn: `NAME
       chage - change user password expiry information

SYNOPSIS
       chage -l USER
       chage [OPTIONS] USER

OPTIONS
       -l          list the information (the fields of /etc/shadow, in plain text)
       -M DAYS     the password must be changed after this many days
       -m DAYS     minimum number of days between changes
       -W DAYS     warn this many days before the password expires
       -E DATE     the account expires (YYYY-MM-DD, -1 = never)
       -d 0        force a password change at the next login

EXAMPLES
       chage -l $USER
       sudo chage -M 90 kim
       sudo chage -E 2026-12-31 substitute`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "l",
      values: "MmWEdI",
      long: { list: "l", maxdays: "M", mindays: "m", warndays: "W", expiredate: "E", lastday: "d", inactive: "I" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    if (o.operands.length !== 1) {
      ctx.err("Usage: chage [options] LOGIN\n\nTry 'man chage' for the options.\n");
      return 2;
    }
    const name = o.operands[0]!;
    const me = sh.currentUser();
    const list = o.flags.has("l");
    if (me.uid !== 0 && !(list && name === me.name)) {
      ctx.err("chage: Permission denied.\n");
      return 1;
    }
    if (UsersLib.findUser(sh, name) === null) {
      ctx.err(`chage: user '${name}' does not exist in /etc/passwd\n`);
      return 1;
    }
    const db = UsersLib.loadDb(sh);
    const s = shadowFor(db, name);
    if (list) {
      const last = s.lastChange === "" ? null : Js.number(s.lastChange);
      const max = s.max === "" ? 99999 : Js.number(s.max);
      const inactive = s.inactive === "" ? -1 : Js.number(s.inactive);
      const expires = last === 0 ? "password must be changed" : last === null || max >= 99999 ? "never" : dayDate(last + max);
      // `last && ...`: truthy means not null, not 0 and not NaN.
      const lastTruthy = last !== null && last !== 0 && !Number.isNaN(last);
      const rows: [string, string][] = [
        ["Last password change", last === 0 ? "password must be changed" : last === null ? "never" : dayDate(last)],
        ["Password expires", expires],
        ["Password inactive", lastTruthy && max < 99999 && inactive >= 0 ? dayDate(last! + max + inactive) : "never"],
        ["Account expires", s.expire === "" ? "never" : dayDate(Js.number(s.expire))],
        ["Minimum number of days between password change", s.min !== "" ? s.min : "0"],
        ["Maximum number of days between password change", s.max !== "" ? s.max : "99999"],
        ["Number of days of warning before password expires", s.warn !== "" ? s.warn : "7"],
      ];
      for (const [k, v] of rows) ctx.out(`${k.padEnd(56)}: ${v}\n`);
      return 0;
    }
    const num = (v: string | undefined, set: (x: string) => void): void => {
      if (v !== undefined) set(v === "-1" ? "" : v);
    };
    num(o.values.get("M"), (v) => (s.max = v));
    num(o.values.get("m"), (v) => (s.min = v));
    num(o.values.get("W"), (v) => (s.warn = v));
    num(o.values.get("I"), (v) => (s.inactive = v));
    const dv = o.values.get("d");
    if (dv !== undefined) s.lastChange = digitsRe.test(dv) ? dv : Js.num(daysOf(dv));
    const ev = o.values.get("E");
    if (ev !== undefined) {
      const days = daysOf(ev);
      if (ev === "-1") s.expire = "";
      else if (Number.isFinite(days)) s.expire = Js.num(days);
      else {
        ctx.err(`chage: invalid date '${ev}'\n`);
        return 2;
      }
    }
    UsersLib.saveDb(sh, db);
    return 0;
  },
};
