// A folder of saved JSON files as the sync engine sees it: a tool's data folder, the bases of the last sync, or the
// backups of files that lost a conflict. Names are without ".json", as in @codestead/ui's Storage.

export interface SavedFile {
  readonly text: string;
  /** When the file was last written (ms since 1970). */
  readonly modifiedAt: number;
}

export interface SyncFolder {
  /** The names of the files in the folder. */
  names(): string[];
  read(name: string): SavedFile | null;
  write(name: string, text: string): void;
}

/** A folder in memory (tests). `now` stamps what is written. */
export class MemoryFolder implements SyncFolder {
  readonly files = new Map<string, SavedFile>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  names(): string[] {
    return [...this.files.keys()];
  }

  read(name: string): SavedFile | null {
    return this.files.get(name) ?? null;
  }

  write(name: string, text: string): void {
    this.files.set(name, { text, modifiedAt: this.now() });
  }

  /** Puts a file with a given time (tests). */
  put(name: string, text: string, modifiedAt: number): void {
    this.files.set(name, { text, modifiedAt });
  }
}
