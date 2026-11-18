import type { SelfUpdate } from "@codestead/ui";

/**
 * "No updates" – for the tests (the app uses the preload's window.codestead.selfUpdate: Velopack in the main process).
 * A hub that cannot update itself offers a newer hub in the catalog as a download (as the C# hub does when it was
 * installed by a package manager).
 */
export const noSelfUpdate: SelfUpdate = {
  canUpdateItself: false,
  check: () => Promise.resolve(null),
  downloadAndRestart: () => Promise.reject(new Error("This build of the hub cannot update itself.")),
};
