// Port of Commands/Archive/ArchiveCmd.Unzip.cs – the unzip command: unpacks .zip files.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { entryLabel, extractEntries, isoDate, readZip, selectEntries, trailingSlashesRe, zipMethod } from "./ArchiveCmd.js";
import { entrySize } from "./ArchiveCmd.Sizes.js";

export const unzip: CommandDef = {
  name: "unzip",
  summary: "Packar upp .zip-filer",
  man: `NAMN
       unzip - lista och packa upp filer från ett zip-arkiv

SYNOPSIS
       unzip [-l] [-o] [-n] [-q] ARKIV.zip [FIL...] [-d KATALOG]

BESKRIVNING
       Packar upp alla filer (eller bara de angivna) i aktuell katalog.
       Rättigheterna följer med, men filerna ägs av dig.

       Filer som redan finns hoppas över. Använd -o för att skriva över dem.

FLAGGOR
       -l            lista innehållet, packa inte upp
       -d KATALOG    packa upp i KATALOG (skapas om den saknas)
       -o            skriv över befintliga filer utan att fråga
       -n            skriv aldrig över befintliga filer
       -q            tyst – skriv inte ut något

EXEMPEL
       unzip -l dokument.zip
       unzip dokument.zip -d uppackat`,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "lonq", values: "d" });
    if (o.error !== null) {
      ctx.err(`unzip: ${o.error}\n`);
      return 10;
    }
    if (o.operands.length === 0) {
      ctx.out(
        "UnZip 6.00 of 20 April 2009. Original by Info-ZIP.\n\n" +
          "Usage: unzip [-opts] file[.zip] [list] [-d exdir]\n" +
          "  -l  list files (short format)     -d  extract files into exdir\n" +
          "  -o  overwrite files WITHOUT prompting\n" +
          "  -n  never overwrite existing files  -q  quiet mode\n",
      );
      return 0;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    const archive = o.operands[0]!;
    let content: string | null = null;
    for (const candidate of [archive, `${archive}.zip`]) {
      try {
        content = sh.vfs.readFile(sh.resolve(candidate), user);
        break;
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        // try the next name
      }
    }
    if (content === null) {
      ctx.err(`unzip:  cannot find or open ${archive}, ${archive}.zip or ${archive}.ZIP.\n`);
      return 9;
    }
    const entries = readZip(content);
    if (entries === null) {
      ctx.out(`Archive:  ${archive}\n`);
      ctx.err(
        "  End-of-central-directory signature not found.  Either this file is not\n" +
          "  a zipfile, or it constitutes one disk of a multi-part archive.  In the\n" +
          "  latter case the central directory and zipfile comment will be found on\n" +
          "  the last disk(s) of this archive.\n" +
          `unzip:  cannot find zipfile directory in one of ${archive} or\n` +
          `        ${archive}.zip, and cannot find ${archive}.ZIP, period.\n`,
      );
      return 9;
    }
    const { selected, missing } = selectEntries(entries, o.operands.slice(1));
    const quiet = o.flags.has("q");
    let code = 0;

    if (o.flags.has("l")) {
      ctx.out(`Archive:  ${archive}\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n`);
      let total = 0;
      for (const e of selected) {
        total += entrySize(e);
        ctx.out(`${Js.num(entrySize(e)).padStart(9)}  ${isoDate(e.mtime)}   ${entryLabel(e)}\n`);
      }
      const n = selected.length;
      ctx.out(`---------                     -------\n${Js.num(total).padStart(9)}                     ${n} file${n === 1 ? "" : "s"}\n`);
    } else {
      let base = sh.cwd;
      let prefix = "";
      const ddir = o.values.get("d");
      if (ddir !== undefined) {
        base = sh.resolve(ddir);
        prefix = ddir.replace(trailingSlashesRe, "") + "/";
        try {
          let cur = "";
          for (const seg of base.split("/").filter((s) => s !== "")) {
            cur += "/" + seg;
            const n = sh.vfs.tryLookup(cur, user);
            if (n === null) sh.vfs.mkdir(cur, user);
            else if (n.type !== "dir") throw new FsError("ENOTDIR");
          }
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`checkdir:  cannot create extraction directory: ${ddir}\n           ${e.message}\n`);
          return 3;
        }
      }
      if (!quiet) ctx.out(`Archive:  ${archive}\n`);
      const ok = extractEntries(ctx, selected, base, {
        keepOwner: false,
        umask: 0,
        before: (e, existing) => {
          const label = prefix + entryLabel(e);
          if (existing?.type === "file" && !o.flags.has("o")) {
            if (!o.flags.has("n") && !quiet) ctx.out(`  skipping: ${label}  (already exists; use -o to overwrite)\n`);
            return false;
          }
          if (!quiet) {
            if (e.type === "dir") {
              if (existing === null) ctx.out(`   creating: ${label}\n`);
            } else {
              ctx.out(`${zipMethod(e).startsWith("stored") ? " extracting" : "  inflating"}: ${label}\n`);
            }
          }
          return true;
        },
        error: (e, what, msg) => ctx.err(`${what === "dir" ? "checkdir error" : "error"}:  cannot create ${prefix}${e.path}\n        ${msg}\n`),
      });
      if (!ok) code = 50;
    }
    for (const m of missing) ctx.err(`caution: filename not matched:  ${m}\n`);
    if (missing.length > 0 && code === 0) code = 11;
    return code;
  },
};
