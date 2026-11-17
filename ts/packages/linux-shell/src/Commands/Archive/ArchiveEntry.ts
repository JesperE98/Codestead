// Port of Commands/Archive/ArchiveEntry.cs – a file or directory in a tar or zip archive.

/** A file or directory in a tar or zip archive. */
export interface ArchiveEntry {
  /** Relative path, without a trailing /. */
  path: string;
  /** "file", "dir" or "link" (a symbolic link: content is where it points). */
  type: string;
  mode: number;
  owner: string;
  group: string;
  mtime: number;
  content?: string | null;
  /** Pretend size, for simulated binaries (e.g. /usr/bin/ls). */
  size?: number | null;
}
