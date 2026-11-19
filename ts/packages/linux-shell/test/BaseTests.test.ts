// Port of tests/Linux/Codestead.Shell.Tests/BaseTests.cs – tests for the base modules initfs/packages/extrarepo
// (they have no TypeScript tests of their own).

import { describe, expect, it } from "vitest";
import * as ExtrarepoLib from "../src/Extrarepo/ExtrarepoLib.js";
import { Js } from "../src/Js.js";
import * as PackagesLib from "../src/Packages/PackagesLib.js";
import { Shell } from "../src/Shell/Shell.js";
import * as VfsLib from "../src/Vfs/VfsLib.js";
import { expectEndsWith, expectStartsWith } from "./TestShell.js";

const distros = ["ubuntu", "debian", "arch", "fedora"];

describe("BaseTests", () => {
  it.each(distros)("coreutils installeras i /usr/bin (%s)", (distro) => {
    const sh = Shell.create(distro, "sv");
    const root = sh.rootUser();
    const coreutils = PackagesLib.findPackage(sh.distro.family, "coreutils")!;
    expect(PackagesLib.isInstalled(sh, coreutils)).toBe(true);
    for (const cmd of coreutils.provides) {
      const node = sh.vfs.tryLookup(`/usr/bin/${cmd}`, root);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("file");
      expectStartsWith(node!.content, VfsLib.Elf);
      expect(node!.mode).toBe(Js.oct(755));
    }
    expect(sh.vfs.lookup("/usr/bin/sudo", root).mode).toBe(Js.oct(4755));
    expect(sh.vfs.lookup("/usr/bin/ls", root).size).toBe(30_000 + ((2 * 7919) % 150_000));
  });

  it.each(distros)("övningsfilerna finns i hemkatalogen (%s)", (distro) => {
    const sh = Shell.create(distro, "sv");
    const root = sh.rootUser();
    const fruits = sh.vfs.lookup("/home/elev/dokument/frukter.txt", root);
    expect(fruits.content).toBe("äpple\nbanan\nkiwi\näpple\napelsin\nbanan\npäron\nkiwi\näpple\nmango\n");
    expect(fruits.owner).toBe("elev");
    expect(fruits.group).toBe("elev");
    expect(fruits.mode).toBe(Js.oct(644));
    expect(sh.vfs.lookup("/home/elev", root).mode).toBe(Js.oct(750));
    expectStartsWith(sh.vfs.lookup("/home/elev/dokument/betyg.csv", root).content, "namn,ämne,poäng\nAlva,matte,87\n");
    expect(sh.vfs.lookup("/home/elev/gammalt/arkiv/logg-2019.txt", root).content).toBe("gammal logg\n");
    expect(sh.vfs.tryLookup("/home/elev/projekt-webb/index.html", root)).not.toBeNull();
    expect(sh.vfs.tryLookup("/home/elev/Nedladdningar/Kalkylator.AppImage", root)).not.toBeNull();
    expect(sh.vfs.lookup("/tmp", root).mode).toBe(Js.oct(1777));
    expect(sh.vfs.lookup("/etc/sudoers", root).mode).toBe(Js.oct(440));
  });

  it("användare, grupper och shadow per familj", () => {
    const ubuntu = Shell.create("ubuntu", "sv");
    const root = ubuntu.rootUser();
    expectEndsWith(ubuntu.vfs.readFile("/etc/passwd", root), "elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n");
    expect(ubuntu.vfs.readFile("/etc/group", root)).toContain("\nsudo:x:27:elev\n");
    const shadow = ubuntu.vfs.lookup("/etc/shadow", root);
    expect(shadow.mode).toBe(Js.oct(640));
    expect(shadow.group).toBe("shadow");
    expectStartsWith(shadow.content, "root:*:20000:0:99999:7:::\n");
    expectEndsWith(shadow.content, "elev:$y$j9T$Qm1x...simulated...hash:20000:0:99999:7:::\n");
    expect(ubuntu.vfs.listDir("/etc/apt/sources.list.d", root)).toContain("ubuntu.sources");

    const arch = Shell.create("arch", "sv");
    expect(arch.vfs.readFile("/etc/group", root)).toContain("\nwheel:x:998:elev\n");
    expect(arch.vfs.lookup("/etc/shadow", root).mode).toBe(Js.oct(600));
    expect(arch.vfs.tryLookup("/etc/pacman.d/mirrorlist", root)).not.toBeNull();
    expect(arch.vfs.tryLookup("/var/log/pacman.log", root)).not.toBeNull();

    const fedora = Shell.create("fedora", "sv");
    expect(fedora.vfs.lookup("/etc/shadow", root).mode).toBe(0);
    expectEndsWith(fedora.vfs.readFile("/etc/login.defs", root), "ENCRYPT_METHOD YESCRYPT\nCREATE_HOME\tyes\n");
    expect(fedora.vfs.tryLookup("/etc/yum.repos.d/fedora.repo", root)).not.toBeNull();
  });

  it("paketnamn skiljer sig mellan familjerna", () => {
    const awk = PackagesLib.packages.filter((p) => p.id === "awk");
    expect(awk.length).toBe(1);
    expect(PackagesLib.packageName(awk[0]!, "debian")).toBe("mawk");
    expect(PackagesLib.packageName(awk[0]!, "arch")).toBe("gawk");
    expect(PackagesLib.packageName(awk[0]!, "redhat")).toBe("gawk");

    expect(PackagesLib.findPackage("debian", "passwd")?.id).toBe("shadow");
    expect(PackagesLib.findPackage("arch", "shadow")?.id).toBe("shadow");
    expect(PackagesLib.findPackage("redhat", "shadow-utils")?.id).toBe("shadow");
    expect(PackagesLib.findPackage("redhat", "vim-enhanced")?.id).toBe("vim");
    expect(PackagesLib.findPackage("redhat", "vim")).toBeNull();
    expect(PackagesLib.findPackage("debian", "openssh-client")?.id).toBe("openssh");
    expect(PackagesLib.findPackage("redhat", "openssh-clients")?.id).toBe("openssh");

    expect(PackagesLib.findPackage("arch", "adduser")).toBeNull();
    expect(PackagesLib.packageProviding("redhat", "adduser")).toBeNull();
    expect(PackagesLib.packageProviding("debian", "adduser")?.id).toBe("adduser");
    expect(PackagesLib.packageProviding("arch", "dig")?.id).toBe("dnsutils");
    expect(PackagesLib.packageName(PackagesLib.packageProviding("arch", "dig")!, "arch")).toBe("bind");
    // yay only exists in AUR – no hint for it.
    expect(PackagesLib.packageProviding("arch", "yay")).toBeNull();
    expect(PackagesLib.isForeign("arch", PackagesLib.packages.find((p) => p.id === "yay")!)).toBe(true);
    expect(PackagesLib.packages.length).toBe(58);
  });

  it("förinstallerade paket per distribution", () => {
    const has = (sh: Shell, cmd: string): boolean => sh.vfs.tryLookup(`/usr/bin/${cmd}`, sh.rootUser()) !== null;
    const ubuntu = Shell.create("ubuntu", "sv");
    const debian = Shell.create("debian", "sv");
    const arch = Shell.create("arch", "sv");
    const fedora = Shell.create("fedora", "sv");
    expect(has(ubuntu, "apt") && has(ubuntu, "adduser") && has(ubuntu, "wget") && has(ubuntu, "snap")).toBe(true);
    expect(has(debian, "snap")).toBe(false);
    expect(has(arch, "pacman") && has(arch, "curl")).toBe(true);
    expect(has(arch, "nano") || has(arch, "ssh") || has(arch, "apt")).toBe(false);
    expect(has(fedora, "dnf") && has(fedora, "python3") && has(fedora, "flatpak")).toBe(true);
    expect(has(fedora, "vim")).toBe(false);
    expect(ubuntu.installed.get("coreutils")).toBe("9.4-3ubuntu6");
    expect(debian.installed.get("coreutils")).toBe("9.4-3+deb13u6");
    expect(fedora.installed.get("coreutils")).toBe("9.7-6.fc43");
  });

  it("installera och ta bort paket med skal", () => {
    const sh = Shell.create("fedora", "sv");
    const root = sh.rootUser();
    const zsh = PackagesLib.findPackage("redhat", "zsh", sh)!;
    expect(PackagesLib.upgradable(sh)).not.toContain(zsh);
    PackagesLib.installPackage(sh, zsh);
    expect(sh.installed.get("zsh")).toBe("5.9-18.fc43");
    expect(sh.vfs.tryLookup("/usr/bin/zsh", root)).not.toBeNull();
    expect(sh.vfs.readFile("/etc/shells", root)).toBe("/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/zsh\n");
    PackagesLib.removePackage(sh, zsh);
    expect(sh.installed.has("zsh")).toBe(false);
    expect(sh.vfs.tryLookup("/usr/bin/zsh", root)).toBeNull();
    expect(sh.vfs.readFile("/etc/shells", root)).toBe("/bin/sh\n/bin/bash\n/usr/bin/bash\n");

    // After `dnf check-update` the new version is available.
    sh.flags.set("repoSynced", true);
    expect(PackagesLib.upgradable(sh)).toContain(PackagesLib.packages.find((p) => p.id === "coreutils"));
    expect(PackagesLib.upgradable(sh)).not.toContain(PackagesLib.packages.find((p) => p.id === "grep"));
  });

  it("sökning och storlekar", () => {
    const hits = PackagesLib.searchPackages("debian", "SHELL").map((p) => p.names.get("debian"));
    expect(hits).toEqual(["bash", "debianutils", "fish", "openssh-client", "zsh"]);
    expect(PackagesLib.formatKb(17_400)).toBe("17.4 MB");
    expect(PackagesLib.formatKb(1_000)).toBe("1 MB");
    expect(PackagesLib.formatKb(640)).toBe("640 kB");
    expect(PackagesLib.formatMiB(17_400)).toBe("16.99 MiB");
  });

  it("PPA och COPR", () => {
    let ppa = ExtrarepoLib.parsePpa("ppa:LunaTool")!;
    expect(ppa.user).toBe("lunatool");
    expect(ppa.name).toBe("ppa");
    expect(ExtrarepoLib.parsePpa("ppa:/x")).toBeNull();
    ppa = ExtrarepoLib.parsePpa("ppa:lunatool/moonphase")!;
    expect(ExtrarepoLib.ppaUri(ppa)).toBe("https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu/");
    expect(ExtrarepoLib.ppaSourcesPath(ppa)).toBe("/etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources");

    const copr = ExtrarepoLib.parseCopr("copr:@grp/proj")!;
    expect(copr.owner).toBe("@grp");
    expect(ExtrarepoLib.coprId(copr)).toBe("copr:copr.fedorainfracloud.org:group_grp:proj");
    expect(ExtrarepoLib.parseCopr("copr.fedorainfracloud.org/lunatool/moonphase")?.owner).toBe("lunatool");
    expect(ExtrarepoLib.parseCopr("bara-ett-ord")).toBeNull();

    // The PPA package shows up when the PPA has been added and apt update has run.
    const sh = Shell.create("ubuntu", "sv");
    const root = sh.rootUser();
    expect(PackagesLib.findPackage("debian", "moonphase", sh)).toBeNull();
    expect(PackagesLib.findPackage("debian", "moonphase")).toBeNull();
    ExtrarepoLib.ensureDir(sh, "/var/lib/apt/lists");
    sh.vfs.writeFile(ExtrarepoLib.ppaSourcesPath(ppa), "Types: deb\n", root);
    expect(ExtrarepoLib.extraRepoEnabled(sh, "ppa:lunatool/moonphase")).toBe(false);
    sh.vfs.writeFile(ExtrarepoLib.ppaListPath(ppa), "", root);
    expect(ExtrarepoLib.extraRepoEnabled(sh, "ppa:lunatool/moonphase")).toBe(true);
    expect(PackagesLib.findPackage("debian", "moonphase", sh)?.id).toBe("moonphase");

    // COPR: enabled once the .repo file says enabled=1.
    const fedora = Shell.create("fedora", "sv");
    const c = ExtrarepoLib.parseCopr("lunatool/moonphase")!;
    expect(PackagesLib.findPackage("redhat", "moonphase", fedora)).toBeNull();
    fedora.vfs.writeFile(ExtrarepoLib.coprRepoPath(c), "[x]\nname=x\nenabled=0\n", root);
    expect(ExtrarepoLib.coprEnabled(fedora, c)).toBe(false);
    fedora.vfs.writeFile(ExtrarepoLib.coprRepoPath(c), "[x]\nname=x\nEnabled = True\n", root);
    expect(ExtrarepoLib.coprEnabled(fedora, c)).toBe(true);
    expect(PackagesLib.findPackage("redhat", "moonphase", fedora)?.id).toBe("moonphase");

    // AUR packages are never in the repositories.
    const arch = Shell.create("arch", "sv");
    expect(PackagesLib.findPackage("arch", "moonphase", arch)).toBeNull();
    expect(ExtrarepoLib.extraRepoEnabled(arch, "aur")).toBe(false);
  });
});
