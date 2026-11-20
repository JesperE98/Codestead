// The Linux packages' compression (packaging/build-linux.sh): the .deb's data.tar compressed with xz afterwards
// (packaging/ts/deb-xz.mjs) and the AppImage's squashfs made with zstd instead of the gzip vpk asks for
// (packaging/ts/squashfs/mksquashfs). The release's install tests install and start the real packages.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ArMember, debWithXzData, readAr, writeAr } from "../../../../packaging/ts/deb-xz.mjs";
import { repoRoot } from "./repo.js";

/** An ar member header as dpkg-deb and nfpm write them. */
function member(name: string, data: string): ArMember {
  const header = Buffer.from(`${name.padEnd(16)}${"1700000000".padEnd(12)}0     0     100644  ${String(data.length).padEnd(10)}\`\n`, "latin1");
  return { name, header, data: Buffer.from(data, "latin1") };
}

describe("PackagingTests", () => {
  it("deb-xz: data.tar blir data.tar.xz, debian-binary och control.tar.gz och ordningen är kvar", () => {
    // Odd sizes: ar pads every member to an even length.
    const deb = writeAr([member("debian-binary", "2.0\n"), member("control.tar.gz", "control!"), member("data.tar", "the files")]);
    expect(deb.toString("latin1", 0, 8)).toBe("!<arch>\n");
    const out = readAr(debWithXzData(deb, (d) => Buffer.concat([Buffer.from("xz:"), d])));
    expect(out.map((m) => m.name)).toEqual(["debian-binary", "control.tar.gz", "data.tar.xz"]);
    expect(out.map((m) => m.data.toString("latin1"))).toEqual(["2.0\n", "control!", "xz:the files"]);
    expect(out[2]!.header.toString("latin1", 16, 48)).toBe(member("data.tar", "").header.toString("latin1", 16, 48));
  });

  it("deb-xz: GNU ar läser resultatet", () => {
    if (process.platform === "win32" || spawnSync("ar", ["--version"]).status !== 0) return;
    const dir = mkdtempSync(join(tmpdir(), "deb-xz-"));
    try {
      const deb = writeAr([member("debian-binary", "2.0\n"), member("control.tar.gz", "c"), member("data.tar", "data")]);
      writeFileSync(join(dir, "p.deb"), debWithXzData(deb, (d) => d));
      expect(spawnSync("ar", ["t", join(dir, "p.deb")], { encoding: "utf8" }).stdout.split("\n").filter(Boolean)).toEqual([
        "debian-binary",
        "control.tar.gz",
        "data.tar.xz",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("deb-xz: vägrar ett paket som redan är komprimerat eller inte är ett .deb", () => {
    expect(() => debWithXzData(writeAr([member("debian-binary", "2.0\n"), member("control.tar.gz", "c"), member("data.tar.gz", "d")]), (d) => d)).toThrow(
      /uncompressed data\.tar/,
    );
    expect(() => readAr(Buffer.from("PK\x03\x04"))).toThrow(/not an ar archive/);
  });

  it("mksquashfs: vpk:s -comp gzip blir zstd -19 med block på 1 MiB; andra argument stoppar bygget", () => {
    if (process.platform === "win32") return;
    const dir = mkdtempSync(join(tmpdir(), "mksquashfs-"));
    try {
      const real = join(dir, "real");
      writeFileSync(real, '#!/bin/sh\necho "REAL $*"\n');
      chmodSync(real, 0o755);
      const shim = join(repoRoot(), "packaging", "ts", "squashfs", "mksquashfs");
      const run = (...args: string[]) => spawnSync(shim, args, { env: { ...process.env, REAL_MKSQUASHFS: real }, encoding: "utf8" });
      const vpk = run("AppDir", "out.tmpfs", "-comp", "gzip", "-root-owned", "-noappend", "-mkfs-time", "0");
      expect(vpk.status).toBe(0);
      expect(vpk.stdout.trim()).toBe("REAL AppDir out.tmpfs -comp zstd -root-owned -noappend -mkfs-time 0 -Xcompression-level 19 -b 1M");
      expect(run("-version").stdout.trim()).toBe("REAL -version");
      for (const args of [["AppDir", "out", "-comp", "xz"], ["AppDir", "out"], ["AppDir", "out", "-comp", "gzip", "-comp", "gzip"]]) {
        const r = run(...args);
        expect(r.status, args.join(" ")).toBe(1);
        expect(r.stderr).toMatch(/expected one -comp gzip/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
