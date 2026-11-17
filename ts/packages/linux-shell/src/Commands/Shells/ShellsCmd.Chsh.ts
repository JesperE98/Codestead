// Port of Commands/Shells/ShellsCmd.Chsh.cs – the chsh command: change login shell.

import { Js, netTrim } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import * as UtilCmd from "../Util/UtilCmd.js";

const binPrefixRe = /^\/bin\//;
const sbinPrefixRe = /^\/sbin\//;
// C#: ^#[^\n\r\u2028\u2029]*\n with RegexOptions.Multiline, where ^ only matches after \n (in JavaScript the m flag
// also matches after \r, \u2028 and \u2029), hence the lookbehind.
const commentLineRe = /(?<![^\n])#[^\n\r\u2028\u2029]*\n/g;
const leadingDashesRe = /^-+/;

/** /bin/zsh and /usr/bin/zsh are the same file (/bin points to /usr/bin in modern distributions). */
function realPath(p: string): string {
  return p.replace(binPrefixRe, "/usr/bin/").replace(sbinPrefixRe, "/usr/sbin/");
}

function changeShell(ctx: CmdCtx, user: string, shell: string, out: Sink): number {
  const sh = ctx.sh;
  const root = sh.rootUser();
  const utilLinux = sh.distro.family !== "debian";
  const shells = (sh.vfs.tryLookup("/etc/shells", root)?.content ?? "").split("\n").map((l) => netTrim(l));
  const isRoot = sh.currentUser().uid === 0;
  if (!shell.startsWith("/")) {
    out.err(utilLinux ? "chsh: shell must be a full path name\n" : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  const node = sh.vfs.tryLookup(realPath(shell), root);
  if (node === null || node.type !== "file" || (node.mode & Js.oct(111)) === 0) {
    out.err(utilLinux ? `chsh: "${shell}" does not exist\n` : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  if (!shells.includes(shell) && !isRoot) {
    out.err(utilLinux ? `chsh: ${shell} is not listed in /etc/shells.\nchsh: Use chsh -l to see list.\n` : `chsh: ${shell} is an invalid shell\n`);
    return 1;
  }
  const passwd = sh.vfs.readFile("/etc/passwd", root);
  const lines = passwd.split("\n").map((line) => {
    const f = line.split(":");
    if (f[0] !== user || f.length < 7) return line;
    f[6] = shell;
    return f.join(":");
  });
  sh.vfs.writeFile("/etc/passwd", lines.join("\n"), root);
  if (utilLinux) out.out("Shell changed.\n");
  out.out(`${UtilCmd.Color.dim}${sh.msg("shells.loginShellChanged", { user, shell })}${UtilCmd.Color.reset}\n`);
  return 0;
}

export const chsh: CommandDef = {
  name: "chsh",
  summary: "Byter inloggningsskal (change shell)",
  summaryEn: "Change login shell",
  man: `NAMN
       chsh - byt inloggningsskal

SYNOPSIS
       chsh [-s SKAL] [ANVÄNDARE]
       chsh -l

BESKRIVNING
       Ändrar vilket skal som startas när du loggar in. Skalet står i
       sista fältet på din rad i /etc/passwd. Bara skal som finns med i
       /etc/shells godtas (de läggs dit när skalet installeras). Ändringen
       gäller från nästa inloggning.

       Utan -s frågar chsh efter det nya skalet.

FLAGGOR
       -s SKAL    det nya skalet, med hela sökvägen (t.ex. /usr/bin/zsh)
       -l         lista skalen i /etc/shells (Arch och Fedora)

EXEMPEL
       cat /etc/shells
       chsh -s /usr/bin/zsh
       grep $USER /etc/passwd
       chsh -s /bin/bash`,
  manEn: `NAME
       chsh - change login shell

SYNOPSIS
       chsh [-s SHELL] [USER]
       chsh -l

DESCRIPTION
       Changes which shell is started when you log in. The shell is the
       last field of your line in /etc/passwd. Only shells listed in
       /etc/shells are accepted (they are added there when the shell is
       installed). The change takes effect at the next login.

       Without -s, chsh asks for the new shell.

OPTIONS
       -s SHELL   the new shell, with its full path (e.g. /usr/bin/zsh)
       -l         list the shells in /etc/shells (Arch and Fedora)

EXAMPLES
       cat /etc/shells
       chsh -s /usr/bin/zsh
       grep $USER /etc/passwd
       chsh -s /bin/bash`,
  run: (ctx) => {
    const sh = ctx.sh;
    const utilLinux = sh.distro.family !== "debian";
    let shell: string | null = null;
    const operands: string[] = [];
    for (let i = 0; i < ctx.args.length; i++) {
      const a = ctx.args[i]!;
      if (a === "-s" || a === "--shell") {
        shell = ++i < ctx.args.length ? ctx.args[i]! : null;
        if (shell === null) {
          ctx.err("chsh: option requires an argument -- 's'\n");
          return 1;
        }
      } else if (a.startsWith("--shell=")) shell = a.slice(8);
      else if ((a === "-l" || a === "--list-shells") && utilLinux) {
        ctx.out(sh.vfs.readFile("/etc/shells", sh.rootUser()).replace(commentLineRe, ""));
        return 0;
      } else if (a.startsWith("-")) {
        ctx.err(`chsh: invalid option -- '${a.replace(leadingDashesRe, "")}'\n`);
        return 1;
      } else operands.push(a);
    }
    const me = sh.currentUser();
    const user = operands.length > 0 ? operands[0]! : me.name;
    const line =
      sh.vfs
        .readFile("/etc/passwd", sh.rootUser())
        .split("\n")
        .find((l) => l.split(":")[0] === user) ?? null;
    if (line === null) {
      ctx.err(utilLinux ? `chsh: user "${user}" does not exist.\n` : `chsh: user '${user}' does not exist\n`);
      return 1;
    }
    if (user !== me.name && me.uid !== 0) {
      ctx.err(utilLinux ? "chsh: running UID doesn't match UID of user we're altering, shell change denied\n" : `chsh: You may not change the shell for '${user}'.\n`);
      return 1;
    }
    if (utilLinux) ctx.out(`Changing shell for ${user}.\n`);
    if (me.uid !== 0) ctx.err(`Password: ${UtilCmd.Color.dim}${sh.msg("common.skipsPassword")}${UtilCmd.Color.reset}\n`);
    if (shell !== null) return changeShell(ctx, user, shell, ctx);
    const fields = line.split(":");
    const current = fields.length > 6 ? fields[6]! : "/bin/bash";
    if (!utilLinux) ctx.out(`Changing the login shell for ${user}\nEnter the new value, or press ENTER for the default\n`);
    sh.askText(utilLinux ? `New shell [${current}]: ` : `\tLogin Shell [${current}]: `, (text, io) => {
      const value = netTrim(text);
      if (value === "" || value === current) {
        if (utilLinux) io.out("Shell not changed.\n");
        return 0;
      }
      return changeShell(ctx, user, value, io);
    });
    return 0;
  },
};
