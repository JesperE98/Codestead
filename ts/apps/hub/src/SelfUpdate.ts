import type { SelfUpdate } from "@codestead/ui";

/**
 * The hub's own updates (Velopack in C#). TODO(phase 5, packaging): the Electron hub cannot update itself yet; until
 * it can, a newer hub in the catalog is offered as a download (the C# hub does the same when it was installed by a
 * package manager).
 */
export const noSelfUpdate: SelfUpdate = {
  canUpdateItself: false,
  check: () => Promise.resolve(null),
  downloadAndRestart: () => Promise.reject(new Error("This build of the hub cannot update itself.")),
};
