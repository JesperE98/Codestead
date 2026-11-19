import { selfUpdateBridge } from "@codestead/ui/electron-bridge";
import { contextBridge, ipcRenderer } from "electron";
import type { Storage } from "@codestead/ui";
import type { HubApi } from "../src/HubApi.js";
import { Ipc } from "../src/ipc.js";

// The window's small API over IPC (window.codestead). The window is sandboxed: everything that needs the file system,
// the network or processes is done by the main process.

const storage = (toolId: string): Storage => ({
  loadText: (name) => ipcRenderer.sendSync(Ipc.storageLoad, toolId, name) as string | null,
  saveText: (name, json) => void ipcRenderer.sendSync(Ipc.storageSave, toolId, name, json),
  remove: (name) => void ipcRenderer.sendSync(Ipc.storageRemove, toolId, name),
});

let nextCall = 1;
const progressListeners = new Map<number, (fraction: number) => void>();
const exitListeners = new Map<number, () => void>();
ipcRenderer.on(Ipc.progress, (_e, call: number, fraction: number) => progressListeners.get(call)?.(fraction));
ipcRenderer.on(Ipc.exited, (_e, call: number) => {
  exitListeners.get(call)?.();
  exitListeners.delete(call);
});

const api: HubApi = {
  info: () => ipcRenderer.invoke(Ipc.info),
  storage,
  loadCatalog: () => ipcRenderer.invoke(Ipc.loadCatalog),
  installedTools: () => ipcRenderer.invoke(Ipc.installedTools),
  async install(toolId, progress) {
    const call = nextCall++;
    progressListeners.set(call, progress);
    try {
      return await ipcRenderer.invoke(Ipc.install, call, toolId);
    } finally {
      progressListeners.delete(call);
    }
  },
  rollBack: (toolId) => ipcRenderer.invoke(Ipc.rollBack, toolId),
  uninstall: (toolId) => ipcRenderer.invoke(Ipc.uninstall, toolId),
  async launch(toolId, onExit) {
    const call = nextCall++;
    exitListeners.set(call, onExit);
    const result = await ipcRenderer.invoke(Ipc.launch, call, toolId);
    if ("error" in result) exitListeners.delete(call);
    return result;
  },
  smokeLaunch: (toolId) => ipcRenderer.invoke(Ipc.smokeLaunch, toolId),
  hideToBackground: (menu) => ipcRenderer.invoke(Ipc.hideToBackground, menu),
  showFromBackground: () => ipcRenderer.invoke(Ipc.showFromBackground),
  onShown: (listener) => void ipcRenderer.on(Ipc.shown, () => listener()),
  onOpenRequested: (listener) => void ipcRenderer.on(Ipc.openRequested, (_e, id: string) => listener(id)),
  onHideRequested: (listener) => void ipcRenderer.on(Ipc.hideRequested, () => listener()),
  setCloseToTray: (value) => ipcRenderer.send(Ipc.setCloseToTray, value),
  setTrayToolTip: (text) => ipcRenderer.send(Ipc.setTrayToolTip, text),
  startsWithComputer: () => ipcRenderer.invoke(Ipc.startsWithComputer),
  setStartsWithComputer: (value) => ipcRenderer.invoke(Ipc.setStartsWithComputer, value),
  selfUpdate: selfUpdateBridge(ipcRenderer),
  openExternal: (url) => ipcRenderer.invoke(Ipc.openExternal, url),
  pickFile: () => ipcRenderer.invoke(Ipc.pickFile),
  pickFolder: () => ipcRenderer.invoke(Ipc.pickFolder),
  smokeTestDone: (ok, text) => ipcRenderer.send(Ipc.smokeTestDone, ok, text),
  quit: () => ipcRenderer.send(Ipc.quit),
};

contextBridge.exposeInMainWorld("codestead", api);
