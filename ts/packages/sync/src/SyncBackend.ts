// Where synced files are kept: one row per (user, tool, file) – the table documents in docs/PLAN-KONTON-OCH-SYNK.md.
// SupabaseBackend (the hub, a later step) and MemoryBackend (tests) implement it.

export interface RemoteInfo {
  readonly name: string;
  /** Goes up by one on every write; a write names the revision it read, so two computers never overwrite each other. */
  readonly revision: number;
  /** When it was last written (ms since 1970). */
  readonly updatedAt: number;
}

export interface RemoteFile extends RemoteInfo {
  readonly text: string;
}

export type PutResult =
  | { readonly ok: true; readonly revision: number; readonly updatedAt: number }
  /** Someone else wrote first (or the file is gone): the current version to merge with. */
  | { readonly ok: false; readonly current: RemoteFile | null };

export interface SyncBackend {
  /** The files of a tool, without their text. */
  list(tool: string): Promise<RemoteInfo[]>;
  get(tool: string, name: string): Promise<RemoteFile | null>;
  /** Writes a file if its revision is still `expected` (null: if there is none yet). */
  put(tool: string, name: string, text: string, expected: number | null): Promise<PutResult>;
}

/** A backend in memory (tests, and two "computers" sharing one). `now` stamps the writes. */
export class MemoryBackend implements SyncBackend {
  readonly rows = new Map<string, RemoteFile>();
  /** Runs before every put (tests use it to let another computer write in between). */
  beforePut: (() => void) | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {}

  private static key(tool: string, name: string): string {
    return `${tool}/${name}`;
  }

  async list(tool: string): Promise<RemoteInfo[]> {
    return [...this.rows.entries()]
      .filter(([k]) => k.startsWith(tool + "/"))
      .map(([, f]) => ({ name: f.name, revision: f.revision, updatedAt: f.updatedAt }));
  }

  async get(tool: string, name: string): Promise<RemoteFile | null> {
    return this.rows.get(MemoryBackend.key(tool, name)) ?? null;
  }

  async put(tool: string, name: string, text: string, expected: number | null): Promise<PutResult> {
    const hook = this.beforePut;
    this.beforePut = null;
    hook?.();
    const key = MemoryBackend.key(tool, name);
    const current = this.rows.get(key) ?? null;
    if ((current?.revision ?? null) !== expected) return { ok: false, current };
    const row: RemoteFile = { name, text, revision: (current?.revision ?? 0) + 1, updatedAt: this.now() };
    this.rows.set(key, row);
    return { ok: true, revision: row.revision, updatedAt: row.updatedAt };
  }

  /** Writes as another computer would (tests). */
  set(tool: string, name: string, text: string): RemoteFile {
    const key = MemoryBackend.key(tool, name);
    const row: RemoteFile = { name, text, revision: (this.rows.get(key)?.revision ?? 0) + 1, updatedAt: this.now() };
    this.rows.set(key, row);
    return row;
  }
}
