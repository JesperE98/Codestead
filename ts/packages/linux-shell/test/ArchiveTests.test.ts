// Port of tests/Linux/Codestead.Shell.Tests/ArchiveTests.cs (src/shell/archive.test.ts) – tar, gzip, zip and du.

import { describe, expect, it } from "vitest";
import * as ArchiveCmd from "../src/Commands/Archive/ArchiveCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import { Js } from "../src/Js.js";
import { Shell } from "../src/Shell/Shell.js";
import * as VfsLib from "../src/Vfs/VfsLib.js";
import { itNeeds, TestShell } from "./TestShell.js";

function newShell(distro = "ubuntu"): TestShell {
  const t = new TestShell(distro);
  // The tests were written for ~/dokument with two files (frukter.txt and server.log).
  t.sh.execute("rm ~/dokument/betyg.csv");
  return t;
}

describe("ArchiveTests", () => {
  // describe('tar')

  it("innehåll och rättigheter överlever tar -c följt av tar -x", () => {
    const t = newShell();
    t.run('mkdir -p projekt/hemligt && echo "echo hej" > projekt/kör.sh && echo topphemligt > projekt/hemligt/nyckel');
    t.run("chmod 755 projekt/kör.sh && chmod 600 projekt/hemligt/nyckel && chmod 700 projekt/hemligt");
    expect(t.run("tar -cf projekt.tar projekt dokument/frukter.txt").exitCode).toBe(0);
    t.run("mkdir ut");
    expect(t.run("tar -xf projekt.tar -C ut").exitCode).toBe(0);

    expect(t.node("~/ut/projekt/kör.sh")?.content).toBe("echo hej\n");
    expect(t.node("~/ut/projekt/hemligt/nyckel")?.content).toBe("topphemligt\n");
    expect(t.node("~/ut/dokument/frukter.txt")?.content).toBe(t.node("~/dokument/frukter.txt")?.content);
    expect(t.node("~/ut/projekt/kör.sh")!.mode & Js.oct(777)).toBe(Js.oct(755));
    expect(t.node("~/ut/projekt/hemligt/nyckel")!.mode & Js.oct(777)).toBe(Js.oct(600));
    expect(t.node("~/ut/projekt/hemligt")!.mode & Js.oct(777)).toBe(Js.oct(700));
    expect(t.node("~/ut/projekt/kör.sh")!.mtime).toBe(t.node("~/projekt/kör.sh")!.mtime);
    expect(t.run("ut/projekt/kör.sh").out).toBe("hej\n");
  });

  it("ihopskrivna flaggor, med och utan bindestreck", () => {
    const t = newShell();
    expect(t.run("tar czvf d.tar.gz dokument").out).toBe("dokument/\ndokument/frukter.txt\ndokument/server.log\n");
    expect(t.run("tar -tzf d.tar.gz").out).toBe("dokument/\ndokument/frukter.txt\ndokument/server.log\n");
    expect(t.run("tar -c -z -f d2.tgz dokument anteckningar.txt").exitCode).toBe(0);
    expect(t.run("tar --list --file=d2.tgz").out).toContain("anteckningar.txt\n");
    t.run("rm -r dokument");
    expect(t.run("tar -xzf d.tar.gz").exitCode).toBe(0);
    expect(t.node("~/dokument/server.log")?.content).toContain("Server starting");
  });

  it("tar -tv visar rättigheter, ägare och storlek som ls -l", () => {
    const t = newShell();
    t.run("tar -cf d.tar dokument");
    const lines = t.run("tar -tvf d.tar").out.split("\n");
    expect(lines[0]).toMatch(/^drwxr-xr-x elev\/elev {9}0 [0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9] dokument\/$/);
    expect(lines[1]).toMatch(/^-rw-r--r-- elev\/elev {8}64 .* dokument\/frukter\.txt$/);
  });

  it("gzip-komprimerade arkiv är mindre och ser binära ut", () => {
    const t = newShell();
    t.run("tar -cf d.tar dokument && tar -czf d.tar.gz dokument");
    expect(VfsLib.nodeSize(t.node("~/d.tar")!)).toBe(10240);
    expect(VfsLib.nodeSize(t.node("~/d.tar.gz")!)).toBeLessThan(1000);
    expect(t.run("ls -l d.tar").out).toContain(" 10240 ");
    expect(t.run("du -h d.tar d.tar.gz").out).toBe("12K\td.tar\n4.0K\td.tar.gz\n");
    const cat = t.run("cat d.tar.gz").out;
    expect(cat).not.toContain("Server starting");
    expect(cat).not.toContain("frukter");
    expect(ArchiveCmd.readArchive(t.node("~/d.tar.gz")!.content!)?.format).toBe("tar.gz");
  });

  it("felmeddelanden som i GNU tar", () => {
    const t = newShell();
    expect(t.run("tar -cf x.tar").out).toBe(
      "tar: Cowardly refusing to create an empty archive\nTry 'tar --help' or 'tar --usage' for more information.\n",
    );
    expect(t.run("tar -xf finnsinte.tar").out).toBe(
      "tar: finnsinte.tar: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n",
    );
    const missing = t.run("tar -cf x.tar dokument finnsinte");
    expect(missing.out).toBe("tar: finnsinte: Cannot stat: No such file or directory\ntar: Exiting with failure status due to previous errors\n");
    expect(missing.exitCode).toBe(2);
    t.run("tar -cf okomprimerad.tar dokument");
    expect(t.run("tar -xzf okomprimerad.tar").out).toContain("gzip: stdin: not in gzip format");
    expect(t.run("tar -tf anteckningar.txt").out).toContain("This does not look like a tar archive");
    expect(t.run("tar -f x.tar").out).toContain("You must specify one of the '-Acdtrux'");
    expect(t.run("tar -c dokument").out).toContain("Refusing to write archive contents to terminal");
    expect(t.run("tar -czf /etc/x.tgz dokument").out).toContain("/etc/x.tgz: Cannot open: Permission denied");
    expect(t.run("tar -xf okomprimerad.tar -C finnsinte").out).toContain("finnsinte: Cannot chdir: No such file or directory");
  });

  it("absoluta sökvägar görs relativa", () => {
    const t = newShell();
    expect(t.run("tar -cf abs.tar ~/dokument").out).toBe("tar: Removing leading `/' from member names\n");
    expect(t.run("tar -tf abs.tar").out).toContain("home/elev/dokument/frukter.txt\n");
  });

  it("tar genom pipes och utvalda filer", () => {
    const t = newShell();
    t.run("mkdir kopia");
    expect(t.run("tar -cf - dokument | tar -xvf - -C kopia").out).toBe("dokument/\ndokument/frukter.txt\ndokument/server.log\n");
    expect(t.node("~/kopia/dokument/frukter.txt")).not.toBeNull();
    t.run("tar -cf d.tar dokument");
    t.run("mkdir bara");
    t.run("tar -xf d.tar -C bara dokument/server.log");
    expect(t.node("~/bara/dokument/server.log")).not.toBeNull();
    expect(t.node("~/bara/dokument/frukter.txt")).toBeNull();
    expect(t.run("tar -tf d.tar saknas").out).toContain("tar: saknas: Not found in archive");
  });

  itNeeds(["sudo"], "root behåller ägaren, vanliga användare blir ägare själva", () => {
    const t = newShell();
    t.run("sudo tar -cf /tmp/etc.tar /etc/hostname");
    t.run("mkdir som-elev");
    t.run("tar -xf /tmp/etc.tar -C som-elev");
    expect(t.node("~/som-elev/etc/hostname")?.owner).toBe("elev");
    t.run("sudo mkdir /tmp/som-root");
    t.run("sudo tar -xf /tmp/etc.tar -C /tmp/som-root");
    expect(t.node("/tmp/som-root/etc/hostname")?.owner).toBe("root");
  });

  it("filer som inte går att läsa hoppas över", () => {
    const t = newShell();
    const r = t.run("tar -cf shadow.tar /etc/shadow");
    expect(r.out).toContain("tar: etc/shadow: Cannot open: Permission denied");
    expect(r.exitCode).toBe(2);
  });

  // describe('gzip')

  it("gzip ersätter filen, gunzip återställer den", () => {
    const t = newShell();
    const original = t.node("~/dokument/server.log")!.content;
    t.run("chmod 640 dokument/server.log");
    expect(t.run("gzip -v dokument/server.log").out).toMatch(/^dokument\/server\.log:\t +[0-9]+\.[0-9]% -- replaced with dokument\/server\.log\.gz\n$/);
    expect(t.node("~/dokument/server.log")).toBeNull();
    const gz = t.node("~/dokument/server.log.gz")!;
    expect(VfsLib.nodeSize(gz)).toBeLessThan(original!.length);
    expect(gz.mode & Js.oct(777)).toBe(Js.oct(640));
    expect(t.run("zcat dokument/server.log.gz").out).toBe(original);
    expect(t.run("gzip -l dokument/server.log.gz").out).toMatch(
      /compressed\s+uncompressed\s+ratio uncompressed_name\n\s+[0-9]+\s+824\s+[0-9]+\.[0-9]% dokument\/server\.log\n/,
    );
    t.run("gunzip dokument/server.log.gz");
    expect(t.node("~/dokument/server.log")?.content).toBe(original);
    expect(t.node("~/dokument/server.log.gz")).toBeNull();
    expect(t.node("~/dokument/server.log")!.mode & Js.oct(777)).toBe(Js.oct(640));
  });

  it("-k behåller originalet, små filer blir större", () => {
    const t = newShell();
    t.run("gzip -k dokument/frukter.txt");
    expect(t.node("~/dokument/frukter.txt")).not.toBeNull();
    expect(VfsLib.nodeSize(t.node("~/dokument/frukter.txt.gz")!)).toBeGreaterThan(VfsLib.nodeSize(t.node("~/dokument/frukter.txt")!));
    expect(t.run("gzip dokument/frukter.txt").out).toBe("gzip: dokument/frukter.txt.gz already exists; not overwritten\n");
    expect(t.run("gzip -f dokument/frukter.txt").exitCode).toBe(0);
  });

  it("felfall", () => {
    const t = newShell();
    expect(t.run("gzip finnsinte").out).toBe("gzip: finnsinte: No such file or directory\n");
    expect(t.run("gzip dokument").out).toBe("gzip: dokument is a directory -- ignored\n");
    expect(t.run("gunzip anteckningar.txt").out).toBe("gzip: anteckningar.txt: unknown suffix -- ignored\n");
    t.run("cp anteckningar.txt falsk.gz");
    expect(t.run("gunzip falsk.gz").out).toBe("gzip: falsk.gz: not in gzip format\n");
    expect(t.run("gzip").out).toContain("compressed data not written to a terminal");
    t.run("gzip anteckningar.txt");
    expect(t.run("gzip anteckningar.txt.gz").out).toBe("gzip: anteckningar.txt.gz already has .gz suffix -- unchanged\n");
  });

  it("gzip och gunzip i pipes", () => {
    const t = newShell();
    expect(t.run("echo hej | gzip | gunzip").out).toBe("hej\n");
    expect(t.run("gzip -c dokument/frukter.txt > f.gz && zcat f.gz | sort | head -1").out).toBe("apelsin\n");
    t.run("tar -cf - dokument | gzip > pipe.tar.gz");
    expect(t.run("tar -tzf pipe.tar.gz").out).toContain("dokument/server.log\n");
  });

  it("gunzip på en .tar.gz ger en .tar", () => {
    const t = newShell();
    t.run("tar -czf d.tgz dokument");
    t.run("gunzip d.tgz");
    expect(t.node("~/d.tar")).not.toBeNull();
    expect(VfsLib.nodeSize(t.node("~/d.tar")!)).toBe(10240);
    expect(t.run("tar -tf d.tar").out).toContain("dokument/frukter.txt");
  });

  // describe('zip och unzip')

  itNeeds(["which"], "måste installeras med pakethanteraren", () => {
    const t = newShell();
    expect(t.run("zip -r d.zip dokument").exitCode).toBe(127);
    expect(t.run("unzip d.zip").exitCode).toBe(127);
    expect(t.run("tar --help").exitCode).toBe(0);
    expect(t.run("which tar gzip gunzip zcat du").exitCode).toBe(0);
  });

  const installs: Record<string, { needs: string[]; lines: string[] }> = {
    debian: { needs: ["sudo", "apt"], lines: ["sudo apt update", "sudo apt install zip unzip"] },
    arch: { needs: ["sudo", "pacman"], lines: ["sudo pacman -S --noconfirm zip unzip"] },
    fedora: { needs: ["sudo", "dnf"], lines: ["sudo dnf install -y zip unzip"] },
  };
  for (const distro of ["debian", "arch", "fedora"]) {
    const install = installs[distro]!;
    itNeeds(install.needs, `zip -r och unzip -d i ${distro}`, () => {
      const t = newShell(distro);
      for (const line of install.lines) t.run(line);
      expect(t.run("zip d.zip dokument").out).toBe("  adding: dokument/ (stored 0%)\n");
      expect(t.run("zip -r d.zip dokument").out).toMatch(
        /^ {2}updating: dokument\/ \(stored 0%\)\n {2}adding: dokument\/frukter\.txt \((deflated [0-9]+%|stored 0%)\)\n {2}adding: dokument\/server\.log \(deflated [0-9]+%\)\n$/,
      );
      expect(t.run("unzip -l d.zip").out).toContain("      824  ");
      const r = t.run("unzip d.zip -d ut");
      expect(r.out).toContain("Archive:  d.zip\n   creating: ut/dokument/\n");
      expect(r.out).toContain("  inflating: ut/dokument/server.log\n");
      expect(t.node("~/ut/dokument/server.log")?.content).toBe(t.node("~/dokument/server.log")?.content);
      expect(t.run("unzip d.zip -d ut").out).toContain("skipping: ut/dokument/server.log");
      expect(t.run("unzip -o d.zip -d ut").out).toContain("inflating: ut/dokument/server.log");
      expect(t.run("unzip finnsinte.zip").out).toBe("unzip:  cannot find or open finnsinte.zip, finnsinte.zip.zip or finnsinte.zip.ZIP.\n");
      expect(t.run("zip tom.zip finnsinte").exitCode).toBe(12);
    });
  }

  // describe('du')

  it("-s, -h och -a", () => {
    const t = newShell();
    expect(t.run("du -sh dokument").out).toBe("12K\tdokument\n");
    expect(t.run("du -s dokument").out).toBe("12\tdokument\n");
    expect(t.run("du -a dokument").out).toBe("4\tdokument/frukter.txt\n4\tdokument/server.log\n12\tdokument\n");
    expect(t.run("du -sb dokument").out).toBe(`${4096 + 64 + 824}\tdokument\n`);
    expect(t.run("du finnsinte").out).toBe("du: cannot access 'finnsinte': No such file or directory\n");
  });

  // describe('spara och återställa med arkiv')

  it("snapshot (JSON) fungerar med arkiv i filsystemet", () => {
    const t = newShell("fedora");
    const sh = t.sh;
    t.run("tar -czf d.tar.gz dokument");
    t.run("gzip -k anteckningar.txt");
    const json = sh.snapshotJson();
    const restored = Shell.restoreJson(json)!;
    const out = (line: string): string => UtilCmd.stripAnsi(restored.execute(line).output);
    expect(out("ls -l d.tar.gz")).toMatch(/ [0-9]{3} .* d\.tar\.gz\n$/);
    expect(out("tar -tzf d.tar.gz")).toBe("dokument/\ndokument/frukter.txt\ndokument/server.log\n");
    out("mkdir ut && tar -xzf d.tar.gz -C ut");
    const user = restored.rootUser();
    expect(restored.vfs.readFile("/home/elev/ut/dokument/server.log", user)).toBe(sh.vfs.readFile("/home/elev/dokument/server.log", user));
    expect(out("zcat anteckningar.txt.gz")).toBe(sh.vfs.readFile("/home/elev/anteckningar.txt", user));
  });
});
