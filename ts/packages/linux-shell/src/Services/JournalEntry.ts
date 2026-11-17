// Port of Services/JournalEntry.cs – systemd model: one line in the journal.

import type { JournalCatalog } from "./JournalCatalog.js";

export interface JournalEntry {
  /** Time (ms since 1970). */
  t: number;
  /** Which boot the line belongs to (index in `boots`). */
  boot: number;
  /** The program that wrote the line, e.g. "systemd", "sshd" or "kernel". */
  ident: string;
  pid?: number | null;
  /** 0 = emerg … 3 = err, 4 = warning, 5 = notice, 6 = info, 7 = debug. */
  prio: number;
  msg: string;
  /** The service the line is about (for `journalctl -u`). */
  unit?: string | null;
  /** Explanation shown with `journalctl -x`. */
  x?: JournalCatalog | null;
}
