// The Electron apps' self-update (Velopack in the main process, a bridge in the preload): not installed by Velopack,
// nothing is offered; the window's calls reach the main process's updater, the download's progress comes back.
import { describe, expect, it } from "vitest";
import type { SelfUpdate } from "../src/SelfUpdate.js";
import { SelfUpdateChannels, selfUpdateBridge, type SelfUpdateIpcRenderer } from "../src/electron/SelfUpdateBridge.js";
import { runVelopackHooks, serveSelfUpdate, type SelfUpdateIpcMain, updateFeedUrl, VelopackSelfUpdate } from "../src/electron/VelopackUpdate.js";

/** ipcMain and ipcRenderer in one process. */
function fakeIpc(): { main: SelfUpdateIpcMain; renderer: SelfUpdateIpcRenderer } {
  const syncHandlers = new Map<string, (e: { returnValue: unknown }) => void>();
  const handlers = new Map<string, (e: { sender: { send(channel: string, ...args: unknown[]): void } }) => Promise<unknown>>();
  const listeners = new Map<string, Set<(e: unknown, ...args: unknown[]) => void>>();
  const sender = { send: (channel: string, ...args: unknown[]) => listeners.get(channel)?.forEach((l) => l({}, ...args)) };
  return {
    main: {
      on: (channel, listener) => syncHandlers.set(channel, listener),
      handle: (channel, listener) => handlers.set(channel, listener),
    },
    renderer: {
      sendSync(channel) {
        const e = { returnValue: undefined as unknown };
        syncHandlers.get(channel)?.(e);
        return e.returnValue;
      },
      invoke: (channel) => handlers.get(channel)!({ sender }),
      on(channel, listener) {
        if (!listeners.has(channel)) listeners.set(channel, new Set());
        listeners.get(channel)!.add(listener);
      },
      removeListener: (channel, listener) => listeners.get(channel)?.delete(listener),
    },
  };
}

describe("SelfUpdateTests", () => {
  it("uppdateringskällan är releasen <id>-latest i release-repot (som i C#)", () => {
    expect(updateFeedUrl("JesperE98/codestead-releases", "codestead-linux")).toBe(
      "https://github.com/JesperE98/codestead-releases/releases/download/codestead-linux-latest/",
    );
  });

  it("utan Velopack-installation erbjuds ingen uppdatering och krokarna gör ingenting", async () => {
    runVelopackHooks();
    let exited = false;
    const u = new VelopackSelfUpdate("JesperE98/codestead-releases", "codestead-linux", () => (exited = true));
    expect(u.canUpdateItself).toBe(false);
    expect(await u.check()).toBeNull();
    await u.downloadAndRestart(() => {});
    expect(exited).toBe(false);
  });

  it("fönstrets anrop når huvudprocessens uppdaterare, och nedladdningens framsteg kommer tillbaka", async () => {
    const { main, renderer } = fakeIpc();
    let created = 0;
    const calls: string[] = [];
    const updater: SelfUpdate = {
      canUpdateItself: true,
      check: () => (calls.push("check"), Promise.resolve("0.7.0")),
      downloadAndRestart: (progress) => {
        calls.push("download");
        progress(40);
        progress(100);
        return Promise.resolve();
      },
    };
    serveSelfUpdate(main, () => (created++, updater));
    expect(created).toBe(0); // made when the window first asks (C# makes it when the update is offered)
    const bridge = selfUpdateBridge(renderer);
    expect(bridge.canUpdateItself).toBe(true);
    expect(await bridge.check()).toBe("0.7.0");
    const seen: number[] = [];
    await bridge.downloadAndRestart((p) => seen.push(p));
    expect(seen).toEqual([40, 100]);
    expect(calls).toEqual(["check", "download"]);
    expect(created).toBe(1);
    // The progress listener is removed after the download.
    renderer.sendSync(SelfUpdateChannels.canUpdateItself);
    let late = 0;
    const before = seen.length;
    await bridge.downloadAndRestart(() => late++);
    expect(late).toBe(2);
    expect(seen.length).toBe(before);
  });
});
