import { spawnSync } from "node:child_process";

/** Runs a program and returns its exit code and standard output (null when it could not be started). */
export type RunProgram = (command: string, args: readonly string[], timeoutMs: number) => { exitCode: number | null; output: string } | null;

const run: RunProgram = (command, args, timeoutMs) => {
  const r = spawnSync(command, args, { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") return null;
  return { exitCode: r.status, output: r.stdout ?? "" };
};

/**
 * Whether the desktop shows tray icons. Windows and macOS always do; on Linux the desktop needs a
 * StatusNotifierItem host (KDE, Cinnamon, XFCE … do; GNOME only with the AppIndicator extension).
 */
export const TraySupport = {
  /** Asks once, like C#'s Lazy. */
  available(platform: string = process.platform, runProgram: RunProgram = run): boolean {
    if (platform === process.platform && runProgram === run) return (cached ??= detect(platform, runProgram));
    return detect(platform, runProgram);
  },
};

let cached: boolean | undefined;

function detect(platform: string, runProgram: RunProgram): boolean {
  if (platform !== "linux") return true;
  try {
    const r = runProgram(
      "dbus-send",
      ["--session", "--print-reply", "--dest=org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus.NameHasOwner", "string:org.kde.StatusNotifierWatcher"],
      2000,
    );
    if (r === null || r.exitCode === null) return false; // not started, or it did not answer in time
    return r.exitCode === 0 && r.output.includes("boolean true");
  } catch {
    return false; // no dbus-send: assume no tray, so the hub never hides where it cannot be found
  }
}
