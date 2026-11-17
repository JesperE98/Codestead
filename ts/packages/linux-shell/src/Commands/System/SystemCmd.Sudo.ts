// Port of Commands/System/SystemCmd.Sudo.cs – the sudo command: runs a command as root (administrator).

import type { CmdCtx } from "../../Types/CmdCtx.js";
import * as UsersLib from "../../Users/UsersLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { simple } from "./SystemCmd.js";

/** str.replace('a', 'b') in JavaScript: only the first occurrence. */
function replaceFirst(s: string, find: string, replacement: string): string {
  const i = s.indexOf(find);
  return i < 0 ? s : s.slice(0, i) + replacement + s.slice(i + find.length);
}

function sudoNotice(ctx: CmdCtx): void {
  const sh = ctx.sh;
  const name = sh.currentUser().name;
  const flag = name === sh.world.user ? "sudoNoticeShown" : `sudoNoticeShown:${name}`;
  if (sh.flags.get(flag) === true) return;
  sh.flags.set(flag, true);
  ctx.err(`[sudo] password for ${name}: ${UtilCmd.Color.dim}${sh.msg("common.skipsPassword")}${UtilCmd.Color.reset}\n`);
}

const sudoUsage = "usage: sudo -h | -K | -k | -V\nusage: sudo [-AbEHknPS] [-u user] [-i | -s] [command [arg ...]]\n";

function runSudo(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const user = sh.currentUser();
  const args = [...ctx.args];
  const shift = (): string | null => args.shift() ?? null;
  if (args.length === 0 || args[0] === "-h") {
    ctx.err(sudoUsage);
    return 1;
  }
  if (args[0] === "-V" || args[0] === "--version") {
    ctx.out("Sudo version 1.9.17p2\n");
    return 0;
  }
  let target = "root";
  let login = false;
  let shell = false;
  while (args.length > 0 && args[0]!.startsWith("-")) {
    const a = shift()!;
    if (a === "--") break;
    if (a === "--user" || a.startsWith("--user=")) {
      target = a.includes("=") ? a.slice(7) : (shift() ?? "");
      continue;
    }
    if (a === "--login") login = true;
    else if (a === "--shell") shell = true;
    else if (a.startsWith("--")) {
      ctx.err(`sudo: unrecognized option '${a}'\n${sudoUsage}`);
      return 1;
    } else {
      for (let i = 1; i < a.length; i++) {
        const c = a[i]!;
        if (c === "i") login = true;
        else if (c === "s") shell = true;
        else if (c === "u") {
          const rest = a.slice(i + 1);
          target = rest !== "" ? rest : (shift() ?? "");
          break;
        } else {
          ctx.err(`sudo: invalid option -- '${c}'\n${sudoUsage}`);
          return 1;
        }
      }
    }
  }
  if (user.uid !== 0 && !user.groups.includes(sh.distro.adminGroup)) {
    ctx.err(`${user.name} is not in the sudoers file.\n`);
    if (ctx.isTTY) {
      ctx.err(`${UtilCmd.Color.dim}${sh.msg("system.sudoAdminGroup", { group: sh.distro.adminGroup })}${UtilCmd.Color.reset}\n`);
    }
    return 1;
  }
  if (target !== "root" && !UsersLib.userExists(sh, target)) {
    ctx.err(`sudo: unknown user ${target}\n`);
    return 1;
  }
  if (user.uid !== 0) sudoNotice(ctx);
  if ((login || shell) && args.length === 0) {
    UsersLib.switchUser(sh, target, login, (m) => ctx.err(`sudo: ${replaceFirst(m, "cannot change", "unable to change")}\n`));
    return 0;
  }
  if (args.length === 0) {
    ctx.err(sudoUsage);
    return 1;
  }
  return sh.runAs(target, () => sh.invoke(args, ctx, true));
}

export const sudo = simple("sudo", "Kör ett kommando som root (administratör)", runSudo, `NAMN
       sudo - kör ett kommando som en annan användare (oftast root)

SYNOPSIS
       sudo KOMMANDO [ARGUMENT]...
       sudo -i

BESKRIVNING
       root är systemets administratör och får göra allt. Vanliga användare
       som tillhör gruppen sudo (Debian/Ubuntu) eller wheel (Arch/Fedora)
       kan köra enstaka kommandon som root genom att sätta sudo framför.
       Du får då ange ditt eget lösenord.

       sudo -i         starta ett root-skal (avsluta med exit)
       sudo -u ANV     kör kommandot som en annan användare än root
       sudo -iu ANV    starta ett inloggningsskal som ANV

EXEMPEL
       sudo apt update
       sudo cat /etc/shadow
       sudo -u kim whoami

VARNING
       Med sudo finns inga skyddsnät. Kör bara kommandon du förstår.`);
