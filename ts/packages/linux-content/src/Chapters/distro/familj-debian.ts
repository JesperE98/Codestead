// Port of Chapters/distro/familj-debian.cs – the chapter "familj-debian" (part "distro"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { ExtrarepoLib } from "@codestead/linux-shell";
import { cmds, flag, installed, isFile, ppaFile, ran, re, unsudo } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function familjDebian(): Chapter {
  return new Chapter({
    id: "familj-debian",
    part: "distro",
    family: "debian",
    title: "Debian-familjen: apt och PPA",
    tasks: [
      new ChapterTask({
        id: "sync",
        text: "Hämta de senaste paketlistorna med `apt update`.",
        hint: "Kommandot ändrar systemet och kräver root: `sudo apt update`.",
        solution: cmds("sudo apt update"),
        check: (c) => flag(c, "repoSynced"),
      }),
      new ChapterTask({
        id: "search",
        text: "Sök efter paketet `htop`.",
        hint: "`apt search htop`",
        solution: cmds("apt search htop"),
        check: (c) => c.exitCode === 0 && re(String.raw`^apt(-cache)?\s+search\s+.*htop`).test(unsudo(c.line)),
      }),
      new ChapterTask({
        id: "install",
        text: "Installera paketet `tree`.",
        hint: "`sudo apt install tree`",
        solution: cmds("sudo apt install tree"),
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
        hint: "`sudo apt remove tree`",
        solution: cmds("sudo apt remove tree", "y"),
        check: (c) => re(String.raw`^apt(-get)?\s+(remove|purge)\b.*\btree\b`).test(unsudo(c.line)) && !installed(c, "tree"),
      }),
      new ChapterTask({
        id: "upgrade",
        text: "Uppgradera alla installerade paket.",
        hint: "Efter `sudo apt update` kör du `sudo apt upgrade`.",
        solution: cmds("sudo apt update", "sudo apt upgrade", "y"),
        check: (c) => flag(c, "upgraded"),
      }),
      new ChapterTask({
        id: "forbered",
        text: "Se till att du har kommandot `add-apt-repository`. Det finns i paketet `software-properties-common` – förinstallerat i Ubuntu, men inte i Debian.",
        hint: "`sudo apt update` och sedan `sudo apt install software-properties-common`.",
        solution: cmds("sudo apt update", "sudo apt install software-properties-common"),
        check: (c) =>
          installed(c, "software-properties-common") &&
          ran(c, re(String.raw`\badd-apt-repository\b|\bapt(-get)?\s+install\b.*\bsoftware-properties-common\b`)),
      }),
      new ChapterTask({
        id: "lagg-till",
        text: "Lägg till PPA:t `ppa:lunatool/moonphase`.",
        hint: "`sudo add-apt-repository ppa:lunatool/moonphase` – och tryck Enter när den frågar.",
        solution: cmds("sudo add-apt-repository -y ppa:lunatool/moonphase"),
        check: (c) =>
          re(String.raw`\badd-apt-repository\b`).test(c.line) && isFile(c, ppaFile()) && ExtrarepoLib.extraRepoEnabled(c.sh, "ppa:lunatool/moonphase"),
      }),
      new ChapterTask({
        id: "granska",
        text: "Titta i filen som `add-apt-repository` skapade i `/etc/apt/sources.list.d/`.",
        hint: "`ls /etc/apt/sources.list.d` och sedan `cat` på filen vars namn börjar med `lunatool`.",
        // The PPA file name is computed when the solution is shown (TS: `cat ${PPA_FILE}`).
        solution: (_d) => cmds("ls /etc/apt/sources.list.d", `cat ${ppaFile()}`),
        check: (c) => ran(c, re(String.raw`^(cat|less|more|head|tail|grep)\b`)) && c.output.includes("ppa.launchpadcontent.net/lunatool/moonphase"),
      }),
      new ChapterTask({
        id: "installera",
        text: "Installera paketet `moonphase` från PPA:t.",
        hint: "`add-apt-repository` körde redan `apt update` åt dig, så `sudo apt install moonphase` räcker.",
        solution: cmds("sudo apt install moonphase"),
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
        text: "Ta reda på varifrån `moonphase` kommer.",
        hint: "`apt policy moonphase`",
        solution: cmds("apt policy moonphase"),
        check: (c) => ran(c, re(String.raw`^apt\s+policy\b.*\bmoonphase\b`)) && c.output.includes("ppa.launchpadcontent.net"),
      }),
      new ChapterTask({
        id: "efterat",
        text: "Ta bort PPA:t igen. Programmet blir kvar, men får inga fler uppdateringar.",
        hint: "`sudo add-apt-repository --remove ppa:lunatool/moonphase`",
        solution: cmds("sudo add-apt-repository -y --remove ppa:lunatool/moonphase"),
        check: (c) => re(String.raw`\badd-apt-repository\b.*\s(-\w*r|--remove)\b|^rm\b`).test(unsudo(c.line)) && !isFile(c, ppaFile()),
      }),
      new ChapterTask({
        id: "vim",
        text: "Bonus: installera texteditorn Vim.",
        hint: "Sök med `apt search vim`. Paketet heter `vim`.",
        solution: cmds("sudo apt update", "sudo apt install vim"),
        check: (c) => installed(c, "vim"),
      }),
    ],
  });
}
