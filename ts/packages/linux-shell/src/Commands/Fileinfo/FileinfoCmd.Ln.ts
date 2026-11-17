// Port of Commands/Fileinfo/FileinfoCmd.Ln.cs – the ln command: make links between files (symbolic with -s).

import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { joinPath, relativePath } from "./FileinfoCmd.js";

export const ln: CommandDef = {
  name: "ln",
  summary: "Skapar länkar till filer (symboliska med -s)",
  summaryEn: "Make links between files (symbolic with -s)",
  man: `NAMN
       ln - skapa länkar mellan filer

SYNOPSIS
       ln [-s] [-f] [-v] MÅL [LÄNKNAMN]
       ln [-s] [-f] [-v] MÅL... KATALOG

BESKRIVNING
       Skapar LÄNKNAMN som pekar på MÅL. Utan LÄNKNAMN får länken samma
       namn som MÅL, i katalogen du står i.

       En symbolisk länk (-s) är en liten fil som innehåller en sökväg.
       Den kan peka på kataloger och på andra filsystem, och den slutar
       fungera om målet tas bort eller flyttas. En relativ sökväg i
       länken räknas från katalogen där länken ligger.

       En hård länk (utan -s) är ett namn till på samma fil (samma
       inod). Filen finns kvar så länge den har minst ett namn.

FLAGGOR
       -s, --symbolic   skapa en symbolisk länk
       -f, --force      ta bort en fil som redan har länkens namn
       -n               behandla en länk till en katalog som en fil
       -v, --verbose    berätta vilken länk som skapas

EXEMPEL
       ln -s /var/log/syslog loggen
       ln -s ~/projekt/start.sh ~/bin/start
       ln anteckningar.txt kopia-som-delar-innehall.txt`,
  manEn: `NAME
       ln - make links between files

SYNOPSIS
       ln [-s] [-f] [-v] TARGET [LINK_NAME]
       ln [-s] [-f] [-v] TARGET... DIRECTORY

DESCRIPTION
       Creates LINK_NAME pointing to TARGET. Without LINK_NAME the link
       gets the same name as TARGET, in the directory you are in.

       A symbolic link (-s) is a small file that contains a path. It can
       point to directories and to other file systems, and it stops
       working if the target is removed or moved. A relative path in the
       link counts from the directory the link is in.

       A hard link (without -s) is one more name for the same file (the
       same inode). The file lives on as long as it has at least one name.

OPTIONS
       -s, --symbolic   make a symbolic link
       -f, --force      remove a file that already has the link's name
       -n               treat a link to a directory as a file
       -v, --verbose    print the name of each link made

EXAMPLES
       ln -s /var/log/syslog thelog
       ln -s ~/project/start.sh ~/bin/start
       ln notes.txt same-file-other-name.txt`,
  run: (ctx) => runLn(ctx),
};

function runLn(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "sfnvrT",
    long: { symbolic: "s", force: "f", verbose: "v", "no-dereference": "n", relative: "r", "no-target-directory": "T" },
  });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
  if (o.operands.length === 0) return UtilCmd.badOption(ctx, "missing file operand");
  const sh = ctx.sh;
  const user = sh.currentUser();
  const symbolic = o.flags.has("s");
  const ops = [...o.operands];
  const dest = ops.length > 1 ? ops.at(-1)! : null;
  const sources = ops.length > 1 ? ops.slice(0, -1) : ops;
  // Where the link(s) go: into a directory (also "." when no name is given) or under a new name.
  let destDir: string | null = null;
  if (dest === null) destDir = ".";
  else if (!o.flags.has("T")) {
    const destPath = sh.resolve(dest);
    const asDir = o.flags.has("n") ? sh.vfs.tryLookupLink(destPath, user) : sh.vfs.tryLookup(destPath, user);
    if (asDir?.type === "dir") destDir = dest;
  }
  if (sources.length > 1 && destDir === null) {
    ctx.err(`ln: target '${dest}' is not a directory\n`);
    return 1;
  }
  let code = 0;
  for (const src of sources) {
    let label: string;
    if (destDir === null) label = dest!;
    else if (destDir === "." && dest === null) label = VfsLib.basename(src);
    else {
      const d = destDir.replace(/\/+$/, "");
      label = joinPath(d.length > 0 ? d : "/", VfsLib.basename(src));
    }
    const linkPath = sh.resolve(label);
    const kind = symbolic ? "symbolic link" : "hard link";
    try {
      let target: FsNode | null = null;
      if (!symbolic) {
        try {
          target = sh.vfs.lookup(sh.resolve(src), user);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`ln: failed to access '${src}': ${e.message}\n`);
          code = 1;
          continue;
        }
        if (target.type === "dir") {
          ctx.err(`ln: ${src}: hard link not allowed for directory\n`);
          code = 1;
          continue;
        }
      }
      const existing = sh.vfs.tryLookupLink(linkPath, user);
      if (existing !== null) {
        if (!symbolic && existing === target) {
          ctx.err(`ln: '${src}' and '${label}' are the same file\n`);
          code = 1;
          continue;
        }
        if (!o.flags.has("f")) throw new FsError("EEXIST");
        if (existing.type === "dir") {
          ctx.err(`ln: ${label}: cannot overwrite directory\n`);
          code = 1;
          continue;
        }
        sh.vfs.remove(linkPath, user);
      }
      if (symbolic) {
        let text = src;
        // -r: a path relative to where the link is (ln -sr ../a b).
        if (o.flags.has("r")) text = relativePath(VfsLib.dirname(linkPath), sh.resolve(src));
        sh.vfs.insert(linkPath, VfsLib.makeLink(text, user.name, user.groups[0] ?? null), user);
        if (o.flags.has("v")) ctx.out(`'${label}' -> '${text}'\n`);
      } else {
        sh.vfs.hardLink(target!, linkPath, user);
        if (o.flags.has("v")) ctx.out(`'${label}' => '${src}'\n`);
      }
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`ln: failed to create ${kind} '${label}': ${e.message}\n`);
      code = 1;
    }
  }
  return code;
}
