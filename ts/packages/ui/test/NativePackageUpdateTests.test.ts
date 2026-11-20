// The updates of an app installed as a .deb, .rpm or Arch package (NativePackageUpdate.ts): which installations are
// native packages, which file of the release is this system's, the signed catalog's version and SHA-256, the package
// manager's command line (through pkexec, or as root without it) and what the user is told when it does not work. The
// package manager, pkexec and GitHub are fakes here; packaging/native-update-test.sh runs the real ones in containers.
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appSelfUpdate } from "../src/electron/AppSelfUpdate.js";
import {
  type CommandResult,
  detectNativeInstall,
  type DetectEnvironment,
  type HttpGet,
  fetchGet,
  electronGet,
  findSystemTool,
  installCommand,
  installFailure,
  isAllowedDownloadUrl,
  isNewerVersion,
  latestFromSignedCatalog,
  linuxRid,
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
import { catalogPublicKey, type SignedRelease } from "../src/electron/SignedCatalog.js";
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
    const { env: e, calls } = env({ answers: { "dpkg-query": ok("install ok installed\t0.2.6-1") } });
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

  it("katalogens processor-id", () => {
    expect(linuxRid("x64")).toBe("linux-x64");
  });

  it("bara HTTPS från GitHub", () => {
    expect(isAllowedDownloadUrl("https://github.com/x/y/releases/download/t/f")).toBe(true);
    expect(isAllowedDownloadUrl("https://objects.githubusercontent.com/github-production-release-asset/1")).toBe(true);
    expect(isAllowedDownloadUrl("https://release-assets.githubusercontent.com/github-production-release-asset/1")).toBe(true);
    for (const u of ["http://github.com/x", "https://github.com.evil.example/x", "https://evil.example/github.com", "https://github.com:8443/x", "https://u:p@github.com/x", "file:///etc/passwd", "nonsense"]) {
      expect(isAllowedDownloadUrl(u), u).toBe(false);
    }
  });

  it("den senaste versionen och paketens SHA-256 ur den signerade katalogen (exakt de signerade byten)", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const key = catalogPublicKey(publicKey.export({ type: "spki", format: "pem" }).toString())!;
    const catalog = new TextEncoder().encode(
      JSON.stringify({
        schema: 1,
        generated: "2026-11-20T00:00:00Z",
        tools: [{ id: "codestead-linux", version: "0.6.10", nativePackages: { "linux-x64": { deb: { file: "codestead-linux_0.6.10_amd64.deb", sha256: "a".repeat(64), size: 9 } } } }],
      }),
    );
    const signature = sign("sha256", catalog, { key: privateKey, dsaEncoding: "der" }).toString("base64");
    const catalogAt = `https://github.com/${repo}/releases/download/catalog/catalog.json`;
    const serve = (files: Record<string, Uint8Array<ArrayBuffer> | string>) => {
      const urls: string[] = [];
      const get: HttpGet = (url) => (urls.push(url), Promise.resolve(url in files ? new Response(files[url]) : new Response("Not Found", { status: 404 })));
      return { get, urls };
    };
    const good = serve({ [catalogAt]: catalog, [`${catalogAt}.sig`]: signature });
    expect(await latestFromSignedCatalog(good.get, repo, key, "codestead-linux")).toEqual({
      version: "0.6.10",
      nativePackages: { "linux-x64": { deb: { file: "codestead-linux_0.6.10_amd64.deb", sha256: "a".repeat(64), size: 9 } } },
    });
    expect(good.urls).toEqual([catalogAt, `${catalogAt}.sig`]);
    expect(await latestFromSignedCatalog(good.get, repo, key, "codestead-gp")).toBeNull();

    // One byte changed (here: the JSON's white space, which does not change what it says): the signature is wrong.
    const changed = new Uint8Array([...catalog, 0x0a]);
    const e = (await latestFromSignedCatalog(serve({ [catalogAt]: changed, [`${catalogAt}.sig`]: signature }).get, repo, key, "codestead-linux").catch((x: unknown) => x)) as NativeUpdateError;
    expect(e).toBeInstanceOf(NativeUpdateError);
    expect([e.reason, e.message]).toEqual(["catalog", "The catalog signature is wrong – the catalog has been changed or damaged and is not used."]);
    // No signature: a download error, nothing is read.
    expect(((await latestFromSignedCatalog(serve({ [catalogAt]: catalog }).get, repo, key, "codestead-linux").catch((x: unknown) => x)) as NativeUpdateError).reason).toBe("download");
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
  const deb = "codestead-hub_0.2.7_amd64.deb";
  const base = `https://github.com/${repo}/releases/download/`;
  const release = `${base}codestead-hub-v0.2.7/`;

  const assets = "https://objects.githubusercontent.com/github-production-release-asset/";

  /** The signed catalog's word on 0.2.7: its .deb with this SHA-256 and size (`packages` replaces the list). */
  const signed = (over: { sha256?: string; size?: number; packages?: SignedRelease["nativePackages"]; version?: string } = {}): SignedRelease => ({
    version: over.version ?? "0.2.7",
    nativePackages:
      over.packages !== undefined ? over.packages : { "linux-x64": { deb: { file: deb, sha256: over.sha256 ?? sha(newDeb), size: over.size ?? newDeb.length } } },
  });

  /**
   * GitHub with the releases; `files`: "<tag>/<name>" → content. As GitHub, a download redirects to the download host
   * (or to `redirectTo`, which serves the files too). `urls`: every request.
   */
  function github(files: Partial<Record<string, Uint8Array<ArrayBuffer> | string>>, redirectTo?: string): { get: HttpGet; urls: string[] } {
    const urls: string[] = [];
    return {
      urls,
      get: (url) => {
        urls.push(url);
        if (url.startsWith(base)) return Promise.resolve(new Response(null, { status: 302, headers: { location: (redirectTo ?? assets) + url.slice(base.length) + "?sig=x" } }));
        const host = redirectTo ?? assets;
        const name = url.startsWith(host) ? decodeURIComponent(url.slice(host.length).replace(/\?.*$/, "")) : null;
        const body = name !== null ? files[name] : undefined;
        if (body === undefined) return Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" }));
        const length = typeof body === "string" ? new TextEncoder().encode(body).length : body.length;
        return Promise.resolve(new Response(body, { headers: { "content-length": String(length) } }));
      },
    };
  }

  const withPackage = (redirectTo?: string) => github({ [`codestead-hub-v0.2.7/${deb}`]: newDeb }, redirectTo);

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
      latestRelease: () => Promise.resolve(signed()),
      get: github({}).get,
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

  /** A signed catalog on the fake GitHub (release "catalog"), and the key the app has built in. */
  function signedCatalog(tools: unknown[]): { files: Record<string, string>; key: ReturnType<typeof catalogPublicKey> & object } {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const data = JSON.stringify({ schema: 1, generated: "2026-11-20T00:00:00Z", tools }, null, 2);
    return {
      files: { "catalog/catalog.json": data, "catalog/catalog.json.sig": sign("sha256", Buffer.from(data), { key: privateKey, dsaEncoding: "der" }).toString("base64") },
      key: catalogPublicKey(publicKey.export({ type: "spki", format: "pem" }).toString())!,
    };
  }

  it("den signerade katalogen, paketet, summan, pkexec apt-get och omstarten (SHA256SUMS.txt används inte)", async () => {
    const catalog = signedCatalog([{ id, version: "0.2.7", nativePackages: { "linux-x64": { deb: { file: deb, sha256: sha(newDeb), size: newDeb.length } } } }]);
    const gh = github({ ...catalog.files, [`codestead-hub-v0.2.7/${deb}`]: newDeb, "codestead-hub-v0.2.7/SHA256SUMS.txt": "not used" });
    const lines: string[] = [];
    const t = updater({ get: gh.get, latestRelease: () => latestFromSignedCatalog(gh.get, repo, catalog.key, id), log: (l) => lines.push(l) });
    expect(t.u.canUpdateItself).toBe(true);
    expect(t.u.asksForPassword).toBe(true);
    expect(await t.u.check()).toBe("0.2.7");
    const progress: number[] = [];
    await t.u.downloadAndRestart((p) => progress.push(p));
    expect(gh.urls).toEqual([
      `${base}catalog/catalog.json`,
      `${assets}catalog/catalog.json?sig=x`,
      `${base}catalog/catalog.json.sig`,
      `${assets}catalog/catalog.json.sig?sig=x`,
      `${release}${deb}`,
      `${assets}codestead-hub-v0.2.7/${deb}?sig=x`,
    ]);
    expect(lines).toContain(`SHA-256 ${sha(newDeb)} matches the signed catalog`);
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

  it("en katalog som inte är signerad med appens nyckel: ingen uppdatering erbjuds", async () => {
    const catalog = signedCatalog([{ id, version: "0.2.7", nativePackages: { "linux-x64": { deb: { file: deb, sha256: sha(newDeb), size: newDeb.length } } } }]);
    const other = signedCatalog([]);
    const gh = github({ ...catalog.files, [`codestead-hub-v0.2.7/${deb}`]: newDeb });
    const t = updater({ get: gh.get, latestRelease: () => latestFromSignedCatalog(gh.get, repo, other.key, id) });
    const e = (await t.u.check().catch((x: unknown) => x)) as NativeUpdateError;
    expect([e.reason, e.message]).toEqual(["catalog", "The catalog signature is wrong – the catalog has been changed or damaged and is not used."]);
    expect(gh.urls.some((u) => u.includes(deb))).toBe(false);
    expect(t.calls).toEqual([]);
  });

  it("som root: pakethanteraren direkt, inget lösenord", async () => {
    const t = updater({ get: withPackage().get, isRoot: true, tools: ["apt-get"] });
    expect(t.u.asksForPassword).toBe(false);
    await t.u.check();
    await t.u.downloadAndRestart(() => {});
    expect(t.calls.map((c) => c.slice(0, 3))).toEqual([["/usr/bin/apt-get", "install", "-y"]]);
    expect(t.restarted()).toBe(1);
  });

  it("en annan SHA-256 än katalogens, eller en större fil: ingenting installeras", async () => {
    for (const release of [signed({ sha256: "0".repeat(64) }), signed({ size: newDeb.length - 1 })]) {
      const t = updater({ get: withPackage().get, latestRelease: () => Promise.resolve(release) });
      await t.u.check();
      const e = await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(NativeUpdateError);
      expect((e as NativeUpdateError).reason).toBe(release.nativePackages!["linux-x64"]!["deb"]!.size === newDeb.length ? "checksum" : "download");
      expect(t.calls).toEqual([]);
      expect(t.restarted()).toBe(0);
      expect(readdirSync(t.temp)).toEqual([]);
    }
  });

  it("paketet saknas i katalogen (en äldre post, en annan sort eller processor, ett annat filnamn): inget laddas ner", async () => {
    const entry = { file: deb, sha256: sha(newDeb), size: newDeb.length };
    const choices: SignedRelease["nativePackages"][] = [
      null,
      {},
      { "linux-x64": { rpm: entry } },
      { "linux-arm64": { deb: entry } },
      { "linux-x64": { deb: { ...entry, file: "codestead-hub_0.2.6_amd64.deb" } } },
    ];
    for (const packages of choices) {
      const gh = withPackage();
      const t = updater({ get: gh.get, latestRelease: () => Promise.resolve(signed({ packages })) });
      expect(await t.u.check()).toBe("0.2.7");
      const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
      expect([e.reason, e.message], JSON.stringify(packages)).toEqual(["catalog", `The signed catalog lists no ${deb} for codestead-hub 0.2.7, so it is not installed.`]);
      expect(gh.urls).toEqual([]);
      expect(t.calls).toEqual([]);
      expect(t.restarted()).toBe(0);
    }
  });

  it("en omdirigering bort från GitHub följs inte (inte ens med rätt kontrollsumma)", async () => {
    for (const away of ["https://evil.example/", "http://objects.githubusercontent.com/"]) {
      const gh = withPackage(away);
      const t = updater({ get: gh.get });
      await t.u.check();
      const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
      expect(e.message).toBe(`The download was redirected away from GitHub: ${away}codestead-hub-v0.2.7/${deb}?sig=x`);
      expect(gh.urls).toEqual([`${release}${deb}`]); // the other host is never asked
      expect(t.calls).toEqual([]);
    }
  });

  it("för många eller trasiga omdirigeringar", async () => {
    const loop: HttpGet = (url) => Promise.resolve(new Response(null, { status: 302, headers: { location: url } }));
    const t = updater({ get: loop });
    await t.u.check();
    await expect(t.u.downloadAndRestart(() => {})).rejects.toThrow(/a broken redirect/);
    const none: HttpGet = () => Promise.resolve(new Response(null, { status: 302 }));
    const t2 = updater({ get: none });
    await t2.u.check();
    await expect(t2.u.downloadAndRestart(() => {})).rejects.toThrow(/a broken redirect/);
  });

  it("lösenordsrutan stängd, eller pakethanteraren misslyckas: felet, ingen omstart, filerna borta", async () => {
    for (const [answers, reason] of [
      [{ pkexec: { code: 126, stdout: "", stderr: "Error executing command as another user: Request dismissed" } }, "cancelled"],
      [{ pkexec: { code: 127, stdout: "", stderr: "Error executing command as another user: No authentication agent found." } }, "no-agent"],
      [{ pkexec: { code: 100, stdout: "", stderr: "E: Unmet dependencies." } }, "install-failed"],
    ] as const) {
      const t = updater({ get: withPackage().get, answers });
      await t.u.check();
      const e = (await t.u.downloadAndRestart(() => {}).catch((x: unknown) => x)) as NativeUpdateError;
      expect(e.reason).toBe(reason);
      expect(t.restarted()).toBe(0);
      expect(readdirSync(t.temp)).toEqual([]);
    }
  });

  it("ingen nyare version, ingen pkexec eller ett system utan paket: inget erbjuds", async () => {
    expect(await updater({ latestRelease: () => Promise.resolve(signed({ version: "0.2.6" })) }).u.check()).toBeNull();
    expect(await updater({ latestRelease: () => Promise.resolve(signed({ version: "garbage" })) }).u.check()).toBeNull();
    expect(await updater({ latestRelease: () => Promise.resolve(null) }).u.check()).toBeNull();
    const noPkexec = updater({ tools: ["apt-get"] }).u;
    expect(noPkexec.canUpdateItself).toBe(false);
    expect(await noPkexec.check()).toBeNull();
    expect(updater({ arch: "arm64" }).u.canUpdateItself).toBe(false);
  });

  it("appens uppdatering: Velopacks, eller pakethanterarens när appen är ett native-paket med katalogens nyckel inbyggd", () => {
    const pem = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ type: "spki", format: "pem" }).toString();
    const common = {
      releasesRepo: repo,
      packageId: id,
      currentVersion: "0.2.6",
      exit: () => {},
      get: github({}).get,
      catalogPublicKey: pem,
      relaunch: { executable: "/opt/codestead-hub/Codestead.Hub" },
    };
    const native = { kind: "deb", version: "0.2.6" } as const;
    expect(appSelfUpdate({ ...common, nativeInstall: null })).toBeInstanceOf(VelopackSelfUpdate);
    expect(appSelfUpdate({ ...common, nativeInstall: native })).toBeInstanceOf(NativePackageSelfUpdate);
    // A build without the key (or with a key that is not one): no native update.
    expect(appSelfUpdate({ ...common, nativeInstall: native, catalogPublicKey: null })).toBeInstanceOf(VelopackSelfUpdate);
    expect(appSelfUpdate({ ...common, nativeInstall: native, catalogPublicKey: "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n" })).toBeInstanceOf(VelopackSelfUpdate);
  });
});

describe("NativePackageUpdateTests: HTTP utan att följa omdirigeringar", () => {
  it("fetchGet ber fetch om redirect: manual", async () => {
    const seen: unknown[] = [];
    const get = fetchGet((url, init) => (seen.push([url, init]), Promise.resolve(new Response("x"))));
    expect(await (await get("https://github.com/a")).text()).toBe("x");
    expect(seen).toEqual([["https://github.com/a", { redirect: "manual" }]]);
  });

  it("electronGet: net.request med redirect: manual, en omdirigering lämnas tillbaka, ett svar med sin kropp", async () => {
    type Listener = (...args: unknown[]) => void;
    const requests: { options: unknown; aborted: boolean }[] = [];
    const net = {
      request(options: { url: string; redirect: "manual" }) {
        const listeners = new Map<string, Listener>();
        const r = { options, aborted: false };
        requests.push(r);
        return {
          on: (event: string, l: Listener) => listeners.set(event, l),
          abort: () => void (r.aborted = true),
          end: () => {
            if (options.url.endsWith("/redirect")) listeners.get("redirect")!(302, "GET", "https://objects.githubusercontent.com/x");
            else if (options.url.endsWith("/fail")) listeners.get("error")!(new Error("net::ERR_NAME_NOT_RESOLVED"));
            else {
              const body = (async function* () {
                yield new TextEncoder().encode("hello ");
                yield new TextEncoder().encode("world");
              })();
              listeners.get("response")!(Object.assign(body, { statusCode: 200, statusMessage: "OK", headers: { "content-length": "11", "set-cookie": ["a", "b"] } }));
            }
          },
        };
      },
    };
    const get = electronGet(net);
    const redirect = await get("https://github.com/redirect");
    expect([redirect.status, redirect.headers.get("location")]).toEqual([302, "https://objects.githubusercontent.com/x"]);
    expect(requests[0]).toEqual({ options: { url: "https://github.com/redirect", redirect: "manual" }, aborted: true });
    const ok = await get("https://github.com/file");
    expect([ok.status, ok.headers.get("content-length"), await ok.text()]).toEqual([200, "11", "hello world"]);
    await expect(get("https://github.com/fail")).rejects.toThrow("net::ERR_NAME_NOT_RESOLVED");
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
