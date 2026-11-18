// The small API the preload script gives the renderer as `window.codestead` (contextBridge), and the IPC channel
// names behind it. Types only, shared by the main process, the preload and the renderer.

import type { SelfUpdate } from "@codestead/ui";
import type { CourseHost } from "../src/CourseHost.js";

/** What the main process tells the renderer at start. */
export interface AppInfo {
  name: string;
  version: string;
  /** --smoke-test: run the checks, report with smokeResult and quit. */
  smokeTest: boolean;
  /** The tool's data folder (storageDirectory(productId, …), the C# app's). */
  storageDirectory: string;
  /** process.platform of the main process. */
  platform: string;
  /** Path.DirectorySeparatorChar. */
  separator: string;
}

/** A file filter of the open dialog, as Electron's. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** The questions about paths and files the window may ask (synchronous, as System.IO's): no reading, no writing. */
export type PathOp = "fullPath" | "directoryName" | "combine" | "relative" | "fileExists" | "directoryExists";

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
  /** Paths and whether files exist (the main file, the pickers' start folder): see {@link PathOp}. */
  path(op: PathOp, ...args: string[]): string | boolean | null;
  /** The course's work in the main process's worker threads: checks, pictures, saving files. */
  readonly course: CourseHost;
  /** Opens a web link in the browser (http and https only; anything else is ignored). */
  openExternal(url: string): void;
  /** Lets the learner pick a file (starting in a folder, if given); null when cancelled. */
  pickFile(title: string, filters?: FileFilter[], startFolder?: string | null): Promise<string | null>;
  /** Lets the learner pick a folder (starting in a folder, if given); null when cancelled. */
  pickFolder(title: string, startFolder?: string | null): Promise<string | null>;
  /**
   * The app's own updates (Velopack in the main process, see @codestead/ui/electron-main): installed with Setup.exe or
   * as an AppImage it updates itself; otherwise canUpdateItself is false.
   */
  readonly selfUpdate: SelfUpdate;
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
  path: "codestead:path",
  course: "codestead:course",
  cancelCheck: "codestead:cancel-check",
  openExternal: "codestead:open-external",
  pickFile: "codestead:pick-file",
  pickFolder: "codestead:pick-folder",
  quit: "codestead:quit",
  smokeResult: "codestead:smoke-result",
} as const;
