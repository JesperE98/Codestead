// Port of Commands/Fs/FsCmd.Cd.cs – the cd command: changes the current directory.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";

export const cd: CommandDef = {
  name: "cd",
  builtin: true,
  summary: "Byter aktuell katalog",
  man: `NAMN
       cd - byt katalog (change directory)

SYNOPSIS
       cd [KATALOG]

BESKRIVNING
       Gör KATALOG till den aktuella katalogen. Utan argument går du till
       din hemkatalog ($HOME).

       cd ..     gå upp en nivå
       cd ~      gå till hemkatalogen
       cd -      gå tillbaka till föregående katalog
       cd /      gå till rotkatalogen`,
  run: (ctx) => {
    const sh = ctx.sh;
    if (ctx.args.length > 1) {
      ctx.err("bash: cd: too many arguments\n");
      return 1;
    }
    let target = ctx.args.length > 0 ? ctx.args[0]! : sh.home;
    if (target === "-") {
      const oldpwd = sh.env.get("OLDPWD");
      if (oldpwd === undefined || oldpwd === "") {
        ctx.err("bash: cd: OLDPWD not set\n");
        return 1;
      }
      target = oldpwd;
      ctx.out(target + "\n");
    }
    if (target === "") return 0;
    const path = sh.resolve(target);
    const user = sh.currentUser();
    try {
      const node = sh.vfs.lookup(path, user);
      if (node.type !== "dir") throw new FsError("ENOTDIR");
      if (!VfsLib.hasPerm(node, user, "x")) throw new FsError("EACCES");
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`bash: cd: ${target}: ${e.message}\n`);
      return 1;
    }
    sh.env.set("OLDPWD", sh.cwd);
    sh.cwd = path;
    sh.env.set("PWD", path);
    return 0;
  },
};
