import { jsonEqual, tryParse } from "./Json.js";
import { mergeLearningState } from "./merge/LearningStateMerge.js";
import type { Side } from "./merge/Rules.js";
import { mergeWholeFile } from "./merge/WholeFileMerge.js";
import type { RemoteFile, RemoteInfo, SyncBackend } from "./SyncBackend.js";
import type { SyncFolder } from "./SyncFolder.js";
import { type FileKind, kindOf } from "./SyncRules.js";

// Syncs one tool's files with the backend. Run it only while the tool is closed (the hub knows; see
// docs/PLAN-KONTON-OCH-SYNK.md): it reads and writes the tool's own files.
//
// For every synced file: read the base (what both sides agreed on last time), the local file and – only when its
// revision moved past the base – the remote file; merge; upload when the result differs from the remote one (naming the
// revision it read, and merging again if another computer wrote in between); write the local file when it differs;
// and keep the result as the new base.

export interface ToolFolders {
  readonly tool: string;
  /** The tool's data folder (%APPDATA%\Codestead\<tool>). */
  readonly files: SyncFolder;
  /** The bases of the last sync, kept apart from the tool's folder. */
  readonly bases: SyncFolder;
  /** Copies of files that lost a conflict. */
  readonly backups: SyncFolder;
}

export interface FileReport {
  readonly name: string;
  /** The local file was written. */
  readonly pulled: boolean;
  /** The merged file was uploaded. */
  readonly pushed: boolean;
  /** Both sides changed a whole file; the loser is in the backups (its name). */
  readonly backup: string | null;
  /** Why the file could not be synced this time (it is tried again next time). */
  readonly error: string | null;
}

interface Base {
  readonly text: string;
  readonly revision: number;
}

export interface SyncEngineOptions {
  readonly now?: () => number;
  /** How many times to merge again when another computer keeps writing first. */
  readonly attempts?: number;
}

export class SyncEngine {
  private readonly now: () => number;
  private readonly attempts: number;

  constructor(
    private readonly backend: SyncBackend,
    options: SyncEngineOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.attempts = options.attempts ?? 3;
  }

  async syncTool(t: ToolFolders): Promise<FileReport[]> {
    const remote = new Map((await this.backend.list(t.tool)).map((r) => [r.name, r] as const));
    const names = [...new Set([...t.files.names(), ...remote.keys()])].filter((n) => kindOf(t.tool, n) !== null).sort();
    const reports: FileReport[] = [];
    for (const name of names) {
      try {
        reports.push(await this.syncFile(t, name, kindOf(t.tool, name)!, remote.get(name) ?? null));
      } catch (e) {
        reports.push({ name, pulled: false, pushed: false, backup: null, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return reports;
  }

  private readBase(t: ToolFolders, name: string): Base | null {
    const f = t.bases.read(name);
    const v = f === null ? undefined : tryParse(f.text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    return typeof v.text === "string" && typeof v.revision === "number" ? { text: v.text, revision: v.revision } : null;
  }

  private async syncFile(t: ToolFolders, name: string, kind: FileKind, info: RemoteInfo | null): Promise<FileReport> {
    const base = this.readBase(t, name);
    const local = t.files.read(name);
    // Unchanged since the last sync: the base is the remote text.
    let remote: RemoteFile | null =
      info === null ? null : base !== null && base.revision === info.revision ? { ...info, text: base.text } : await this.backend.get(t.tool, name);

    for (let attempt = 0; attempt < this.attempts; attempt++) {
      let merged: string;
      let lost: { side: Side; text: string } | null = null;
      if (local === null && remote === null) return { name, pulled: false, pushed: false, backup: null, error: null };
      if (local === null) merged = remote!.text;
      else if (remote === null) merged = local.text;
      else {
        const newer: Side = local.modifiedAt >= remote.updatedAt ? "local" : "remote";
        const baseText = base?.text ?? null;
        if (kind === "learning-state") merged = mergeLearningState(baseText, local.text, remote.text, newer);
        else {
          const r = mergeWholeFile(baseText, local.text, remote.text, newer);
          merged = r.text;
          lost = r.lost;
        }
      }

      let revision = remote?.revision ?? 0;
      let pushed = false;
      if (remote === null || !sameJson(merged, remote.text)) {
        const put = await this.backend.put(t.tool, name, merged, remote?.revision ?? null);
        if (!put.ok) {
          remote = put.current; // another computer wrote first: merge with that
          continue;
        }
        revision = put.revision;
        pushed = true;
      }

      const backup = lost === null ? null : this.keepBackup(t, name, lost.side, lost.text);
      const pulled = local === null || !sameJson(merged, local.text);
      if (pulled) t.files.write(name, merged);
      t.bases.write(name, JSON.stringify({ revision, text: merged }));
      return { name, pulled, pushed, backup, error: null };
    }
    return { name, pulled: false, pushed: false, backup: null, error: "another computer kept writing the file" };
  }

  /** Keeps the text that lost a conflict as "<name>.<side>-<yyyyMMddHHmmss>". */
  private keepBackup(t: ToolFolders, name: string, side: Side, text: string): string {
    const d = new Date(this.now());
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const backupName = `${name}.${side}-${stamp}`;
    t.backups.write(backupName, text);
    return backupName;
  }
}

/** Equal as JSON when both parse, else as text. */
function sameJson(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = tryParse(a), pb = tryParse(b);
  return pa !== undefined && pb !== undefined && jsonEqual(pa, pb);
}
