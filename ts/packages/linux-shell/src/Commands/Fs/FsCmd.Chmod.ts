// Port of Commands/Fs/FsCmd.Chmod.cs – the chmod command: changes file permissions.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { applyMode } from "./FsCmd.js";

export const chmod: CommandDef = {
  name: "chmod",
  summary: "Ändrar rättigheter på filer",
  man: `NAMN
       chmod - ändra rättigheter (change mode)

SYNOPSIS
       chmod [-R] LÄGE FIL...

BESKRIVNING
       LÄGE kan anges med siffror eller symboler.

       Siffror (oktalt): en siffra per grupp – ägare, grupp, övriga.
       r = 4, w = 2, x = 1. Lägg ihop dem:
           chmod 755 skript.sh   rwxr-xr-x
           chmod 644 fil.txt     rw-r--r--
           chmod 600 hemligt     rw-------

       Symboler: [ugoa][+-=][rwx]
           u = ägare (user), g = grupp, o = övriga (others), a = alla
           chmod +x skript.sh    gör körbar för alla
           chmod u+x,g-w fil     lägg till x för ägaren, ta bort w för gruppen
           chmod o= fil          ta bort alla rättigheter för övriga

FLAGGOR
       -R    ändra rekursivt i kataloger`,
  run: (ctx) => {
    const sh = ctx.sh;
    const user = sh.currentUser();
    let recursive = false;
    let mode: string | null = null;
    const files: string[] = [];
    for (const a of ctx.args) {
      if (a === "-R" || a === "--recursive") recursive = true;
      else if (mode === null) mode = a;
      else files.push(a);
    }
    if (mode === null) return UtilCmd.badOption(ctx, "missing operand");
    if (files.length === 0) return UtilCmd.badOption(ctx, `missing operand after '${mode}'`);
    if (applyMode(0, mode, false) === null) return UtilCmd.badOption(ctx, `invalid mode: '${mode}'`);
    const spec = mode;
    let code = 0;
    const apply = (label: string, node: FsNode): void => {
      if (user.uid !== 0 && node.owner !== user.name) {
        ctx.err(`chmod: changing permissions of '${label}': Operation not permitted\n`);
        code = 1;
        return;
      }
      node.mode = applyMode(node.mode, spec, node.type === "dir")!;
      if (recursive && node.type === "dir") {
        // Symbolic links inside the directory are left alone (their own permissions do not matter).
        for (const [n, c] of [...node.children!]) if (c.type !== "link") apply(`${label}/${n}`, c);
      }
    };
    for (const f of files) {
      try {
        apply(f, sh.vfs.lookup(sh.resolve(f), user));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`chmod: cannot access '${f}': ${e.message}\n`);
        code = 1;
      }
    }
    return code;
  },
};
