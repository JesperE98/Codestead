// Port of Commands/Users/UsersCmd.Usermod.cs – the usermod command: modifies a user (groups, shell, locking).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { checkGroups, daysOf, denied, isRoot, shadowFor, splitList, stripBang } from "./UsersCmd.js";

export const usermod: CommandDef = {
  name: "usermod",
  summary: "Ändrar en användare: grupper, skal, låsning (kräver root)",
  summaryEn: "Modify a user: groups, shell, locking (needs root)",
  man: `NAMN
       usermod - ändra ett användarkonto

SYNOPSIS
       usermod [FLAGGOR] ANVÄNDARE

FLAGGOR
       -aG GRUPPER  lägg till användaren i grupperna (append)
       -G GRUPPER   sätt EXAKT vilka extra grupper användaren har – utan -a
                    försvinner användaren ur alla andra grupper!
       -g GRUPP     byt primär grupp
       -s SKAL      byt inloggningsskal
       -c TEXT      byt kommentar (fullständigt namn)
       -d KATALOG   byt hemkatalog (-m flyttar också innehållet)
       -L           lås kontot (sätter ! framför lösenordshashen)
       -U           lås upp kontot
       -e DATUM     kontot slutar gälla DATUM (ÅÅÅÅ-MM-DD)

BESKRIVNING
       Ändringar i gruppmedlemskap gäller först nästa gång användaren
       loggar in.

EXEMPEL
       sudo usermod -aG sudo kim       (Debian/Ubuntu)
       sudo usermod -aG wheel kim      (Arch/Fedora)
       sudo usermod -s /bin/bash kim
       sudo usermod -L kim`,
  manEn: `NAME
       usermod - modify a user account

SYNOPSIS
       usermod [OPTIONS] USER

OPTIONS
       -aG GROUPS   add the user to the groups (append)
       -G GROUPS    set EXACTLY which supplementary groups the user has –
                    without -a the user is removed from all other groups!
       -g GROUP     change the primary group
       -s SHELL     change the login shell
       -c TEXT      change the comment (full name)
       -d DIR       change the home directory (-m also moves the contents)
       -L           lock the account (puts ! in front of the password hash)
       -U           unlock the account
       -e DATE      the account expires on DATE (YYYY-MM-DD)

DESCRIPTION
       Group membership changes take effect the next time the user logs in.

EXAMPLES
       sudo usermod -aG sudo kim       (Debian/Ubuntu)
       sudo usermod -aG wheel kim      (Arch/Fedora)
       sudo usermod -s /bin/bash kim
       sudo usermod -L kim`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "aLUm",
      values: "Ggscde",
      long: {
        append: "a",
        lock: "L",
        unlock: "U",
        "move-home": "m",
        groups: "G",
        gid: "g",
        shell: "s",
        comment: "c",
        home: "d",
        expiredate: "e",
      },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
    const changes = ["L", "U"].some((f) => o.flags.has(f)) || o.values.size > 0;
    if (o.operands.length !== 1 || !changes) {
      ctx.err("Usage: usermod [options] LOGIN\n\nTry 'man usermod' for the options.\n");
      return 2;
    }
    if (o.flags.has("a") && o.values.get("G") === undefined) {
      ctx.err("usermod: -a flag is ONLY allowed with the -G flag\nTry 'man usermod' for the options.\n");
      return 2;
    }
    const name = o.operands[0]!;
    if (!isRoot(sh)) return denied(ctx);
    const db = UsersLib.loadDb(sh);
    const entry = db.passwd.find((e) => e.name === name);
    if (entry === undefined) {
      ctx.err(`usermod: user '${name}' does not exist\n`);
      return 6;
    }
    const gList = o.values.get("G");
    if (gList !== undefined) {
      const list = splitList(gList);
      if (!checkGroups(ctx, sh, "usermod", list)) return 6;
      for (const g of db.group) {
        const wanted = list.includes(g.name);
        if (wanted && !g.members.includes(name)) g.members.push(name);
        if (!wanted && !o.flags.has("a") && g.members.includes(name)) g.members = g.members.filter((m) => m !== name);
      }
    }
    const gv = o.values.get("g");
    if (gv !== undefined) {
      const g = db.group.find((e) => e.name === gv || Js.num(e.gid) === gv);
      if (g === undefined) {
        ctx.err(`usermod: group '${gv}' does not exist\n`);
        return 6;
      }
      entry.gid = g.gid;
    }
    const sv = o.values.get("s");
    if (sv !== undefined) entry.shell = sv;
    const cv = o.values.get("c");
    if (cv !== undefined) entry.gecos = cv;
    const dv = o.values.get("d");
    if (dv !== undefined) {
      const old = entry.home;
      entry.home = dv;
      if (o.flags.has("m")) {
        const node = sh.vfs.tryLookup(old, UsersLib.Root);
        if (node !== null) {
          try {
            sh.vfs.insert(dv, node, UsersLib.Root);
            sh.vfs.remove(old, UsersLib.Root);
          } catch (e) {
            if (!(e instanceof FsError)) throw e;
            ctx.err(`usermod: cannot rename directory ${old} to ${dv}: ${e.message}\n`);
            return 12;
          }
        }
      }
    }
    const shadow = shadowFor(db, name);
    if (o.flags.has("L") && !shadow.hash.startsWith("!")) shadow.hash = "!" + shadow.hash;
    if (o.flags.has("U")) {
      const unlocked = stripBang(shadow.hash);
      if (unlocked === "" || unlocked === "!") {
        ctx.err(
          "usermod: unlocking the user's password would result in a passwordless account.\nYou should set a password with usermod -p to unlock this user's password.\n",
        );
      } else shadow.hash = unlocked;
    }
    const ev = o.values.get("e");
    if (ev !== undefined) {
      const days = daysOf(ev);
      shadow.expire = ev === "" || ev === "-1" ? "" : Number.isFinite(days) ? Js.num(days) : shadow.expire;
    }
    UsersLib.saveDb(sh, db);
    return 0;
  },
};
