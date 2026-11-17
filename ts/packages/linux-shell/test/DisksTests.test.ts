// Port of tests/Linux/Codestead.Shell.Tests/DisksTests.cs (src/shell/disks.test.ts).

import { describe, expect, it } from "vitest";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import * as DisksLib from "../src/Disks/DisksLib.js";
import type { Mount } from "../src/Disks/Mount.js";
import * as DistrosLib from "../src/Distros/DistrosLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { itNeeds, TestShell } from "./TestShell.js";

function usbMounted(t: TestShell): Mount | null {
  return t.sh.disks.mounts.find((m) => m.dev === DisksLib.UsbPart) ?? null;
}

/** RegexOptions.Multiline */
function M(pattern: string): RegExp {
  return new RegExp(pattern, "m");
}

describe("DisksTests", () => {
  // ---------- lsblk och blkid ----------

  it("lsblk visar systemdisken och den omonterade USB-stickan som ett träd", () => {
    const t = new TestShell();
    const out = t.run("lsblk").out;
    expect(out.split("\n")[0]).toBe("NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS");
    expect(out).toContain("├─sda1   8:1    0    1G  0 part /boot/efi");
    expect(out).toContain("├─sda2   8:2    0   61G  0 part /");
    expect(out).toContain("└─sda3   8:3    0    2G  0 part [SWAP]");
    expect(out).toContain("sdb      8:16   1 14.9G  0 disk");
    expect(out).toMatch(/└─sdb1 +8:17 +1 14\.9G +0 part\n/);
  });

  it("lsblk -f visar typ, etikett och UUID", () => {
    const t = new TestShell();
    const out = t.run("lsblk -f").out;
    expect(out).toMatch(/^NAME +FSTYPE FSVER LABEL +UUID +FSAVAIL FSUSE% MOUNTPOINTS/);
    expect(out).toMatch(/sdb1 vfat +FAT32 USBSTICK 7E21-9A4F\n/);
    expect(out).toContain(DisksLib.rootUuid(DistrosLib.getDistro("ubuntu")));
  });

  it("lsblk -o, -d, -p och okända kolumner", () => {
    const t = new TestShell();
    expect(t.run("lsblk -d -o NAME,SIZE,RM").out).toBe("NAME  SIZE RM\nsda    64G  0\nsdb  14.9G  1\n");
    expect(t.run("lsblk -p -n -o NAME /dev/sdb").out).toBe("/dev/sdb\n└─/dev/sdb1\n");
    const bad = t.run("lsblk -o NAME,KAKA");
    expect(bad.exitCode).toBe(1);
    expect(bad.out).toContain("unknown column: KAKA");
  });

  it("Fedora: btrfs på både / och /home, och swap i zram", () => {
    const t = new TestShell("fedora");
    const out = t.run("lsblk").out;
    expect(out).toMatch(/└─sda3 .* part \/home\n +\/\n/);
    expect(out).toContain("zram0  251:0    0    2G  0 disk [SWAP]");
    expect(t.run("swapon --show").out).toContain("/dev/zram0 partition   2G   0B  100");
    expect(t.run("findmnt /home").out).toContain("/dev/sda3[/home] btrfs");
  });

  it("blkid med -s, -o value, -L och -U", () => {
    const t = new TestShell("arch");
    expect(t.run("blkid -s UUID -o value /dev/sdb1").out).toBe(`${DisksLib.UsbUuid}\n`);
    expect(t.run("blkid /dev/sdb1").out).toBe(
      `/dev/sdb1: LABEL="USBSTICK" UUID="${DisksLib.UsbUuid}" BLOCK_SIZE="512" TYPE="vfat" PARTUUID="5d3a1c7e-01"\n`,
    );
    expect(t.run("blkid -L USBSTICK").out).toBe("/dev/sdb1\n");
    expect(t.run(`blkid -U ${DisksLib.rootUuid(DistrosLib.getDistro("arch"))}`).out).toBe("/dev/sda3\n");
    expect(t.run("blkid -L FINNSINTE").exitCode).toBe(2);
  });

  for (const id of DistrosLib.distros.map((d) => d.id)) {
    itNeeds(["cat"], `alla UUID i /etc/fstab finns på diskarna (${id})`, () => {
      const t = new TestShell(id);
      const fstab = t.run("cat /etc/fstab").out;
      expect(fstab).toBe(DisksLib.fstabFor(DistrosLib.getDistro(id)));
      const uuids = [...fstab.matchAll(/^UUID=(\S+)/gm)].map((m) => m[1]!);
      expect(uuids.length >= 2).toBe(true);
      const blkid = t.run("blkid").out;
      for (const u of uuids) expect(blkid).toContain(`UUID="${u}"`);
      expect(t.run("findmnt -n -o UUID /").out).toBe(`${DisksLib.rootUuid(DistrosLib.getDistro(id))}\n`);
    });
  }

  // ---------- df ----------

  it("df -h visar monterade filsystem, även tmpfs, men inte proc", () => {
    const t = new TestShell();
    const out = t.run("df -h").out;
    expect(out.split("\n")[0]).toBe("Filesystem      Size  Used Avail Use% Mounted on");
    expect(out).toMatch(M(String.raw`^/dev/sda2 +60G +\S+ +\S+ +\d+% /$`));
    expect(out).toMatch(M(String.raw`^tmpfs .* /run$`));
    expect(out).not.toContain("/proc");
  });

  it("df -T, -x och en sökväg", () => {
    const t = new TestShell("debian");
    expect(t.run("df -hT").out).toMatch(M(String.raw`^/dev/sda1 +vfat `));
    // Debian 13 has /tmp in RAM.
    expect(t.run("df /tmp").out).toMatch(M(String.raw`^tmpfs .* /tmp$`));
    const real = t.run("df -x tmpfs -x devtmpfs").out;
    expect(real).not.toContain("tmpfs");
    expect(real.trim().split("\n")).toHaveLength(3);
    expect(t.run("df ~").out).toMatch(/\/dev\/sda2 .* \/\n$/);
    const missing = t.run("df /finns/inte");
    expect(missing.exitCode).toBe(1);
    expect(missing.out).toContain("df: /finns/inte: No such file or directory");
  });

  itNeeds(["head"], "stora filer syns i df", () => {
    const t = new TestShell();
    const used = (): number => Number(/\/dev\/sda2 +[0-9]+ +([0-9]+)/.exec(t.run("df").out)![1]);
    const before = used();
    t.run("head -c 0 /dev/null > ~/stor.bin");
    t.sh.vfs.lookup("/home/elev/stor.bin", t.sh.rootUser()).size = 50 * 1024 * 1024;
    expect(used() - before).toBe(50 * 1024);
  });

  // ---------- mount och umount ----------

  itNeeds(["sudo", "mkdir"], "montera kräver root och en befintlig monteringspunkt", () => {
    const t = new TestShell();
    let r = t.run("mount /dev/sdb1 /mnt/usb");
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("mount: /mnt/usb: must be superuser to use mount.");
    r = t.run("sudo mount /dev/sdb1 /mnt/usb");
    expect(r.exitCode).toBe(32);
    expect(r.out).toContain("mount: /mnt/usb: mount point does not exist.");
    t.run("sudo mkdir /mnt/usb");
    r = t.run("sudo mount /dev/sdb /mnt/usb");
    expect(r.out).toContain("wrong fs type, bad option, bad superblock on /dev/sdb");
    expect(r.out).toContain("prova /dev/sdb1");
    r = t.run("sudo mount /dev/sdc1 /mnt/usb");
    expect(r.out).toContain("special device /dev/sdc1 does not exist");
    expect(t.run("sudo mount /dev/sda3 /mnt/usb").out).toContain("unknown filesystem type 'swap'");
    expect(t.run("sudo mount /dev/sda1 /mnt/usb").out).toContain("/dev/sda1 already mounted on /boot/efi.");
    expect(t.run("sudo mount -t ext4 /dev/sdb1 /mnt/usb").out).toContain("wrong fs type");
    expect(usbMounted(t)).toBeNull();
  });

  itNeeds(["sudo", "mkdir", "touch", "ls", "cp", "cat"], "filerna dyker upp vid mount och försvinner vid umount – ändringar sparas på stickan", () => {
    const t = new TestShell();
    t.run("sudo mkdir -p /mnt/usb");
    t.run("sudo touch /mnt/usb/gömd.txt");
    expect(t.run("sudo mount /dev/sdb1 /mnt/usb").exitCode).toBe(0);
    expect(usbMounted(t)?.target).toBe("/mnt/usb");
    expect(t.run("ls -1 /mnt/usb").out).toBe("att-gora.txt\nrapport.pdf\nsemester.jpg\n");
    // What was in the directory before is hidden.
    expect(t.node("/mnt/usb/gömd.txt")).toBeNull();

    // FAT: everything is owned by whoever mounted it, and ordinary users may not write.
    expect(t.node("/mnt/usb/rapport.pdf")?.owner).toBe("root");
    expect(t.run("cp ~/dokument/frukter.txt /mnt/usb/").exitCode).toBe(1);
    expect(t.run("sudo cp ~/dokument/frukter.txt /mnt/usb/").exitCode).toBe(0);
    expect(t.run("cp /mnt/usb/rapport.pdf ~").exitCode).toBe(0);
    expect(t.node("~/rapport.pdf")?.content).toContain("%PDF");
    expect(t.run("cat /proc/mounts").out).toContain("/dev/sdb1 /mnt/usb vfat rw,relatime,fmask=0022");

    expect(t.run("sudo umount /mnt/usb").exitCode).toBe(0);
    expect(usbMounted(t)).toBeNull();
    expect(t.run("ls -1 /mnt/usb").out).toBe("gömd.txt\n");
    expect(t.run("cat /proc/mounts").out).not.toContain("sdb1");

    // Mounted again – with the label and owned by elev.
    expect(t.run("sudo mount -o uid=1000,gid=1000 LABEL=USBSTICK /mnt/usb").exitCode).toBe(0);
    expect(t.run("ls -1 /mnt/usb").out).toBe("att-gora.txt\nfrukter.txt\nrapport.pdf\nsemester.jpg\n");
    expect(t.node("/mnt/usb/frukter.txt")?.owner).toBe("elev");
    expect(t.run("touch /mnt/usb/egen.txt").exitCode).toBe(0);
    expect(t.run("mount -t vfat").out).toContain("/dev/sdb1 on /mnt/usb type vfat (rw,relatime,uid=1000,gid=1000,");
    expect(t.run("sudo umount -v /dev/sdb1").out).toBe("umount: /mnt/usb unmounted\n");
  });

  itNeeds(["sudo", "mkdir", "cd"], "umount: target is busy, not mounted och systemets filsystem", () => {
    const t = new TestShell();
    t.run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb");
    t.run("cd /mnt/usb");
    let r = t.run("sudo umount /mnt/usb");
    expect(r.exitCode).toBe(32);
    expect(r.out).toContain("umount: /mnt/usb: target is busy.");
    expect(usbMounted(t)).not.toBeNull();
    r = t.run("umount /mnt/usb");
    expect(r.out).toContain("must be superuser to use umount");
    t.run("cd ~");
    expect(t.run("sudo umount /mnt/usb").exitCode).toBe(0);
    expect(t.run("sudo umount /mnt/usb").out).toContain("umount: /mnt/usb: not mounted.");
    expect(t.run("sudo umount /mnt/finnsinte").out).toContain("no mount point specified");
    expect(t.run("sudo umount /").out).toContain("umount: /: target is busy.");
    expect(t.run("sudo umount /boot/efi").exitCode).toBe(32);
  });

  itNeeds(["sudo", "mkdir"], "samma partition kan inte monteras två gånger, och en upptagen monteringspunkt vägras", () => {
    const t = new TestShell();
    t.run("sudo mkdir -p /mnt/usb /mnt/b");
    t.run("sudo mount /dev/sdb1 /mnt/usb");
    expect(t.run("sudo mount /dev/sdb1 /mnt/b").out).toContain("/dev/sdb1 already mounted on /mnt/usb.");
    expect(t.run("sudo mount -t tmpfs tmpfs /mnt/usb").out).toContain("already mounted or mount point busy");
  });

  it("mount utan argument och findmnt", () => {
    const t = new TestShell("arch");
    const list = t.run("mount").out;
    expect(list).toContain("/dev/sda3 on / type ext4 (rw,relatime)");
    expect(list).toContain("/dev/sda1 on /boot type vfat");
    expect(list).toContain("proc on /proc type proc");
    const tree = t.run("findmnt").out;
    expect(tree.split("\n")[0]).toMatch(/^TARGET +SOURCE +FSTYPE +OPTIONS$/);
    expect(tree).toMatch(M(String.raw`^/ +/dev/sda3 +ext4`));
    expect(tree).toMatch(M(String.raw`^├─/proc +proc +proc`));
    expect(tree).toMatch(M(String.raw`^│ └─/dev/shm +tmpfs`));
    expect(t.run("findmnt -n -o TARGET,FSTYPE -t vfat").out).toBe("/boot vfat\n");
    expect(t.run("findmnt /mnt").exitCode).toBe(1);
  });

  itNeeds(["sudo", "mkdir", "echo"], "tmpfs finns bara i RAM-minnet", () => {
    const t = new TestShell();
    t.run("sudo mkdir /mnt/ram");
    expect(t.run("sudo mount -t tmpfs -o size=100M tmpfs /mnt/ram").exitCode).toBe(0);
    expect(t.run("df -h /mnt/ram").out).toMatch(M(String.raw`^tmpfs +100M .* /mnt/ram$`));
    t.run("echo hej > /mnt/ram/fil.txt");
    expect(t.node("/mnt/ram/fil.txt")?.content).toBe("hej\n");
    expect(t.run("sudo umount /mnt/ram").exitCode).toBe(0);
    expect(t.node("/mnt/ram/fil.txt")).toBeNull();
  });

  itNeeds(["sudo", "mkdir", "echo", "tee", "touch", "sed"], "/etc/fstab: mount -a och en rad med user", () => {
    const t = new TestShell("fedora");
    t.run("sudo mkdir -p /mnt/usb");
    t.run("echo 'LABEL=USBSTICK /mnt/usb vfat noauto,user,uid=1000,gid=1000 0 0' | sudo tee -a /etc/fstab");
    // noauto: mount -a skips it, and everything else is already mounted.
    expect(t.run("sudo mount -a").exitCode).toBe(0);
    expect(usbMounted(t)).toBeNull();
    // user: ordinary users may mount it.
    expect(t.run("mount /mnt/usb").exitCode).toBe(0);
    expect(usbMounted(t)?.target).toBe("/mnt/usb");
    expect(t.run("touch /mnt/usb/egen.txt").exitCode).toBe(0);
    t.run("sudo umount /mnt/usb");
    t.run("sudo sed -i 's/noauto,//' /etc/fstab");
    expect(t.run("sudo mount -a").exitCode).toBe(0);
    expect(usbMounted(t)?.target).toBe("/mnt/usb");
    expect(t.run("sudo mount /mnt/finnsinte").out).toContain("can't find in /etc/fstab");
  });

  // ---------- fdisk, swapon och mkfs ----------

  itNeeds(["sudo"], "fdisk -l kräver root och visar partitionstabellerna", () => {
    const t = new TestShell();
    expect(t.run("fdisk -l").out).toContain("fdisk: cannot open /dev/sda: Permission denied");
    const out = t.run("sudo fdisk -l").out;
    expect(out).toContain("Disk /dev/sda: 64 GiB, 68719476736 bytes, 134217728 sectors");
    expect(out).toContain("Disklabel type: gpt");
    expect(out).toMatch(/\/dev\/sda1 +2048 +2099199 +2097152 +1G EFI System/);
    expect(out).toContain("Disk /dev/sdb: 14.91 GiB");
    expect(out).toMatch(/\/dev\/sdb1 +2048 31277231 31275184 14\.9G {2}c W95 FAT32 \(LBA\)/);
    const interactive = t.run("sudo fdisk /dev/sdb");
    expect(interactive.exitCode).toBe(1);
    expect(interactive.out).toContain("Welcome to fdisk");
  });

  it("swapon visar swap-partitionen", () => {
    const t = new TestShell("debian");
    expect(t.run("swapon").out).toBe("NAME      TYPE      SIZE USED PRIO\n/dev/sda3 partition   2G   0B   -2\n");
  });

  itNeeds(["sudo", "mkdir", "ls"], "mkfs.ext4 frågar först, och formaterar sedan bort allt", () => {
    const t = new TestShell();
    expect(t.run("mkfs.ext4 /dev/sdb1").out).toContain("Permission denied");
    let r = t.run("sudo mkfs.ext4 -L BACKUP /dev/sdb1");
    expect(r.out).toContain("/dev/sdb1 contains a vfat file system labelled 'USBSTICK'");
    expect(r.pending).toBe(true);
    expect(t.run("n").exitCode).toBe(1);
    expect(t.run("blkid -s TYPE -o value /dev/sdb1").out).toBe("vfat\n");
    t.run("sudo mkfs.ext4 -L BACKUP /dev/sdb1");
    r = t.run("y");
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Creating journal (16384 blocks): done");
    expect(t.run("lsblk -f /dev/sdb1").out).toMatch(/sdb1 ext4 +1\.0 +BACKUP /);
    expect(t.sh.disks.disks[1]!.partitions[0]!.uuid).not.toBe(DisksLib.UsbUuid);
    t.run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb");
    expect(t.run("ls -A /mnt/usb").out).toBe("lost+found\n");
    // Mounted and active partitions cannot be formatted.
    expect(t.run("sudo mkfs.ext4 /dev/sdb1").out).toContain("/dev/sdb1 is mounted; will not make a filesystem here!");
    expect(t.run("sudo mkfs.ext4 /dev/sda2").out).toContain("is mounted");
    expect(t.run("sudo mkfs.ext4 /dev/sda3").out).toContain("apparently in use by the system");
    t.run("sudo umount /mnt/usb");
    expect(t.run("sudo mkfs.vfat -n USBSTICK /dev/sdb1").exitCode).toBe(0);
    expect(t.run("blkid -s LABEL -o value /dev/sdb1").out).toBe("USBSTICK\n");
    expect(t.run("sudo mkfs -t xfs /dev/sdb1").out).toContain("failed to execute mkfs.xfs");
  });

  itNeeds(["sudo", "which"], "mkfs.vfat följer inte med Arch från början", () => {
    const t = new TestShell("arch");
    expect(t.run("sudo mkfs.vfat /dev/sdb1").out).toContain("command not found");
    expect(t.run("which mkfs.ext4").exitCode).toBe(0);
  });

  // ---------- sparat tillstånd ----------

  itNeeds(["sudo", "mkdir", "cp", "ls"], "monteringar och stickans innehåll överlever snapshot/restore", () => {
    const t = new TestShell();
    t.run("sudo mkdir -p /mnt/usb && sudo mount /dev/sdb1 /mnt/usb && sudo cp ~/dokument/frukter.txt /mnt/usb/");
    const copy = Shell.restoreJson(t.sh.snapshotJson())!;
    expect(copy.disks.mounts.some((m) => m.dev === DisksLib.UsbPart && m.target === "/mnt/usb")).toBe(true);
    expect(copy.execute("sudo umount /mnt/usb").exitCode).toBe(0);
    const again = Shell.restoreJson(copy.snapshotJson())!;
    again.execute("sudo mount /dev/sdb1 /mnt/usb");
    expect(UtilCmd.stripAnsi(again.execute("ls /mnt/usb").output)).toContain("frukter.txt");
  });

  itNeeds(["cat", "ls", "which"], "ett gammalt sparat skal utan diskar får diskar, ny fstab och de nya kommandona", () => {
    const t = new TestShell("fedora");
    type JsonObj = Record<string, unknown>;
    const obj = (v: unknown): JsonObj => v as JsonObj;
    const old = obj(JSON.parse(t.sh.snapshotJson()));
    delete old["disks"];
    const flags = obj(old["flags"]);
    for (const k of Object.keys(flags)) if (k.startsWith("default:cmd:")) delete flags[k];
    const children = (node: unknown): JsonObj => obj(obj(node)["children"]);
    const fsChildren = children(old["fs"]);
    const etc = children(fsChildren["etc"]);
    obj(etc["fstab"])["content"] =
      "# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n";
    const bin = children(children(fsChildren["usr"])["bin"]);
    for (const cmd of ["lsblk", "mount", "umount", "df", "mkfs.ext4"]) delete bin[cmd];
    delete bin["mkfs.vfat"];
    delete children(fsChildren["dev"])["sdb1"];

    const restored = Shell.restoreJson(JSON.stringify(old))!;
    expect(restored.disks.disks.map((d) => d.name)).toEqual(["sda", "sdb", "zram0"]);
    expect(UtilCmd.stripAnsi(restored.execute("lsblk").output)).toContain("sdb1");
    expect(UtilCmd.stripAnsi(restored.execute("cat /etc/fstab").output)).toContain("btrfs");
    expect(restored.execute("ls /dev/sdb1").exitCode).toBe(0);
    expect(restored.execute("df -h").exitCode).toBe(0);
    expect(restored.execute("which mkfs.vfat").exitCode).toBe(0);
  });
});
