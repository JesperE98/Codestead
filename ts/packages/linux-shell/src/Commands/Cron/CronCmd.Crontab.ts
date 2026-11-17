// Port of Commands/Cron/CronCmd.Crontab.cs – the crontab command: show and change your scheduled jobs (cron).

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { parse, spoolDir } from "./CronCmd.js";

function ensureSpool(sh: Shell): FsNode {
  const root = sh.rootUser();
  const dir = spoolDir(sh);
  let cur = "";
  for (const seg of dir.split("/").filter((s) => s !== "")) {
    cur += "/" + seg;
    if (sh.vfs.tryLookup(cur, root) === null) {
      const spool = cur === dir && sh.distro.family === "debian" && UsersLib.groupExists(sh, "crontab");
      const node = VfsLib.makeDir("root", spool ? Js.oct(1730) : Js.oct(700), null, spool ? "crontab" : "root");
      sh.vfs.insert(cur, node, root);
    }
  }
  return sh.vfs.lookup(dir, root);
}

export const crontab: CommandDef = {
  name: "crontab",
  summary: "Visar och ändrar dina schemalagda jobb (cron)",
  summaryEn: "Show and change your scheduled jobs (cron)",
  man: `NAMN
       crontab - dina schemalagda jobb

SYNOPSIS
       crontab -l
       crontab FIL
       crontab -e
       crontab -r

BESKRIVNING
       Din crontab är en lista med jobb som tjänsten cron kör åt dig på
       bestämda tider. Varje rad har fem tidsfält och sedan kommandot:

       ┌───────────── minut (0–59)
       │ ┌─────────── timme (0–23)
       │ │ ┌───────── dag i månaden (1–31)
       │ │ │ ┌─────── månad (1–12)
       │ │ │ │ ┌───── veckodag (0–7, 0 och 7 är söndag)
       │ │ │ │ │
       * * * * *  kommando

       * betyder "varje", 1-5 ett intervall, 1,15 en lista och */10
       "var tionde". @daily, @hourly, @weekly och @reboot är genvägar.

       Jobben körs med /bin/sh i din hemkatalog, utan dina alias och
       med en kort PATH. Utdata som inte skickas till en fil försvinner,
       så skriv t.ex. >> ~/jobb.log 2>&1 sist på raden.

FLAGGOR
       -l        visa din crontab
       FIL       ersätt din crontab med innehållet i FIL (- = indata)
       -e        öppna din crontab i en texteditor
       -r        ta bort din crontab
       -u ANV    (root) gör det för en annan användare

EXEMPEL
       crontab -l
       echo '30 2 * * * ~/backup.sh >> ~/backup.log 2>&1' | crontab -
       (crontab -l; echo '@reboot ~/start.sh') | crontab -`,
  manEn: `NAME
       crontab - your scheduled jobs

SYNOPSIS
       crontab -l
       crontab FILE
       crontab -e
       crontab -r

DESCRIPTION
       Your crontab is a list of jobs that the cron service runs for you at
       set times. Each line has five time fields and then the command:

       ┌───────────── minute (0–59)
       │ ┌─────────── hour (0–23)
       │ │ ┌───────── day of month (1–31)
       │ │ │ ┌─────── month (1–12)
       │ │ │ │ ┌───── day of week (0–7, 0 and 7 are Sunday)
       │ │ │ │ │
       * * * * *  command

       * means "every", 1-5 a range, 1,15 a list and */10 "every tenth".
       @daily, @hourly, @weekly and @reboot are shortcuts.

       Jobs run with /bin/sh in your home directory, without your aliases
       and with a short PATH. Output that is not sent to a file is lost, so
       end the line with e.g. >> ~/job.log 2>&1.

OPTIONS
       -l        show your crontab
       FILE      replace your crontab with the content of FILE (- = input)
       -e        open your crontab in a text editor
       -r        remove your crontab
       -u USER   (root) do it for another user

EXAMPLES
       crontab -l
       echo '30 2 * * * ~/backup.sh >> ~/backup.log 2>&1' | crontab -
       (crontab -l; echo '@reboot ~/start.sh') | crontab -`,
  run: (ctx) => runCrontab(ctx),
};

function usage(ctx: CmdCtx, why: string | null = null): number {
  if (why !== null) ctx.err(`crontab: ${why}\n`);
  ctx.err(
    "usage:\tcrontab [-u user] file\n\tcrontab [ -u user ] [ -i ] { -e | -l | -r }\n\t\t(default operation is replace, per 1003.2)\n\t-e\t(edit user's crontab)\n\t-l\t(list user's crontab)\n\t-r\t(delete user's crontab)\n\t-i\t(prompt before deleting user's crontab)\n",
  );
  return 1;
}

function runCrontab(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const me = sh.currentUser();
  let who: string | null = null;
  let action: string | null = null;
  let file: string | null = null;
  const args = [...ctx.args];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-u") {
      if (++i >= args.length) return usage(ctx, "option requires an argument -- 'u'");
      who = args[i]!;
    } else if (a === "-l" || a === "-r" || a === "-e") action = action === null ? a : "conflict";
    else if (a === "-i") continue;
    else if (a.startsWith("-") && a !== "-") return usage(ctx, `invalid option -- '${a.replace(/^-+/, "")}'`);
    else file = a;
  }
  if (action === "conflict" || (action !== null && file !== null)) return usage(ctx);
  if (action === null && file === null) {
    // Without arguments crontab reads the new crontab from its input (an empty input removes all jobs).
    if (ctx.stdin === null) return usage(ctx, "usage error: file name or - (for stdin) must be specified");
    file = "-";
  }
  if (who !== null && who !== me.name && me.uid !== 0) {
    ctx.err("crontab: must be privileged to use -u\n");
    return 1;
  }
  const user = who ?? me.name;
  if (!UsersLib.userExists(sh, user)) {
    ctx.err(`crontab: user '${user}' unknown\n`);
    return 1;
  }
  const root = sh.rootUser();
  const path = `${spoolDir(sh)}/${user}`;
  const current = sh.vfs.tryLookup(path, root);

  switch (action) {
    case "-l":
      if (current === null) {
        ctx.err(`no crontab for ${user}\n`);
        return 1;
      }
      ctx.out(current.content ?? "");
      return 0;
    case "-r":
      if (current === null) {
        ctx.err(`no crontab for ${user}\n`);
        return 1;
      }
      sh.vfs.remove(path, root);
      return 0;
    case "-e":
      ctx.out(`${UtilCmd.Color.dim}${sh.msg("cron.editUnsupported")}${UtilCmd.Color.reset}\n`);
      return 1;
  }

  let text: string;
  if (file === "-") text = ctx.stdin ?? "";
  else {
    try {
      text = sh.vfs.readFile(sh.resolve(file!), me);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`${file}: ${e.message}\n`);
      return 1;
    }
  }
  const label = file === "-" ? "-" : file;
  if (text !== "" && !text.endsWith("\n")) {
    ctx.err("new crontab file is missing newline before EOF, can't install.\n");
    return 1;
  }
  const { error, line } = parse(text, user);
  if (error !== null) {
    ctx.err(`"${label}":${line}: ${error}\nerrors in crontab file, can't install.\n`);
    return 1;
  }
  const spool = ensureSpool(sh);
  const group = sh.distro.family === "debian" && UsersLib.groupExists(sh, "crontab") ? "crontab" : (sh.getUser(user).groups[0] ?? user);
  const node = VfsLib.makeFile(text, user, Js.oct(600), group);
  spool.children!.set(user, node);
  return 0;
}
