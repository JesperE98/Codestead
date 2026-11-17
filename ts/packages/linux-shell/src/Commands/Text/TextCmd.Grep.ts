// Port of Commands/Text/TextCmd.Grep.cs – the grep command: searches for lines matching a pattern.

import { Js } from "../../Js.js";
import * as ParserLib from "../../Parser/ParserLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { breToJs, jsRegex } from "./TextCmd.js";

export const grep: CommandDef = {
  name: "grep",
  summary: "Söker efter rader som matchar ett mönster",
  man: `NAMN
       grep - skriv ut rader som matchar ett mönster

SYNOPSIS
       grep [FLAGGA]... MÖNSTER [FIL]...

BESKRIVNING
       Söker igenom filer (eller standard input) och skriver ut raderna som
       innehåller MÖNSTER. MÖNSTER är ett reguljärt uttryck.

FLAGGOR
       -i    ignorera skillnad mellan stora och små bokstäver
       -v    visa rader som INTE matchar
       -n    visa radnummer
       -c    visa bara antalet matchande rader
       -l    visa bara namnen på filer som matchar
       -r    sök rekursivt i kataloger
       -w    matcha bara hela ord
       -o    visa bara den del som matchar
       -E    utökade reguljära uttryck (t.ex. "ERROR|WARN")
       -F    mönstret är vanlig text, inte ett reguljärt uttryck

EXEMPEL
       grep ERROR server.log
       grep -in "varning" *.txt
       grep -E "ERROR|WARN" server.log
       ps aux | grep firefox`,
  run: (ctx) => runGrep(ctx),
};

function runGrep(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "ivnclrRwqhHEFos",
    values: "e",
    long: {
      "ignore-case": "i",
      "invert-match": "v",
      "line-number": "n",
      count: "c",
      "files-with-matches": "l",
      recursive: "r",
      "word-regexp": "w",
      quiet: "q",
      "extended-regexp": "E",
      "fixed-strings": "F",
      "only-matching": "o",
      color: "C",
      colour: "C",
    },
  });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error, 2);
  const ops = [...o.operands];
  let pattern = o.values.get("e") ?? null;
  if (pattern === null && ops.length > 0) pattern = ops.shift()!;
  if (pattern === null) {
    ctx.err("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.\n");
    return 2;
  }
  let source = o.flags.has("F") ? ParserLib.escapeRegex(pattern) : o.flags.has("E") ? pattern : breToJs(pattern);
  if (o.flags.has("w")) source = `\\b(?:${source})\\b`;
  let re: RegExp;
  try {
    re = jsRegex(source, o.flags.has("i"));
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    ctx.err("grep: Invalid regular expression\n");
    return 2;
  }
  // The same regex with the g flag, for every match on a line (C# Regex.Matches / Replace).
  const reAll = new RegExp(re.source, re.flags + "g");

  const sh = ctx.sh;
  const user = sh.currentUser();
  const recursive = o.flags.has("r") || o.flags.has("R");
  const files: { label: string; content: string }[] = [];
  let failed = false;
  if (recursive) {
    const walk = (label: string, node: FsNode): void => {
      // grep -r does not follow symbolic links inside the directories it searches.
      if (node.type === "link") return;
      if (node.type === "file") {
        if (VfsLib.hasPerm(node, user, "r")) files.push({ label, content: node.content ?? "" });
        else {
          ctx.err(`grep: ${label}: Permission denied\n`);
          failed = true;
        }
        return;
      }
      if (!VfsLib.hasPerm(node, user, "r") || !VfsLib.hasPerm(node, user, "x")) {
        ctx.err(`grep: ${label}: Permission denied\n`);
        failed = true;
        return;
      }
      for (const n of [...node.children!.keys()].sort()) walk(label.endsWith("/") ? label + n : `${label}/${n}`, node.children!.get(n)!);
    };
    for (const p of ops.length > 0 ? ops : ["."]) {
      try {
        walk(p, sh.vfs.lookup(sh.resolve(p), user));
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`grep: ${p}: ${e.message}\n`);
        failed = true;
      }
    }
  } else {
    for (const p of ops.length > 0 ? ops : ["-"]) {
      if (p === "-") {
        files.push({ label: "(standard input)", content: ctx.stdin ?? "" });
        continue;
      }
      const node = sh.vfs.tryLookup(sh.resolve(p), user);
      if (node?.type === "dir") {
        ctx.err(`grep: ${p}: Is a directory\n`);
        continue;
      }
      try {
        files.push({ label: p, content: sh.vfs.readFile(sh.resolve(p), user) });
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        ctx.err(`grep: ${p}: ${e.message}\n`);
        failed = true;
      }
    }
  }

  const showName = (files.length > 1 || recursive) && !o.flags.has("h") ? true : o.flags.has("H");
  const color = ctx.isTTY;
  const paint = (code: string, s: string): string => (color ? `${code}${s}${UtilCmd.Color.reset}` : s);
  let matchedAny = false;
  for (const f of files) {
    let count = 0;
    const lines = UtilCmd.splitLines(f.content);
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx]!;
      const matches = re.test(line);
      if (matches === o.flags.has("v")) continue;
      count++;
      matchedAny = true;
      if (o.flags.has("q") || o.flags.has("c") || o.flags.has("l")) continue;
      const prefix =
        (showName ? paint(UtilCmd.Color.magenta, f.label) + paint(UtilCmd.Color.cyan, ":") : "") +
        (o.flags.has("n") ? paint(UtilCmd.Color.green, Js.num(idx + 1)) + paint(UtilCmd.Color.cyan, ":") : "");
      if (o.flags.has("o") && !o.flags.has("v")) {
        for (const m of line.matchAll(reAll)) if (m[0] !== "") ctx.out(prefix + paint(UtilCmd.Color.red, m[0]) + "\n");
        continue;
      }
      const body = color && !o.flags.has("v") ? line.replace(reAll, (m) => paint(UtilCmd.Color.red, m)) : line;
      ctx.out(prefix + body + "\n");
    }
    if (o.flags.has("q")) continue;
    if (o.flags.has("c")) ctx.out((showName ? paint(UtilCmd.Color.magenta, f.label) + paint(UtilCmd.Color.cyan, ":") : "") + count + "\n");
    else if (o.flags.has("l") && count > 0) ctx.out(paint(UtilCmd.Color.magenta, f.label) + "\n");
  }
  if (failed && !(o.flags.has("q") && matchedAny)) return 2;
  return matchedAny ? 0 : 1;
}
