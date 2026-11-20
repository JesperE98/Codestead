// The updates of an app installed as a .deb, .rpm or Arch package (NativePackageUpdate.ts): which installations are
// native packages, which file of the release is this system's, the release's checksums, the package manager's command
// line (through pkexec, or as root without it) and what the user is told when it does not work. The package manager,
// pkexec and GitHub are fakes here; packaging/native-update-test.sh runs the real ones in containers.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appSelfUpdate } from "../src/electron/AppSelfUpdate.js";
import {
  checksumFor,
  type CommandResult,
  detectNativeInstall,
  type DetectEnvironment,
  type FetchLike,
  findSystemTool,
  installCommand,
  installFailure,
  isAllowedDownloadUrl,
  isNewerVersion,
  latestFromVelopackFeed,
  type NativeInstall,
  NativePackageSelfUpdate,
  nativePackageAsset,
  NativeUpdateError,
  type NativeUpdateOptions,
  relaunchAfterExit,
  releaseAssetUrl,
  type RunCommand,
} from "../src/electron/NativePackageUpdate.js";
import { remoteMessage, SelfUpdateChannels, selfUpdateBridge } from "../src/electron/SelfUpdateBridge.js";
import { VelopackSelfUpdate } from "../src/electron/VelopackUpdate.js";

const repo = "JesperE98/codestead-releases";
const id = "codestead-hub";

/** A fake execFile: answers by program name, records every call. */
function fakeRun(answers: Record<string, CommandResult>): { run: RunCommand; calls: string[][] } {
  const calls: string[][] = [];
  const run: RunCommand = (file, args) => {
    calls.push([file, ...args]);
    return Promise.resolve(answers[file.split("/").pop()!] ?? { code: null, stdout: "", stderr: "not found", missing: true });
  };
  return { run, calls };
}

/** The system's programs: these exist in /usr/bin. */
const tools =
  (...names: string[]) =>
  (name: string) =>
    names.includes(name) ? `/usr/bin/${name}` : null;

function env(over: Partial<DetectEnvironment> & { answers?: Record<string, CommandResult>; tools?: string[] }): { env: DetectEnvironment; calls: string[][] } {
  const { run, calls } = fakeRun(over.answers ?? {});
  return {
    env: { platform: "linux", execPath: `/opt/${id}/Codestead.Hub.bin`, run, findTool: tools(...(over.tools ?? ["dpkg-query", "rpm", "pacman"])), ...over },
    calls,
  };
}

const ok = (stdout: string): CommandResult => ({ code: 0, stdout, stderr: "" });
const notInstalled: CommandResult = { code: 1, stdout: "", stderr: "not installed" };

describe("NativePackageUpdateTests: installationen", () => {
  it("en .deb: dpkg-query säger att paketet är installerat", async () => {
    const { env: e, calls } = env({ answers: { "dpkg-query": ok("install ok installed\t0.2.6") } });
    expect(await detectNativeInstall(id, e)).toEqual({ kind: "deb", version: "0.2.6" });
    expect(calls).toEqual([["/usr/bin/dpkg-query", "-W", "--showformat=${Status}\\t${Version}", id]]);
  });

  it("en .rpm: rpm -q, när dpkg inte har paketet (Debian kan ha rpm och tvärtom)", async () => {
    const { env: e, calls } = env({ answers: { "dpkg-query": { code: 1, stdout: "", stderr: "no packages found" }, rpm: ok("0.2.6") } });
    expect(await detectNativeInstall(id, e)).toEqual({ kind: "rpm", version: "0.2.6" });
    expect(calls[1]).toEqual(["/usr/bin/rpm", "-q", "--qf", "%{VERSION}", id]);
  });

  it("ett Arch-paket: pacman -Q, utan paketets release-nummer", async () => {
    const { env: e, calls } = env({ tools: ["pacman"], answers: { pacman: ok("codestead-hub 0.2.6-1\n") } });
    expect(await detectNativeInstall(id, e)).toEqual({ kind: "arch", version: "0.2.6" });
    expect(calls).toEqual([["/usr/bin/pacman", "-Q", id]]);
  });

  it("borttaget men konfigurationen kvar, eller inget paket alls: ingen native installation", async () => {
    const { env: e } = env({ answers: { "dpkg-query": ok("deinstall ok config-files\t0.2.6"), rpm: notInstalled, pacman: notInstalled } });
    expect(await detectNativeInstall(id, e)).toBeNull();
    expect(await detectNativeInstall(id, env({ tools: [] }).env)).toBeNull();
  });

  it("sökvägen räcker inte, och utanför /opt/<id>/ frågas ingen pakethanterare", async () => {
    for (const over of [
      { execPath: "/home/u/.local/share/codestead/tools/codestead-hub/1/Codestead.Hub.bin" }, // the hub's per-user copy
      { execPath: "/opt/codestead-hub-old/Codestead.Hub.bin" },
      { execPath: "/opt/codestead-hub/../x/Codestead.Hub.bin" },
      { appImage: "/home/u/Codestead.AppImage" },
      { platform: "win32" },
    ]) {
      const { env: e, calls } = env({ ...over, answers: { "dpkg-query": ok("install ok installed\t0.2.6") } });
      expect(await detectNativeInstall(id, e), JSON.stringify(over)).toBeNull();
      expect(calls).toEqual([]);
    }
    expect(await detectNativeInstall("../etc", env({}).env)).toBeNull();
  });

  it("programmen tas från systemets mappar, inte från PATH", () => {
    expect(findSystemTool("pkexec", (p) => p === "/usr/bin/pkexec")).toBe("/usr/bin/pkexec");
    expect(findSystemTool("apt-get", (p) => p === "/sbin/apt-get")).toBe("/sbin/apt-get");
    expect(findSystemTool("dnf", () => false)).toBeNull();
  });
});

describe("NativePackageUpdateTests: releasens filer", () => {
  it("paketet för varje sort och processor (packaging/build-linux.sh), bara x64 byggs", () => {
    expect(nativePackageAsset(id, "0.2.7", "deb", "x64")).toBe("codestead-hub_0.2.7_amd64.deb");
    expect(nativePackageAsset(id, "0.2.7", "rpm", "x64")).toBe("codestead-hub-0.2.7-1.x86_64.rpm");
    expect(nativePackageAsset(id, "0.2.7", "arch", "x64")).toBe("codestead-hub-0.2.7-1-x86_64.pkg.tar.zst");
    expect(nativePackageAsset(id, "0.2.7", "deb", "arm64")).toBeNull();
    expect(nativePackageAsset(id, "0.2.7/../../x", "deb", "x64")).toBeNull();
    expect(releaseAssetUrl(repo, "codestead-hub-v0.2.7", "SHA256SUMS.txt")).toBe(
      "https://github.com/JesperE98/codestead-releases/releases/download/codestead-hub-v0.2.7/SHA256SUMS.txt",
    );
  });

  it("kontrollsumman ur SHA256SUMS.txt (sha256sum: text- och binärläge), annars ingen", () => {
    const a = "a".repeat(64);
    const b = "B".repeat(64);
    const sums = `${a}  codestead-hub_0.2.7_amd64.deb\n${b} *codestead-hub-0.2.7-1.x86_64.rpm\r\n${"c".repeat(64)}  x-codestead-hub_0.2.7_amd64.deb.sig\n`;
    expect(checksumFor(sums, "codestead-hub_0.2.7_amd64.deb")).toBe(a);
    expect(checksumFor(sums, "codestead-hub-0.2.7-1.x86_64.rpm")).toBe("b".repeat(64));
    expect(checksumFor(sums, "codestead-hub-0.2.7-1-x86_64.pkg.tar.zst")).toBeNull();
    expect(checksumFor("not a checksum file", "codestead-hub_0.2.7_amd64.deb")).toBeNull();
  });

  it("bara HTTPS från GitHub", () => {
    expect(isAllowedDownloadUrl("https://github.com/x/y/releases/download/t/f")).toBe(true);
    expect(isAllowedDownloadUrl("https://objects.githubusercontent.com/github-production-release-asset/1")).toBe(true);
    expect(isAllowedDownloadUrl("https://release-assets.githubusercontent.com/github-production-release-asset/1")).toBe(true);
    for (const u of ["http://github.com/x", "https://github.com.evil.example/x", "https://evil.example/github.com", "https://github.com:8443/x", "https://u:p@github.com/x", "file:///etc/passwd", "nonsense"]) {
      expect(isAllowedDownloadUrl(u), u).toBe(false);
    }
  });

  it("den senaste versionen i Velopack-flödet (releases.linux.json, som AppImage uppdaterar från)", async () => {
    const feed = {
      Assets: [
        { PackageId: "codestead-linux", Version: "0.6.7", Type: "Full", FileName: "a.nupkg" },
        { PackageId: "codestead-linux", Version: "0.6.10", Type: "Full", FileName: "b.nupkg" },
        { PackageId: "codestead-linux", Version: "0.6.11", Type: "Delta", FileName: "c.nupkg" },
        { PackageId: "other", Version: "9.0.0", Type: "Full" },
      ],
    };
    const urls: string[] = [];
    const fetchFn: FetchLike = (url) => (urls.push(url), Promise.resolve(new Response(JSON.stringify(feed))));
    expect(await latestFromVelopackFeed(fetchFn, `https://github.com/${repo}/releases/download/codestead-linux-latest/`, "codestead-linux")).toBe("0.6.10");
    expect(urls).toEqual([`https://github.com/${repo}/releases/download/codestead-linux-latest/releases.linux.json`]);
    expect(isNewerVersion("0.6.10", "0.6.9")).toBe(true);
    expect(isNewerVersion("0.6.9", "0.6.9")).toBe(false);
    expect(isNewerVersion("1.0", "0.6.9")).toBe(false);
  });
});

describe("NativePackageUpdateTests: kommandoraderna", () => {
  const file = "/tmp/codestead-hub-update-x/codestead-hub_0.2.7_amd64.deb";

  it("som vanlig användare genom pkexec, som root utan", () => {
    const all = tools("pkexec", "apt-get", "dnf", "zypper", "rpm", "pacman");
    expect(installCommand("deb", file, false, all)).toEqual({ file: "/usr/bin/pkexec", args: ["/usr/bin/apt-get", "install", "-y", file] });
    expect(installCommand("deb", file, true, all)).toEqual({ file: "/usr/bin/apt-get", args: ["install", "-y", file] });
    expect(installCommand("rpm", "/t/p.rpm", false, all)).toEqual({ file: "/usr/bin/pkexec", args: ["/usr/bin/dnf", "install", "-y", "/t/p.rpm"] });
    expect(installCommand("arch", "/t/p.pkg.tar.zst", true, all)).toEqual({ file: "/usr/bin/pacman", args: ["-U", "--noconfirm", "/t/p.pkg.tar.zst"] });
  });

  it(".rpm utan dnf: zypper (openSUSE; paketen är inte signerade), annars rpm -U", () => {
    expect(installCommand("rpm", "/t/p.rpm", true, tools("zypper", "rpm"))).toEqual({
      file: "/usr/bin/zypper",
      args: ["--non-interactive", "install", "--allow-unsigned-rpm", "/t/p.rpm"],
    });
    expect(installCommand("rpm", "/t/p.rpm", true, tools("rpm"))).toEqual({ file: "/usr/bin/rpm", args: ["-U", "/t/p.rpm"] });
  });

  it("utan pkexec eller pakethanterare: inget kommando (fönstret visar nedladdningen som förut)", () => {
    expect(installCommand("deb", file, false, tools("apt-get"))).toBeNull();
    expect(installCommand("deb", file, true, tools("dpkg", "pkexec"))).toBeNull();
    expect(installCommand("arch", file, false, tools("pkexec", "apt-get"))).toBeNull();
  });

  it("pkexec: stängd lösenordsruta, ingen polkit-agent, inte tillåtet; pakethanterarens fel med dess text", () => {
    const viaPkexec = { file: "/usr/bin/pkexec", args: ["/usr/bin/apt-get", "install", "-y", file] };
    expect(installFailure({ code: 0, stdout: "", stderr: "" }, viaPkexec, true)).toBeNull();
    expect(installFailure({ code: 126, stdout: "", stderr: "Error executing command as another user: Request dismissed" }, viaPkexec, true)?.reason).toBe("cancelled");
    const noAgent = installFailure({ code: 127, stdout: "", stderr: "Error executing command as another user: No authentication agent found." }, viaPkexec, true)!;
    expect(noAgent.reason).toBe("no-agent");
    expect(noAgent.message).toMatch(/polkit/);
    expect(installFailure({ code: 127, stdout: "", stderr: "Error executing command as another user: Not authorized" }, viaPkexec, true)?.reason).toBe("not-authorized");
    const apt = installFailure({ code: 100, stdout: "Reading package lists...", stderr: "E: Could not get lock /var/lib/dpkg/lock-frontend." }, viaPkexec, true)!;
    expect(apt.reason).toBe("install-failed");
    expect(apt.message).toBe("apt-get ended with code 100: E: Could not get lock /var/lib/dpkg/lock-frontend.");
    // As root, 126/127 are the package manager's own codes.
    const rootCmd = { file: "/usr/bin/pacman", args: ["-U", "--noconfirm", "/t/p"] };
    expect(installFailure({ code: 1, stdout: "", stderr: "error: failed to commit transaction (conflicting files)" }, rootCmd, false)?.message).toBe(
      "pacman ended with code 1: error: failed to commit transaction (conflicting files)",
    );
  });
});

describe("NativePackageUpdateTests: uppdateringen", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const newDeb = new TextEncoder().encode("the 0.2.7 package ".repeat(5000));
  const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
  const base = `https://github.com/${repo}/releases/download/codestead-hub-v0.2.7/`;

  /** GitHub with one release; `files`: name → content (a string is the checksums file). */
  function github(files: Partial<Record<string, Uint8Array<ArrayBuffer> | string>>, redirectTo?: string): { fetch: FetchLike; urls: string[] } {
    const urls: string[] = [];
    return {
      urls,
      fetch: (url) => {
        urls.push(url);
        const name = url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : null;
        const body = name !== null ? files[name] : undefined;
        const r = body === undefined ? new Response("Not Found", { status: 404, statusText: "Not Found" }) : new Response(body, { headers: { "content-length": String(typeof body === "string" ? new TextEncoder().encode(body).length : body.length) } });
        if (redirectTo !== undefined) Object.defineProperty(r, "url", { value: redirectTo });
        return Promise.resolve(r);
      },
    };
  }

  function updater(over: Partial<NativeUpdateOptions> & { answers?: Record<string, CommandResult>; tools?: string[] }) {
    const temp = mkdtempSync(join(tmpdir(), "native-update-test-"));
    dirs.push(temp);
    const { run, calls } = fakeRun(over.answers ?? { pkexec: ok(""), "apt-get": ok("") });
    let restarted = 0;
    const installed: Uint8Array[] = [];
    const recordingRun: RunCommand = (file, args) => {
      const path = args.at(-1)!;
      if (existsSync(path)) installed.push(readFileSync(path));
      return run(file, args);
    };
    const u = new NativePackageSelfUpdate({
      releasesRepo: repo,
      packageId: id,
      currentVersion: "0.2.6",
      install: { kind: "deb", version: "0.2.6" } satisfies NativeInstall,
      latestVersion: () => Promise.resolve("0.2.7"),
      fetch: github({}).fetch,
      restart: () => restarted++,
      arch: "x64",
      isRoot: false,
      run: recordingRun,
      findTool: tools(...(over.tools ?? ["pkexec", "apt-get", "dpkg-query"])),
      tempRoot: temp,
      ...over,
    });
    return { u, calls, temp, installed, restarted: () => restarted };
  }

  it("laddar ner paketet, kontrollerar summan, installerar med pkexec apt-get och startar om", async () => {
    const gh = github({ "SHA256SUMS.txt": `${sha(newDeb)}  codestead-hub_0.2.7_amd64.deb\n`, "codestead-hub_0.2.7_amd64.deb": newDeb });
    const t = updater({ fetch: gh.fetch });
    expect(t.u.canUpdateItself).toBe(true);
    expect(t.u.asksForPassword).toBe(true);
    expect(await t.u.check()).toBe("0.2.7");
    const progress: number[] = [];
    await t.u.downloadAndRestart((p) => progress.push(p));
    expect(gh.urls).toEqual([`${base}SHA256SUMS.txt`, `${base}codestead-hub_0.2.7_amd64.deb`]);
    expect(t.calls).toHaveLength(1);
    const [pkexec, aptGet, install, yes, file] = t.calls[0]!;
    expect([pkexec, aptGet, install, yes]).toEqual(["/usr/bin/pkexec", "/usr/bin/apt-get", "install", "-y"]);
    expect(file).toMatch(new RegExp(`^${t.temp}/codestead-hub-update-[^/]+/codestead-hub_0\\.2\\.7_amd64\\.deb$`));
    expect(t.installed).toEqual([Buffer.from(newDeb)]);
    expect(progress.at(-2)).toBe(100);
    expect(progress.at(-1)).toBe(-1);
    expect(t.restarted()).toBe(1);
    expect(readdirSync(t.temp)).toEqual([]); // the private folder is removed
  });

  it("som root: pakethanteraren direkt, inget lösenord", async () => {
    const gh = github({ "SHA256SUMS.txt": `${sha(newDeb)}  codestead-hub_0.2.7_amd64.deb\n`, "codestead-hub_0.2.7_amd64.deb": newDeb });
    const t = updater({ fetch: gh.fetch, isRoot: true, tools: ["apt-get"] });
    expect(t.u.asksForPassword).toBe(false);
    await t.u.check();
    await t.u.downloadAndRestart(() => {});
    expect(t.calls.map((c) => c.slice(0, 3))).toEqual([["/usr/bin/apt-get", "install", "-y"]]);
    expect(t.restarted()).toBe(1);
  });

  it("fel kontrollsumma: ingenting installeras", async () => {
    const gh = github({ "SHA256SUMS.txt": `${"0".repeat(64)}  codestead-hub_0.2.7_amd64.deb\n`, "codestead-hub_0.2.7_amd64.deb": newDeb });
    const t = updater({ fetch: gh.fetch });
    await t.u.check();
    const e = await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NativeUpdateError);
    expect((e as NativeUpdateError).reason).toBe("checksum");
    expect(t.calls).toEqual([]);
    expect(t.restarted()).toBe(0);
    expect(readdirSync(t.temp)).toEqual([]);
  });

  it("ingen kontrollsumma för paketet, eller ingen SHA256SUMS.txt: inget laddas ner eller installeras", async () => {
    const choices: Partial<Record<string, Uint8Array<ArrayBuffer> | string>>[] = [
      { "SHA256SUMS.txt": `${sha(newDeb)}  codestead-hub-0.2.7-1.x86_64.rpm\n`, "codestead-hub_0.2.7_amd64.deb": newDeb },
      { "codestead-hub_0.2.7_amd64.deb": newDeb },
    ];
    for (const files of choices) {
      const gh = github(files);
      const t = updater({ fetch: gh.fetch });
      await t.u.check();
      const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
      expect(e.reason, JSON.stringify(Object.keys(files))).toBe("SHA256SUMS.txt" in files ? "checksum" : "download");
      expect(gh.urls).toEqual([`${base}SHA256SUMS.txt`]);
      expect(t.calls).toEqual([]);
      expect(t.restarted()).toBe(0);
    }
  });

  it("en omdirigering bort från GitHub stoppas", async () => {
    const gh = github({ "SHA256SUMS.txt": `${sha(newDeb)}  codestead-hub_0.2.7_amd64.deb\n` }, "https://evil.example/SHA256SUMS.txt");
    const t = updater({ fetch: gh.fetch });
    await t.u.check();
    const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
    expect(e.message).toMatch(/redirected away from GitHub/);
    expect(t.calls).toEqual([]);
  });

  it("lösenordsrutan stängd, eller pakethanteraren misslyckas: felet, ingen omstart, filerna borta", async () => {
    for (const [answers, reason] of [
      [{ pkexec: { code: 126, stdout: "", stderr: "Error executing command as another user: Request dismissed" } }, "cancelled"],
      [{ pkexec: { code: 127, stdout: "", stderr: "Error executing command as another user: No authentication agent found." } }, "no-agent"],
      [{ pkexec: { code: 100, stdout: "", stderr: "E: Unmet dependencies." } }, "install-failed"],
    ] as const) {
      const gh = github({ "SHA256SUMS.txt": `${sha(newDeb)}  codestead-hub_0.2.7_amd64.deb\n`, "codestead-hub_0.2.7_amd64.deb": newDeb });
      const t = updater({ fetch: gh.fetch, answers });
      await t.u.check();
      const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
      expect(e.reason).toBe(reason);
      expect(t.restarted()).toBe(0);
      expect(readdirSync(t.temp)).toEqual([]);
    }
  });

  it("ingen nyare version, ingen pkexec eller ett system utan paket: inget erbjuds", async () => {
    expect(await updater({ latestVersion: () => Promise.resolve("0.2.6") }).u.check()).toBeNull();
    expect(await updater({ latestVersion: () => Promise.resolve("garbage") }).u.check()).toBeNull();
    const noPkexec = updater({ tools: ["apt-get"] }).u;
    expect(noPkexec.canUpdateItself).toBe(false);
    expect(await noPkexec.check()).toBeNull();
    expect(updater({ arch: "arm64" }).u.canUpdateItself).toBe(false);
  });

  it("appens uppdatering: Velopacks, eller pakethanterarens när appen är ett native-paket", () => {
    const common = {
      releasesRepo: repo,
      packageId: id,
      currentVersion: "0.2.6",
      exit: () => {},
      fetch: github({}).fetch,
      latestVersion: () => Promise.resolve(null),
      relaunch: { executable: "/opt/codestead-hub/Codestead.Hub" },
    };
    expect(appSelfUpdate({ ...common, nativeInstall: null })).toBeInstanceOf(VelopackSelfUpdate);
    expect(appSelfUpdate({ ...common, nativeInstall: { kind: "deb", version: "0.2.6" } })).toBeInstanceOf(NativePackageSelfUpdate);
  });
});

describe("NativePackageUpdateTests: fönstret och omstarten", () => {
  it("fönstret får veta om systemet frågar efter lösenordet, och huvudprocessens fel utan Electrons inledning", async () => {
    const renderer = {
      sendSync: (channel: string) => channel === SelfUpdateChannels.canUpdateItself || channel === SelfUpdateChannels.asksForPassword,
      invoke: () => Promise.reject(new Error("Error invoking remote method 'codestead:self-update-download': NativeUpdateError: The password dialog was closed.")),
      on: () => {},
      removeListener: () => {},
    };
    const bridge = selfUpdateBridge(renderer);
    expect(bridge.asksForPassword).toBe(true);
    await expect(bridge.downloadAndRestart(() => {})).rejects.toThrow(/^The password dialog was closed\.$/);
    expect(remoteMessage(new Error("Error invoking remote method 'x': Error: boom"))).toBe("boom");
    expect(remoteMessage("plain")).toBe("plain");
  });

  it("startar appen igen när den gamla processen har slutat, med argumenten som de är (inget skal)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "relaunch-test-"));
    try {
      const marker = join(dir, "a $(touch pwned) ; b");
      writeFileSync(join(dir, "args.sh"), '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done > "$1.out"\n', { mode: 0o755 });
      relaunchAfterExit(join(dir, "args.sh"), [marker, "two words"], 2 ** 22 + 12345 /* no such process */);
      const out = `${marker}.out`;
      for (let i = 0; i < 100 && !existsSync(out); i++) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 50));
      expect(readFileSync(out, "utf8")).toBe(`${marker}\ntwo words\n`);
      expect(existsSync(join(dir, "pwned"))).toBe(false);
      expect(existsSync("pwned")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
