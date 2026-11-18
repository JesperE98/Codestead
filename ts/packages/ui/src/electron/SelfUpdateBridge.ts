// The app's own updates across Electron's processes: the main process has Velopack (VelopackUpdate.ts), the sandboxed
// window only the preload's bridge. This file has no Node imports – the preload scripts bundle it.

import type { SelfUpdate } from "../SelfUpdate.js";

/** The IPC channels of the self-update (main ⇄ preload). */
export const SelfUpdateChannels = {
  canUpdateItself: "codestead:self-update-can",
  check: "codestead:self-update-check",
  download: "codestead:self-update-download",
  progress: "codestead:self-update-progress",
} as const;

/** The part of Electron's ipcRenderer the bridge needs. */
export interface SelfUpdateIpcRenderer {
  sendSync(channel: string, ...args: unknown[]): unknown;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown;
}

/**
 * The {@link SelfUpdate} the preload gives the window (contextBridge): the main process checks, downloads and applies
 * the update; the download's progress comes back as events.
 */
export function selfUpdateBridge(ipc: SelfUpdateIpcRenderer): SelfUpdate {
  return {
    canUpdateItself: ipc.sendSync(SelfUpdateChannels.canUpdateItself) === true,
    check: () => ipc.invoke(SelfUpdateChannels.check) as Promise<string | null>,
    downloadAndRestart: async (progress: (percent: number) => void) => {
      const listener = (_e: unknown, percent: unknown) => {
        if (typeof percent === "number") progress(percent);
      };
      ipc.on(SelfUpdateChannels.progress, listener);
      try {
        await ipc.invoke(SelfUpdateChannels.download);
      } finally {
        ipc.removeListener(SelfUpdateChannels.progress, listener);
      }
    },
  };
}
