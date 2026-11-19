// Port of Chapters/distro/familj-redhat.cs – the chapter "familj-redhat" (part "distro"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { ExtrarepoLib } from "@codestead/linux-shell";
import { cmds, flag, installed, ran, re, unsudo } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function familjRedhat(): Chapter {
  return new Chapter({
    id: "familj-redhat",
    part: "distro",
    family: "redhat",
    title: "Red Hat-familjen: dnf och COPR",
    tasks: [
      new ChapterTask({
        id: "sync",
        text: "Hämta ny paketinformation och se om det finns uppdateringar med `dnf check-update`.",
        hint: "`dnf check-update` behöver inte root.",
        solution: cmds("dnf check-update"),
        check: (c) => flag(c, "repoSynced"),
      }),
      new ChapterTask({
        id: "search",
        text: "Sök efter paketet `htop`.",
        hint: "`dnf search htop`",
        solution: cmds("dnf search htop"),
        check: (c) => c.exitCode === 0 && re(String.raw`^dnf5?\s+search\s+.*htop`).test(unsudo(c.line)),
      }),
      new ChapterTask({
        id: "install",
        text: "Installera paketet `tree`.",
        hint: "`sudo dnf install tree` – och svara `y`, eftersom Nej är standard!",
        solution: cmds("sudo dnf install tree", "y"),
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
        hint: "`sudo dnf remove tree`",
        solution: cmds("sudo dnf remove tree", "y"),
        check: (c) => re(String.raw`^dnf5?\s+(remove|rm|erase)\b.*\btree\b`).test(unsudo(c.line)) && !installed(c, "tree"),
      }),
      new ChapterTask({
        id: "upgrade",
        text: "Uppgradera alla installerade paket.",
        hint: "`sudo dnf upgrade`",
        solution: cmds("sudo dnf upgrade", "y"),
        check: (c) => flag(c, "upgraded"),
      }),
      new ChapterTask({
        id: "forbered",
        text: "Visa vilka förråd dnf använder just nu.",
        hint: "`dnf repolist`",
        solution: cmds("dnf repolist"),
        check: (c) => ran(c, re(String.raw`^dnf5?\s+repolist\b`)),
      }),
      new ChapterTask({
        id: "lagg-till",
        text: "Aktivera COPR-förrådet `lunatool/moonphase`.",
        hint: "`sudo dnf copr enable lunatool/moonphase` – och svara `y`, Nej är standard.",
        solution: cmds("sudo dnf copr enable lunatool/moonphase", "y"),
        check: (c) => re(String.raw`\bcopr\s+enable\b`).test(c.line) && ExtrarepoLib.extraRepoEnabled(c.sh, "copr:lunatool/moonphase"),
      }),
      new ChapterTask({
        id: "granska",
        text: "Lista vilka COPR-förråd som är tillagda.",
        hint: "`dnf copr list`",
        solution: cmds("dnf copr list"),
        check: (c) => ran(c, re(String.raw`^dnf5?\s+copr\s+list\b`)) && c.output.includes("lunatool/moonphase"),
      }),
      new ChapterTask({
        id: "installera",
        text: "Installera paketet `moonphase` från COPR-förrådet.",
        hint: "`sudo dnf install moonphase`",
        solution: cmds("sudo dnf install moonphase", "y"),
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
        text: "Ta reda på från vilket förråd `moonphase` installerades.",
        hint: "`dnf info moonphase` – titta på raden `From repository`.",
        solution: cmds("dnf info moonphase"),
        check: (c) => ran(c, re(String.raw`^dnf5?\s+info\b.*\bmoonphase\b`)) && c.output.includes("copr:"),
      }),
      new ChapterTask({
        id: "efterat",
        text: "Stäng av COPR-förrådet igen. Programmet blir kvar, men får inga fler uppdateringar.",
        hint: "`sudo dnf copr disable lunatool/moonphase`",
        solution: cmds("sudo dnf copr disable lunatool/moonphase"),
        check: (c) => re(String.raw`\bcopr\s+(disable|remove)\b`).test(c.line) && !ExtrarepoLib.extraRepoEnabled(c.sh, "copr:lunatool/moonphase"),
      }),
      new ChapterTask({
        id: "vim",
        text: "Bonus: installera texteditorn Vim. Tips: paketet heter inte `vim` i Red Hat-familjen!",
        hint: "Sök med `dnf search vim`. Paketet heter `vim-enhanced`.",
        solution: cmds("sudo dnf install vim-enhanced", "y"),
        check: (c) => installed(c, "vim"),
      }),
    ],
  });
}
