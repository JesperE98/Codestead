import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Runs reg.exe and returns its output; throws when it fails (tests pass their own). */
export type RegistryCommand = (args: readonly string[]) => string;

const runReg: RegistryCommand = (args) => execFileSync("reg", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });

/**
 * Starting an app when the user logs in: on Windows a value under HKCU\Software\Microsoft\Windows\CurrentVersion\Run,
 * on Linux a .desktop file in ~/.config/autostart (the freedesktop autostart standard).
 */
export class Autostart {
  private static readonly RunKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

  constructor(
    private readonly appId: string,
    private readonly configHome: string | null = null,
    private readonly platform: string = process.platform,
    private readonly env: Readonly<Record<string, string | undefined>> = process.env,
    private readonly reg: RegistryCommand = runReg,
  ) {}

  /** The Linux autostart file. */
  get desktopFile(): string {
    return join(this.configDir, "autostart", this.appId + ".desktop");
  }

  private get configDir(): string {
    if (this.configHome !== null) return this.configHome;
    const xdg = this.env.XDG_CONFIG_HOME;
    return xdg ? xdg : join(homedir(), ".config");
  }

  /** Starting at login is possible on this system. */
  static supported(platform: string = process.platform): boolean {
    return platform === "win32" || platform === "linux";
  }

  private get windows(): boolean {
    return this.platform === "win32";
  }

  get isEnabled(): boolean {
    return this.windows ? this.windowsValue() !== null : existsSync(this.desktopFile);
  }

  /** Starts `executable` with `args` at login. */
  enable(name: string, executable: string, args: string): void {
    if (this.windows) {
      this.setWindowsValue(`"${executable}" ${args}`.trimEnd());
      return;
    }
    mkdirSync(dirname(this.desktopFile), { recursive: true });
    writeFileSync(
      this.desktopFile,
      ["[Desktop Entry]", "Type=Application", `Name=${name}`, `Exec=${quote(executable)} ${args}`, "X-GNOME-Autostart-enabled=true", "NoDisplay=true", ""].join("\n"),
    );
  }

  disable(): void {
    if (this.windows) {
      this.setWindowsValue(null);
      return;
    }
    if (existsSync(this.desktopFile)) rmSync(this.desktopFile);
  }

  /** The value under the Run key, or null (reg query fails when there is none). */
  private windowsValue(): string | null {
    try {
      const out = this.reg(["query", Autostart.RunKey, "/v", this.appId]);
      const line = out.split(/\r?\n/).find((l) => l.trim().startsWith(this.appId + " ") || l.trim().startsWith(this.appId + "\t"));
      const m = line?.match(/REG_\w+\s+(.*)$/);
      return m ? m[1]! : null;
    } catch {
      return null;
    }
  }

  private setWindowsValue(value: string | null): void {
    if (value === null) {
      // DeleteValue(…, throwOnMissingValue: false)
      try {
        this.reg(["delete", Autostart.RunKey, "/v", this.appId, "/f"]);
      } catch {
        // Not there.
      }
    } else {
      this.reg(["add", Autostart.RunKey, "/v", this.appId, "/t", "REG_SZ", "/d", value, "/f"]);
    }
  }
}

/** A path for the Exec line of a .desktop file (quoted when it has spaces). */
function quote(path: string): string {
  return path.includes(" ") ? `"${path.replaceAll('"', '\\"')}"` : path;
}
