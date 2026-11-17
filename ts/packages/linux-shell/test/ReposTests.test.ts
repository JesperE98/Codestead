// Port of tests/Linux/Codestead.Shell.Tests/ReposTests.cs (src/shell/repos.test.ts). The tests that also need
// commands of other groups (git, cd, ls, chmod, mv ...) are todos until those are ported (see itNeeds).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ReposCmd from "../src/Commands/Repos/ReposCmd.js";
import type { Distro } from "../src/Distros/Distro.js";
import * as DistrosLib from "../src/Distros/DistrosLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { snapshotFromJson } from "../src/Shell/ShellSnapshot.js";
import { World } from "../src/World.js";
import { allCommandNames, itNeeds, TestShell } from "./TestShell.js";

const ppaFile = "/etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources";
const coprFile = "/etc/yum.repos.d/_copr:copr.fedorainfracloud.org:lunatool:moonphase.repo";

describe("ReposTests", () => {
  // ---------------------------------------------------------------- PPA (Ubuntu/Debian)

  itNeeds(["which", "add-apt-repository", "sudo", "apt"], "add-apt-repository finns i Ubuntu men inte i Debian", () => {
    expect(new TestShell("ubuntu").run("which add-apt-repository").exitCode).toBe(0);
    const t = new TestShell("debian");
    expect(t.run("add-apt-repository ppa:lunatool/moonphase").exitCode).toBe(127);
    t.run("sudo apt update");
    t.run("sudo apt install software-properties-common");
    expect(t.run("which add-apt-repository").exitCode).toBe(0);
  });

  itNeeds(["add-apt-repository", "sudo"], "kräver root, och okända PPA:er finns inte", () => {
    const t = new TestShell("ubuntu");
    expect(t.run("add-apt-repository ppa:lunatool/moonphase").out).toContain("must run as root");
    const r = t.run("sudo add-apt-repository -y ppa:nobody/nothing");
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("ppa 'nobody/nothing' not found");
  });

  itNeeds(["sudo", "apt", "add-apt-repository", "moonphase"], "paketet syns först när PPA:t lagts till, och apt update körs automatiskt", () => {
    const t = new TestShell("ubuntu");
    const sh = t.sh;
    t.run("sudo apt update");
    expect(t.run("sudo apt install moonphase").out).toContain("Unable to locate package moonphase");
    expect(t.run("apt search moonphase").out).not.toContain("moonphase/");

    const add = t.run("sudo add-apt-repository ppa:lunatool/moonphase");
    expect(add.pending).toBe(true);
    expect(add.out).toContain("URIs: https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu/");
    const enter = t.run("");
    expect(enter.out).toMatch(/Get:\d+ https:\/\/ppa\.launchpadcontent\.net\/lunatool\/moonphase\/ubuntu noble InRelease/);
    expect(sh.vfs.tryLookup(ppaFile, sh.rootUser())?.content).toContain("Suites: noble");

    const inst = t.run("sudo apt install moonphase");
    expect(inst.exitCode).toBe(0);
    expect(inst.out).toContain("https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu noble/main amd64 moonphase");
    expect(t.run("moonphase").out).toMatch(/illuminated/);
    expect(t.run("apt policy moonphase").out).toMatch(/\*\*\* 1\.4\.2-1~ppa1~noble1 500\n\s+500 https:\/\/ppa\.launchpadcontent\.net/);
  });

  itNeeds(["sudo", "apt", "add-apt-repository"], "en källa som läggs till för hand syns först efter apt update", () => {
    const t = new TestShell("ubuntu");
    const sh = t.sh;
    t.run("sudo apt update");
    t.run("sudo add-apt-repository -y -n ppa:lunatool/moonphase");
    expect(sh.vfs.tryLookup(ppaFile, sh.rootUser())).not.toBeNull();
    expect(t.run("sudo apt install moonphase").exitCode).toBe(100);
    expect(t.run("sudo apt update").out).toContain("ppa.launchpadcontent.net");
    expect(t.run("sudo apt install moonphase").exitCode).toBe(0);
  });

  itNeeds(["sudo", "apt", "add-apt-repository"], "--remove tar bort källan; paketet blir kvar men kan inte installeras igen", () => {
    const t = new TestShell("ubuntu");
    const sh = t.sh;
    t.run("sudo add-apt-repository -y ppa:lunatool/moonphase");
    t.run("sudo apt install moonphase");
    expect(t.run("sudo add-apt-repository -y --remove ppa:lunatool/moonphase").exitCode).toBe(0);
    expect(sh.vfs.tryLookup(ppaFile, sh.rootUser())).toBeNull();
    expect(sh.installed.has("moonphase")).toBe(true);
    expect(t.run("apt policy moonphase").out).toMatch(/\*\*\* .* 100\n\s+100 \/var\/lib\/dpkg\/status/);
    t.run("sudo apt remove -y moonphase");
    expect(t.run("sudo apt install moonphase").exitCode).toBe(100);
  });

  itNeeds(["sudo", "apt", "add-apt-repository"], "i Debian varnar simulatorn för PPA:er", () => {
    const t = new TestShell("debian");
    t.run("sudo apt update");
    t.run("sudo apt install software-properties-common");
    const r = t.run("sudo add-apt-repository -y ppa:lunatool/moonphase");
    expect(r.out).toContain("Debian 13");
    expect(t.run("sudo apt install moonphase").exitCode).toBe(0);
  });

  // ---------------------------------------------------------------- COPR (Fedora)

  itNeeds(["sudo", "dnf"], "dnf hittar inte paketet förrän förrådet aktiverats", () => {
    const t = new TestShell("fedora");
    expect(t.run("sudo dnf install -y moonphase").out).toContain("No match for argument: moonphase");
    expect(t.run("dnf copr enable lunatool/moonphase").out).toContain("superuser privileges");
  });

  itNeeds(["sudo", "dnf"], "enable frågar med Nej som standard och skapar en .repo-fil", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    expect(t.run("sudo dnf copr enable lunatool/moonphase").pending).toBe(true);
    expect(t.run("").out).toContain("Operation aborted");
    expect(sh.vfs.tryLookup(coprFile, sh.rootUser())).toBeNull();

    t.run("sudo dnf copr enable lunatool/moonphase");
    t.run("y");
    expect(sh.vfs.tryLookup(coprFile, sh.rootUser())?.content).toContain("enabled=1");
    expect(t.run("dnf copr list").out).toBe("copr.fedorainfracloud.org/lunatool/moonphase\n");
    expect(t.run("dnf repolist").out).toContain("copr:copr.fedorainfracloud.org:lunatool:moonphase");

    const inst = t.run("sudo dnf install -y moonphase");
    expect(inst.out).toContain("copr:copr.fedorainfracloud.org:lunatool:moonphase");
    expect(t.run("dnf info moonphase").out).toContain("From repository : copr:copr.fedorainfracloud.org:lunatool:moonphase");

    t.run("sudo dnf copr disable lunatool/moonphase");
    expect(t.run("dnf copr list").out).toContain("(disabled)");
    expect(t.run("dnf repolist").out).not.toContain("copr:");
    t.run("sudo dnf remove -y moonphase");
    expect(t.run("sudo dnf install -y moonphase").exitCode).toBe(1);
    t.run("sudo dnf copr remove lunatool/moonphase");
    expect(t.run("dnf copr list").out).toBe("");
  });

  itNeeds(["sudo", "dnf"], "okända projekt", () => {
    const t = new TestShell("fedora");
    expect(t.run("sudo dnf copr enable -y someone/nothing").exitCode).toBe(1);
  });

  // ---------------------------------------------------------------- AUR (Arch)

  /** The commands prepared runs. */
  const preparedCommands = ["sudo", "pacman", "cd"];

  function prepared(): TestShell {
    const s = new TestShell("arch");
    s.run("sudo pacman -S --needed --noconfirm git base-devel");
    s.run("cd ~");
    return s;
  }

  itNeeds(["sudo", "pacman"], "pacman känner inte till AUR", () => {
    const t = new TestShell("arch");
    expect(t.run("sudo pacman -S moonphase").out).toContain("target not found: moonphase");
    expect(t.run("sudo pacman -S yay").out).toContain("bara i AUR");
    expect(t.run("pacman -Ss moonphase").exitCode).toBe(1);
  });

  itNeeds([...preparedCommands, "git", "makepkg"], "git clone hämtar PKGBUILD; fel namn ger ett tomt förråd", () => {
    const t = prepared();
    const sh = t.sh;
    const r = t.run("git clone https://aur.archlinux.org/moonphase.git");
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Cloning into 'moonphase'...");
    expect(sh.vfs.readFile("/home/elev/moonphase/PKGBUILD", sh.rootUser())).toContain("pkgname=moonphase");
    expect(t.run("git clone https://aur.archlinux.org/moonphase.git").exitCode).toBe(128);

    expect(t.run("git clone https://aur.archlinux.org/moonfase.git").out).toContain("cloned an empty repository");
    t.run("cd moonfase");
    expect(t.run("makepkg -si").out).toContain("PKGBUILD does not exist");
  });

  itNeeds(["sudo", "pacman", "cd", "git", "makepkg"], "makepkg vägrar root och behöver base-devel", () => {
    const t = new TestShell("arch");
    t.run("sudo pacman -S --noconfirm git");
    t.run("cd ~");
    t.run("git clone https://aur.archlinux.org/moonphase.git");
    t.run("cd moonphase");
    const root = t.run("sudo makepkg -si");
    expect(root.exitCode).toBe(10);
    expect(root.out).toContain("Running makepkg as root is not allowed");
    expect(t.run("makepkg -si").out).toContain("Cannot find the fakeroot binary");
  });

  itNeeds([...preparedCommands, "git", "makepkg", "ls", "moonphase"], 'makepkg -si bygger, frågar och installerar – paketet blir "foreign"', () => {
    const t = prepared();
    const sh = t.sh;
    t.run("git clone https://aur.archlinux.org/moonphase.git");
    t.run("cd moonphase");
    const build = t.run("makepkg -si");
    expect(build.out).toContain("==> Finished making: moonphase 1.4.2-1");
    expect(build.pending).toBe(true);
    t.run("y");
    expect(sh.installed.get("moonphase")).toBe("1.4.2-1");
    expect(t.run("ls").out).toContain("moonphase-1.4.2-1-x86_64.pkg.tar.zst");
    expect(t.run("moonphase --version").out).toBe("moonphase 1.4.2\n");
    expect(t.run("pacman -Qm").out).toBe("moonphase 1.4.2-1\n");
    expect(t.run("pacman -Qn").out).not.toContain("moonphase");
    expect(t.run("makepkg").out).toContain("A package has already been built");
    expect(t.run("sudo pacman -R --noconfirm moonphase").exitCode).toBe(0);
    expect(t.run("pacman -Qm").exitCode).toBe(1);
  });

  itNeeds([...preparedCommands, "git", "makepkg"], "makepkg -s installerar byggberoenden (go för yay) innan bygget", () => {
    const t = prepared();
    const sh = t.sh;
    t.run("git clone https://aur.archlinux.org/yay.git");
    t.run("cd yay");
    expect(t.run("makepkg -i").out).toContain("Missing dependencies:\n  -> go>=1.24");
    expect(t.run("makepkg -si").out).toContain("Packages (1) go-");
    const built = t.run("y");
    expect(built.out).toContain("==> Finished making: yay");
    expect(built.pending).toBe(true);
    t.run("y");
    expect(sh.installed.has("go") && sh.installed.has("yay")).toBe(true);
  });

  itNeeds([...preparedCommands, "git", "makepkg", "yay"], "yay söker i AUR och installerar därifrån, men inte som root", () => {
    const t = prepared();
    const sh = t.sh;
    t.run("git clone https://aur.archlinux.org/yay-bin.git");
    t.run("cd yay-bin");
    t.run("makepkg -si --noconfirm");
    expect(t.run("yay --version").out).toContain("yay v12.5.2");
    expect(t.run("yay -Ss snow").out).toContain("aur/snowfall 2.0.1-1");
    expect(t.run("sudo yay -S snowfall").out).toContain("Refusing to install AUR packages as root");
    t.run("yay -S snowfall");
    t.run("y");
    expect(sh.installed.has("snowfall")).toBe(true);
    expect(sh.vfs.tryLookup("/home/elev/.cache/yay/snowfall/PKGBUILD", sh.rootUser())).not.toBeNull();
    expect(t.run("pacman -Qm").out).toBe("snowfall 2.0.1-1\nyay-bin 12.5.2-1\n");
    // Normal packages are installed with pacman.
    t.run("yay -S --noconfirm tree");
    expect(sh.installed.has("tree")).toBe(true);
  });

  // ---------------------------------------------------------------- Flatpak

  itNeeds(["flatpak"], "förinstallerat i Fedora med fedora-källan", () => {
    const t = new TestShell("fedora");
    expect(t.run("flatpak --version").out).toBe("Flatpak 1.16.1\n");
    expect(t.run("flatpak remotes").out).toContain("fedora");
    expect(new TestShell("ubuntu").run("flatpak --version").exitCode).toBe(127);
  });

  itNeeds(["sudo", "pacman", "flatpak"], "Flathub, installation, körning och avinstallation", () => {
    const t = new TestShell("arch");
    const sh = t.sh;
    t.run("sudo pacman -S --noconfirm flatpak");
    const noRemote = t.run("flatpak install flathub org.gimp.GIMP");
    expect(noRemote.exitCode).toBe(1);
    expect(noRemote.out).toContain("No remote refs found");

    const add = "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo";
    expect(t.run(add).exitCode).toBe(0);
    expect(t.run(add).exitCode).toBe(0);
    expect(t.run(add.replaceAll("--if-not-exists ", "")).out).toContain("Remote flathub already exists");

    expect(t.run("flatpak search gimp").out).toContain("org.gimp.GIMP");
    const inst = t.run("flatpak install flathub org.gimp.GIMP");
    expect(inst.out).toContain("org.gnome.Platform");
    expect(inst.pending).toBe(true);
    expect(t.run("y").out).toContain("Installation complete.");
    expect(sh.vfs.tryLookup("/var/lib/flatpak/app/org.gimp.GIMP", sh.rootUser())).not.toBeNull();
    expect(t.run("flatpak list --app").out).toContain("org.gimp.GIMP");
    expect(t.run("flatpak run org.gimp.GIMP").out).toContain("GNU Image Manipulation Program");
    expect(t.run("flatpak run org.videolan.VLC").exitCode).toBe(1);

    t.run("flatpak uninstall -y org.gimp.GIMP");
    expect(t.run("flatpak list --runtime").out).toContain("org.gnome.Platform");
    t.run("flatpak uninstall -y --unused");
    expect(t.run("flatpak list").out).toBe("");
  });

  itNeeds(["flatpak"], "--user har egna källor och hamnar i hemkatalogen", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    expect(t.run("flatpak install --user -y flathub org.videolan.VLC").exitCode).toBe(1);
    t.run("flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo");
    expect(t.run("flatpak install --user -y flathub org.videolan.VLC").exitCode).toBe(0);
    expect(sh.vfs.tryLookup("/home/elev/.local/share/flatpak/app/org.videolan.VLC", sh.currentUser())?.owner).toBe("elev");
    expect(t.run("flatpak list").out).toMatch(/org\.videolan\.VLC.*user/);
  });

  // ---------------------------------------------------------------- Snap

  itNeeds(["snap"], "Ubuntu har snaps från början, Debian inte", () => {
    expect(new TestShell("ubuntu").run("snap list").out).toMatch(/firefox\s+144/);
    expect(new TestShell("debian").run("snap list").exitCode).toBe(127);
  });

  itNeeds(["sudo", "dnf", "snap"], "installera kräver root; hello-world körs från /snap/bin", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    t.run("sudo dnf install -y snapd");
    expect(t.run("snap list").out).toContain("No snaps are installed yet");
    expect(t.run("snap install hello-world").out).toContain("access denied (try with sudo)");
    expect(t.run("sudo snap install hello-world").out).toContain("hello-world 6.4 from canonical✓ installed");
    expect(t.run("hello-world").out).toBe("Hello World!\n");
    expect(t.run("/snap/bin/hello-world").out).toBe("Hello World!\n");
    expect(t.run("snap run hello-world").out).toBe("Hello World!\n");
    expect(t.run("snap list").out).toMatch(/core22\s+.*base/);
    t.run("sudo snap remove hello-world");
    expect(t.run("snap run hello-world").exitCode).toBe(1);
    expect(sh.vfs.tryLookup("/snap/bin/hello-world", sh.rootUser())).toBeNull();
  });

  itNeeds(["sudo", "snap"], "classic confinement måste godkännas", () => {
    const t = new TestShell("ubuntu");
    const r = t.run("sudo snap install code");
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("classic confinement");
    expect(t.run("sudo snap install code --classic").exitCode).toBe(0);
    expect(t.run("snap list").out).toMatch(/code\s+.*classic/);
  });

  // ---------------------------------------------------------------- AppImage

  const app = "/home/elev/Nedladdningar/Kalkylator.AppImage";

  itNeeds(["chmod", "sudo", "apt", "pacman", "dnf"], "måste göras körbar och behöver FUSE 2", () => {
    for (const [distro, pkgCmd] of [
      ["ubuntu", "sudo apt update && sudo apt install libfuse2t64"],
      ["arch", "sudo pacman -S --noconfirm fuse2"],
      ["fedora", "sudo dnf install -y fuse-libs"],
    ] as const) {
      const t = new TestShell(distro);
      expect(t.run(app).out).toContain("Permission denied");
      t.run(`chmod +x ${app}`);
      const fuse = t.run(app);
      expect(fuse.exitCode).toBe(127);
      expect(fuse.out).toContain("AppImages require FUSE to run");
      t.run(pkgCmd);
      const ok = t.run(app);
      expect(ok.exitCode, distro).toBe(0);
      expect(ok.out).toContain("Kalkylator");
    }
  });

  itNeeds(["cd", "chmod", "mv"], "--appimage-extract och omdöpt fil", () => {
    const t = new TestShell("debian");
    const sh = t.sh;
    t.run("cd ~/Nedladdningar");
    t.run("chmod +x Kalkylator.AppImage");
    expect(t.run("./Kalkylator.AppImage --appimage-extract").out).toContain("squashfs-root/AppRun");
    expect(sh.vfs.tryLookup("/home/elev/Nedladdningar/squashfs-root/kalkylator.desktop", sh.rootUser())).not.toBeNull();
    expect(t.run("./squashfs-root/AppRun").exitCode).toBe(0);
    expect(t.run("./Kalkylator.AppImage --appimage-extract-and-run").exitCode).toBe(0);
    t.run("mv Kalkylator.AppImage kalk");
    expect(t.run("./kalk").out).toContain("AppImages require FUSE");
  });

  // ---------------------------------------------------------------- övrigt

  it("gamla sparade terminaler får makepkg och ~/Nedladdningar", () => {
    const sh = new TestShell("arch").sh;
    const snap = snapshotFromJson(sh.snapshotJson())!;
    snap.fs.children!.get("usr")!.children!.get("bin")!.children!.delete("makepkg");
    snap.fs.children!.get("home")!.children!.get("elev")!.children!.delete("Nedladdningar");
    for (const k of [...snap.flags.keys()]) if (k === "default:cmd:makepkg" || k.includes("Nedladdningar")) snap.flags.delete(k);
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup("/usr/bin/makepkg", restored.rootUser())).not.toBeNull();
    expect(restored.vfs.tryLookup("/home/elev/Nedladdningar/Kalkylator.AppImage", restored.rootUser())).not.toBeNull();
  });

  it("moonphase räknar månens ålder", () => {
    const newMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    // toBeCloseTo: |expected - actual| < 0.005
    expect(Math.abs(ReposCmd.moonAge(newMoon) - 0) < 0.005).toBe(true);
    // Half a synodic month after a new moon it is full moon.
    expect(Math.abs(ReposCmd.moonAge(newMoon + (29.530588853 / 2) * 86_400_000) - 29.530588853 / 2) < 0.005).toBe(true);
    expect(ReposCmd.moonAge(Date.UTC(1999, 11, 1, 0, 0, 0)) > 0).toBe(true);
  });

  // preprocess() from src/content/render.ts: keeps only :::family blocks for the chosen family and fills in {{placeholders}}.
  // The test calls preprocess(md, d) without a language, so the family names are always the Swedish ones.
  const familyNames = new Map<string, Map<string, string>>([
    [
      "sv",
      new Map([
        ["debian", "Debian-familjen"],
        ["arch", "Arch-familjen"],
        ["redhat", "Red Hat-familjen"],
      ]),
    ],
    [
      "en",
      new Map([
        ["debian", "Debian family"],
        ["arch", "Arch family"],
        ["redhat", "Red Hat family"],
      ]),
    ],
  ]);

  // .NET multiline $ only matches before \n (the text has \r\n turned into \n first).
  const familyBlock = /^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm;
  const placeholder = /\{\{([A-Za-z0-9_]+)\}\}/g;
  const shBlock = /```sh\n([\s\S]*?)```/g;

  function preprocess(md: string, d: Distro, lang = "sv"): string {
    const values = new Map<string, string>([
      ["distro", d.name],
      ["hostname", d.hostname],
      ["family", familyNames.get(lang)!.get(d.family)!],
      ["pm", d.packageManager],
      ["adminGroup", d.adminGroup],
    ]);
    md = md.replace(/\r\n?/g, "\n");
    md = md.replace(familyBlock, (_m, fam: string, body: string) =>
      fam === d.family ? `<div class="distro-block" data-family="${fam}" data-label="${values.get("family")}">\n\n${body}\n\n</div>` : "",
    );
    return md.replace(placeholder, (m, key: string) => values.get(key) ?? m);
  }

  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

  itNeeds(allCommandNames(), "alla klickbara kommandon i kapiteltexterna fungerar", () => {
    // Intentional failures: "snap install code" without --classic, an AppImage before FUSE exists and
    // "dnf check-update", which exits with 100 when there are updates.
    const expectedFailures = (w: World): RegExp[] => [/^sudo snap install code$/, new RegExp(`^\\./${w.get("calculator").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), /^dnf check-update$/];
    for (const lang of [...World.languages].sort()) {
      const world = World.get(lang);
      const failures = expectedFailures(world);
      for (const d of DistrosLib.distros) {
        const t = new TestShell(d.id, lang, lang);
        // The family chapter of the distro (apt/pacman/dnf and PPA/AUR/COPR), then the universal formats.
        for (const id of [`familj-${d.family}`, "universella-paket"]) {
          const path = join(repoRoot, "src", "Linux", "content", "chapters", lang, `${id}.md`);
          // A translation that hasn't been written yet is reported by the content tests, not here.
          if (lang !== "en" && !existsSync(path)) continue;
          const md = world.expand(preprocess(readFileSync(path, "utf8"), d));
          const lines = [...md.matchAll(shBlock)].flatMap((m) => m[1]!.split("\n").filter((l) => l !== ""));
          for (const line of lines) {
            let r = t.run(line);
            for (let i = 0; r.pending && i < 5; i++) r = t.run("y");
            if (r.exitCode !== 0 && !failures.some((re) => re.test(line))) {
              expect.fail(`${lang}/${id} i ${d.id}: "${line}" gav ${r.exitCode}\n${r.out}`);
            }
          }
        }
      }
    }
  });
});
