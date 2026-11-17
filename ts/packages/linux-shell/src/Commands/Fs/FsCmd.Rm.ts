// Port of Commands/Fs/FsCmd.Rm.cs – the rm command: removes files and directories.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const rm: CommandDef = {
  name: "rm",
  summary: "Tar bort filer och kataloger",
  man: `NAMN
       rm - ta bort filer eller kataloger (remove)

SYNOPSIS
       rm [FLAGGA]... FIL...

BESKRIVNING
       Tar bort filer. Det finns ingen papperskorg – det som tas bort är borta!

FLAGGOR
       -r, -R, --recursive   ta bort kataloger och allt innehåll
       -f, --force           ignorera filer som inte finns, fråga aldrig
       -v, --verbose         berätta vad som tas bort

VARNING
       rm -rf är kraftfullt. Dubbelkolla alltid sökvägen innan du trycker Enter.`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "rRfiv",
      long: { recursive: "r", force: "f", verbose: "v", "no-preserve-root": "P" },
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const force = o.flags.has("f");
    const recursive = o.flags.has("r") || o.flags.has("R");
    if (o.operands.length === 0) {
      if (force) return 0;
      return UtilCmd.badOption(ctx, "missing operand");
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let code = 0;
    for (const t of o.operands) {
      const path = sh.resolve(t);
      const b = VfsLib.basename(t);
      if (b === "." || b === "..") {
        ctx.err(`rm: refusing to remove '.' or '..' directory: skipping '${t}'\n`);
        code = 1;
        continue;
      }
      if (path === "/") {
        if (!recursive) {
          ctx.err("rm: cannot remove '/': Is a directory\n");
          code = 1;
          continue;
        }
        if (!o.flags.has("P")) {
          ctx.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n");
          code = 1;
          continue;
        }
        if (user.uid !== 0) {
          ctx.err("rm: cannot remove '/': Permission denied\n");
          code = 1;
          continue;
        }
        sh.vfs.root.children = Js.obj<FsNode>();
        continue;
      }
      try {
        // rm removes a symbolic link itself, never what it points to.
        const node = sh.vfs.lookup(path, user, t.endsWith("/"));
        if (node.type === "dir" && !recursive) throw new FsError("EISDIR");
        sh.vfs.remove(path, user);
        if (o.flags.has("v")) ctx.out(node.type === "dir" ? `removed directory '${t}'\n` : `removed '${t}'\n`);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        if (force && e.code === "ENOENT") continue;
        ctx.err(`rm: cannot remove '${t}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
