// Port of src/GP/Codestead.GP/YourProject/MainFiles.cs (the C# app's, not the course's: it has no UI, so the next
// wave's app can take it from here). The storage is @codestead/ui's Storage interface (only its type is used here:
// the course does not load React), the files go through the course's FileSystem.
import { toSavedJson } from "@codestead/common";
import type { Storage } from "@codestead/ui";
import { defaultFileSystem, type FileSystem } from "../Ide/FileSystem.js";

const Name = "mainfiles";
/** The earlier app's project folder per chapter (folders.json): its main file is used until another is picked. */
const OldFolders = "folders";

/** What mainfiles.json holds (camelCase, as C#'s JsonDefaults write it). */
export interface MainFileChoices {
  files: Record<string, string>;
  lastFolder?: string | null;
}

function load(storage: Storage, name: string): Record<string, unknown> | null {
  const text = storage.loadText(name);
  if (text === null) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof v === "object" && v !== null) for (const [k, s] of Object.entries(v)) if (typeof s === "string") out[k] = s;
  return out;
}

/**
 * The main file the learner picked for each chapter and API ("opengl/hello-window" → a path), for "Check my code",
 * saved in the app's data folder (mainfiles.json), and the folder the file pickers start in. The learner organises
 * their code as they like; the file can be anywhere.
 */
export class MainFiles {
  private readonly data: MainFileChoices;
  private readonly oldFolders: Record<string, string>;

  constructor(
    private readonly storage: Storage,
    private readonly fs: FileSystem = defaultFileSystem(),
  ) {
    const saved = load(storage, Name);
    this.data = { files: stringMap(saved?.["files"]), lastFolder: typeof saved?.["lastFolder"] === "string" ? saved["lastFolder"] : null };
    this.oldFolders = stringMap(load(storage, OldFolders)?.["folders"]);
  }

  private static key(api: string, chapterId: string): string {
    return `${api}/${chapterId}`;
  }

  /** The chapter's main file: the one picked, else the course's main file in the earlier app's folder. */
  get(api: string, chapterId: string, courseMainFile: string): string | null {
    const key = MainFiles.key(api, chapterId);
    if (Object.hasOwn(this.data.files, key)) return this.data.files[key]!;
    if (Object.hasOwn(this.oldFolders, key)) {
      const old = this.fs.combine(this.oldFolders[key]!, courseMainFile);
      if (this.fs.fileExists(old)) return old;
    }
    return null;
  }

  set(api: string, chapterId: string, file: string): void {
    file = this.fs.fullPath(file);
    this.data.files[MainFiles.key(api, chapterId)] = file;
    this.data.lastFolder = this.fs.directoryName(file);
    this.storage.saveText(Name, toSavedJson(this.data));
  }

  /** Where the pickers start: the folder of the last file picked or saved. */
  get lastFolder(): string | null {
    return this.data.lastFolder ?? null;
  }
}
