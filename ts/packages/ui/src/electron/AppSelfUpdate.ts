// The apps' main processes import their updates from here ("@codestead/ui/electron-main"): Velopack (VelopackUpdate.ts)
// where it installed the app, the system's package manager (NativePackageUpdate.ts) where the app is a .deb, .rpm or
// Arch package, and nothing for the hub's per-user copies (the hub updates those).

import type { SelfUpdate } from "../SelfUpdate.js";
import { type HttpGet, type NativeInstall, NativePackageSelfUpdate, relaunchAfterExit } from "./NativePackageUpdate.js";
import { VelopackSelfUpdate } from "./VelopackUpdate.js";

export * from "./NativePackageUpdate.js";
export * from "./VelopackUpdate.js";

/** What {@link appSelfUpdate} needs to know about the app. */
export interface AppSelfUpdateOptions {
  /** "owner/repo" of the public releases repository. */
  readonly releasesRepo: string;
  /** The product's id: the Velopack package id and the native package's name. */
  readonly packageId: string;
  readonly currentVersion: string;
  /** What detectNativeInstall found (before the window asked: it runs the package manager's query). */
  readonly nativeInstall: NativeInstall | null;
  /** Ends the app (Velopack waits for it; a native update starts the new version once it has ended). */
  readonly exit: () => void;
  /** One GET without redirects: electronGet(net) (the system's proxy settings). */
  readonly get: HttpGet;
  /** The latest released version, for a native update. */
  readonly latestVersion: () => Promise<string | null>;
  /** The app's executable to start again after a native update (the launcher /opt/<id>/<exe>) and its arguments. */
  readonly relaunch: { readonly executable: string; readonly args?: readonly string[]; readonly inheritOutput?: boolean };
  readonly log?: (line: string) => void;
}

/**
 * The app's own updates: Velopack's where Velopack installed it (Setup.exe, AppImage); otherwise, installed as a
 * native package, the package manager's; otherwise none (Velopack's, which then offers nothing).
 */
export function appSelfUpdate(o: AppSelfUpdateOptions): SelfUpdate {
  const velopack = new VelopackSelfUpdate(o.releasesRepo, o.packageId, o.exit);
  if (velopack.canUpdateItself || o.nativeInstall === null) return velopack;
  return new NativePackageSelfUpdate({
    releasesRepo: o.releasesRepo,
    packageId: o.packageId,
    currentVersion: o.currentVersion,
    install: o.nativeInstall,
    latestVersion: o.latestVersion,
    get: o.get,
    log: o.log,
    restart: () => {
      relaunchAfterExit(o.relaunch.executable, o.relaunch.args ?? [], process.pid, o.relaunch.inheritOutput === true);
      o.exit();
    },
  });
}
