// Port of Commands/Ssh/SshCmd.Ssh.cs – the ssh command: log in to or run commands on another computer.

import { Js } from "../../Js.js";
import * as NetworkLib from "../../Network/NetworkLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { authenticate, dim, parseDest, serverFor, sshConnect } from "./SshCmd.js";

const valueOptRe = /^-[pliFoJLRDEWbcmQSweB]$/;
const portOptRe = /^-p[0-9]+$/;

export const ssh: CommandDef = {
  name: "ssh",
  summary: "Loggar in på eller kör kommandon på en annan dator",
  summaryEn: "Log in to or run commands on another computer",
  man: `NAMN
       ssh - Secure Shell: logga in på en annan dator krypterat

SYNOPSIS
       ssh [-p PORT] [ANVÄNDARE@]VÄRD [KOMMANDO]

BESKRIVNING
       Ansluter till SSH-servern (sshd, port 22) på en annan dator. Med ett
       KOMMANDO körs det på den andra datorn och resultatet visas här.
       Första gången frågar ssh om du litar på datorns värdnyckel; svaret
       sparas i ~/.ssh/known_hosts.

       I simulatorn finns servern server.lan (192.168.1.10) med samma
       användare som på din egen dator ($USER). Interaktiva inloggningar
       stöds inte – skriv kommandot efter värden.

FLAGGOR
       -p PORT   anslut till en annan port än 22
       -l NAMN   användarnamn (samma som NAMN@VÄRD)

~/.ssh/config
       Ge datorer korta namn. Efter

           Host srv
               HostName 192.168.1.10
               User elev

       räcker det att skriva ssh srv (och scp fil srv:). Filen får
       bara du kunna skriva i (chmod 600).

EXEMPEL
       ssh $USER@server.lan hostname
       ssh $USER@server.lan 'ls -l; cat *.txt'
       ssh $USER@192.168.1.10 uptime`,
  manEn: `NAME
       ssh - Secure Shell: log in to another computer, encrypted

SYNOPSIS
       ssh [-p PORT] [USER@]HOST [COMMAND]

DESCRIPTION
       Connects to the SSH server (sshd, port 22) on another computer. With
       a COMMAND, it runs on the other computer and the result is shown
       here. The first time, ssh asks whether you trust the computer's host
       key; the answer is saved in ~/.ssh/known_hosts.

       The simulator has the server server.lan (192.168.1.10) with the same
       user as on your own computer ($USER). Interactive logins are not
       supported – put the command after the host.

OPTIONS
       -p PORT   connect to a port other than 22
       -l NAME   user name (same as NAME@HOST)

~/.ssh/config
       Give computers short names. After

           Host srv
               HostName 192.168.1.10
               User student

       it is enough to type ssh srv (and scp file srv:). Only you may be
       able to write to the file (chmod 600).

EXAMPLES
       ssh $USER@server.lan hostname
       ssh $USER@server.lan 'ls -l; cat *.txt'
       ssh $USER@192.168.1.10 uptime`,
  run: (ctx) => {
    const sh = ctx.sh;
    const args = [...ctx.args];
    let port: number | null = null;
    let login: string | null = null;
    let dest: string | null = null;
    while (args.length > 0) {
      const a = args.shift()!;
      if (a === "-V") {
        ctx.err("OpenSSH_10.0p2, OpenSSL 3.5.1 1 Jul 2025\n");
        return 0;
      }
      if (valueOptRe.test(a)) {
        if (args.length === 0) {
          ctx.err(`ssh: option requires an argument -- ${a[1]}\n`);
          return 255;
        }
        const v = args.shift()!;
        if (a === "-p") port = Js.number(v);
        if (a === "-l") login = v;
        continue;
      }
      if (portOptRe.test(a)) {
        port = Js.number(a.slice(2));
        continue;
      }
      if (a.startsWith("-")) continue;
      dest = a;
      break;
    }
    if (dest === null) {
      ctx.err(
        "usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address]\n           [-c cipher_spec] [-D [bind_address:]port] [-E log_file]\n           [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file]\n           [-J destination] [-L address] [-l login_name] [-m mac_spec]\n           [-O ctl_cmd] [-o option] [-P tag] [-p port] [-R address]\n           [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]]\n           destination [command [argument ...]]\n",
      );
      return 255;
    }
    if (port !== null && (!Number.isFinite(port) || port !== Math.floor(port) || port < 1 || port > 65535)) {
      ctx.err(`Bad port '${Js.num(port)}'\n`);
      return 255;
    }
    const { dest: d, error: configError } = parseDest(dest, login, sh, port);
    if (d === null) {
      ctx.err(configError!);
      return 255;
    }
    const command = args.join(" ");
    const shownDest = dest;
    return sshConnect(ctx, d, (io) => {
      if (!authenticate(sh, d, io)) return 255;
      const server = serverFor(sh);
      if (command.trim() === "") {
        io.out(
          `Linux ${NetworkLib.ServerName} ${server.distro.kernel} #1 SMP PREEMPT_DYNAMIC Debian x86_64\n\n` +
            "The programs included with the Debian GNU/Linux system are free software;\n" +
            "the exact distribution terms for each program are described in the\n" +
            "individual files in /usr/share/doc/*/copyright.\n\n" +
            "Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent\npermitted by applicable law.\n" +
            `Last login: Thu Oct 29 18:03:12 2026 from ${NetworkLib.MyIpAddress}\n`,
        );
        io.err(dim(sh, "ssh.noInteractiveShell", { dest: shownDest }));
        io.err(`Connection to ${d.host} closed.\n`);
        return 0;
      }
      const result = server.execute(command);
      server.cancel();
      io.out(result.output);
      return result.exitCode;
    });
  },
};
