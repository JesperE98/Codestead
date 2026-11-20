// Port of Shell/ShellSnapshot.cs – the saved state of a Shell (the whole simulated computer), stored as JSON.
// The JSON is the same as the C# app's (see Json.ts): the ordered dictionaries are Maps in memory and objects in
// the file, and snapshotFromJson turns them back into Maps.

import type { DiskState } from "../Disks/DiskState.js";
import type { Obj } from "../Js.js";
import { parseJson, stringifyJson, toMap, type JsonObject } from "../Json.js";
import type { Node } from "../Parser/Ast/Node.js";
import type { ProcState } from "../Procs/ProcState.js";
import type { ServiceState } from "../Services/ServiceState.js";
import type { UnitRt } from "../Services/UnitRt.js";
import type { ShellFrame } from "../Shellmode/ShellFrame.js";
import type { FsNode } from "../Vfs/FsNode.js";

export interface ShellSnapshot {
  version: number;
  distroId: string;
  /**
   * The language of the exercise files and the user name (see World.ts). Null in terminals saved before
   * the world was translated: they are Swedish and are brought up to date by WorldMigration.
   */
  world?: string | null;
  fs: FsNode;
  cwd: string;
  env: Obj<string>;
  /** The names of the exported variables (null in terminals saved before they were kept apart: all of env). */
  exported?: string[] | null;
  aliases: Obj<string>;
  history: string[];
  installed: Obj<string>;
  flags: Obj<boolean>;
  userStack: string[];
  functions?: Obj<Node> | null;
  proc?: ProcState | null;
  services?: ServiceState | null;
  /** zsh/fish shells started on top of the first bash shell. */
  shells?: ShellFrame[] | null;
  disks?: DiskState | null;
  /** The shell's umask (null means the usual 022). */
  umask?: number | null;
}

/** The snapshot as JSON (Js.Stringify in C#). */
export function snapshotToJson(s: ShellSnapshot): string {
  return stringifyJson(s);
}

/** An FsNode read from JSON: children become a Map again (all the way down). */
export function reviveFsNode(v: unknown): FsNode {
  const n = v as JsonObject;
  const node = n as unknown as FsNode;
  if (n["children"] !== null && n["children"] !== undefined) node.children = toMap(n["children"], reviveFsNode);
  return node;
}

function reviveFrame(v: unknown): ShellFrame {
  const f = v as JsonObject;
  const saved = (f["saved"] ?? {}) as JsonObject;
  return {
    mode: (f["mode"] as string | undefined) ?? "bash",
    pid: (f["pid"] as number | undefined) ?? 0,
    userDepth: (f["userDepth"] as number | undefined) ?? 0,
    options: toMap<boolean>(f["options"]),
    saved: {
      cwd: (saved["cwd"] as string | undefined) ?? "",
      env: toMap<string>(saved["env"]),
      exported: (saved["exported"] as string[] | null | undefined) ?? null,
      aliases: toMap<string>(saved["aliases"]),
      functions: toMap<Node>(saved["functions"]),
    },
    pushedUser: (f["pushedUser"] as boolean | null | undefined) ?? null,
  };
}

function reviveDisks(v: unknown): DiskState {
  const d = v as DiskState;
  d.disks ??= [];
  d.mounts ??= [];
  for (const disk of d.disks) {
    disk.partitions ??= [];
    if (disk.root) disk.root = reviveFsNode(disk.root);
    for (const p of disk.partitions) if (p.root) p.root = reviveFsNode(p.root);
  }
  for (const m of d.mounts) if (m.under) m.under = reviveFsNode(m.under);
  return d;
}

function reviveServices(v: unknown): ServiceState {
  const s = v as JsonObject;
  return {
    units: toMap<UnitRt>(s["units"]),
    journal: (s["journal"] as ServiceState["journal"] | undefined) ?? [],
    boots: (s["boots"] as ServiceState["boots"] | undefined) ?? [],
    job: (s["job"] as number | undefined) ?? 0,
    machineId: (s["machineId"] as string | undefined) ?? "",
  };
}

/** Reads a snapshot written by snapshotToJson (or by the C# app). Throws SyntaxError for broken JSON. */
export function snapshotFromJson(json: string): ShellSnapshot | null {
  const o = parseJson(json);
  if (o === null || typeof o !== "object" || Array.isArray(o)) return null;
  const s = o as JsonObject;
  const opt = <T>(key: string, revive: (v: unknown) => T): T | null => (s[key] === null || s[key] === undefined ? null : revive(s[key]));
  return {
    version: (s["version"] as number | undefined) ?? 1,
    distroId: (s["distroId"] as string | undefined) ?? "",
    world: (s["world"] as string | null | undefined) ?? null,
    fs: (opt("fs", reviveFsNode) ?? null) as FsNode,
    cwd: (s["cwd"] as string | undefined) ?? "",
    env: toMap<string>(s["env"]),
    exported: (s["exported"] as string[] | null | undefined) ?? null,
    aliases: toMap<string>(s["aliases"]),
    history: (s["history"] as string[] | undefined) ?? [],
    installed: toMap<string>(s["installed"]),
    flags: toMap<boolean>(s["flags"]),
    userStack: (s["userStack"] as string[] | undefined) ?? [],
    functions: opt("functions", (v) => toMap<Node>(v)),
    proc: opt("proc", (v) => ({ procs: [], jobs: [], nextPid: 0, ...(v as Partial<ProcState>) }) as ProcState),
    services: opt("services", reviveServices),
    shells: opt("shells", (v) => (v as unknown[]).map(reviveFrame)),
    disks: opt("disks", reviveDisks),
    umask: (s["umask"] as number | null | undefined) ?? null,
  };
}
