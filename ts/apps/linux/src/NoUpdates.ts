// The app's own updates (C#: SelfUpdate with Velopack). TODO(phase 5): packaging and updates are a separate step
// (electron-builder and an updater, see docs/TYPESCRIPT-MIGRATION.md); until then the app never offers an update –
// the hub or the package manager keeps it up to date.

import type { SelfUpdate } from "@codestead/ui";

/** "No updates": the app cannot update itself (the learning window then makes no offer). */
export const NoUpdates: SelfUpdate = {
  canUpdateItself: false,
  check: () => Promise.resolve(null),
  downloadAndRestart: () => Promise.reject(new Error("This build cannot update itself.")),
};
