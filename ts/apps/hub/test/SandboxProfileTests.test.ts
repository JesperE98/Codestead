// Chromium's sandbox for the hub's tools where AppArmor restricts user namespaces (core/SandboxProfile.ts): when the hub
// offers it, the profile's text and paths, the pkexec command, and the root script itself – run here with sh as this
// user, with a fake apparmor_parser and a temporary folder for /etc/apparmor.d. Where AppArmor 4's real parser is
// installed (Ubuntu 24.04, the CI runners), it checks the profiles too. Loading them into a kernel and starting a tool
// with the sandbox is a manual check (docs/RELEASE-CHECKLIST.md).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  attachPattern,
  enableFailure,
  enableSandbox,
  isProfilePath,
  isSandboxTool,
  profileTemplate,
  type SandboxEnvironment,
  SandboxError,
  sandboxInstallScript,
  sandboxStatus,
  sandboxTools,
  scriptArgs,
  userProfileName,
  userProfileText,
} from "../src/core/SandboxProfile.js";

const tools = [
  { id: "codestead-linux", exe: "Codestead.Linux" },
  { id: "codestead-gp", exe: "Codestead.GP" },
];
const root = "/home/alice/.local/share/codestead";

/** A Linux system with the restriction on, pkexec and AppArmor 4, the hub without a profile; `files` changes it. */
function env(files: Record<string, string | null> = {}, o: Partial<Pick<SandboxEnvironment, "platform" | "uid">> = {}): SandboxEnvironment & { files: Record<string, string | null> } {
  const all: Record<string, string | null> = {
    "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1\n",
    "/proc/self/attr/current": "unconfined\n",
    "/etc/apparmor.d/abi/4.0": "",
    ...files,
  };
  return {
    files: all,
    platform: o.platform ?? "linux",
    uid: o.uid ?? 1000,
    home: "/home/alice",
    readFile: (p) => all[p] ?? null,
    // The home folder's folders exist, except new/; /home/alice/link points to /tmp/elsewhere.
    realpath: (p) => {
      if (p === "/home/alice/link" || p.startsWith("/home/alice/link/")) return "/tmp/elsewhere" + p.slice("/home/alice/link".length);
      if (p.startsWith("/home/alice/new")) return null;
      return p === "/" || p === "/home" || p === "/home/alice" || p.startsWith("/home/alice/") ? p : null;
    },
    findTool: (n) => (n === "pkexec" || n === "apparmor_parser" ? `/usr/bin/${n}` : null),
    exists: (p) => all[p] !== undefined && all[p] !== null,
  };
}

describe("SandboxProfileTests", () => {
  it("profilen täcker bara Codesteads Electron-filer i användarens verktygsmapp", () => {
    expect(userProfileName(1000)).toBe("codestead-user-1000");
    expect(attachPattern(tools)).toBe("{codestead-linux/[0-9]*/Codestead.Linux.bin,codestead-gp/[0-9]*/Codestead.GP.bin}");
    expect(attachPattern(tools.slice(0, 1))).toBe("codestead-linux/[0-9]*/Codestead.Linux.bin");
    const text = userProfileText(1000, root, tools);
    expect(text).toContain("abi <abi/4.0>,\ninclude <tunables/global>\n");
    expect(text).toContain(
      "\nprofile codestead-user-1000 /home/alice/.local/share/codestead/tools/{codestead-linux/[0-9]*/Codestead.Linux.bin,codestead-gp/[0-9]*/Codestead.GP.bin} flags=(unconfined) {\n  userns,\n",
    );
    expect(text).toContain("  include if exists <local/codestead-user-1000>\n}\n");
    // Every line that is not a comment, a blank line or the profile's own: nothing else is allowed or changed.
    const rules = text.split("\n").filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
    expect(rules).toEqual(["abi <abi/4.0>,", "include <tunables/global>", expect.stringMatching(/^profile codestead-user-1000 /), "  userns,", "  include if exists <local/codestead-user-1000>", "}"]);
  });

  it("mallen har inget som skriptets here-dokument skulle tolka, utom de tre platshållarna", () => {
    const rest = profileTemplate.replaceAll("${uid}", "").replaceAll("${root}", "").replaceAll("${attach}", "");
    expect(rest).not.toMatch(/[$`\\]/);
  });

  it("verktygen kommer ur products.json, utan hubben", () => {
    expect(sandboxTools()).toEqual(expect.arrayContaining(tools));
    expect(sandboxTools().map((t) => t.id)).not.toContain("codestead-hub");
    expect(sandboxTools().every(isSandboxTool)).toBe(true);
    expect(isSandboxTool({ id: "evil", exe: "Codestead.X" })).toBe(false);
    expect(isSandboxTool({ id: "codestead-x", exe: "bash" })).toBe(false);
    expect(isSandboxTool({ id: "codestead-x", exe: "Codestead.X/../y" })).toBe(false);
  });

  it("bara vanliga absoluta sökvägar utan mönster, variabler eller citattecken", () => {
    for (const ok of [root, "/home/a/b-c_d.e", "/x"]) expect(isProfilePath(ok), ok).toBe(true);
    for (const bad of ["", "/", "relative/x", "/a//b", "/a/./b", "/a/../b", "/a/..", "/a/b/", "/a b", "/a/*", "/a/{b,c}", "/a/@{HOME}", '/a/"b"', "/a,b", "/a/[0-9]", "/a\nb", "/a/ü"]) {
      expect(isProfilePath(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("när hubben erbjuder sandlådan", () => {
    expect(sandboxStatus(env(), root, tools)).toEqual({ state: "off", profile: "/etc/apparmor.d/codestead-user-1000" });
    // Not needed: Windows, root (no sandbox anyway), no restriction (or a kernel without it).
    expect(sandboxStatus(env({}, { platform: "win32" }), root, tools).state).toBe("not-needed");
    expect(sandboxStatus(env({}, { uid: 0 }), root, tools).state).toBe("not-needed");
    expect(sandboxStatus(env({ "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "0\n" }), root, tools).state).toBe("not-needed");
    expect(sandboxStatus(env({ "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": null }), root, tools).state).toBe("not-needed");
    // The hub runs under its package's profile: the tools it starts keep it.
    expect(sandboxStatus(env({ "/proc/self/attr/apparmor/current": "codestead-hub (unconfined)\n" }), root, tools).state).toBe("inherited");
    expect(sandboxStatus(env({ "/proc/self/attr/current": "codestead-hub (unconfined)\n" }), root, tools).state).toBe("inherited");
    // Installed, as the hub would write it now; another folder or another list of tools: off again.
    const on = env({ "/etc/apparmor.d/codestead-user-1000": userProfileText(1000, root, tools) });
    expect(sandboxStatus(on, root, tools)).toEqual({ state: "on", profile: "/etc/apparmor.d/codestead-user-1000" });
    expect(sandboxStatus(on, "/home/alice/other", tools).state).toBe("off");
    expect(sandboxStatus(on, root, tools.slice(0, 1)).state).toBe("off");
    // A data folder that does not exist yet: its real path from the folders that do.
    expect(sandboxStatus(env(), "/home/alice/new/codestead", tools).state).toBe("off");
  });

  it("inte tillgänglig: utan pkexec, utan AppArmor 4 eller med en mapp som profilen inte ska nämna", () => {
    const noPkexec = { ...env(), findTool: (n: string) => (n === "apparmor_parser" ? "/usr/sbin/apparmor_parser" : null) };
    expect(sandboxStatus(noPkexec, root, tools).state).toBe("unavailable");
    const noParser = { ...env(), findTool: (n: string) => (n === "pkexec" ? "/usr/bin/pkexec" : null) };
    expect(sandboxStatus(noParser, root, tools).state).toBe("unavailable");
    expect(sandboxStatus(env({ "/etc/apparmor.d/abi/4.0": null }), root, tools).state).toBe("unavailable");
    // Outside the home folder (CODESTEAD_HUB_DIR=/tmp/…), through a link out of it, the home itself, odd characters.
    expect(sandboxStatus(env(), "/tmp/codestead", tools).state).toBe("unavailable");
    expect(sandboxStatus(env(), "/home/alice/link/codestead", tools).state).toBe("unavailable");
    expect(sandboxStatus(env(), "/home/alice", tools).state).toBe("unavailable");
    expect(sandboxStatus(env(), "/home/alice/my data", tools).state).toBe("unavailable");
    expect(sandboxStatus(env(), root, []).state).toBe("unavailable");
    expect(sandboxStatus(env(), root, [{ id: "evil", exe: "sh" }]).state).toBe("unavailable");
  });

  it("vad användaren får veta när pkexec inte gick", () => {
    const r = (code: number | null, stderr = "", missing?: boolean) => ({ code, stdout: "", stderr, missing });
    expect(enableFailure(r(0))).toBeNull();
    expect(enableFailure(r(126))?.message).toBe("The password dialog was closed, so nothing was changed.");
    expect(enableFailure(r(127, "Error executing command as another user: No authentication agent found."))?.message).toMatch(/polkit authentication agent/);
    expect(enableFailure(r(127, "Not authorized"))?.message).toBe("It was not allowed: Not authorized");
    expect(enableFailure(r(3, "codestead-sandbox: other users can write in /home/alice"))?.message).toBe(
      "Installing the AppArmor profile ended with code 3: codestead-sandbox: other users can write in /home/alice",
    );
    expect(enableFailure(r(null, "", true))?.message).toBe("pkexec could not be started.");
  });

  it("slår på med pkexec och skriptet som fasta argument, och läser sedan av profilen", async () => {
    const e = env();
    const calls: { file: string; args: readonly string[] }[] = [];
    const made: string[] = [];
    const status = await enableSandbox(root, {
      env: e,
      tools,
      makeFolder: (p) => made.push(p),
      run: async (file, args) => {
        calls.push({ file, args });
        e.files["/etc/apparmor.d/codestead-user-1000"] = userProfileText(1000, root, tools);
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    expect(status.state).toBe("on");
    expect(made).toEqual([`${root}/tools`]);
    expect(calls).toEqual([{ file: "/usr/bin/pkexec", args: ["/bin/sh", "-c", sandboxInstallScript(), "codestead-sandbox", root, "codestead-linux", "Codestead.Linux", "codestead-gp", "Codestead.GP"] }]);
    // Cancelled: an error, nothing installed.
    const cancelled = env();
    await expect(enableSandbox(root, { env: cancelled, tools, run: async () => ({ code: 126, stdout: "", stderr: "" }) })).rejects.toThrow(SandboxError);
    // Not offered: nothing is run.
    let ran = false;
    const run = async () => ((ran = true), { code: 0, stdout: "", stderr: "" });
    await expect(enableSandbox("/tmp/codestead", { env: env(), tools, run })).rejects.toThrow(/cannot be turned on here \(unavailable\)/);
    expect(ran).toBe(false);
  });
});

// ---------- The root script, run with sh ----------

describe("SandboxProfileTests – skriptet", () => {
  const uid = process.getuid?.() ?? -1;
  const posix = process.platform === "linux" && uid >= 0;
  const cleanup: string[] = [];
  afterEach(() => {
    for (const d of cleanup.splice(0)) {
      chmodSync(d, 0o700);
      rmSync(d, { recursive: true, force: true });
    }
  });

  /** A data folder in the real home (the script only accepts those), /etc/apparmor.d and a fake apparmor_parser. */
  function setUp(parser = 'echo "$*" >> "$(dirname "$0")/parser.log"\nexit 0') {
    const data = realpathSync(mkdtempSync(join(homedir(), ".codestead-sandbox-test-")));
    const work = realpathSync(mkdtempSync(join(tmpdir(), "codestead-sandbox-")));
    cleanup.push(data, work);
    chmodSync(data, 0o755);
    const etc = join(work, "apparmor.d");
    mkdirSync(etc);
    const fake = join(work, "apparmor_parser");
    writeFileSync(fake, `#!/bin/sh\n${parser}\n`, { mode: 0o755 });
    return { data, work, etc, fake, log: join(work, "parser.log") };
  }

  function run(s: ReturnType<typeof setUp>, args: string[], pkexecUid: string | null = String(uid)) {
    const script = sandboxInstallScript({ profileDir: s.etc, parsers: ["/nonexistent/apparmor_parser", s.fake] });
    const environment: NodeJS.ProcessEnv = { ...process.env, TMPDIR: s.work };
    delete environment.PKEXEC_UID;
    if (pkexecUid !== null) environment.PKEXEC_UID = pkexecUid;
    return spawnSync("/bin/sh", ["-c", script, "codestead-sandbox", ...args], { env: environment, encoding: "utf8" });
  }

  it.runIf(posix)("skriver profilen som hubben räknar med, kontrollerar den och laddar den", () => {
    const s = setUp();
    const r = run(s, scriptArgs(s.data, tools));
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    const file = join(s.etc, `codestead-user-${uid}`);
    expect(readFileSync(file, "utf8")).toBe(userProfileText(uid, s.data, tools));
    const log = readFileSync(s.log, "utf8").trim().split("\n");
    expect(log).toHaveLength(2);
    expect(log[0]).toMatch(/^--skip-kernel-load --skip-cache --quiet \//);
    expect(log[1]).toBe(`--replace --write-cache --skip-read-cache ${file}`);
    // One tool: no braces.
    expect(run(s, scriptArgs(s.data, tools.slice(0, 1))).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(userProfileText(uid, s.data, tools.slice(0, 1)));
  });

  it.runIf(posix)("vägrar mappar som andra kan skriva i, utanför hemmet, länkar och okända verktyg", () => {
    const s = setUp();
    const file = join(s.etc, `codestead-user-${uid}`);
    const refused = (args: string[], code: number, message: RegExp, pkexecUid?: string | null) => {
      const r = run(s, args, pkexecUid);
      expect(r.status, r.stderr).toBe(code);
      expect(r.stderr).toMatch(message);
      expect(existsSync(file)).toBe(false);
    };
    refused(scriptArgs(s.data, tools), 2, /PKEXEC_UID is not set/, null);
    refused(scriptArgs(s.data, tools), 2, /PKEXEC_UID is not set/, "1000; rm -rf /");
    refused([s.data], 2, /usage/);
    refused([s.data, "codestead-linux"], 2, /usage/);
    refused(scriptArgs(s.work, tools), 3, /is not in the home folder/);
    refused(scriptArgs(s.data + "/", tools), 3, /not a plain path/);
    refused(scriptArgs(s.data + "/../x", tools), 3, /not a plain path/);
    refused(scriptArgs(s.data + "/{a,b}", tools), 3, /not a plain path/);
    refused(scriptArgs("relative", tools), 3, /not an absolute path/);
    refused(scriptArgs(join(s.data, "missing"), tools), 3, /is not a folder/);
    // A link in the home folder to a folder elsewhere.
    symlinkSync(s.work, join(s.data, "link"));
    refused(scriptArgs(join(s.data, "link"), tools), 3, /is not the folder's real path/);
    // A folder on the way that other users can write in.
    mkdirSync(join(s.data, "shared", "codestead"), { recursive: true });
    chmodSync(join(s.data, "shared"), 0o777);
    refused(scriptArgs(join(s.data, "shared", "codestead"), tools), 3, /other users can write in .*\/shared$/m);
    // Another user's home: the data folder must be in PKEXEC_UID's own home and belong to that user.
    const other = uid === 0 ? "65534" : "0";
    refused(scriptArgs(s.data, tools), 3, /is not in the home folder|does not belong to user|has no home folder/, other);
    // Only Codestead's tools.
    refused([s.data, "evil", "Codestead.Linux"], 2, /not a Codestead tool/);
    refused([s.data, "codestead-", "Codestead.Linux"], 2, /not a Codestead tool/);
    refused([s.data, "codestead-linux/../x", "Codestead.Linux"], 2, /not a Codestead tool/);
    refused([s.data, "codestead-linux", "bash"], 2, /not a Codestead executable/);
    refused([s.data, "codestead-linux", "Codestead.Linux.bin,/**"], 2, /not a Codestead executable/);
    expect(existsSync(s.log)).toBe(false);
  });

  it.runIf(posix)("installerar ingenting som parsern inte godtar, och tar bort det som inte gick att ladda", () => {
    const refusing = setUp('case "$1" in --skip-kernel-load) echo "syntax error" >&2; exit 1 ;; esac\nexit 0');
    const r1 = run(refusing, scriptArgs(refusing.data, tools));
    expect(r1.status).toBe(5);
    expect(r1.stderr).toMatch(/AppArmor does not accept the profile \(AppArmor 4 is needed\): syntax error/);
    expect(existsSync(join(refusing.etc, `codestead-user-${uid}`))).toBe(false);
    const failing = setUp('case "$1" in --replace) exit 1 ;; esac\nexit 0');
    const r2 = run(failing, scriptArgs(failing.data, tools));
    expect(r2.status).toBe(6);
    expect(existsSync(join(failing.etc, `codestead-user-${uid}`))).toBe(false);
    // No parser at all.
    const none = setUp();
    rmSync(none.fake);
    expect(run(none, scriptArgs(none.data, tools)).status).toBe(4);
  });
});

// ---------- AppArmor's own parser, where it is installed ----------

const realParser = ["/usr/sbin/apparmor_parser", "/sbin/apparmor_parser"].find((p) => existsSync(p));
const parserReady = realParser !== undefined && existsSync("/etc/apparmor.d/abi/4.0") && existsSync("/etc/apparmor.d/tunables/global");

describe("SandboxProfileTests – AppArmors parser", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const parse = (text: string) => {
    const dir = mkdtempSync(join(tmpdir(), "codestead-profile-"));
    dirs.push(dir);
    writeFileSync(join(dir, "profile"), text);
    return spawnSync(realParser!, ["--skip-kernel-load", "--skip-cache", "--quiet", join(dir, "profile")], { encoding: "utf8" });
  };

  it.runIf(parserReady)("godtar användarens profil och paketens profil", () => {
    const user = parse(userProfileText(1000, root, sandboxTools()));
    expect(user.status, user.stderr).toBe(0);
    const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
    const native = readFileSync(join(repo, "packaging", "ts", "apparmor-profile"), "utf8")
      .replaceAll("${PKG_NAME}", "codestead-hub")
      .replaceAll("${PKG_DISPLAY_NAME}", "Codestead")
      .replaceAll("${PKG_EXECUTABLE}", "Codestead.Hub");
    const r = parse(native);
    expect(r.status, r.stderr).toBe(0);
    expect(parse(native.replace("userns,", "userns, nonsense")).status).not.toBe(0);
  });
});
