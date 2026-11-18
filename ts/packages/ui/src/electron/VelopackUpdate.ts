// Port of Codestead.UI/SelfUpdate.cs (Velopack) for the Electron apps' main process, with Velopack's Node SDK (the
// npm package velopack, the same version as the C# apps' Velopack package and the release workflow's vpk). Node only:
// the apps' main processes import it as "@codestead/ui/electron-main" and keep velopack outside their bundle (it has a
// native module); the window reaches it through SelfUpdateBridge.ts.

import { HttpSource, UpdateManager, type UpdateInfo, VelopackApp } from "velopack";
import type { SelfUpdate } from "../SelfUpdate.js";
import { SelfUpdateChannels } from "./SelfUpdateBridge.js";

/**
 * Velopack's install/update hooks (C#: VelopackApp.Build().Run() first in Program.Main): when Setup.exe or an update
 * starts the app for one of them, Velopack handles it and ends the process; an update downloaded earlier is applied
 * here. Call it first in the main process. Outside a Velopack installation it does nothing. A failure (say, the native
 * module is missing) must not stop the app, so it is only reported.
 */
export function runVelopackHooks(): void {
  try {
    VelopackApp.build().run();
  } catch (e) {
    process.stderr.write(`Velopack: ${e instanceof Error ? e.message : String(e)}\n`);
  }
}

/** The Velopack update feed of a product: the release "<id>-latest" in the releases repository (as C#). */
export function updateFeedUrl(releasesRepo: string, packageId: string): string {
  return `https://github.com/${releasesRepo}/releases/download/${packageId}-latest/`;
}

/**
 * An app's own updates. Installed with Setup.exe (Windows) or as an AppImage, it updates itself with Velopack from the
 * release "<id>-latest" in the releases repository. Installed as a .deb/.rpm/Arch package (or by the hub), something
 * else owns the files, so {@link canUpdateItself} is false.
 */
export class VelopackSelfUpdate implements SelfUpdate {
  private readonly manager: UpdateManager | null = null;
  private pending: UpdateInfo | null = null;

  /**
   * @param releasesRepo "owner/repo" of the public releases repository.
   * @param packageId The Velopack package id, e.g. "codestead-hub".
   * @param exit Ends the app once the updater waits for it (C#'s ApplyUpdatesAndRestart exits the process).
   */
  constructor(
    releasesRepo: string,
    packageId: string,
    private readonly exit: () => void,
  ) {
    try {
      // HttpSource, not the URL as a string: Velopack's Node SDK would take a github.com address for a GitHub
      // repository (C#'s UpdateManager(string) reads it as a plain web feed, as here).
      this.manager = new UpdateManager(new HttpSource(updateFeedUrl(releasesRepo, packageId)));
    } catch {
      // Not installed by Velopack (development build, native package, the hub's installation) – no self-update.
    }
  }

  /** True when the app can download and apply its own updates. */
  get canUpdateItself(): boolean {
    return this.manager !== null;
  }

  /** The newer version available, or null. */
  async check(): Promise<string | null> {
    if (this.manager === null) return null;
    this.pending = await this.manager.checkForUpdatesAsync();
    return this.pending?.TargetFullRelease.Version ?? null;
  }

  async downloadAndRestart(progress: (percent: number) => void): Promise<void> {
    if (this.manager === null || this.pending === null) return;
    await this.manager.downloadUpdateAsync(this.pending, progress);
    this.manager.waitExitThenApplyUpdate(this.pending.TargetFullRelease, false, true, []);
    this.exit();
  }
}

/** The part of Electron's ipcMain the self-update needs. */
export interface SelfUpdateIpcMain {
  on(channel: string, listener: (event: { returnValue: unknown }) => void): unknown;
  handle(channel: string, listener: (event: { sender: { send(channel: string, ...args: unknown[]): void } }) => Promise<unknown>): unknown;
}

/**
 * Answers the window's self-update (SelfUpdateBridge.ts). The updater is made when the window first asks – as C# makes
 * it when the learning window offers an update.
 */
export function serveSelfUpdate(ipc: SelfUpdateIpcMain, create: () => SelfUpdate): void {
  let updater: SelfUpdate | null = null;
  const get = () => (updater ??= create());
  ipc.on(SelfUpdateChannels.canUpdateItself, (e) => void (e.returnValue = get().canUpdateItself));
  ipc.handle(SelfUpdateChannels.check, () => get().check());
  ipc.handle(SelfUpdateChannels.download, (e) => get().downloadAndRestart((percent) => e.sender.send(SelfUpdateChannels.progress, percent)));
}
