import { jsonEqual, tryParse } from "../Json.js";
import type { Side } from "./Rules.js";

// Files that are merged as a whole: the code in Codestead GP's editor (project.*.json) and the files in Codestead
// Linux's terminal (shell.*.json). The side that changed wins; when both changed, the one saved last wins and the
// other is handed back so the engine can keep it as a backup.

export interface WholeFileResult {
  readonly text: string;
  /** Both sides changed: the side that lost and its text. */
  readonly lost: { readonly side: Side; readonly text: string } | null;
}

/** Equal as JSON when both parse, else as text (so a re-formatted but equal file is not a change). */
function same(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = tryParse(a), pb = tryParse(b);
  return pa !== undefined && pb !== undefined && jsonEqual(pa, pb);
}

export function mergeWholeFile(base: string | null, local: string, remote: string, newer: Side): WholeFileResult {
  if (same(local, remote)) return { text: local, lost: null };
  if (base !== null && same(local, base)) return { text: remote, lost: null };
  if (base !== null && same(remote, base)) return { text: local, lost: null };
  return newer === "local" ? { text: local, lost: { side: "remote", text: remote } } : { text: remote, lost: { side: "local", text: local } };
}
