// The optional project of the main chapter "distro": the second-hand laptop. On the distribution the learner chose
// (any family) they set up a friend's computer with what the part taught – upgrade, search, install, list the
// installed packages, remove, a Flatpak from Flathub – and the per-family package names (Go and Vim are called
// different things). Every milestone counts per family, like the family-specific tasks of the part. Its place is set
// by defineProjects() in ChapterDefinitions.ts; the brief is src/Linux/content/chapters/<lang>/distro-project.md.

import { ChapterKinds } from "@codestead/learning";
import { byFamily, cmds, installed, isDir, ran, re } from "../../Checks.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

/** A regex for the learner's family (the commands of the family's package manager). */
function famRe(c: CheckContext, debian: string, arch: string, redhat: string): RegExp {
  const f = c.distro.family;
  return re(f === "debian" ? debian : f === "arch" ? arch : redhat);
}

/**
 * The Go package's name in each family, as a regex for the package managers' output: first on a line or after a
 * colon ("Name : go", "Package: golang-go"), perhaps after a repository ("extra/go"), and followed by a space, a slash
 * ("golang-go/noble") or the architecture ("golang.x86_64").
 */
function goPackage(c: CheckContext): RegExp {
  const name = (n: string): string => String.raw`(^|\n|:)[ \t]*([a-z]+\/)?${n}(\.x86_64)?(\s|\/|$)`;
  return famRe(c, name("golang-go"), name("go"), name("golang"));
}

const installRe: [string, string, string] = [
  String.raw`\bapt(-get)?\s+(-\S+\s+)*install\b`,
  String.raw`\b(pacman|yay)\s+(-\S+\s+)*-S[a-z]*\s`,
  String.raw`\bdnf5?\s+(-\S+\s+)*(install|in)\b`,
];

const vlcDirs = ["/var/lib/flatpak/app/org.videolan.VLC", "~/.local/share/flatpak/app/org.videolan.VLC"];

export function distroProject(): Chapter {
  return new Chapter({
    id: "distro-project",
    part: "distro",
    kind: ChapterKinds.Project,
    title: "Projekt: Den begagnade datorn",
    tasks: [
      new ChapterTask({
        id: "upgrade",
        perFamily: true,
        text: "Först det tråkiga: hämta de senaste paketlistorna och uppgradera alla installerade paket.",
        hint: byFamily(
          /* debian */ "Två steg med apt: `sudo apt update` och sedan `sudo apt upgrade`.",
          /* arch */ "Ett enda kommando gör båda sakerna i pacman: `-Syu`, med sudo.",
          /* redhat */ "dnf hämtar paketinformationen själv, så `sudo dnf upgrade` räcker."),
        solution: byFamily(
          /* debian */ cmds("sudo apt update", "sudo apt upgrade"),
          /* arch */ cmds("sudo pacman -Syu"),
          /* redhat */ cmds("sudo dnf upgrade")),
        check: (c) =>
          c.sh.flags.get("upgraded") === true &&
          ran(
            c,
            famRe(
              c,
              String.raw`\bapt(-get)?\s+(-\S+\s+)*(upgrade|full-upgrade|dist-upgrade)\b`,
              String.raw`\b(pacman|yay)\s+(-\S+\s+)*-S(?=[a-z]*y)(?=[a-z]*u)[a-z]*\b`,
              String.raw`\bdnf5?\s+(-\S+\s+)*(upgrade|update|distro-sync)\b`,
            ),
          ),
      }),
      new ChapterTask({
        id: "search",
        perFamily: true,
        text: "Alex ska gå en kurs i programspråket Go. Sök i paketlistorna och ta reda på vad paketet med Go heter i din distribution.",
        hint: byFamily(
          /* debian */ "`apt search` söker i både namn och beskrivningar – prova `golang` eller `\"Go programming\"`.",
          /* arch */ "`pacman -Ss` söker i både namn och beskrivningar – prova `\"Go programming\"`.",
          /* redhat */ "`dnf search` söker i både namn och beskrivningar – prova `golang`."),
        solution: byFamily(
          /* debian */ cmds("apt search golang"),
          /* arch */ cmds('pacman -Ss "Go programming"'),
          /* redhat */ cmds("dnf search golang")),
        check: (c) =>
          ran(c, famRe(c, String.raw`\bapt(-cache)?\s+search\b`, String.raw`\b(pacman|yay)\s+(-\S+\s+)*-Ss`, String.raw`\bdnf5?\s+search\b`)) &&
          goPackage(c).test(c.output),
      }),
      new ChapterTask({
        id: "install",
        perFamily: true,
        text: "Installera allt på Alex önskelista: processvisaren `htop`, programspråket Go och texteditorn Vim.",
        hint: byFamily(
          /* debian */ "Du kan ge `sudo apt install` flera paket på en gång. Go heter `golang-go` och Vim `vim`.",
          /* arch */ "Du kan ge `sudo pacman -S` flera paket på en gång. Go heter `go` och Vim `vim`.",
          /* redhat */ "Du kan ge `sudo dnf install` flera paket på en gång. Go heter `golang`, och Vim heter `vim-enhanced` i Red Hat-familjen."),
        solution: byFamily(
          /* debian */ cmds("sudo apt install htop golang-go vim"),
          /* arch */ cmds("sudo pacman -S htop go vim", "y"),
          /* redhat */ cmds("sudo dnf install htop golang vim-enhanced", "y")),
        check: (c) =>
          installed(c, "htop") && installed(c, "go") && installed(c, "vim") && ran(c, famRe(c, ...installRe)),
      }),
      new ChapterTask({
        id: "list-installed",
        perFamily: true,
        text: "Dubbelkolla: leta upp Go i listan över **installerade** paket.",
        hint: byFamily(
          /* debian */ "`apt list --installed` listar alla installerade paket. Skicka listan vidare till `grep` för att slippa leta.",
          /* arch */ "`pacman -Q` listar alla installerade paket – eller bara de paket du skriver efter.",
          /* redhat */ "`dnf list --installed` listar alla installerade paket. Skicka listan vidare till `grep` för att slippa leta."),
        solution: byFamily(
          /* debian */ cmds("apt list --installed | grep golang"),
          /* arch */ cmds("pacman -Q go"),
          /* redhat */ cmds("dnf list --installed | grep golang")),
        check: (c) =>
          installed(c, "go") &&
          ran(
            c,
            famRe(
              c,
              String.raw`\bapt(-cache)?\s+(list|show|policy)\b`,
              String.raw`\b(pacman|yay)\s+(-\S+\s+)*-Q`,
              String.raw`\bdnf5?\s+(-\S+\s+)*(list|info)\b`,
            ),
          ) &&
          goPackage(c).test(c.output),
      }),
      new ChapterTask({
        id: "remove",
        perFamily: true,
        text: "Alex provade Vim och hittade inte ut igen. – Ta bort den! Avinstallera Vim.",
        hint: byFamily(
          /* debian */ "`sudo apt remove` och paketets namn.",
          /* arch */ "`sudo pacman -R` och paketets namn.",
          /* redhat */ "`sudo dnf remove` och paketets namn – samma namn som när du installerade det."),
        solution: byFamily(
          /* debian */ cmds("sudo apt remove vim", "y"),
          /* arch */ cmds("sudo pacman -R vim", "y"),
          /* redhat */ cmds("sudo dnf remove vim-enhanced", "y")),
        check: (c) =>
          !installed(c, "vim") &&
          ran(
            c,
            famRe(
              c,
              String.raw`\bapt(-get)?\s+(-\S+\s+)*(remove|purge)\b.*\bvim\b`,
              String.raw`\bpacman\s+(-\S+\s+)*-R[a-z]*\s.*\bvim\b`,
              String.raw`\bdnf5?\s+(-\S+\s+)*(remove|rm|erase)\b.*\bvim(-enhanced)?\b`,
            ),
          ),
      }),
      new ChapterTask({
        id: "vlc",
        perFamily: true,
        text: "Alex vill kunna se film. Installera mediaspelaren VLC (`org.videolan.VLC`) som Flatpak från Flathub.",
        hint: byFamily(
          /* debian */ "`flatpak install flathub org.videolan.VLC`. Saknas Flatpak eller Flathub? Installera paketet `flatpak` och lägg till Flathub med `flatpak remote-add`.",
          /* arch */ "`flatpak install flathub org.videolan.VLC`. Saknas Flatpak eller Flathub? Installera paketet `flatpak` och lägg till Flathub med `flatpak remote-add`.",
          /* redhat */ "`flatpak install flathub org.videolan.VLC`. Saknas Flathub? Lägg till den med `flatpak remote-add`."),
        solution: cmds("flatpak install flathub org.videolan.VLC", "y"),
        check: (c) => vlcDirs.some((d) => isDir(c, d)) && re(String.raw`\bflatpak\s+(-\S+\s+)*install\b`).test(c.line),
      }),
      new ChapterTask({
        id: "go-version",
        perFamily: true,
        text: "Provkör innan du lämnar tillbaka datorn: låt Go visa sin version, så att Alex ser att kursen kan börja.",
        hint: "Programmet heter `go`, och underkommandot `version` skriver ut versionen.",
        solution: cmds("go version"),
        check: (c) => installed(c, "go") && ran(c, re(String.raw`^go\s+version\b`)) && c.output.includes("go version"),
      }),
    ],
  });
}
