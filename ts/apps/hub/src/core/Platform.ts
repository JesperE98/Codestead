import { homedir } from "node:os";
import { join, win32 } from "node:path";

/** What the platform functions look at (the real process by default; tests pass their own). */
export interface PlatformInfo {
  /** process.platform */
  platform: string;
  /** process.arch (C# looks at the OS's architecture; an x64 Electron build runs on x64 systems only). */
  arch: string;
  env: Readonly<Record<string, string | undefined>>;
  home: string;
}

export function currentPlatform(): PlatformInfo {
  return { platform: process.platform, arch: process.arch, env: process.env, home: homedir() };
}

export const Platform = {
  /** The runtime id of this machine as used in the catalog ("win-x64", "linux-x64"), or null if unsupported. */
  rid(p: PlatformInfo = currentPlatform()): string | null {
    if (p.arch !== "x64") return null;
    if (p.platform === "win32") return "win-x64";
    if (p.platform === "linux") return "linux-x64";
    return null;
  },

  /**
   * Where the hub keeps installed tools: %LOCALAPPDATA%\Codestead on Windows,
   * $XDG_DATA_HOME/codestead (~/.local/share/codestead) on Linux. CODESTEAD_HUB_DIR overrides it.
   */
  dataRoot(p: PlatformInfo = currentPlatform()): string {
    const overridden = p.env.CODESTEAD_HUB_DIR;
    if (overridden) return overridden;
    if (p.platform === "win32") {
      // Environment.SpecialFolder.LocalApplicationData
      const local = p.env.LOCALAPPDATA || win32.join(p.home, "AppData", "Local");
      return win32.join(local, "Codestead");
    }
    const xdg = p.env.XDG_DATA_HOME;
    const baseDir = xdg ? xdg : join(p.home, ".local", "share");
    return join(baseDir, "codestead");
  },
};
