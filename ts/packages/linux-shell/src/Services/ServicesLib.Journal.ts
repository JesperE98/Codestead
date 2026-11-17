// Port of Services/ServicesLib.Journal.cs – ServicesLib: writing to the journal.

import type { Shell } from "../Shell/Shell.js";
import type { JournalCatalog } from "./JournalCatalog.js";

// ---------- The journal ----------

const JournalMax = 3000;

export function currentBoot(sh: Shell): number {
  return sh.services.boots.length - 1;
}

/** The optional fields of a journal entry (named parameters in C#). */
export interface LogOptions {
  pid?: number | null;
  prio?: number | null;
  unit?: string | null;
  x?: JournalCatalog | null;
}

/** log(sh, t, ident, msg, opts) – the optional fields of the entry are named options. */
export function log(sh: Shell, t: number, ident: string, msg: string, o: LogOptions = {}): void {
  const st = sh.services;
  st.journal.push({
    t,
    boot: currentBoot(sh),
    ident,
    pid: o.pid ?? (ident === "systemd" ? 1 : null),
    prio: o.prio ?? 6,
    msg,
    unit: o.unit ?? null,
    x: o.x ?? null,
  });
  if (st.journal.length > JournalMax) st.journal.splice(0, st.journal.length - JournalMax);
}

export function identOf(exec: string): string {
  return exec.split(" ")[0]!.split("/").at(-1)!;
}

export function subjectStarted(unit: string, job: number): JournalCatalog {
  return {
    subject: `A start job for unit ${unit} has finished successfully`,
    body: [`A start job for unit ${unit} has finished successfully.`, "", `The job identifier is ${job}.`],
  };
}
