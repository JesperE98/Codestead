// The preload script (sandboxed): gives the renderer `window.codestead` (see api.ts) over IPC – nothing else of
// Electron or Node reaches the page.

import { contextBridge, ipcRenderer } from "electron";
import type { CheckReportData, CourseHost, DrawnData, FilesToSave, SaveResult } from "../src/CourseHost.js";
import { type AppInfo, Channels, type CodesteadApi, type FileFilter, type PathOp } from "./api.js";

const course = (op: keyof CourseHost, ...args: unknown[]) => ipcRenderer.invoke(Channels.course, op, ...args);

const api: CodesteadApi = {
  info: ipcRenderer.sendSync(Channels.info) as AppInfo,
  // Synchronous, like the C# Storage: the learning window reads its state while it is built, and a save is on disk
  // before the next command (and before the window closes).
  storage: {
    loadText: (name: string) => ipcRenderer.sendSync(Channels.storageLoad, name) as string | null,
    saveText: (name: string, json: string) => void ipcRenderer.sendSync(Channels.storageSave, name, json),
    remove: (name: string) => void ipcRenderer.sendSync(Channels.storageRemove, name),
  },
  path: (op: PathOp, ...args: string[]) => ipcRenderer.sendSync(Channels.path, op, ...args) as string | boolean | null,
  course: {
    check: (mainFile: string, chapter: string, api: string) => course("check", mainFile, chapter, api) as Promise<CheckReportData>,
    cancelCheck: () => ipcRenderer.send(Channels.cancelCheck),
    draw: (chapter: string, api: string, task: number, width: number) => course("draw", chapter, api, task, width) as Promise<DrawnData>,
    conflicts: (folder: string, files: FilesToSave) => course("conflicts", folder, files) as Promise<string[]>,
    save: (folder: string, files: FilesToSave) => course("save", folder, files) as Promise<SaveResult>,
    smokePrepare: (chapter: string, api: string, taskIndex: number) => course("smokePrepare", chapter, api, taskIndex) as Promise<string>,
    smokeBuilds: () => course("smokeBuilds") as Promise<number>,
    smokeAssets: () => course("smokeAssets") as Promise<number>,
    smokeCleanup: () => course("smokeCleanup") as Promise<void>,
  },
  openExternal: (url: string) => ipcRenderer.send(Channels.openExternal, url),
  pickFile: (title: string, filters?: FileFilter[], startFolder?: string | null) => ipcRenderer.invoke(Channels.pickFile, title, filters, startFolder) as Promise<string | null>,
  pickFolder: (title: string, startFolder?: string | null) => ipcRenderer.invoke(Channels.pickFolder, title, startFolder) as Promise<string | null>,
  quit: (exitCode = 0) => ipcRenderer.send(Channels.quit, exitCode),
  smokeResult: (ok: boolean, text: string) => ipcRenderer.send(Channels.smokeResult, ok, text),
};

contextBridge.exposeInMainWorld("codestead", api);
