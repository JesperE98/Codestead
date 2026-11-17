// Port of Commands/Man/ManEnCmd.cs (src/shell/commands/man-en.ts) – English summaries and man pages for commands
// that do not have summaryEn/manEn directly in their CommandDef. The man pages are shown for every language except
// Swedish; the summaries are translated via ShellI18n (i18n/<lang>.json).
// The man page texts must stay byte for byte identical to the C# (and the TypeScript original).

import type { Shell } from "../../Shell/Shell.js";
import * as ShellI18n from "../../ShellI18n.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { archivePages } from "./ManEnCmd.Archive.js";
import { extrasPages } from "./ManEnCmd.Extras.js";
import { fsPages } from "./ManEnCmd.Fs.js";
import { pkgPages } from "./ManEnCmd.Pkg.js";
import { procsPages } from "./ManEnCmd.Procs.js";
import { scriptPages } from "./ManEnCmd.Script.js";
import { systemPages } from "./ManEnCmd.System.js";
import { textPages } from "./ManEnCmd.Text.js";
import { textprocPages } from "./ManEnCmd.Textproc.js";

/** One entry of the table: the English summary and man page (a (Summary, Man) tuple in C#). */
export interface ManPage {
  summary: string;
  man: string | null;
}

let table: Map<string, ManPage> | null = null;

/**
 * The table, split over the files ManEnCmd.<Group>.ts, one per group of commands, and joined here in
 * the original order.
 */
export function manEn(): Map<string, ManPage> {
  return (table ??= join(fsPages(), textPages(), systemPages(), pkgPages(), extrasPages(), scriptPages(), procsPages(), textprocPages(), archivePages()));
}

function join(...parts: Map<string, ManPage>[]): Map<string, ManPage> {
  const all = new Map<string, ManPage>();
  for (const part of parts) for (const [name, page] of part) all.set(name, page);
  return all;
}

/**
 * The English summary as written in the code (summaryEn, else the manEn table). The summaries in
 * shell i18n/en.json are generated from it, and those in sv.json from CommandDef.summary.
 */
export function englishSummary(def: CommandDef): string {
  return def.summaryEn ?? manEn().get(def.name)?.summary ?? def.summary;
}

/** The one-line summary in the shell's language (shown by help and in generated man pages). */
export function summaryFor(def: CommandDef, sh: Shell): string {
  return ShellI18n.summary(sh.lang, def.name) ?? (sh.lang === "sv" ? def.summary : englishSummary(def));
}

/** The man page: Swedish for Swedish, otherwise English – like on a real system, man pages are not translated. */
export function manFor(def: CommandDef, sh: Shell): string {
  if (sh.lang === "sv") return def.man ?? `NAMN\n       ${def.name} - ${summaryFor(def, sh)}`;
  const man = def.manEn ?? manEn().get(def.name)?.man ?? null;
  return man ?? `NAME\n       ${def.name} - ${summaryFor(def, sh)}`;
}
