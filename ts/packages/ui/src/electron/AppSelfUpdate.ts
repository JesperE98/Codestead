// The apps' main processes import their updates from here ("@codestead/ui/electron-main"): Velopack (VelopackUpdate.ts)
// where it installed the app, the system's package manager (NativePackageUpdate.ts) where the app is a .deb, .rpm or
// Arch package, and nothing for the hub's per-user copies (the hub updates those).

import type { KeyObject } from "node:crypto";
import type { SelfUpdate } from "../SelfUpdate.js";
import { type HttpGet, latestFromSignedCatalog, type NativeInstall, NativePackageSelfUpdate, relaunchAfterExit } from "./NativePackageUpdate.js";
import { catalogPublicKey } from "./SignedCatalog.js";
import { VelopackSelfUpdate } from "./VelopackUpdate.js";

export * from "./NativePackageUpdate.js";
export * from "./SignedCatalog.js";
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
  /**
   * The public key of the signed catalog built into the app (build/catalog-signing.pub.pem, PEM), never one from the
   * command line or the environment: a native update takes its version and the package's SHA-256 only from a catalog
   * signed with it. Null (a build without the key): the app offers no native update.
   */
  readonly catalogPublicKey: string | null;
  /** Ends the app (Velopack waits for it; a native update starts the new version once it has ended). */
  readonly exit: () => void;
  /** One GET without redirects: electronGet(net) (the system's proxy settings). */
  readonly get: HttpGet;
  /** The app's executable to start again after a native update (the launcher /opt/<id>/<exe>) and its arguments. */
  readonly relaunch: { readonly executable: string; readonly args?: readonly string[]; readonly inheritOutput?: boolean };
  readonly log?: (line: string) => void;
}

function keyOf(pem: string | null): KeyObject | null {
  try {
    return catalogPublicKey(pem);
  } catch {
    return null;
  }
}

/**
 * The app's own updates: Velopack's where Velopack installed it (Setup.exe, AppImage); otherwise, installed as a
 * native package and with the catalog's key built in, the package manager's; otherwise none (Velopack's, which then
 * offers nothing).
 */
export function appSelfUpdate(o: AppSelfUpdateOptions): SelfUpdate {
  const velopack = new VelopackSelfUpdate(o.releasesRepo, o.packageId, o.exit);
  const key = keyOf(o.catalogPublicKey);
  if (velopack.canUpdateItself || o.nativeInstall === null || key === null) return velopack;
  return new NativePackageSelfUpdate({
    releasesRepo: o.releasesRepo,
    packageId: o.packageId,
    currentVersion: o.currentVersion,
    install: o.nativeInstall,
    latestRelease: () => latestFromSignedCatalog(o.get, o.releasesRepo, key, o.packageId),
    get: o.get,
    log: o.log,
    restart: () => {
      relaunchAfterExit(o.relaunch.executable, o.relaunch.args ?? [], process.pid, o.relaunch.inheritOutput === true);
      o.exit();
    },
  });
}
