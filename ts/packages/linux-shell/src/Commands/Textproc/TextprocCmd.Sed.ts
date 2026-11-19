// Port of Commands/Textproc/TextprocCmd.Sed.cs – the sed command (stream editor): replaces, deletes and prints lines.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as AwkCmd from "../Awk/AwkCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { codePoints, dimNote } from "./TextprocCmd.js";
import {
  parseSedScript,
  type ReplPart,
  type SedAddr,
  type SedCommand,
  SedError,
  type SedState,
  SedUnsupported,
} from "./TextprocCmd.SedParser.js";

function substitute(ps: string, cmd: SedCommand): string | null {
  const re = cmd.re!.re;
  let count = 0;
  let o = "";
  let last = 0;
  let did = false;
  for (const m of ps.matchAll(re)) {
    count++;
    const take = cmd.global ? count >= cmd.nth : count === cmd.nth;
    if (!take) continue;
    o += ps.slice(last, m.index) + buildReplacement(cmd.repl!, m);
    last = m.index + m[0].length;
    did = true;
    if (!cmd.global) break;
  }
  return did ? o + ps.slice(last) : null;
}

function buildReplacement(parts: ReplPart[], m: RegExpMatchArray): string {
  let o = "";
  let mode: string | null = null;
  let once: string | null = null;
  const add = (text: string): void => {
    let s = text;
    if (s === "") return;
    if (mode === "U") s = AwkCmd.jsUpper(s);
    else if (mode === "L") s = AwkCmd.jsLower(s);
    if (once !== null) {
      const first = s[0]!;
      s = (once === "u" ? AwkCmd.jsUpper(first) : AwkCmd.jsLower(first)) + s.slice(1);
      once = null;
    }
    o += s;
  };
  for (const p of parts) {
    if (p.text !== null && p.text !== undefined) add(p.text);
    else if (p.group !== null && p.group !== undefined) {
      const g = p.group;
      add(g < m.length && m[g] !== undefined ? m[g] : "");
    } else if (p.caseOp === "u" || p.caseOp === "l") once = p.caseOp;
    else mode = p.caseOp === "E" ? null : (p.caseOp ?? null);
  }
  return o;
}

interface SedRun {
  quit: boolean;
  exitCode: number;
}

/** Runs the sed program on a stream of lines. */
function runSedStream(cmds: SedCommand[], content: string, quiet: boolean, out: (s: string) => void, run: SedRun): void {
  const lines = UtilCmd.splitLines(content);
  const missingNewline = content !== "" && !content.endsWith("\n");
  const lastNo = lines.length;
  for (const c of cmds) c.active = false;

  const test = (a: SedAddr, n: number, ps: string): boolean => {
    if (a.kind === "line") return n === a.n;
    if (a.kind === "last") return n === lastNo;
    if (a.kind === "step") return a.step! > 0 ? n >= a.first! && (n - a.first!) % a.step! === 0 : n === a.first;
    return a.re!.re.test(ps);
  };
  const matches = (cmd: SedCommand, n: number, ps: string): boolean => {
    let m: boolean;
    if (cmd.a1 === null) m = true;
    else if (cmd.a2 === null) m = test(cmd.a1, n, ps);
    else if (!cmd.active) {
      m = test(cmd.a1, n, ps);
      if (m) {
        const a2 = cmd.a2;
        cmd.active = !(a2.kind === "line" ? a2.n! <= n : a2.kind === "last" ? n === lastNo : false);
      }
    } else {
      m = true;
      const a2 = cmd.a2;
      if (a2.kind === "line" ? n >= a2.n! : a2.kind === "last" ? n === lastNo : test(a2, n, ps)) cmd.active = false;
    }
    return cmd.neg ? !m : m;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const n = idx + 1;
    let ps = lines[idx]!;
    let deleted = false;
    const appended: string[] = [];
    for (const cmd of cmds) {
      if (!matches(cmd, n, ps)) continue;
      if (cmd.name === "s") {
        const r = substitute(ps, cmd);
        if (r !== null) {
          ps = r;
          if (cmd.print) out(ps + "\n");
        }
      } else if (cmd.name === "y") {
        ps = codePoints(ps)
          .map((c) => cmd.map!.get(c) ?? c)
          .join("");
      } else if (cmd.name === "p") {
        out(ps + "\n");
      } else if (cmd.name === "=") {
        out(n + "\n");
      } else if (cmd.name === "a") {
        appended.push(cmd.text!);
      } else if (cmd.name === "i") {
        out(cmd.text! + "\n");
      } else if (cmd.name === "c") {
        if (cmd.a2 === null || cmd.neg || !cmd.active) out(cmd.text! + "\n");
        deleted = true;
        break;
      } else if (cmd.name === "d") {
        deleted = true;
        break;
      } else if (cmd.name === "q" || cmd.name === "Q") {
        run.quit = true;
        run.exitCode = cmd.exitCode;
        if (cmd.name === "Q") deleted = true;
        break;
      }
    }
    if (!deleted && !quiet) out(ps + (n === lastNo && missingNewline && appended.length === 0 ? "" : "\n"));
    for (const a of appended) out(a + "\n");
    if (run.quit) return;
  }
}

function exitCodeOf(d: number): number {
  return Number.isNaN(d) ? 0 : Math.max(-2147483648, Math.min(2147483647, d));
}

export const sed: CommandDef = {
  name: "sed",
  summary: "Strömeditor: byter ut, tar bort och skriver ut rader",
  man: `NAMN
       sed - strömeditor (stream editor) för att filtrera och ändra text

SYNOPSIS
       sed [FLAGGA]... SKRIPT [FIL]...
       sed [FLAGGA]... -e SKRIPT [-e SKRIPT]... [FIL]...

BESKRIVNING
       sed läser filer (eller standard input) rad för rad, kör SKRIPT på
       varje rad och skriver ut resultatet. Filen ändras inte – om du inte
       använder -i.

       Ett skript består av kommandon, valfritt med en ADRESS framför som
       väljer vilka rader kommandot gäller. Flera kommandon skiljs åt med ;
       eller ges med flera -e.

FLAGGOR
       -n        skriv bara ut det som p-kommandot ber om
       -E, -r    utökade reguljära uttryck (som grep -E)
       -i[SUFFIX]
                 ändra filen på plats (in-place). Med SUFFIX sparas en
                 säkerhetskopia, t.ex. -i.bak
       -e SKRIPT lägg till SKRIPT (kan anges flera gånger)

KOMMANDON
       s/MÖNSTER/ERSÄTTNING/FLAGGOR
                 byt ut (substitute). FLAGGOR: g = alla träffar på raden,
                 i = skiftlägesokänsligt, p = skriv ut raden, N = bara
                 träff nummer N. I ERSÄTTNING betyder & hela träffen och
                 \\1 ... \\9 grupperna \\( \\) (eller ( ) med -E).
                 Vilket tecken som helst kan avgränsa: s|/usr|/opt|
       d         ta bort raden (delete)
       p         skriv ut raden (print) – oftast tillsammans med -n
       q         avsluta (quit) efter den här raden
       y/abc/xyz/   byt tecken mot tecken
       =         skriv ut radnumret
       a TEXT, i TEXT, c TEXT
                 lägg till text efter / före raden, eller ersätt raden

ADRESSER
       5         rad 5
       1~2       varannan rad (första~steg)
       $         sista raden
       /regex/   rader som matchar
       2,4       rad 2 till 4
       /a/,/b/   från en rad som matchar a till nästa som matchar b
       ADRESS!   alla rader UTOM de som matchar

EXEMPEL
       sed 's/ERROR/FEL/' server.log
       sed -n '5,8p' server.log
       sed '/^#/d' inställningar.conf
       sed -i 's/gammal/ny/g' fil.txt
       sed -E 's/([0-9]+)-([0-9]+)/\\2-\\1/' datum.txt

SIMULATORN
       Stöder s, d, p, q, Q, y, =, a, i och c. Kommandon som arbetar med
       hållutrymmet (h, H, g, G, x), hopp (b, t) och { } stöds inte.`,
  run: (ctx) => {
    const scripts: string[] = [];
    const operands: string[] = [];
    let quiet = false;
    let ere = false;
    let inPlace: string | null = null;
    const bad = (msg: string): number => {
      ctx.err(`sed: ${msg}\nUsage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n`);
      return 1;
    };
    const args = ctx.args;
    for (let k = 0; k < args.length; k++) {
      const a = args[k]!;
      if (a === "--") {
        operands.push(...args.slice(k + 1));
        break;
      }
      if (a.startsWith("--")) {
        const eq = a.indexOf("=");
        const key = eq >= 0 ? a.slice(0, eq) : a;
        const val = eq >= 0 ? a.slice(eq + 1) : null;
        if (key === "--quiet" || key === "--silent") quiet = true;
        else if (key === "--regexp-extended") ere = true;
        else if (key === "--in-place") inPlace = val ?? "";
        else if (key === "--expression") {
          const v = val ?? (++k < args.length ? args[k]! : null);
          if (v === null) return bad("option '--expression' requires an argument");
          scripts.push(v);
        } else return bad(`unrecognized option '${a}'`);
        continue;
      }
      if (a.startsWith("-") && a.length > 1) {
        for (let j = 1; j < a.length; j++) {
          const c = a[j]!;
          if (c === "n") quiet = true;
          else if (c === "E" || c === "r") ere = true;
          else if (c === "s" || c === "u") continue;
          else if (c === "i") {
            inPlace = a.slice(j + 1);
            break;
          } else if (c === "e" || c === "f") {
            const rest = a.slice(j + 1);
            const v = rest !== "" ? rest : ++k < args.length ? args[k]! : null;
            if (v === null) return bad(`option requires an argument -- '${c}'`);
            if (c === "e") scripts.push(v);
            else {
              try {
                const text = ctx.sh.vfs.readFile(ctx.sh.resolve(v), ctx.sh.currentUser());
                scripts.push(text.endsWith("\n") ? text.slice(0, -1) : text);
              } catch (e) {
                if (!(e instanceof FsError)) throw e;
                ctx.err(`sed: couldn't open file ${v}: ${e.message}\n`);
                return 1;
              }
            }
            break;
          } else return bad(`invalid option -- '${c}'`);
        }
        continue;
      }
      operands.push(a);
    }
    if (scripts.length === 0) {
      if (operands.length === 0) {
        ctx.err(
          "Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\n" +
            "  -n, --quiet, --silent\n                 suppress automatic printing of pattern space\n" +
            "  -e script, --expression=script\n                 add the script to the commands to be executed\n" +
            "  -i[SUFFIX], --in-place[=SUFFIX]\n                 edit files in place (makes backup if SUFFIX supplied)\n" +
            "  -E, -r, --regexp-extended\n                 use extended regular expressions in the script\n",
        );
        return 1;
      }
      scripts.push(operands.shift()!);
    }

    const cmds: SedCommand[] = [];
    const state: SedState = { lastRe: null };
    try {
      for (let k = 0; k < scripts.length; k++) parseSedScript(scripts[k]!, k + 1, ere, state, cmds);
    } catch (e) {
      if (e instanceof SedError) {
        ctx.err(`sed: ${e.message}\n`);
        return 1;
      }
      if (e instanceof SedUnsupported) {
        ctx.err(`sed: unsupported command: \`${e.message}'\n`);
        dimNote(ctx, "textproc.sedUnsupported", { command: e.message });
        return 1;
      }
      throw e;
    }

    const sh = ctx.sh;
    const user = sh.currentUser();
    const run: SedRun = { quit: false, exitCode: 0 };
    let code = 0;

    if (inPlace !== null) {
      if (operands.length === 0) {
        ctx.err("sed: no input files\n");
        return 1;
      }
      for (const f of operands) {
        const path = sh.resolve(f);
        const node = sh.vfs.tryLookup(path, user);
        if (node?.type === "dir") {
          ctx.err(`sed: couldn't edit ${f}: not a regular file\n`);
          code = 4;
          continue;
        }
        let content: string;
        try {
          content = sh.vfs.readFile(path, user);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`sed: can't read ${f}: ${e.message}\n`);
          code = 2;
          continue;
        }
        let result = "";
        runSedStream(cmds, content, quiet, (s) => (result += s), run);
        try {
          if (inPlace !== "") sh.vfs.writeFile(sh.resolve(f + inPlace), content, user);
          sh.vfs.writeFile(path, result, user);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`sed: couldn't open temporary file ${VfsLib.dirname(path)}/sedXyZ12a: ${e.message}\n`);
          code = 4;
        }
        if (run.quit) break;
      }
      return run.quit ? exitCodeOf(run.exitCode) : code;
    }

    // Without -i every file is read as one long stream.
    let all = "";
    for (const f of operands.length > 0 ? operands : ["-"]) {
      let text: string;
      if (f === "-") text = ctx.stdin ?? "";
      else {
        const path = sh.resolve(f);
        if (sh.vfs.tryLookup(path, user)?.type === "dir") {
          ctx.err(`sed: read error on ${f}: Is a directory\n`);
          code = 2;
          continue;
        }
        try {
          text = sh.vfs.readFile(path, user);
        } catch (e) {
          if (!(e instanceof FsError)) throw e;
          ctx.err(`sed: can't read ${f}: ${e.message}\n`);
          code = 2;
          continue;
        }
      }
      if (all.length > 0 && !all.endsWith("\n")) all += "\n";
      all += text;
    }
    runSedStream(cmds, all, quiet, (s) => ctx.out(s), run);
    return run.quit ? exitCodeOf(run.exitCode) : code;
  },
};
