// Port of Commands/Systemd/SystemdCmd.Journalctl.cs – the journalctl command: read the system log (the journal).

import { Js } from "../../Js.js";
import type { JournalEntry } from "../../Services/JournalEntry.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { journalLine, longTime, parseSince, replaceFirst, table, tip } from "./SystemdCmd.js";

function supportUrl(ctx: CmdCtx): string {
  switch (ctx.sh.distro.id) {
    case "ubuntu":
      return "http://www.ubuntu.com/support";
    case "debian":
      return "https://www.debian.org/support";
    default:
      return "https://lists.freedesktop.org/mailman/listinfo/systemd-devel";
  }
}

function catalogLines(ctx: CmdCtx, e: JournalEntry): string[] {
  if (e.x === null || e.x === undefined) return [];
  const lines = [`Subject: ${e.x.subject}`, "Defined-By: systemd", `Support: ${supportUrl(ctx)}`, ""];
  lines.push(...e.x.body);
  return lines.map((l) => `░░ ${l}`.trimEnd() + (l === "" ? " " : ""));
}

const prios = ["emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"];
const prioDigitRe = /^[0-7]$/;

function parsePrio(s: string): { lo: number; hi: number } | null {
  const one = (x: string): number | null => {
    if (prioDigitRe.test(x)) return x.charCodeAt(0) - 48;
    const lower = x.toLowerCase();
    const i = prios.indexOf(lower === "error" ? "err" : lower === "warn" ? "warning" : lower);
    return i >= 0 ? i : null;
  };
  if (s.includes("..")) {
    const parts = s.split("..");
    const a = parts[0]!;
    const b = parts.length > 1 ? parts[1]! : "";
    const lo = one(a !== "" ? a : "emerg");
    const hi = one(b !== "" ? b : "debug");
    return lo === null || hi === null ? null : { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }
  const p = one(s);
  return p === null ? null : { lo: 0, hi: p };
}

const journalctlHelp = 'journalctl [OPTIONS...] [MATCHES...]\n\nQuery the journal.\n\nSee "man journalctl" for the options.\n';
const linesValueRe = /^(\+?[0-9]+|all)$/;
const bootValueRe = /^[+-]?[0-9]+$/;
const matchArgRe = /^(_SYSTEMD_UNIT|UNIT|SYSLOG_IDENTIFIER|_COMM)=(.+)$/;

function linesValue(v: string): number {
  return v === "all" ? Infinity : Js.number(replaceFirst(v, "+", ""));
}

function makeGrep(v: string): RegExp | null {
  try {
    return new RegExp(v, v === v.toLowerCase() ? "i" : "");
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return null;
  }
}

export const journalctl: CommandDef = {
  name: "journalctl",
  summary: "Läser systemloggen (journalen)",
  summaryEn: "Read the system log (the journal)",
  man: `NAMN
       journalctl - läs systemd:s logg, journalen

SYNOPSIS
       journalctl [FLAGGOR]

BESKRIVNING
       Allt som tjänsterna, kärnan och systemd skriver hamnar i journalen.
       Utan flaggor visas hela journalen, äldst först. Fel visas i rött och
       varningar i gult.

FLAGGOR
       -u TJÄNST        bara rader från tjänsten (t.ex. -u ssh)
       -n N             bara de N senaste raderna (-n utan tal: 10)
       -p PRIORITET     bara rader med den prioriteten eller allvarligare:
                        emerg alert crit err warning notice info debug
                        (eller 0–7). -p err visar bara fel.
       -b [N]           bara den här uppstarten; -b -1 = förra uppstarten
       --since TID      från och med TID: today, yesterday, "10:00",
                        "2026-10-30 08:00", "1 hour ago"
       --until TID      till och med TID
       -f               följ loggen: visa nya rader när de kommer (Ctrl+C)
       -e               hoppa till slutet
       -x               lägg till förklaringar till vissa rader
       -r               nyast först
       -k               bara kärnans meddelanden (som dmesg)
       -g MÖNSTER       bara rader som matchar MÖNSTER (reguljärt uttryck)
       -t NAMN          bara rader från programmet NAMN
       -o FORMAT        short (standard), short-iso eller cat
       --list-boots     lista uppstarterna som finns i journalen
       --disk-usage     visa hur mycket plats journalen tar

EXEMPEL
       journalctl -u myserver
       journalctl -xeu reportd
       journalctl -p err -b
       journalctl --since today -u ssh
       journalctl -f`,
  manEn: `NAME
       journalctl - read the systemd log, the journal

SYNOPSIS
       journalctl [OPTIONS]

DESCRIPTION
       Everything the services, the kernel and systemd log ends up in the
       journal. Without options the whole journal is shown, oldest first.
       Errors are shown in red and warnings in yellow.

OPTIONS
       -u UNIT          only lines from the service (e.g. -u ssh)
       -n N             only the N most recent lines (-n without a number: 10)
       -p PRIORITY      only lines with that priority or more severe:
                        emerg alert crit err warning notice info debug
                        (or 0–7). -p err shows only errors.
       -b [N]           only this boot; -b -1 = the previous boot
       --since TIME     from TIME: today, yesterday, "10:00",
                        "2026-10-30 08:00", "1 hour ago"
       --until TIME     up to TIME
       -f               follow the log: show new lines as they arrive (Ctrl+C)
       -e               jump to the end
       -x               add explanations to some lines
       -r               newest first
       -k               only kernel messages (like dmesg)
       -g PATTERN       only lines matching PATTERN (regular expression)
       -t NAME          only lines from the program NAME
       -o FORMAT        short (default), short-iso or cat
       --list-boots     list the boots in the journal
       --disk-usage     show how much space the journal uses

EXAMPLES
       journalctl -u myserver
       journalctl -xeu reportd
       journalctl -p err -b
       journalctl --since today -u ssh
       journalctl -f`,
  run: (ctx) => runJournalctl(ctx),
};

function runJournalctl(ctx: CmdCtx): number {
  const sh = ctx.sh;
  ServicesLib.syncServices(sh);
  const st = sh.services;
  const args = ctx.args;
  const units: string[] = [];
  const idents: string[] = [];
  let lines: number | null = null;
  let prio: { lo: number; hi: number } | null = null;
  let boot: number | null = null;
  let since: number | null = null;
  let until: number | null = null;
  let follow = false;
  let catalog = false;
  let end = false;
  let reverse = false;
  let kernel = false;
  let output = "short";
  let grep: RegExp | null = null;
  let listBoots = false;
  let diskUsage = false;

  const fail = (msg: string): number => {
    ctx.err(msg + "\n");
    return 1;
  };
  const setTime = (which: string, v: string | null): string | null => {
    if (v === null) return `option '--${which}' requires an argument`;
    const t = parseSince(v);
    if (t === null) return `Failed to parse timestamp: ${v}`;
    if (which === "since") since = t;
    else until = t;
    return null;
  };
  let i = 0;
  const next = (): string | null => {
    ++i;
    return i < args.length ? args[i]! : null;
  };

  for (i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const attached = eq > 0 ? a.slice(eq + 1) : null;
      const value = (): string | null => attached ?? next();
      const optional = (re: RegExp): string | null => attached ?? (i + 1 < args.length && re.test(args[i + 1]!) ? args[++i]! : null);
      let err: string | null = null;
      switch (key) {
        case "unit": {
          const v = value();
          if (v === null) return fail("journalctl: option '--unit' requires an argument");
          units.push(v);
          break;
        }
        case "identifier": {
          const v = value();
          if (v === null) return fail("journalctl: option '--identifier' requires an argument");
          idents.push(v);
          break;
        }
        case "lines": {
          const v = optional(linesValueRe);
          lines = v === null ? 10 : linesValue(v);
          break;
        }
        case "priority": {
          const p = parsePrio(value() ?? "");
          if (p === null) return fail(`Failed to parse priority value: ${attached ?? (i < args.length ? args[i] : "undefined")}`);
          prio = p;
          break;
        }
        case "boot": {
          const v = optional(bootValueRe);
          boot = v === null ? 0 : Js.number(v);
          break;
        }
        case "since":
          err = setTime("since", value());
          break;
        case "until":
          err = setTime("until", value());
          break;
        case "follow":
          follow = true;
          break;
        case "catalog":
          catalog = true;
          break;
        case "pager-end":
          end = true;
          break;
        case "reverse":
          reverse = true;
          break;
        case "dmesg":
          kernel = true;
          break;
        case "output":
          output = value() ?? "";
          break;
        case "grep": {
          const v = value() ?? "";
          grep = makeGrep(v);
          if (grep === null) return fail(`Bad pattern "${v}"`);
          break;
        }
        case "list-boots":
          listBoots = true;
          break;
        case "disk-usage":
          diskUsage = true;
          break;
        case "no-pager":
        case "full":
        case "all":
        case "quiet":
        case "utc":
        case "no-hostname":
        case "system":
        case "merge":
          break;
        case "help":
          ctx.out(journalctlHelp);
          return 0;
        default:
          return fail(`journalctl: unrecognized option '${a}'`);
      }
      if (err !== null) return fail(err);
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const c = a[j]!;
        const rest = a.slice(j + 1);
        const value = (): string | null => (rest !== "" ? rest : next());
        const optional = (re: RegExp): string | null => (rest !== "" ? rest : i + 1 < args.length && re.test(args[i + 1]!) ? args[++i]! : null);
        let stop = false;
        let err: string | null = null;
        switch (c) {
          case "u":
          case "t": {
            const v = value();
            if (v === null) return fail(`journalctl: option requires an argument -- '${c}'`);
            (c === "u" ? units : idents).push(v);
            stop = true;
            break;
          }
          case "n": {
            const v = optional(linesValueRe);
            lines = v === null ? 10 : linesValue(v);
            if (Number.isNaN(lines)) return fail(`Failed to parse lines '${v}'`);
            stop = true;
            break;
          }
          case "p": {
            const v = value();
            const p = parsePrio(v ?? "");
            if (p === null) return fail(`Failed to parse priority value: ${v ?? ""}`);
            prio = p;
            stop = true;
            break;
          }
          case "b": {
            const v = optional(bootValueRe);
            boot = v === null ? 0 : Js.number(v);
            if (Number.isNaN(boot)) return fail(`Failed to parse boot descriptor '${v}'`);
            stop = true;
            break;
          }
          case "S":
          case "U":
            err = setTime(c === "S" ? "since" : "until", value());
            stop = true;
            break;
          case "o":
            output = value() ?? "";
            stop = true;
            break;
          case "g": {
            const v = value() ?? "";
            grep = makeGrep(v);
            if (grep === null) return fail(`Bad pattern "${v}"`);
            stop = true;
            break;
          }
          case "f":
            follow = true;
            break;
          case "x":
            catalog = true;
            break;
          case "e":
            end = true;
            break;
          case "r":
            reverse = true;
            break;
          case "k":
            kernel = true;
            break;
          case "q":
          case "a":
          case "l":
            break;
          case "h":
            ctx.out(journalctlHelp);
            return 0;
          default:
            return fail(`journalctl: invalid option -- '${c}'`);
        }
        if (err !== null) return fail(err);
        if (stop) break;
      }
      continue;
    }
    // Matches such as _SYSTEMD_UNIT=ssh.service or _PID=733.
    const m = matchArgRe.exec(a);
    if (m !== null) {
      if (m[1]!.endsWith("UNIT")) units.push(m[2]!);
      else idents.push(m[2]!);
      continue;
    }
    return fail(`Failed to add match '${a}': Invalid argument`);
  }

  if (!(output === "short" || output === "short-iso" || output === "cat")) return fail(`Unknown output format '${output}'.`);

  const cur = ServicesLib.currentBoot(sh);
  if (listBoots) {
    const rows: string[][] = [["IDX", "BOOT ID", "FIRST ENTRY", "LAST ENTRY"]];
    for (let b = 0; b < st.boots.length; b++) {
      const rec = st.boots[b]!;
      const bootEntries = st.journal.filter((e) => e.boot === b);
      const first = bootEntries.length > 0 ? bootEntries[0]!.t : rec.start;
      const last = bootEntries.length > 0 ? bootEntries.at(-1)!.t : rec.start;
      rows.push([String(b - cur).padStart(3), rec.id, longTime(first), longTime(last)]);
    }
    for (const line of table(rows)) ctx.out(line + "\n");
    return 0;
  }
  if (diskUsage) {
    ctx.out(`Archived and active journals take up ${Js.toFixed(8 + st.boots.length * 8, 1)}M in the file system.\n`);
    return 0;
  }

  let query: JournalEntry[] = st.journal;
  if (boot !== null || kernel) {
    const b = boot ?? 0;
    const idx = b <= 0 ? cur + b : b - 1;
    if (idx < 0 || idx > cur) return fail(`Data from the specified boot (${b > 0 ? "+" : ""}${Js.num(b)}) is not available: No such boot ID in journal`);
    query = query.filter((e) => e.boot === idx);
  }
  if (kernel) query = query.filter((e) => e.ident === "kernel");
  if (units.length > 0) {
    const names = units.map((u) => ServicesLib.resolveUnit(sh, u)?.name ?? ServicesLib.unitName(u));
    query = query.filter((e) => e.unit !== null && e.unit !== undefined && names.includes(e.unit));
  }
  if (idents.length > 0) query = query.filter((e) => idents.includes(e.ident));
  if (prio !== null) {
    const { lo, hi } = prio;
    query = query.filter((e) => e.prio >= lo && e.prio <= hi);
  }
  if (since !== null) {
    const sinceT = since;
    query = query.filter((e) => e.t >= sinceT);
  }
  if (until !== null) {
    const untilT = until;
    query = query.filter((e) => e.t <= untilT);
  }
  if (grep !== null) {
    const re = grep;
    query = query.filter((e) => re.test(e.msg));
  }
  let entries = [...query];
  const n = lines ?? (follow ? 10 : end ? 1000 : Infinity);
  if (Number.isFinite(n)) {
    const start = Math.max(0, entries.length - n);
    entries = entries.slice(Math.min(start, entries.length));
  }
  if (reverse) entries.reverse();

  if (entries.length === 0) {
    if (!follow) ctx.out("-- No entries --\n");
  }
  let prevBoot: number | null = null;
  for (const e of entries) {
    if (prevBoot !== null && e.boot !== prevBoot) ctx.out(`-- Boot ${e.boot >= 0 && e.boot < st.boots.length ? st.boots[e.boot]!.id : "?"} --\n`);
    prevBoot = e.boot;
    ctx.out(journalLine(ctx, e, output) + "\n");
    if (catalog) for (const l of catalogLines(ctx, e)) ctx.out(l + "\n");
  }
  if (follow) {
    tip(ctx, "systemd.journalFollow");
  }
  return 0;
}
