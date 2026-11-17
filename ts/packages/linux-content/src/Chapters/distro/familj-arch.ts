// Port of Chapters/distro/familj-arch.cs – the chapter "familj-arch" (part "distro"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, flag, installed, ran, re, unsudo } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function familjArch(): Chapter {
  return new Chapter({
    id: "familj-arch",
    part: "distro",
    family: "arch",
    title: "Arch-familjen: pacman och AUR",
    tasks: [
      new ChapterTask({
        id: "sync",
        text: "Synkronisera paketdatabasen och uppgradera systemet med `pacman -Syu`.",
        hint: "Kommandot ändrar systemet och kräver root: `sudo pacman -Syu`.",
        solution: cmds("sudo pacman -Syu", "y"),
        check: (c) => flag(c, "repoSynced"),
      }),
      new ChapterTask({
        id: "search",
        text: "Sök efter paketet `htop`.",
        hint: "`pacman -Ss htop`",
        solution: cmds("pacman -Ss htop"),
        check: (c) => c.exitCode === 0 && re(String.raw`^pacman\s+-Ss\w*\s+.*htop`).test(unsudo(c.line)),
      }),
      new ChapterTask({
        id: "install",
        text: "Installera paketet `tree`.",
        hint: "`sudo pacman -S tree` och svara ja på frågan.",
        solution: cmds("sudo pacman -S tree", "y"),
        check: (c) => installed(c, "tree"),
      }),
      new ChapterTask({
        id: "run-tree",
        text: "Kör `tree` i din hemkatalog.",
        solution: cmds("cd ~", "tree"),
        check: (c) => ran(c, re(String.raw`^tree\b`)) && installed(c, "tree"),
      }),
      new ChapterTask({
        id: "remove",
        text: "Ta bort paketet `tree` igen.",
        hint: "`sudo pacman -R tree`",
        solution: cmds("sudo pacman -R tree", "y"),
        check: (c) => re(String.raw`^pacman\s+-R\w*\s+.*\btree\b`).test(unsudo(c.line)) && !installed(c, "tree"),
      }),
      new ChapterTask({
        id: "upgrade",
        text: "Uppgradera alla installerade paket.",
        hint: "`sudo pacman -Syu` gör allt på en gång.",
        solution: cmds("sudo pacman -Syu", "y"),
        check: (c) => flag(c, "upgraded"),
      }),
      new ChapterTask({
        id: "forbered",
        text: "Installera det som behövs för att bygga paket från AUR: `git` och `base-devel`.",
        hint: "`sudo pacman -S --needed git base-devel`",
        solution: cmds("sudo pacman -S --needed git base-devel", "y"),
        check: (c) => installed(c, "git") && installed(c, "base-devel"),
      }),
      new ChapterTask({
        id: "lagg-till",
        text: "Hämta byggreceptet för AUR-paketet `moonphase` till din hemkatalog med `git clone`. Adressen är `https://aur.archlinux.org/moonphase.git`.",
        hint: "`cd ~` och sedan `git clone https://aur.archlinux.org/moonphase.git`",
        solution: cmds("cd ~", "git clone https://aur.archlinux.org/moonphase.git"),
        check: (c) => ran(c, re(String.raw`\bgit\s+clone\s+.*aur\.archlinux\.org\/moonphase(\.git)?\b`)),
      }),
      new ChapterTask({
        id: "granska",
        text: "Läs byggreceptet `PKGBUILD` innan du bygger något!",
        hint: "`cd ~/moonphase` och sedan `less PKGBUILD` (eller `cat PKGBUILD`).",
        solution: cmds("cd ~/moonphase", "less PKGBUILD"),
        check: (c) => ran(c, re(String.raw`^(cat|less|more|head|tail)\b.*PKGBUILD`)) && c.output.includes("pkgname=moonphase"),
      }),
      new ChapterTask({
        id: "installera",
        text: "Bygg och installera `moonphase` med `makepkg`.",
        hint: "Stå i katalogen `~/moonphase` och kör `makepkg -si` – utan sudo!",
        solution: cmds("cd ~/moonphase", "makepkg -si", "y"),
        check: (c) => installed(c, "moonphase"),
      }),
      new ChapterTask({
        id: "kor",
        text: "Kör programmet `moonphase`.",
        solution: cmds("moonphase"),
        check: (c) => ran(c, re(String.raw`^moonphase\b`)) && installed(c, "moonphase"),
      }),
      new ChapterTask({
        id: "ursprung",
        text: "Lista alla installerade paket som inte kommer från Archs egna förråd.",
        hint: "Sådana paket kallas *foreign*: `pacman -Qm`",
        solution: cmds("pacman -Qm"),
        check: (c) => ran(c, re(String.raw`^(pacman|yay)\s+-Q\w*m`)) && c.output.includes("moonphase"),
      }),
      new ChapterTask({
        id: "efterat",
        text: "Bonus: installera AUR-hjälparen `yay` (AUR-paketet `yay-bin`) och använd den för att installera AUR-paketet `snowfall`.",
        hint: "Som förut: `cd ~`, `git clone https://aur.archlinux.org/yay-bin.git`, `cd yay-bin` och `makepkg -si`. Sedan `yay -S snowfall` – utan sudo.",
        solution: cmds("cd ~", "git clone https://aur.archlinux.org/yay-bin.git", "cd yay-bin", "makepkg -si", "y", "yay -S snowfall", "y"),
        check: (c) => installed(c, "snowfall"),
      }),
      new ChapterTask({
        id: "vim",
        text: "Bonus: installera texteditorn Vim.",
        hint: "Sök med `pacman -Ss vim`. Paketet heter `vim`.",
        solution: cmds("sudo pacman -S vim", "y"),
        check: (c) => installed(c, "vim"),
      }),
    ],
  });
}
