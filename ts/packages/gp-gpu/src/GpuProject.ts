import { matchesAll } from "./internal/regex.js";
import { CppSource } from "./Readers/CppSource.js";

/** Path.GetFileName on a path with forward slashes. */
const fileNameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** name.Replace('\\', '/').TrimStart('.', '/'). */
const normalize = (name: string): string => name.replaceAll("\\", "/").replace(/^[./]+/, "");

/** The learner's project: its files by path ("main.cpp", "shaders/shader.vert"), in the order they are shown. */
export class GpuProject {
  /** The files by path, in order (C#'s OrderedDictionary: a Map keeps insertion order). */
  files = new Map<string, string>();

  /** Binary files the code loads (images), by path. They are shown but not edited. */
  assets = new Map<string, Uint8Array>();

  constructor(files?: Iterable<[string, string]>) {
    if (files) for (const [k, v] of files) this.files.set(k, v.replaceAll("\r\n", "\n"));
  }

  clone(): GpuProject {
    const copy = new GpuProject(this.files);
    for (const [k, v] of this.assets) copy.assets.set(k, v);
    return copy;
  }

  /** An asset by its path or by its name alone, or null. */
  findAsset(name: string): Uint8Array | null {
    name = normalize(name);
    const data = this.assets.get(name);
    if (data !== undefined) return data;
    const file = fileNameOf(name);
    for (const [k, v] of this.assets) if (fileNameOf(k) === file) return v;
    return null;
  }

  /** A file by its path, or by its name alone ("shader.vs" finds "shaders/shader.vs"). */
  find(name: string): string | null {
    name = normalize(name);
    const text = this.files.get(name);
    if (text !== undefined) return text;
    const file = fileNameOf(name);
    for (const [k, v] of this.files) if (fileNameOf(k) === file) return v;
    return null;
  }

  pathOf(name: string): string | null {
    name = normalize(name);
    if (this.files.has(name)) return name;
    const file = fileNameOf(name);
    for (const k of this.files.keys()) if (fileNameOf(k) === file) return k;
    return null;
  }

  /**
   * The main file's text as the simulator reads it: the project's headers it includes that hold data (const float
   * LTC1[] = { … }) and free functions but no classes are appended after it, so their arrays and functions are known
   * (the main file's own offsets and lines stay as they are).
   */
  mainText(): string {
    const main = this.mainFile;
    const text = this.files.get(main) ?? "";
    let appended = "";
    for (const m of matchesAll(/^[ \t]*#\s*include\s*"([^"]+)"/gm, text)) {
      const header = this.find(m[1]!);
      if (header === null || this.pathOf(m[1]!) === main) continue;
      const code = CppSource.blankComments(header);
      // A header with classes (learnopengl's Shader, Model, Mesh: the reader has them itself) is not read; data and
      // free functions (assimp_glm_helpers.h's ConvertMatrixToGLMFormat) are.
      if (/\bclass\s+\w+\s*(?::[^{;]*)?\{|\bstruct\s+\w+\s*\{[^}]*\)\s*(?:const\s*)?\{/.test(code)) continue;
      appended += "\n// ---- " + m[1] + " ----\n" + code;
    }
    return appended.length === 0 ? text : text + "\n" + appended;
  }

  /** The C++ sources (.cpp and .h files). */
  get cppFiles(): [string, string][] {
    return [...this.files].filter(([k]) => k.endsWith(".cpp") || k.endsWith(".h") || k.endsWith(".hpp"));
  }

  /** The file that has main() (or WinMain/wWinMain), else the first .cpp file. */
  get mainFile(): string {
    const cpp = this.cppFiles;
    return cpp.find(([, v]) => /\b(?:w?WinMain|main)\s*\(/.test(v))?.[0] ?? cpp[0]?.[0] ?? this.files.keys().next().value ?? "main.cpp";
  }
}
