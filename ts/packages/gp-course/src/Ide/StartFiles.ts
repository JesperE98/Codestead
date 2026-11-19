import type { GpuProject } from "@codestead/gp-gpu";
import { defaultFileSystem, IOException, isIoError, type FileSystem } from "./FileSystem.js";

/** Copies a chapter's start files (code, shaders and the course's images, models and fonts) into a folder. */
export const StartFiles = {
  /** The files of a project as (relative path, bytes). */
  of(project: GpuProject): [path: string, bytes: Uint8Array][] {
    const encoder = new TextEncoder();
    return [...[...project.files].map(([k, v]) => [k, encoder.encode(v)] as [string, Uint8Array]), ...project.assets];
  },

  /** The files that exist in the folder with other contents (they would be overwritten). */
  conflicts(folder: string, project: GpuProject, fs: FileSystem = defaultFileSystem()): string[] {
    const list: string[] = [];
    for (const [path, bytes] of StartFiles.of(project)) {
      const t = target(folder, path, fs);
      try {
        if (fs.fileExists(t) && !same(fs.readBytes(t), bytes)) list.push(path);
      } catch (e) {
        if (!isIoError(e)) throw e;
        list.push(path);
      }
    }
    return list;
  },

  /** Writes the files (overwriting); returns how many were written. */
  copy(folder: string, project: GpuProject, fs: FileSystem = defaultFileSystem()): number {
    let n = 0;
    for (const [path, bytes] of StartFiles.of(project)) {
      const t = target(folder, path, fs);
      fs.createDirectory(fs.directoryName(t)!);
      fs.writeBytes(t, bytes);
      n++;
    }
    return n;
  },
};

function target(folder: string, path: string, fs: FileSystem): string {
  const full = fs.fullPath(fs.combine(folder, path.replaceAll("/", fs.separator)));
  let root = fs.fullPath(folder);
  while (root.endsWith(fs.separator)) root = root.slice(0, -1);
  root += fs.separator;
  const inside = fs.caseSensitive ? full.startsWith(root) : full.toUpperCase().startsWith(root.toUpperCase());
  if (!inside) throw new IOException(`${path} is outside the project folder.`);
  return full;
}

/** Text compares without line-ending differences (Git on Windows checks out CRLF). */
function same(a: Uint8Array, b: Uint8Array): boolean {
  return sequenceEqual(a, b) || (a.length < 4 * 1024 * 1024 && normalize(a) === normalize(b));
}

function sequenceEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Encoding.UTF8.GetString keeps a byte order mark (ignoreBOM: true does too). */
function normalize(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).replaceAll("\r\n", "\n");
}
