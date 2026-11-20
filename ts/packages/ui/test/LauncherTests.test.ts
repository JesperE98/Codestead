// packaging/ts/launcher.sh, the Linux apps' executable: when it starts Electron with --no-sandbox. Run with sh against a
// fake system: /proc and /etc/apparmor.d are folders of the test (the launcher's two settings), `id` and `unshare` are
// fakes on the PATH, and Electron is a script that prints its arguments – or, started as Node (ELECTRON_RUN_AS_NODE),
// the AppArmor label it would get. A real kernel with AppArmor is a manual check (docs/RELEASE-CHECKLIST.md).
import { spawnSync } from "node:child_process";
import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { repoRoot } from "./repo.js";

const launcherSource = readFileSync(join(repoRoot(), "packaging", "ts", "launcher.sh"), "utf8");
const posix = process.platform === "linux";
const root = posix && process.getuid?.() === 0;

interface System {
  /** The user's id (`id -u`). */
  uid?: number;
  /** /proc/sys/kernel/apparmor_restrict_unprivileged_userns (null: the kernel has none). */
  restricted?: "0" | "1" | null;
  unprivilegedUsernsClone?: "0" | "1" | null;
  maxUserNamespaces?: string | null;
  /** Whether `unshare --user --map-root-user true` works. */
  unshare?: boolean;
  /** The launcher's own AppArmor label (/proc/self/attr/current). */
  label?: string;
  /** The label Electron gets when it starts (what the probe prints). */
  binLabel?: string;
  /** Files in /etc/apparmor.d. */
  profiles?: string[];
  /** chrome-sandbox setuid root (only possible as root). */
  setuidHelper?: boolean;
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function write(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { mode });
}

/** Installs the app (the filled launcher next to a fake Electron) on a fake system and starts it. */
function start(system: System, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "codestead-launcher-"));
  dirs.push(dir);
  const proc = join(dir, "proc");
  const apparmor = join(dir, "apparmor.d");
  const app = join(dir, "app");
  const bin = join(dir, "bin");

  const filled = launcherSource
    .replaceAll("${PKG_DISPLAY_NAME}", "Codestead Test")
    .replaceAll("${PKG_EXECUTABLE}", "Codestead.Test")
    .replaceAll("${PKG_NAME}", "codestead-test");
  const pointed = filled.replace(/^proc=\/proc$/m, `proc=${proc}`).replace(/^apparmor_d=\/etc\/apparmor\.d$/m, `apparmor_d=${apparmor}`);
  expect(pointed).not.toBe(filled);
  expect(pointed).toContain(`proc=${proc}\napparmor_d=${apparmor}\n`);
  write(join(app, "Codestead.Test"), pointed, 0o755);
  write(
    join(app, "Codestead.Test.bin"),
    `#!/bin/sh
if [ "$ELECTRON_RUN_AS_NODE" = 1 ]; then
  echo "$*" >> "${dir}/probes"
  printf '%s\\n' "$FAKE_BIN_LABEL"
  exit 0
fi
for a in "$@"; do printf '[%s]' "$a"; done
`,
    0o755,
  );
  write(join(app, "chrome-sandbox"), "", 0o755);
  if (system.setuidHelper) {
    chownSync(join(app, "chrome-sandbox"), 0, 0);
    chmodSync(join(app, "chrome-sandbox"), 0o4755);
  }

  const sysctl = (name: string, value: string | null | undefined) => {
    if (value != null) write(join(proc, "sys", name), value + "\n");
  };
  sysctl("kernel/apparmor_restrict_unprivileged_userns", system.restricted === undefined ? "0" : system.restricted);
  sysctl("kernel/unprivileged_userns_clone", system.unprivilegedUsernsClone);
  sysctl("user/max_user_namespaces", system.maxUserNamespaces === undefined ? "63379" : system.maxUserNamespaces);
  write(join(proc, "self", "attr", "current"), (system.label ?? "unconfined") + "\n");
  mkdirSync(apparmor, { recursive: true });
  for (const p of system.profiles ?? []) write(join(apparmor, p), "profile …\n");

  write(join(bin, "id"), `#!/bin/sh\necho ${system.uid ?? 1000}\n`, 0o755);
  write(join(bin, "unshare"), `#!/bin/sh\nexit ${system.unshare === false ? 1 : 0}\n`, 0o755);

  const r = spawnSync(join(app, "Codestead.Test"), args, {
    encoding: "utf8",
    env: { PATH: `${bin}:/usr/bin:/bin`, FAKE_BIN_LABEL: system.binLabel ?? "unconfined" },
  });
  expect(r.stderr).toBe("");
  expect(r.status).toBe(0);
  const probes = existsSync(join(dir, "probes")) ? readFileSync(join(dir, "probes"), "utf8").trim().split("\n") : [];
  return { args: r.stdout, sandbox: !r.stdout.startsWith("[--no-sandbox]"), probes };
}

describe.runIf(posix)("LauncherTests", () => {
  it("startar med sandlådan där användarnamnrymder fungerar, och skickar argumenten vidare orörda", () => {
    const r = start({}, ["--smoke-test", "a b", "*"]);
    expect(r.args).toBe("[--smoke-test][a b][*]");
    expect(r.probes).toEqual([]);
  });

  it("utan sandlåda som root, när namnrymderna är avstängda eller inte fungerar", () => {
    expect(start({ uid: 0 }, ["x"]).args).toBe("[--no-sandbox][x]");
    expect(start({ unprivilegedUsernsClone: "0" }).sandbox).toBe(false);
    expect(start({ unprivilegedUsernsClone: "1" }).sandbox).toBe(true);
    expect(start({ maxUserNamespaces: "0" }).sandbox).toBe(false);
    expect(start({ unshare: false }).sandbox).toBe(false);
    // A kernel without Ubuntu's restriction (the file is missing): as before.
    expect(start({ restricted: null }).sandbox).toBe(true);
  });

  it("AppArmor begränsar namnrymderna: utan sandlåda när ingen Codestead-profil finns – och då startas Electron bara en gång", () => {
    const r = start({ restricted: "1", profiles: ["Discord", "codestead-user-1001"] });
    expect(r.sandbox).toBe(false);
    expect(r.probes).toEqual([]);
  });

  it("paketets profil eller användarens profil: sandlådan när Electron verkligen får en Codestead-profil", () => {
    const pkg = start({ restricted: "1", profiles: ["codestead-test"], binLabel: "codestead-test (unconfined)" }, ["y"]);
    expect(pkg.args).toBe("[y]");
    expect(pkg.probes).toHaveLength(1);
    expect(pkg.probes[0]).toMatch(/^-e .*\/proc\/self\/attr\/apparmor\/current/);
    expect(start({ restricted: "1", profiles: ["codestead-user-1000"], binLabel: "codestead-user-1000 (unconfined)" }).sandbox).toBe(true);
    // The profile names another path (the package's /opt/<id>/, while this is a copy elsewhere), or it is not loaded.
    expect(start({ restricted: "1", profiles: ["codestead-test"], binLabel: "unconfined" }).sandbox).toBe(false);
    expect(start({ restricted: "1", profiles: ["codestead-user-1000"], binLabel: "" }).sandbox).toBe(false);
    // Another program's profile is not enough.
    expect(start({ restricted: "1", profiles: ["codestead-test"], binLabel: "Discord (unconfined)" }).sandbox).toBe(false);
  });

  it("startad av en Codestead-app med profil (hubben som paket) behåller verktyget den profilen", () => {
    const r = start({ restricted: "1", label: "codestead-hub (unconfined)" });
    expect(r.sandbox).toBe(true);
    expect(r.probes).toEqual([]);
    expect(start({ restricted: "1", label: "snap.firefox.firefox (enforce)" }).sandbox).toBe(false);
    // The user namespaces themselves switched off: no profile helps.
    expect(start({ restricted: "1", label: "codestead-hub (unconfined)", unprivilegedUsernsClone: "0" }).sandbox).toBe(false);
  });

  it.runIf(root)("den setuid-märkta hjälpen räcker alltid (paketen)", () => {
    expect(start({ restricted: "1", setuidHelper: true }).sandbox).toBe(true);
    expect(start({ unshare: false, setuidHelper: true }).sandbox).toBe(true);
    expect(start({ uid: 0, setuidHelper: true }).sandbox).toBe(false);
  });
});
