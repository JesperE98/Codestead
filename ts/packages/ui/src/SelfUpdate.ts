/**
 * An app's own updates (C#'s SelfUpdate, which uses Velopack). Installed so that it can update itself, the app
 * downloads and applies a newer version; installed by a package manager or the hub, something else owns the files and
 * {@link canUpdateItself} is false. The Electron apps implement it; the learning window only offers the update.
 */
export interface SelfUpdate {
  /** True when the app can download and apply its own updates. */
  readonly canUpdateItself: boolean;
  /** The newer version available, or null. */
  check(): Promise<string | null>;
  downloadAndRestart(progress: (percent: number) => void): Promise<void>;
}
