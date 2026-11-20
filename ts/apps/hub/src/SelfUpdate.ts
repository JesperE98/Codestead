import type { SelfUpdate } from "@codestead/ui";

/**
 * "No updates" – for the tests (the app uses the preload's window.codestead.selfUpdate: the main process's updates).
 * A hub that cannot update itself (unpacked by hand, or a native package on a system without pkexec) offers a newer
 * hub in the catalog as a download (as the C# hub did when it was installed by a package manager).
 */
export const noSelfUpdate: SelfUpdate = {
  canUpdateItself: false,
  check: () => Promise.resolve(null),
  downloadAndRestart: () => Promise.reject(new Error("This build of the hub cannot update itself.")),
};
