// The small API the preload script gives the renderer as `window.codestead` (contextBridge), and the IPC channel
// names behind it. Types only, shared by the main process, the preload and the renderer.

/** What the main process tells the renderer at start. */
export interface AppInfo {
  name: string;
  version: string;
  /** --smoke-test: run the checks, report with smokeResult and quit. */
  smokeTest: boolean;
  /** The tool's data folder (storageDirectory(productId, …), the C# app's). */
  storageDirectory: string;
}

/** A file filter of the open dialog, as Electron's. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** `window.codestead`. */
export interface CodesteadApi {
  readonly info: AppInfo;
  /**
   * The tool's JSON files (`<name>.json` in its data folder) – the {@link import("@codestead/ui").Storage} interface.
   * Synchronous like the C# Storage (the window reads them while it is being built).
   */
  readonly storage: {
    loadText(name: string): string | null;
    saveText(name: string, json: string): void;
    remove(name: string): void;
  };
  /** Opens a web link in the browser (http and https only; anything else is ignored). */
  openExternal(url: string): void;
  /** Lets the learner pick a file; null when cancelled. */
  pickFile(title: string, filters?: FileFilter[]): Promise<string | null>;
  /** Lets the learner pick a folder; null when cancelled. */
  pickFolder(title: string): Promise<string | null>;
  /** Ends the app with an exit code. */
  quit(exitCode?: number): void;
  /** The result of --smoke-test: "SMOKE OK …" on stdout (exit 0) or "SMOKE FAILED: …" on stderr (exit 1). */
  smokeResult(ok: boolean, text: string): void;
}

/** The IPC channels (main ⇄ preload). */
export const Channels = {
  info: "codestead:info",
  storageLoad: "codestead:storage-load",
  storageSave: "codestead:storage-save",
  storageRemove: "codestead:storage-remove",
  openExternal: "codestead:open-external",
  pickFile: "codestead:pick-file",
  pickFolder: "codestead:pick-folder",
  quit: "codestead:quit",
  smokeResult: "codestead:smoke-result",
} as const;
