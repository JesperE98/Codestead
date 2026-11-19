import { toSavedJson } from "@codestead/common";

/**
 * Small JSON files per tool in the user's app data folder (C#'s Codestead.UI.Storage): Windows
 * %APPDATA%\Codestead\&lt;tool&gt;, Linux and macOS ~/.config/Codestead/&lt;tool&gt; (see {@link storageDirectory}). The
 * Electron apps implement it with files (writes atomic: temp file + move, so a crash never leaves a half-written
 * file); tests use {@link MemoryStorage}. Every method is best effort and never throws.
 */
export interface Storage {
  /** The text of `<name>.json`, or null when there is none or it cannot be read. */
  loadText(name: string): string | null;
  /** Writes `<name>.json` (saving is best effort; the app keeps working without it). */
  saveText(name: string, json: string): void;
  /** Deletes `<name>.json` if it is there. */
  remove(name: string): void;
}

/** `<name>.json` parsed, or null when there is none or it is not JSON (C#'s Storage.Load). */
export function loadJson(storage: Storage, name: string): unknown {
  const text = storage.loadText(name);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Saves a value as `<name>.json` with the C# apps' JSON rules (camelCase, nulls left out). */
export function saveJson(storage: Storage, name: string, value: unknown): void {
  storage.saveText(name, toSavedJson(value));
}

/** A storage in memory, for tests (and a session without a data folder). */
export class MemoryStorage implements Storage {
  readonly files = new Map<string, string>();

  loadText(name: string): string | null {
    return this.files.get(name) ?? null;
  }

  saveText(name: string, json: string): void {
    this.files.set(name, json);
  }

  remove(name: string): void {
    this.files.delete(name);
  }
}

/** Where the files are, as the C# apps find it. */
export interface StorageLocation {
  /** process.platform. */
  platform: string;
  /** process.env. */
  env: Readonly<Record<string, string | undefined>>;
  /** The home directory (os.homedir()). */
  home: string;
  /** A base directory that overrides everything (tests). */
  baseDirectory?: string;
}

/**
 * The data folder of a tool, the same as the C# apps': `baseDirectory`, else $CODESTEAD_DATA_DIR, else .NET's
 * ApplicationData folder + "Codestead" – %APPDATA% on Windows, $XDG_CONFIG_HOME or ~/.config elsewhere (also on macOS,
 * where Electron's own appData would be ~/Library/Application Support) – and then the tool's id.
 */
export function storageDirectory(toolId: string, where: StorageLocation): string {
  const windows = where.platform === "win32";
  const sep = windows ? "\\" : "/";
  const join = (a: string, b: string) => (a.endsWith(sep) || a.endsWith("/") ? a + b : a + sep + b);
  const appData = windows ? (where.env.APPDATA ?? join(where.home, "AppData\\Roaming")) : where.env.XDG_CONFIG_HOME || join(where.home, ".config");
  const root = where.baseDirectory ?? where.env.CODESTEAD_DATA_DIR ?? join(appData, "Codestead");
  return join(root, toolId);
}
