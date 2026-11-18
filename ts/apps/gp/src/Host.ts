// The renderer's side of the preload API (window.codestead, see electron/api.ts): the tool's storage, paths, the
// course's work in the main process and the app's facts. Outside Electron (the page served by `vite` in a browser) a
// stand-in keeps everything in memory and has no files.

import { IOException, type FileSystem } from "@codestead/gp-course";
import { MemoryStorage, type Storage } from "@codestead/ui";
import type { CodesteadApi, PathOp } from "../electron/api.js";
import type { CourseHost } from "./CourseHost.js";
import { NoUpdates } from "./NoUpdates.js";
import { ProductInfo } from "./ProductInfo.js";

/** The browser has no files: nothing to check, no pictures, nothing saved. */
const noCourse: CourseHost = {
  check: () => Promise.reject(new Error("No files in a browser.")),
  cancelCheck: () => {},
  draw: () => Promise.resolve({ width: 0, height: 0, pixels: null, message: "expected.none" }),
  conflicts: () => Promise.resolve([]),
  save: () => Promise.resolve({ error: "No files in a browser." }),
  smokePrepare: () => Promise.reject(new Error("No files in a browser.")),
  smokeBuilds: () => Promise.resolve(0),
  smokeAssets: () => Promise.resolve(0),
  smokeCleanup: () => Promise.resolve(),
};

/** Paths as on Linux, and no file exists. */
function browserPath(op: PathOp, a = "", b = ""): string | boolean | null {
  switch (op) {
    case "fullPath":
      return a;
    case "directoryName": {
      const i = a.lastIndexOf("/");
      return i <= 0 ? null : a.slice(0, i);
    }
    case "combine":
      return b.startsWith("/") ? b : a.replace(/\/$/, "") + "/" + b;
    case "relative":
      return b;
    default:
      return false;
  }
}

/** A stand-in for the browser: memory storage, links in a new tab, no pickers, no files. */
function browserApi(): CodesteadApi {
  const memory = new MemoryStorage();
  return {
    info: { name: ProductInfo.name, version: ProductInfo.version, smokeTest: false, storageDirectory: "", platform: "linux", separator: "/" },
    storage: memory,
    path: browserPath,
    course: noCourse,
    openExternal: (url) => void globalThis.open?.(url, "_blank", "noopener,noreferrer"),
    pickFile: () => Promise.resolve(null),
    pickFolder: () => Promise.resolve(null),
    selfUpdate: NoUpdates,
    quit: () => globalThis.close?.(),
    smokeResult: (ok, text) => console.log(ok ? "SMOKE OK" : "SMOKE FAILED", text),
  };
}

/** window.codestead, or the browser stand-in. */
export function hostApi(): CodesteadApi {
  // Given by the preload script (electron/preload.ts). Not declared on Window globally: every app has its own
  // window.codestead, and the workspace is type-checked as one program.
  const given = (globalThis.window as { codestead?: CodesteadApi } | undefined)?.codestead;
  return given ?? browserApi();
}

/** The tool's files through the preload (the C# app's data folder) – {@link Storage}. */
export function hostStorage(api: CodesteadApi): Storage {
  return {
    loadText: (name) => api.storage.loadText(name),
    saveText: (name, json) => api.storage.saveText(name, json),
    remove: (name) => api.storage.remove(name),
  };
}

/**
 * The course's {@link FileSystem} in the window (MainFiles, whether the main file exists): paths and whether files
 * exist, answered by the main process. The window reads and writes no files itself – the course worker does.
 */
export function hostFileSystem(api: CodesteadApi): FileSystem {
  const ask = (op: PathOp, ...args: string[]) => api.path(op, ...args);
  const notHere = (what: string) => () => {
    throw new IOException(`${what} is done by the course worker, not in the window.`);
  };
  return {
    separator: api.info.separator,
    caseSensitive: api.info.platform === "linux",
    fullPath: (f) => ask("fullPath", f) as string,
    directoryName: (f) => ask("directoryName", f) as string | null,
    combine: (a, b) => ask("combine", a, b) as string,
    relative: (from, to) => ask("relative", from, to) as string,
    fileExists: (f) => ask("fileExists", f) === true,
    directoryExists: (f) => ask("directoryExists", f) === true,
    entries: notHere("Listing a folder"),
    fileSize: notHere("Reading a file"),
    readBytes: notHere("Reading a file"),
    writeBytes: notHere("Writing a file"),
    createDirectory: notHere("Creating a folder"),
  };
}
