// Port of Chapters/distro/universella-paket.cs – the chapter "universella-paket" (part "distro"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { Js } from "@codestead/linux-shell";
import { byFamily, cmds, content, installed, isDir, mode, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function universellaPaket(): Chapter {
  return new Chapter({
    id: "universella-paket",
    part: "distro",
    title: "Flatpak, Snap och AppImage",
    tasks: [
      new ChapterTask({
        id: "flatpak",
        perFamily: true,
        text: byFamily(
          /* debian */ "Installera Flatpak (paketet `flatpak`).",
          /* arch */ "Installera Flatpak (paketet `flatpak`).",
          /* redhat */ "Flatpak finns redan i Fedora Workstation. Kontrollera vilken version du har."),
        hint: byFamily(
          /* debian */ "`sudo apt update` och sedan `sudo apt install flatpak`.",
          /* arch */ "`sudo pacman -S flatpak`",
          /* redhat */ "`flatpak --version`"),
        solution: byFamily(
          /* debian */ cmds("sudo apt update", "sudo apt install flatpak"),
          /* arch */ cmds("sudo pacman -S flatpak", "y"),
          /* redhat */ cmds("flatpak --version")),
        check: (c) => ran(c, re(String.raw`\bflatpak\b`)) && installed(c, "flatpak"),
      }),
      new ChapterTask({
        id: "flathub",
        perFamily: true,
        text: "Lägg till Flathub som källa (*remote*) för Flatpak.",
        hint: "`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`",
        solution: cmds("flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"),
        check: (c) =>
          ran(c, re(String.raw`^flatpak\s+remote-add\b`)) &&
          [content(c, "/var/lib/flatpak/repo/config"), content(c, "~/.local/share/flatpak/repo/config")].some((t) =>
            t.includes("[remote \"flathub\"]"),
          ),
      }),
      new ChapterTask({
        id: "gimp",
        perFamily: true,
        text: "Installera bildredigeringsprogrammet GIMP (`org.gimp.GIMP`) från Flathub.",
        hint: "`flatpak install flathub org.gimp.GIMP` – och svara ja.",
        solution: cmds("flatpak install flathub org.gimp.GIMP", "y"),
        check: (c) => isDir(c, "/var/lib/flatpak/app/org.gimp.GIMP") || isDir(c, "~/.local/share/flatpak/app/org.gimp.GIMP"),
      }),
      new ChapterTask({
        id: "flatpak-run",
        perFamily: true,
        text: "Starta GIMP med `flatpak run`.",
        hint: "Program startas med sitt fullständiga id: `flatpak run org.gimp.GIMP`",
        solution: cmds("flatpak run org.gimp.GIMP"),
        check: (c) => ran(c, re(String.raw`^flatpak\s+run\s+(\S+\s+)*org\.gimp\.GIMP\b`)),
      }),
      new ChapterTask({
        id: "snap",
        perFamily: true,
        text: byFamily(
          /* debian */ "Installera snap-paketet `hello-world` och kör det. I Ubuntu finns Snap redan; i Debian installerar du paketet `snapd` först.",
          /* arch */ "Snap finns inte i Archs förråd, bara i AUR. Bygg och installera `snapd` från AUR, installera sedan snap-paketet `hello-world` och kör det.",
          /* redhat */ "Installera Snap (paketet `snapd`), installera sedan snap-paketet `hello-world` och kör det."),
        hint: byFamily(
          /* debian */ "`sudo apt install snapd` (behövs bara i Debian), `sudo snap install hello-world` och sedan `hello-world`.",
          /* arch */ "`git clone https://aur.archlinux.org/snapd.git`, `cd snapd`, `makepkg -si`. Sedan `sudo snap install hello-world` och `hello-world`.",
          /* redhat */ "`sudo dnf install snapd`, `sudo snap install hello-world` och sedan `hello-world`."),
        solution: byFamily(
          /* debian */ cmds("sudo apt update", "sudo apt install snapd", "sudo snap install hello-world", "hello-world"),
          /* arch */ cmds(
            "sudo pacman -S --needed git base-devel",
            "y",
            "cd ~",
            "git clone https://aur.archlinux.org/snapd.git",
            "cd snapd",
            "makepkg -si",
            "y",
            "y",
            "sudo snap install hello-world",
            "hello-world"),
          /* redhat */ cmds("sudo dnf install snapd", "y", "sudo snap install hello-world", "hello-world")),
        check: (c) => ran(c, re(String.raw`\bhello-world\b`)) && c.output.includes("Hello World!"),
      }),
      new ChapterTask({
        id: "appimage-chmod",
        text: "I `~/{{downloads}}` ligger en nedladdad AppImage. Gör filen `{{calculator}}` körbar.",
        hint: "`chmod +x ~/{{downloads}}/{{calculator}}`",
        solution: cmds("chmod +x ~/{{downloads}}/{{calculator}}"),
        check: (c) => ran(c, re(String.raw`^chmod\b`)) && (mode(c, "~/{{downloads}}/{{calculator}}") & Js.oct(100)) !== 0,
      }),
      new ChapterTask({
        id: "appimage-run",
        perFamily: true,
        text: "Starta {{calcName}}. Klagar den på FUSE? Installera biblioteket som saknas och försök igen.",
        hint: byFamily(
          /* debian */ "Biblioteket finns i paketet `libfuse2t64`. Starta sedan med `~/{{downloads}}/{{calculator}}`.",
          /* arch */ "Biblioteket finns i paketet `fuse2`. Starta sedan med `~/{{downloads}}/{{calculator}}`.",
          /* redhat */ "Biblioteket finns i paketet `fuse-libs`. Starta sedan med `~/{{downloads}}/{{calculator}}`."),
        solution: byFamily(
          /* debian */ cmds("sudo apt update", "sudo apt install libfuse2t64", "~/{{downloads}}/{{calculator}}"),
          /* arch */ cmds("sudo pacman -S fuse2", "y", "~/{{downloads}}/{{calculator}}"),
          /* redhat */ cmds("sudo dnf install fuse-libs", "y", "~/{{downloads}}/{{calculator}}")),
        check: (c) => ran(c, re(c, String.raw`{{calculator}}|\bAppRun\b`)) && !re(String.raw`--appimage-extract(\s|$)`).test(c.line),
      }),
    ],
  });
}
