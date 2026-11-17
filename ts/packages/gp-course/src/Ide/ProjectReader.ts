import { CppSource, GpuProject } from "@codestead/gp-gpu";
import { GpCourse } from "../GpCourse.js";
import { defaultFileSystem, isIoError, type FileSystem } from "./FileSystem.js";
import { ProjectFiles } from "./ProjectFiles.js";
import { ProjectRead } from "./ProjectRead.js";

type Root = { root: string; files: string[] };

const mainFunction = /\b(?:w?WinMain|main)\s*\(/;

/** Path.GetFileName of a relative path with '/'. */
const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** Path.GetExtension. */
function extension(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot);
}

/** string.Equals / EndsWith with StringComparison.OrdinalIgnoreCase (upper-case mapping, as .NET's simple case folding). */
const upper = (s: string): string => s.toUpperCase();
const equalsIgnoreCase = (a: string, b: string): boolean => a.length === b.length && upper(a) === upper(b);
const endsWithIgnoreCase = (s: string, end: string): boolean => s.length >= end.length && upper(s.slice(s.length - end.length)) === upper(end);

const depth = (f: string): number => f.split("/").length - 1;

/** string.CompareOrdinal. */
const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function inLibrary(relative: string): boolean {
  return relative.split("/").slice(0, -1).some((d) => ProjectFiles.isLibraryDir(d));
}

/**
 * Reads the learner's code into a project the checks can look at. The learner picks the chapter's main file (any
 * name, anywhere: they organise their code as they like); the chapter's other files (its start files and the files
 * its tasks create: shaders, headers) are found by their path in the course or by name in the main file's folder and
 * the folders below it, else in the folder above it ("src/main.cpp" with "shaders/" beside "src/"), outside the build
 * folders. The images, models and fonts come from there when they are there, else from the course. Library code kept
 * in the project (GLAD, GLM, stb_image …) is not read: it is not the learner's, and the checks look at the learner's code.
 */
export const ProjectReader = {
  /** Larger text files are not the learner's code. */
  MaxTextSize: 2 * 1024 * 1024,

  /** How many files and folders a search looks at, and how deep: a folder like the home folder is not searched through. */
  MaxEntries: 20000,

  MaxDepth: 8,

  /** The chapter's code from the main file the learner picked and the folders around it. */
  readFrom(mainFile: string, chapterId: string, api: string, fs: FileSystem = defaultFileSystem()): ProjectRead {
    const folder = fs.directoryName(fs.fullPath(mainFile))!;
    const roots: Root[] = [{ root: folder, files: ProjectReader.list(folder, fs) }];
    const parent = fs.directoryName(folder);
    if (parent !== null) roots.push({ root: parent, files: ProjectReader.list(parent, fs) });
    // A picked main file that is gone is missing: another main file nearby is not the learner's choice.
    return read(roots, chapterId, api, fs.fileExists(mainFile) ? fs.fullPath(mainFile) : null, true, fs);
  },

  /** The chapter's code from a folder: the main file is the course's, or the C++ file with main(). */
  read(folder: string, chapterId: string, api: string, fs: FileSystem = defaultFileSystem()): ProjectRead {
    const files = ProjectReader.list(folder, fs);
    const main = findMain(folder, files, fs);
    return read([{ root: folder, files }], chapterId, api, main === null ? null : fs.combine(folder, main), false, fs);
  },

  /** The files under the folder outside build, IDE and skipped folders (relative, with '/'). */
  list(folder: string, fs: FileSystem = defaultFileSystem()): string[] {
    const list: string[] = [];
    if (!fs.directoryExists(folder)) return list;
    const pending: { dir: string; depth: number }[] = [{ dir: folder, depth: 0 }];
    let entries = 0;
    while (pending.length > 0 && entries < ProjectReader.MaxEntries) {
      const { dir, depth } = pending.pop()!;
      try {
        for (const item of fs.entries(dir)) {
          if (item.isLink) continue;
          if (++entries > ProjectReader.MaxEntries) break;
          if (item.isDirectory) {
            if (depth + 1 <= ProjectReader.MaxDepth && !ProjectFiles.isSkippedDir(item.name) && !ProjectFiles.isBuildDir(item.name)) pending.push({ dir: item.fullPath, depth: depth + 1 });
            continue;
          }
          list.push(fs.relative(folder, item.fullPath).replaceAll("\\", "/"));
        }
      } catch (e) {
        if (!isIoError(e)) throw e;
      }
    }
    list.sort(ordinal);
    return list;
  },

  /**
   * A file of the course's project in the folder: at its path, else the file with its name whose path ends like the
   * course's ("src/shaders/shader.vert" for "shaders/shader.vert"), outside library folders, the shortest.
   */
  find(files: readonly string[], coursePath: string): string | null {
    const exact = files.find((f) => equalsIgnoreCase(f, coursePath));
    if (exact !== undefined) return exact;
    const name = fileName(coursePath);
    const key = (f: string): [number, number, number] => [endsWithIgnoreCase(f, "/" + coursePath) ? 0 : 1, inLibrary(f) ? 1 : 0, depth(f)];
    // OrderBy … ThenBy … (stable), first.
    const candidates = files.filter((f) => equalsIgnoreCase(fileName(f), name));
    candidates.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || ordinal(a, b);
    });
    return candidates[0] ?? null;
  },
};

function read(roots: readonly Root[], chapterId: string, api: string, mainFile: string | null, mainGiven: boolean, fs: FileSystem): ProjectRead {
  const start = GpCourse.startProject(chapterId, api);
  const expected = [...new Set([...start.files.keys(), ...GpCourse.allTasks(chapterId, api).flatMap((t) => t.edits).map((e) => e.file)])];
  const project = new GpuProject();
  const missing: string[] = [];
  const startMain = start.mainFile;
  for (const path of expected) {
    const found = path !== startMain ? locate(roots, path, fs) : (mainFile ?? (mainGiven ? null : locate(roots, path, fs)));
    if (found === null) {
      if (start.files.has(path)) missing.push(path);
      continue;
    }
    const text = readText(found, fs);
    if (text !== null) project.files.set(path, text.replaceAll("\r\n", "\n"));
  }
  for (const [path, bytes] of start.assets) {
    let own: Uint8Array | null = null;
    const found = locate(roots, path, fs);
    if (found !== null) {
      try {
        own = fs.readBytes(found);
      } catch (e) {
        if (!isIoError(e)) throw e;
      }
    }
    project.assets.set(path, own ?? bytes);
  }
  return new ProjectRead(project, missing);
}

/** A course file in the first folder that has it (full path). */
function locate(roots: readonly Root[], coursePath: string, fs: FileSystem): string | null {
  for (const { root, files } of roots) {
    const found = ProjectReader.find(files, coursePath);
    if (found !== null) return fs.combine(root, found);
  }
  return null;
}

/** The learner's C++ file with main() or WinMain(), outside library folders. */
function findMain(folder: string, files: readonly string[], fs: FileSystem): string | null {
  const cpp = files.filter((f) => !inLibrary(f) && [".cpp", ".cc", ".cxx"].includes(extension(f).toLowerCase()));
  cpp.sort((a, b) => depth(a) - depth(b)); // OrderBy: stable
  for (const f of cpp) {
    const text = readText(fs.combine(folder, f), fs);
    if (text !== null && mainFunction.test(CppSource.blankComments(text))) return f;
  }
  return null;
}

/** File.ReadAllText (UTF-8, a byte order mark dropped), or null for a missing or too large file. */
function readText(path: string, fs: FileSystem): string | null {
  try {
    const size = fs.fileSize(path);
    return size !== null && size <= ProjectReader.MaxTextSize ? new TextDecoder().decode(fs.readBytes(path)) : null;
  } catch (e) {
    if (!isIoError(e)) throw e;
    return null;
  }
}
