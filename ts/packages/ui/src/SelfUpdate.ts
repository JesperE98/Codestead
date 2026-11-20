/**
 * An app's own updates (C#'s SelfUpdate, which uses Velopack). Installed so that it can update itself (Setup.exe, an
 * AppImage: Velopack; a .deb/.rpm/Arch package on Linux: the system's package manager through pkexec), the app
 * downloads and applies a newer version; installed by the hub (or unpacked by hand), something else owns the files and
 * {@link canUpdateItself} is false. The Electron apps implement it; the windows only offer the update.
 */
export interface SelfUpdate {
  /** True when the app can download and apply its own updates. */
  readonly canUpdateItself: boolean;
  /** True when installing the update asks for the user's password (a native package: pkexec). */
  readonly asksForPassword?: boolean;
  /** The newer version available, or null. */
  check(): Promise<string | null>;
  /**
   * Downloads and installs the update, then restarts the app (or rejects with the reason it could not). Progress:
   * 0-100 while downloading, -1 while the system installs it.
   */
  downloadAndRestart(progress: (percent: number) => void): Promise<void>;
}
