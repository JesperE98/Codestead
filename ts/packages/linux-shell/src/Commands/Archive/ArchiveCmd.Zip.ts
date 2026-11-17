// Port of Commands/Archive/ArchiveCmd.Zip.cs – the zip command: bundles and compresses files into a .zip file.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import {
  entryLabel,
  leadingDotSlashRe,
  leadingSlashesRe,
  makeZip,
  readZip,
  trailingSlashesRe,
  walkTree,
  zipMethod,
} from "./ArchiveCmd.js";
import type { ArchiveEntry } from "./ArchiveEntry.js";

const shortOptRe = /-- '(.)'/;

export const zip: CommandDef = {
  name: "zip",
  summary: "Packar ihop och komprimerar filer till en .zip-fil",
  man: `NAMN
       zip - packa ihop och komprimera filer till ett zip-arkiv

SYNOPSIS
       zip [-r] [-q] [-j] ARKIV.zip FIL...

BESKRIVNING
       zip gör både det som tar och gzip gör: packar ihop flera filer till
       ett arkiv och komprimerar dem. Formatet kommer från Windows-världen,
       så välj zip när du ska skicka filer till någon som inte kör Linux.

       Finns arkivet redan läggs filerna till (eller uppdateras) i det.
       Saknar ARKIV filändelse läggs .zip till.

FLAGGOR
       -r    ta med kataloger och allt deras innehåll (recursive). Utan -r
             läggs bara den tomma katalogen till!
       -q    tyst – skriv inte ut något
       -j    spara bara filnamnen, inte katalogerna (junk paths)

EXEMPEL
       zip -r dokument.zip dokument
       zip bilder.zip bild1.png bild2.png

SE ÄVEN
       unzip(1), tar(1)`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "rqj0123456789",
      long: { "recurse-paths": "r", quiet: "q", "junk-paths": "j" },
    });
    if (o.error !== null) {
      const m = shortOptRe.exec(o.error);
      ctx.err(`zip error: Invalid command arguments (${m ? `short option '${m[1]}' not supported` : o.error})\n`);
      return 16;
    }
    if (o.operands.length === 0) {
      ctx.out(
        "Usage: zip [-options] zipfile list\n" +
          "  The default action is to add or replace zipfile entries from list.\n" +
          "  -r   recurse into directories     -q   quiet operation\n" +
          "  -j   junk (don't record) directory names\n",
      );
      return 0;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    let archive = o.operands[0]!;
    if (!VfsLib.basename(archive).includes(".")) archive += ".zip";
    const archivePath = sh.resolve(archive);
    const files = o.operands.slice(1);
    if (files.length === 0) {
      ctx.err(`\nzip error: Nothing to do! (${archive})\n`);
      return 12;
    }
    let entries: ArchiveEntry[] = [];
    const existing = sh.vfs.tryLookup(archivePath, user);
    if (existing !== null) {
      let content: string;
      try {
        content = sh.vfs.readFile(archivePath, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`zip I/O error: ${e.message}\n\nzip error: Could not open input file (${archive})\n`);
        return 15;
      }
      const old = content === "" ? [] : readZip(content);
      if (old === null) {
        ctx.err(`\nzip error: Zip file structure invalid (${archive})\n`);
        return 3;
      }
      entries = old;
    }
    let added = 0;
    for (const op of files) {
      const abs = sh.resolve(op);
      let node: FsNode;
      try {
        node = sh.vfs.lookup(abs, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`\tzip warning: name not matched: ${op}\n`);
        continue;
      }
      // zip always stores relative paths: leading / and ./ are removed.
      const name = op.replace(trailingSlashesRe, "").replace(leadingSlashesRe, "").replace(leadingDotSlashRe, "");
      walkTree(user, node, abs, name === "." ? "" : name, o.flags.has("r"), {
        add: (e) => {
          if (o.flags.has("j")) {
            if (e.type === "dir") return;
            e.path = VfsLib.basename(e.path);
          }
          const idx = entries.findIndex((x) => x.path === e.path);
          if (idx >= 0) entries[idx] = e;
          else entries.push(e);
          added++;
          if (!o.flags.has("q")) ctx.out(`  ${idx >= 0 ? "updating" : "adding"}: ${entryLabel(e)} (${zipMethod(e)})\n`);
        },
        error: (n) => ctx.err(`\tzip warning: could not open for reading: ${n}\n`),
        skip: (a) => a === archivePath,
      });
    }
    if (added === 0 && existing === null) {
      ctx.err(`\nzip error: Nothing to do! (${archive})\n`);
      return 12;
    }
    try {
      sh.vfs.writeFile(archivePath, makeZip(entries), user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`zip I/O error: ${e.message}\n\nzip error: Could not create output file (${archive})\n`);
      return 15;
    }
    return 0;
  },
};
