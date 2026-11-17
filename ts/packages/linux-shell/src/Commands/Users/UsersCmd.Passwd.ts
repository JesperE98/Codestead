// Port of Commands/Users/UsersCmd.Passwd.cs – the passwd command: changes a password (your own, or other users' as
// root).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { askNewPassword, dim, setPassword, shadowFor, stripBang } from "./UsersCmd.js";

/** new Date(days * 86_400_000).toISOString().slice(0, 10) (throws a RangeError for an invalid date, like JS). */
function isoDate(days: number): string {
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

export const passwd: CommandDef = {
  name: "passwd",
  summary: "Byter lösenord (ditt eget, eller andras som root)",
  summaryEn: "Change a password (your own, or other users' as root)",
  man: `NAMN
       passwd - byt lösenord

SYNOPSIS
       passwd [FLAGGOR] [ANVÄNDARE]

BESKRIVNING
       Utan ANVÄNDARE byter du ditt eget lösenord. Bara root får byta
       lösenord åt andra: sudo passwd kim. Lösenordet skrivs två gånger
       och syns inte när du skriver. Det sparas som en hash i /etc/shadow.

FLAGGOR
       -l    lås lösenordet (kontot går inte att logga in på med lösenord)
       -u    lås upp
       -d    ta bort lösenordet
       -e    tvinga användaren att byta lösenord vid nästa inloggning
       -S    visa status: P (har lösenord), L (låst), NP (inget lösenord)

EXEMPEL
       passwd
       sudo passwd kim
       sudo passwd -S kim`,
  manEn: `NAME
       passwd - change a password

SYNOPSIS
       passwd [OPTIONS] [USER]

DESCRIPTION
       Without USER you change your own password. Only root may change
       other users' passwords: sudo passwd kim. The password is typed
       twice and is not shown as you type. It is stored as a hash in
       /etc/shadow.

OPTIONS
       -l    lock the password (no password logins for the account)
       -u    unlock
       -d    delete the password
       -e    force the user to change password at the next login
       -S    show status: P (has a password), L (locked), NP (no password)

EXAMPLES
       passwd
       sudo passwd kim
       sudo passwd -S kim`,
  run: (ctx) => {
    const sh = ctx.sh;
    const redhat = sh.distro.family === "redhat";
    const longs: Record<string, string> = { lock: "l", unlock: "u", delete: "d", expire: "e", status: "S" };
    if (redhat) longs["stdin"] = "i";
    const o = UtilCmd.parseOpts(ctx.args, { flags: "luedS", long: longs });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    const me = sh.currentUser();
    const name = o.operands.length > 0 ? o.operands[0]! : me.name;
    if (name !== me.name && me.uid !== 0) {
      ctx.err(redhat ? "passwd: Only root can specify a user name.\n" : `passwd: You may not view or modify password information for ${name}.\n`);
      return 1;
    }
    if (UsersLib.findUser(sh, name) === null) {
      ctx.err(redhat ? `passwd: Unknown user name '${name}'.\n` : `passwd: user '${name}' does not exist\n`);
      return 1;
    }
    const action = ["l", "u", "d", "e", "S"].find((f) => o.flags.has(f)) ?? null;
    if (action !== null) {
      if (me.uid !== 0 && action !== "S") {
        ctx.err("passwd: Permission denied.\n");
        return 1;
      }
      const db = UsersLib.loadDb(sh);
      const s = shadowFor(db, name);
      if (action === "S") {
        const date = s.lastChange !== "" ? isoDate(Js.number(s.lastChange)) : "";
        const or = (v: string, def: string): string => (v !== "" ? v : def);
        ctx.out(`${name} ${UsersLib.passwordStatus(s.hash)} ${date} ${or(s.min, "0")} ${or(s.max, "99999")} ${or(s.warn, "7")} ${or(s.inactive, "-1")}\n`);
        return 0;
      }
      const verbs = new Map<string, string>([
        ["l", "Locking password"],
        ["u", "Unlocking password"],
        ["d", "Removing password"],
        ["e", "Expiring password"],
      ]);
      if (action === "l" && !s.hash.startsWith("!")) s.hash = "!" + s.hash;
      if (action === "u") {
        const unlocked = stripBang(s.hash);
        if (unlocked === "" || unlocked === "!") {
          ctx.err(
            "passwd: unlocking the password would result in a passwordless account.\nYou should set a password with usermod -p to unlock the password of this account.\n",
          );
          return 3;
        }
        s.hash = unlocked;
      }
      if (action === "d") s.hash = "";
      if (action === "e") s.lastChange = "0";
      UsersLib.saveDb(sh, db);
      ctx.out(redhat ? `${verbs.get(action)} for user ${name}.\npasswd: Success\n` : "passwd: password changed.\n");
      return 0;
    }
    if (o.flags.has("i") || (ctx.stdin !== null && !sh.canAskInteractively())) {
      // Read the password from stdin (Fedora's passwd --stdin, or in scripts).
      const pw = (ctx.stdin ?? "").split("\n")[0]!;
      if (pw === "") {
        ctx.err("passwd: Authentication token manipulation error\n");
        return 10;
      }
      setPassword(sh, name, pw);
      ctx.out(redhat ? `Changing password for user ${name}.\npasswd: all authentication tokens updated successfully.\n` : "passwd: password updated successfully\n");
      return 0;
    }
    if (!sh.canAskInteractively()) {
      ctx.err("passwd: Authentication token manipulation error\npasswd: password unchanged\n");
      return 10;
    }
    if (redhat) ctx.out(`Changing password for user ${name}.\n`);
    else if (me.uid !== 0) ctx.out(`Changing password for ${name}.\n`);
    if (me.uid !== 0) {
      ctx.out(dim(sh, "users.skipsCurrentPassword"));
    }
    if (ctx.isTTY && !(sh.flags.get("passwdNoticeShown") ?? false)) {
      sh.flags.set("passwdNoticeShown", true);
      ctx.out(dim(sh, "users.passwordHidden"));
    }
    askNewPassword(sh, name, (ok) => (ok ? 0 : 10));
    return 0;
  },
};
