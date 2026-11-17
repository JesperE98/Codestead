// The renderer's side of the preload API (window.codestead, see electron/api.ts): the tool's storage and the app's
// facts. Outside Electron (the page served by `vite` in a browser) a stand-in keeps everything in memory.

import { MemoryStorage, type Storage } from "@codestead/ui";
import type { CodesteadApi } from "../electron/api.js";
import { ProductInfo } from "./ProductInfo.js";

declare global {
  interface Window {
    /** Given by the preload script (electron/preload.ts). */
    codestead?: CodesteadApi;
  }
}

/** A stand-in for the browser: memory storage, links in a new tab, no pickers. */
function browserApi(): CodesteadApi {
  const memory = new MemoryStorage();
  return {
    info: { name: ProductInfo.name, version: ProductInfo.version, smokeTest: false, storageDirectory: "" },
    storage: memory,
    openExternal: (url) => void globalThis.open?.(url, "_blank", "noopener,noreferrer"),
    pickFile: () => Promise.resolve(null),
    pickFolder: () => Promise.resolve(null),
    quit: () => globalThis.close?.(),
    smokeResult: (ok, text) => console.log(ok ? "SMOKE OK" : "SMOKE FAILED", text),
  };
}

/** window.codestead, or the browser stand-in. */
export function hostApi(): CodesteadApi {
  return globalThis.window?.codestead ?? browserApi();
}

/** The tool's files through the preload (the C# app's data folder) – {@link Storage}. */
export function hostStorage(api: CodesteadApi): Storage {
  return {
    loadText: (name) => api.storage.loadText(name),
    saveText: (name, json) => api.storage.saveText(name, json),
    remove: (name) => api.storage.remove(name),
  };
}
