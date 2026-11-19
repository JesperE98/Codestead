import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractTarGz, extractZip } from "../src/core/Archives.js";
import { IOError } from "../src/core/Errors.js";

// Not a port of a C# test: .NET's TarFile and ZipFile are well tested, this reader is new. Archives made by the system's
// own tar and zip (what the release workflow uses) unpack the same way: long names, symbolic links, permissions.

const has = (cmd: string) => {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const unix = process.platform !== "win32";
const longDir = "a-rather-long-folder-name-that-goes-on-and-on/" + "x".repeat(60) + "/" + "y".repeat(60);

describe("ArchivesTests", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codestead-archives-"));
    const src = join(dir, "src");
    mkdirSync(join(src, longDir), { recursive: true });
    writeFileSync(join(src, longDir, "file-with-a-long-name.txt"), "deep");
    writeFileSync(join(src, "Codestead.Linux"), "#!/bin/sh\necho hi\n");
    chmodSync(join(src, "Codestead.Linux"), 0o755);
    writeFileSync(join(src, "big.bin"), Buffer.alloc(3_000_000, 7));
    if (unix) symlinkSync("Codestead.Linux", join(src, "link"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  for (const format of ["gnu", "pax", "ustar"]) {
    it.skipIf(!unix || !has("tar"))(`tar --format=${format}`, async () => {
      const file = join(dir, "a.tar.gz");
      // ustar cannot hold the long folder name: only the short files then.
      const what = format === "ustar" ? ["Codestead.Linux", "big.bin", "link"] : ["."];
      execFileSync("tar", [`--format=${format}`, "-czf", file, "-C", join(dir, "src"), ...what]);
      const out = join(dir, "out");
      mkdirSync(out);
      await extractTarGz(file, out);
      if (format !== "ustar") expect(readFileSync(join(out, longDir, "file-with-a-long-name.txt"), "utf8")).toBe("deep");
      expect(statSync(join(out, "Codestead.Linux")).mode & 0o111).toBe(0o111);
      expect(readFileSync(join(out, "big.bin")).equals(Buffer.alloc(3_000_000, 7))).toBe(true);
      expect(readlinkSync(join(out, "link"))).toBe("Codestead.Linux");
    });
  }

  it.skipIf(!unix || !has("zip"))("zip -r -y", async () => {
    const file = join(dir, "a.zip");
    execFileSync("zip", ["-q", "-r", "-y", file, "."], { cwd: join(dir, "src") });
    const out = join(dir, "out");
    mkdirSync(out);
    await extractZip(file, out);
    expect(readFileSync(join(out, longDir, "file-with-a-long-name.txt"), "utf8")).toBe("deep");
    expect(statSync(join(out, "Codestead.Linux")).mode & 0o111).toBe(0o111);
    expect(readFileSync(join(out, "big.bin")).equals(Buffer.alloc(3_000_000, 7))).toBe(true);
  });

  it.skipIf(!unix || !has("tar"))("a link that points outside the folder is refused", async () => {
    const src = join(dir, "evil");
    mkdirSync(src);
    symlinkSync("../../etc/passwd", join(src, "escape"));
    const file = join(dir, "evil.tar.gz");
    execFileSync("tar", ["-czf", file, "-C", src, "escape"]);
    const out = join(dir, "out");
    mkdirSync(out);
    await expect(extractTarGz(file, out)).rejects.toBeInstanceOf(IOError);
  });

  it.skipIf(!unix || !has("tar"))("existing files are not overwritten", async () => {
    const file = join(dir, "a.tar.gz");
    execFileSync("tar", ["-czf", file, "-C", join(dir, "src"), "Codestead.Linux"]);
    const out = join(dir, "out");
    mkdirSync(out);
    writeFileSync(join(out, "Codestead.Linux"), "mine");
    await expect(extractTarGz(file, out)).rejects.toBeInstanceOf(IOError);
    expect(readFileSync(join(out, "Codestead.Linux"), "utf8")).toBe("mine");
  });
});
