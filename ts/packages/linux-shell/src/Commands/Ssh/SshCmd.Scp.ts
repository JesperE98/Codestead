// Port of Commands/Ssh/SshCmd.Scp.cs – the scp command: copy files to and from another computer over SSH.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { copyFor, joinPath, localPlace, type Place, remotePlace, splitRemote, withServer } from "./SshCmd.Transfer.js";

function sizeText(bytes: number): string {
  return bytes < 1024 ? Js.num(bytes) : bytes < 1024 * 1024 ? `${Js.toFixed(bytes / 1024.0, 1)}KB` : `${Js.toFixed(bytes / 1048576.0, 1)}MB`;
}

export const scp: CommandDef = {
  name: "scp",
  summary: "Kopierar filer till och från en annan dator över SSH",
  summaryEn: "Copy files to and from another computer over SSH",
  man: `NAMN
       scp - kopiera filer över SSH (secure copy)

SYNOPSIS
       scp [-r] [-P PORT] KÄLLA... MÅL

BESKRIVNING
       Fungerar som cp, men KÄLLA eller MÅL kan ligga på en annan dator:
       skriv [ANVÄNDARE@]VÄRD:SÖKVÄG. En relativ SÖKVÄG räknas från
       hemkatalogen på den andra datorn, och VÄRD: ensamt betyder
       hemkatalogen. Inloggningen är samma som för ssh (lösenord eller
       nyckel), och namn i ~/.ssh/config fungerar.

FLAGGOR
       -r        kopiera kataloger med allt innehåll
       -P PORT   anslut till en annan port än 22 (stort P!)
       -p        behåll ändringstiderna
       -q        visa inte förloppet

EXEMPEL
       scp rapport.txt $USER@server.lan:
       scp $USER@server.lan:valkommen.txt .
       scp -r projekt/ $USER@server.lan:backup/`,
  manEn: `NAME
       scp - copy files over SSH (secure copy)

SYNOPSIS
       scp [-r] [-P PORT] SOURCE... TARGET

DESCRIPTION
       Works like cp, but SOURCE or TARGET can be on another computer:
       write [USER@]HOST:PATH. A relative PATH counts from the home
       directory on the other computer, and HOST: alone means the home
       directory. Logging in works as for ssh (password or key), and
       names from ~/.ssh/config work.

OPTIONS
       -r        copy directories with everything in them
       -P PORT   connect to a port other than 22 (capital P!)
       -p        keep the modification times
       -q        do not show the progress

EXAMPLES
       scp report.txt $USER@server.lan:
       scp $USER@server.lan:welcome.txt .
       scp -r project/ $USER@server.lan:backup/`,
  run: runScp,
};

function runScp(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, { flags: "rpqvC346BT", values: "Pio" });
  if (o.error !== null || o.operands.length < 2) {
    ctx.err(
      "usage: scp [-346ABCOpqRrsTv] [-c cipher] [-D sftp_server_path] [-F ssh_config]\n           [-i identity_file] [-J destination] [-l limit] [-o ssh_option]\n           [-P port] [-S program] [-X sftp_option] source ... target\n",
    );
    return 1;
  }
  const pv = o.values.get("P");
  const port = pv !== undefined ? Js.number(pv) : null;
  const recursive = o.flags.has("r");
  const quiet = o.flags.has("q") || !ctx.isTTY;
  const keepTimes = o.flags.has("p");
  const sh = ctx.sh;
  const sources = o.operands.slice(0, -1);
  const target = o.operands.at(-1)!;
  const remotes = o.operands.map(splitRemote);
  const hosts = [...new Set(remotes.filter((r) => r !== null).map((r) => r.raw))];
  if (hosts.length === 0) {
    // No host anywhere: scp copies locally, like cp.
    const args: string[] = [];
    if (recursive) args.push("-r");
    args.push(...o.operands);
    return sh.invoke(["cp", ...args], ctx, true);
  }
  const last = remotes.at(-1) ?? null;
  if (hosts.length > 1 || (last !== null && remotes.slice(0, -1).some((r) => r !== null))) {
    ctx.err(`${UtilCmd.Color.dim}${sh.msg("scp.oneSide")}${UtilCmd.Color.reset}\n`);
    return 1;
  }
  return withServer(ctx, "scp", hosts[0]!, port, (server, io) => {
    const toServer = last !== null;
    const dest = last !== null ? remotePlace(server, last.path, target) : localPlace(sh, target);
    const from = sources.map((s) => (toServer ? localPlace(sh, s) : remotePlace(server, splitRemote(s)!.path, s)));
    return copyFiles("scp", from, dest, recursive, quiet, keepTimes, io);
  });
}

/** scp's copy: like cp, from one computer to the other, with a progress line per file. */
function copyFiles(who: string, from: Place[], dest: Place, recursive: boolean, quiet: boolean, keepTimes: boolean, io: Sink): number {
  let code = 0;
  const destNode = dest.sh.vfs.tryLookup(dest.path, dest.user);
  if (from.length > 1 && destNode?.type !== "dir") {
    io.err(`${who}: ${dest.label}: Not a directory\n`);
    return 1;
  }
  for (const src of from) {
    let node: FsNode;
    try {
      node = src.sh.vfs.lookup(src.path, src.user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      io.err(src.remote ? `${who}: ${src.path}: ${e.message}\n` : `${who}: stat local "${src.label}": ${e.message}\n`);
      code = 1;
      continue;
    }
    if (node.type === "dir" && !recursive) {
      io.err(src.remote ? `${who}: download ${src.path}: not a regular file\n` : `${who}: local "${src.label}" is not a regular file\n`);
      code = 1;
      continue;
    }
    if (node.type === "file" && !VfsLib.hasPerm(node, src.user, "r")) {
      io.err(`${who}: ${src.label}: Permission denied\n`);
      code = 1;
      continue;
    }
    const name = VfsLib.basename(src.path);
    const targetPath = destNode?.type === "dir" ? joinPath(dest.path, name) : dest.path;
    try {
      const existing = dest.sh.vfs.tryLookup(targetPath, dest.user);
      if (node.type === "file" && existing?.type === "file") {
        if (!VfsLib.hasPerm(existing, dest.user, "w")) throw new FsError("EACCES");
        existing.content = node.content;
        existing.size = node.size;
        existing.mtime = keepTimes ? node.mtime : Js.now();
      } else {
        if (existing?.type === "dir" && node.type !== "dir") throw new FsError("EISDIR");
        dest.sh.vfs.insert(targetPath, copyFor(node, dest.user, keepTimes), dest.user);
      }
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      io.err(`${who}: ${dest.remote ? targetPath : dest.label}: ${e.message}\n`);
      code = 1;
      continue;
    }
    if (!quiet) {
      const progress = (fileName: string, n: FsNode): void => {
        if (n.type === "dir") {
          for (const [child, c] of n.children!) progress(child, c);
          return;
        }
        const size = VfsLib.nodeSize(n);
        io.out(`${fileName.padEnd(40)} 100% ${sizeText(size).padStart(6)} ${(sizeText(size * 8) + "/s").padStart(10)}   00:00    \n`);
      };
      progress(name, node);
    }
  }
  return code;
}
