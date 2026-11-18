// The preload script (sandboxed): gives the renderer `window.codestead` (see api.ts) over IPC – nothing else of
// Electron or Node reaches the page.

import { selfUpdateBridge } from "@codestead/ui/electron-bridge";
import { contextBridge, ipcRenderer } from "electron";
import { type AppInfo, Channels, type CodesteadApi, type FileFilter } from "./api.js";

const api: CodesteadApi = {
  info: ipcRenderer.sendSync(Channels.info) as AppInfo,
  // Synchronous, like the C# Storage: the learning window reads its state while it is built, and a save is on disk
  // before the next command (and before the window closes).
  storage: {
    loadText: (name: string) => ipcRenderer.sendSync(Channels.storageLoad, name) as string | null,
    saveText: (name: string, json: string) => void ipcRenderer.sendSync(Channels.storageSave, name, json),
    remove: (name: string) => void ipcRenderer.sendSync(Channels.storageRemove, name),
  },
  openExternal: (url: string) => ipcRenderer.send(Channels.openExternal, url),
  pickFile: (title: string, filters?: FileFilter[]) => ipcRenderer.invoke(Channels.pickFile, title, filters) as Promise<string | null>,
  pickFolder: (title: string) => ipcRenderer.invoke(Channels.pickFolder, title) as Promise<string | null>,
  selfUpdate: selfUpdateBridge(ipcRenderer),
  quit: (exitCode = 0) => ipcRenderer.send(Channels.quit, exitCode),
  smokeResult: (ok: boolean, text: string) => ipcRenderer.send(Channels.smokeResult, ok, text),
};

contextBridge.exposeInMainWorld("codestead", api);
