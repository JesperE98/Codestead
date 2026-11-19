// The learner's files, for "Check my code" (ProjectReader), the start files (StartFiles) and the main files
// (MainFiles). C# uses System.IO directly; the port reads and writes through this interface so the course also runs
// where there is no node:fs (a browser renderer: the Electron app gives it one over IPC, or runs the checks in a
// process that has node:fs). In Node – the tests, Electron's main process – {@link defaultFileSystem} is node:fs.

/** An entry of a folder (C#'s FileSystemInfo). */
export interface DirEntry {
  readonly name: string;
  readonly fullPath: string;
  readonly isDirectory: boolean;
  /** A symbolic link or junction (C#: FileAttributes.ReparsePoint), which the folder walk skips. */
  readonly isLink: boolean;
}

/**
 * The operations of System.IO the course uses. Methods that read or write throw an {@link IOException} (or an error
 * with a `code`, like Node's) when the file system refuses; the callers catch those as C# catches IOException and
 * UnauthorizedAccessException.
 */
export interface FileSystem {
  /** Path.DirectorySeparatorChar. */
  readonly separator: string;
  /** Paths compare case-sensitively (Linux): StartFiles' "inside the folder" test. */
  readonly caseSensitive: boolean;
  /** Path.GetFullPath. */
  fullPath(path: string): string;
  /** Path.GetDirectoryName (null for a root). */
  directoryName(path: string): string | null;
  /** Path.Combine. */
  combine(a: string, b: string): string;
  /** Path.GetRelativePath. */
  relative(from: string, to: string): string;
  fileExists(path: string): boolean;
  directoryExists(path: string): boolean;
  /** The entries of a folder (C#: EnumerateFileSystemInfos with IgnoreInaccessible). */
  entries(dir: string): DirEntry[];
  /** The size of a file, or null when there is no such file. */
  fileSize(path: string): number | null;
  readBytes(path: string): Uint8Array;
  writeBytes(path: string, bytes: Uint8Array): void;
  /** Directory.CreateDirectory (with the folders above it). */
  createDirectory(path: string): void;
}

/** C#'s IOException. */
export class IOException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IOException";
  }
}

/** What C#'s `catch (Exception e) when (e is IOException or UnauthorizedAccessException)` catches. */
export function isIoError(e: unknown): boolean {
  return e instanceof IOException || (e instanceof Error && typeof (e as { code?: unknown }).code === "string");
}

let current: FileSystem | null = null;

/** Sets the file system the course uses (the app, where there is no node:fs). */
export function setFileSystem(fs: FileSystem | null): void {
  current = fs;
}

/** The file system set with {@link setFileSystem}, else node:fs where there is one. */
export function defaultFileSystem(): FileSystem {
  if (current !== null) return current;
  const node = nodeFileSystem();
  if (node === null) throw new Error("No file system: call setFileSystem (there is no node:fs here).");
  return (current = node);
}

interface NodeStats {
  isFile(): boolean;
  size: number;
}
interface NodeDirent {
  name: string;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}
interface NodeFs {
  existsSync(path: string): boolean;
  statSync(path: string, options?: { throwIfNoEntry: boolean }): (NodeStats & { isDirectory(): boolean }) | undefined;
  readdirSync(path: string, options: { withFileTypes: true }): NodeDirent[];
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array): void;
  mkdirSync(path: string, options: { recursive: true }): void;
}
interface NodePath {
  sep: string;
  resolve(...paths: string[]): string;
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  isAbsolute(path: string): boolean;
  parse(path: string): { root: string };
}

/** node:fs and node:path behind {@link FileSystem}, or null where there is no Node (no static import: see Resources.ts). */
export function nodeFileSystem(): FileSystem | null {
  const p = (globalThis as { process?: { platform?: string; getBuiltinModule?: (id: string) => unknown } }).process;
  const fs = p?.getBuiltinModule?.("node:fs") as NodeFs | undefined;
  const path = p?.getBuiltinModule?.("node:path") as NodePath | undefined;
  if (fs === undefined || path === undefined) return null;
  const stat = (f: string) => fs.statSync(f, { throwIfNoEntry: false });
  return {
    separator: path.sep,
    caseSensitive: p?.platform === "linux",
    fullPath: (f) => path.resolve(f),
    directoryName: (f) => (path.parse(f).root === f ? null : path.dirname(f)),
    // Path.Combine: a rooted second path replaces the first.
    combine: (a, b) => (path.isAbsolute(b) ? b : path.join(a, b)),
    relative: (from, to) => path.relative(from, to) || ".",
    fileExists: (f) => stat(f)?.isFile() ?? false,
    directoryExists: (f) => stat(f)?.isDirectory() ?? false,
    entries: (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).map((d) => ({
        name: d.name,
        fullPath: path.join(dir, d.name),
        isDirectory: d.isDirectory(),
        isLink: d.isSymbolicLink(),
      })),
    fileSize: (f) => {
      const s = stat(f);
      return s !== undefined && s.isFile() ? s.size : null;
    },
    readBytes: (f) => new Uint8Array(fs.readFileSync(f)),
    writeBytes: (f, bytes) => fs.writeFileSync(f, bytes),
    createDirectory: (f) => fs.mkdirSync(f, { recursive: true }),
  };
}
