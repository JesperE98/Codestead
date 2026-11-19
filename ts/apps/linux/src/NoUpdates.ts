// "No updates" – the tool's SelfUpdate where there is no Electron main process (the page in a browser, the tests). In
// the app, the preload's window.codestead.selfUpdate (Velopack in the main process, @codestead/ui/electron-main) is used.

import type { SelfUpdate } from "@codestead/ui";

/** "No updates": the app cannot update itself (the learning window then makes no offer). */
export const NoUpdates: SelfUpdate = {
  canUpdateItself: false,
  check: () => Promise.resolve(null),
  downloadAndRestart: () => Promise.reject(new Error("This build cannot update itself.")),
};
