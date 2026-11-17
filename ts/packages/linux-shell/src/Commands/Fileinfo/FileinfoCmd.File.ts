// Port of Commands/Fileinfo/FileinfoCmd.File.cs – the file command: determine what kind of data a file contains.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { describe } from "./FileinfoCmd.js";

export const file: CommandDef = {
  name: "file",
  summary: "Gissar vad en fil innehåller (text, skript, arkiv, program ...)",
  summaryEn: "Determine what kind of data a file contains",
  man: `NAMN
       file - ta reda på vad en fil innehåller

SYNOPSIS
       file [-b] [-L] FIL...

BESKRIVNING
       Linux bryr sig inte om filändelser: en fil som heter bild.txt
       kan vara vad som helst. file tittar på innehållet i stället och
       säger om det är text, ett skript, ett arkiv, ett program och så
       vidare. En symbolisk länk visas som länk; med -L undersöks filen
       den pekar på.

FLAGGOR
       -b   skriv bara beskrivningen, inte filnamnet
       -L   följ symboliska länkar

EXEMPEL
       file /usr/bin/ls
       file *`,
  manEn: `NAME
       file - determine file type

SYNOPSIS
       file [-b] [-L] FILE...

DESCRIPTION
       Linux does not care about file name extensions: a file called
       picture.txt can be anything. file looks at the content instead and
       tells whether it is text, a script, an archive, a program and so on.
       A symbolic link is shown as a link; with -L the file it points to
       is examined.

OPTIONS
       -b   print only the description, not the file name
       -L   follow symbolic links

EXAMPLES
       file /usr/bin/ls
       file *`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "bLhiz", long: { brief: "b", dereference: "L", "no-dereference": "h" } });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    if (o.operands.length === 0) {
      ctx.err(
        "Usage: file [-bcCdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>]\n            [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet]\n            <file> ...\n       file -C [-m <magicfiles>]\n       file [--help]\n",
      );
      return 1;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    const width = Math.max(...o.operands.map((a) => a.length)) + 1;
    for (const arg of o.operands) {
      const path = sh.resolve(arg);
      let desc: string;
      if (path === "/dev/null") desc = "character special (1/3)";
      else {
        let node = sh.vfs.tryLookupLink(path, user);
        if (node?.type === "link" && o.flags.has("L")) node = sh.vfs.tryLookup(path, user) ?? node;
        if (node === null) desc = `cannot open \`${arg}' (No such file or directory)`;
        else if (node.type === "dir") desc = "directory";
        else if (node.type === "link")
          desc = sh.vfs.tryLookup(path, user) === null ? `broken symbolic link to ${node.content}` : `symbolic link to ${node.content}`;
        else if (!VfsLib.hasPerm(node, user, "r")) desc = "regular file, no read permission";
        else desc = describe(node.content ?? "", (node.mode & Js.oct(111)) !== 0);
      }
      ctx.out(o.flags.has("b") ? desc + "\n" : `${(arg + ":").padEnd(width)} ${desc}\n`);
    }
    return 0;
  },
};
