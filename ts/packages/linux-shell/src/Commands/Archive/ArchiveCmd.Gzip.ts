// Port of Commands/Archive/ArchiveCmd.Gzip.cs – the gzip, gunzip and zcat commands.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as AwkCmd from "../Awk/AwkCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { gunzipString, gzipString, joinPath, sortedChildren } from "./ArchiveCmd.js";
import { logicalSize } from "./ArchiveCmd.Sizes.js";

function ratio(compressed: number, uncompressed: number): string {
  const r = uncompressed === 0 ? 0 : (1 - compressed / uncompressed) * 100;
  return `${AwkCmd.jsToFixed(r, 1).padStart(5)}%`;
}

const gzSuffixes: { suffix: string; replacement: string }[] = [
  { suffix: ".tgz", replacement: ".tar" },
  { suffix: ".gz", replacement: "" },
];

function gzipLike(mode: string): (ctx: CmdCtx) => number {
  return (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "cdfklqrtv123456789",
      long: {
        stdout: "c",
        "to-stdout": "c",
        decompress: "d",
        uncompress: "d",
        force: "f",
        keep: "k",
        list: "l",
        quiet: "q",
        recursive: "r",
        test: "t",
        verbose: "v",
        fast: "1",
        best: "9",
      },
    });
    if (o.error !== null) {
      ctx.err(`gzip: ${o.error}\nTry \`gzip --help' for more information.\n`);
      return 1;
    }
    const sh = ctx.sh;
    const user = sh.currentUser();
    const has = (f: string): boolean => o.flags.has(f);
    const decompress = mode !== "gzip" || has("d") || has("l") || has("t");
    const toStdout = mode === "zcat" || has("c");
    const verbose = has("v") && !has("q");
    let code = 0;
    const warn = (): void => {
      code = Math.max(code, 2);
    };
    const fail = (): void => {
      code = 1;
    };
    const notToTerminal = (): number => {
      ctx.err("gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h\n");
      return 1;
    };
    const listRows: { c: number; u: number; name: string }[] = [];

    const handleStdin = (): void => {
      const input = ctx.stdin ?? "";
      if (!decompress) {
        if (ctx.isTTY && !has("f")) {
          code = notToTerminal();
          return;
        }
        ctx.out(gzipString(input));
        return;
      }
      if (input === "") {
        ctx.err("gzip: stdin: unexpected end of file\n");
        fail();
        return;
      }
      const gz = gunzipString(input);
      if (gz === null) {
        ctx.err("gzip: stdin: not in gzip format\n");
        fail();
        return;
      }
      if (has("l")) listRows.push({ c: logicalSize(input), u: gz.s ?? logicalSize(gz.d), name: "stdout" });
      else if (!has("t")) ctx.out(gz.d);
    };

    const handleFile = (label: string, abs: string, node: FsNode): void => {
      let content: string;
      try {
        content = sh.vfs.readFile(abs, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`gzip: ${label}: ${e.message}\n`);
        fail();
        return;
      }

      // Creates the output file with the same permissions and time as the original, and removes the original.
      const replace = (outLabel: string, data: string, size: number | null = null): boolean => {
        const outAbs = joinPath(VfsLib.dirname(abs), VfsLib.basename(outLabel));
        if (sh.vfs.tryLookup(outAbs, user) !== null && !has("f")) {
          ctx.err(`gzip: ${outLabel} already exists; not overwritten\n`);
          warn();
          return false;
        }
        try {
          const outNode = VfsLib.makeFile(
            data,
            user.uid === 0 ? node.owner : user.name,
            node.mode,
            user.uid === 0 ? node.group : (user.groups[0] ?? null),
          );
          outNode.mtime = node.mtime;
          if (size !== null) outNode.size = size;
          sh.vfs.insert(outAbs, outNode, user);
          if (!has("k")) sh.vfs.remove(abs, user);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`gzip: ${outLabel}: ${e.message}\n`);
          fail();
          return false;
        }
        return true;
      };

      if (decompress) {
        let suffix: { suffix: string; replacement: string } | null = null;
        for (const sfx of gzSuffixes) {
          if (label.endsWith(sfx.suffix) && label.length > sfx.suffix.length) {
            suffix = sfx;
            break;
          }
        }
        if (suffix === null && !toStdout && !has("l") && !has("t")) {
          ctx.err(`gzip: ${label}: unknown suffix -- ignored\n`);
          warn();
          return;
        }
        const gz = gunzipString(content);
        if (gz === null) {
          ctx.err(`gzip: ${label}: not in gzip format\n`);
          fail();
          return;
        }
        const outLabel = suffix !== null ? label.slice(0, label.length - suffix.suffix.length) + suffix.replacement : label;
        const uncompressed = gz.s ?? logicalSize(gz.d);
        if (has("l")) {
          listRows.push({ c: VfsLib.nodeSize(node), u: uncompressed, name: outLabel });
        } else if (has("t")) {
          if (verbose) ctx.err(`${label}:\t OK\n`);
        } else if (toStdout) {
          ctx.out(gz.d);
        } else if (replace(outLabel, gz.d, gz.s ?? null)) {
          if (verbose)
            ctx.err(`${label}:\t${ratio(VfsLib.nodeSize(node), uncompressed)} -- ${has("k") ? "created" : "replaced with"} ${outLabel}\n`);
        }
        return;
      }

      if (gzSuffixes.some((s) => label.endsWith(s.suffix)) && !toStdout) {
        ctx.err(`gzip: ${label} already has ${label.endsWith(".tgz") ? ".tgz" : ".gz"} suffix -- unchanged\n`);
        warn();
        return;
      }
      const data = gzipString(content, VfsLib.basename(label), node.size ?? null);
      if (toStdout) {
        if (ctx.isTTY && !has("f")) {
          code = notToTerminal();
          return;
        }
        ctx.out(data);
      } else if (replace(`${label}.gz`, data)) {
        if (verbose)
          ctx.err(`${label}:\t${ratio(logicalSize(data), VfsLib.nodeSize(node))} -- ${has("k") ? "created" : "replaced with"} ${label}.gz\n`);
      }
    };

    const visit = (label: string, abs: string): void => {
      let node: FsNode;
      try {
        node = sh.vfs.lookup(abs, user);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`gzip: ${label}: ${e.message}\n`);
        fail();
        return;
      }
      if (node.type === "dir") {
        if (!has("r")) {
          ctx.err(`gzip: ${label} is a directory -- ignored\n`);
          warn();
          return;
        }
        if (!VfsLib.hasPerm(node, user, "r")) {
          ctx.err(`gzip: ${label}: Permission denied\n`);
          fail();
          return;
        }
        for (const child of sortedChildren(node)) visit(label.endsWith("/") ? label + child : `${label}/${child}`, joinPath(abs, child));
        return;
      }
      handleFile(label, abs, node);
    };

    const operands = o.operands.length > 0 ? o.operands : ["-"];
    for (const op of operands) {
      if (op === "-") handleStdin();
      else visit(op, sh.resolve(op));
    }

    if (listRows.length > 0) {
      const row = (c: number, u: number, name: string): string => `${Js.num(c).padStart(19)} ${Js.num(u).padStart(19)} ${ratio(c, u)} ${name}\n`;
      ctx.out(`${"compressed".padStart(19)} ${"uncompressed".padStart(19)}  ratio uncompressed_name\n`);
      for (const r of listRows) ctx.out(row(r.c, r.u, r.name));
      if (listRows.length > 1) {
        let c = 0;
        let u = 0;
        for (const r of listRows) {
          c += r.c;
          u += r.u;
        }
        ctx.out(row(c, u, "(totals)"));
      }
    }
    return code;
  };
}

const gzipMan = `NAMN
       gzip, gunzip, zcat - komprimera och dekomprimera filer

SYNOPSIS
       gzip [-k] [-v] [-d] [-c] [-l] FIL...
       gunzip FIL.gz...
       zcat FIL.gz...

BESKRIVNING
       gzip komprimerar EN fil i taget: fil.txt ersätts med den mindre
       filen fil.txt.gz. Rättigheter och tidsstämpel följer med. Vill du
       komprimera en hel katalog packar du först ihop den med tar (eller
       använder tar -z direkt).

       gunzip är samma sak som gzip -d och zcat samma sak som gzip -dc:
       zcat skriver ut innehållet utan att packa upp filen.

       Mycket små filer blir ofta STÖRRE av att komprimeras, eftersom
       gzip lägger till ett huvud med bland annat filnamnet.

FLAGGOR
       -k, --keep         behåll originalfilen
       -d, --decompress   dekomprimera (som gunzip)
       -c, --stdout       skriv resultatet till standard output
       -l, --list         visa storlek före och efter komprimering
       -v, --verbose      berätta hur mycket mindre filen blev
       -r, --recursive    komprimera alla filer i kataloger, var för sig
       -f, --force        skriv över filer som redan finns
       -1 ... -9          snabbare (-1) eller bättre (-9) komprimering

EXEMPEL
       gzip -kv server.log         komprimera, men behåll originalet
       gzip -l server.log.gz       hur mycket sparade vi?
       zcat server.log.gz | grep ERROR`;

export const gzip: CommandDef = { name: "gzip", summary: "Komprimerar filer (fil → fil.gz)", man: gzipMan, run: gzipLike("gzip") };
export const gunzip: CommandDef = { name: "gunzip", summary: "Packar upp .gz-filer (samma som gzip -d)", man: gzipMan, run: gzipLike("gunzip") };
export const zcat: CommandDef = { name: "zcat", summary: "Visar innehållet i .gz-filer utan att packa upp dem", man: gzipMan, run: gzipLike("zcat") };
