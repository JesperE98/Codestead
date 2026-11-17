// Port of Chapters/distro/distributioner.cs – the chapter "distributioner" (part "distro"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { byFamily, cmds, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function distributioner(): Chapter {
  return new Chapter({
    id: "distributioner",
    part: "distro",
    title: "Distributioner och familjer",
    tasks: [
      new ChapterTask({
        id: "os-release",
        perFamily: true,
        text: "Ta reda på namnet och versionen på distributionen du kör.",
        solution: cmds("cat /etc/os-release"),
        check: (c) => ran(c, re(String.raw`\/etc\/os-release`)),
      }),
      new ChapterTask({
        id: "kernel",
        perFamily: true,
        text: "Visa vilken version av Linuxkärnan som körs.",
        solution: cmds("uname -r"),
        check: (c) => ran(c, re(String.raw`^uname\s+-\w*[ra]`)),
      }),
      new ChapterTask({
        id: "pm-config",
        perFamily: true,
        text: byFamily(
          /* debian */ "Titta på vilka förråd apt använder i `/etc/apt/sources.list.d/`.",
          /* arch */ "Titta på pacmans inställningar i `/etc/pacman.conf`.",
          /* redhat */ "Titta på vilka förråd dnf använder i `/etc/yum.repos.d/`."),
        solution: byFamily(
          /* debian */ cmds("ls /etc/apt/sources.list.d"),
          /* arch */ cmds("cat /etc/pacman.conf"),
          /* redhat */ cmds("ls /etc/yum.repos.d")),
        check: (c) => {
          const familyRe =
            c.distro.family === "debian"
              ? re(String.raw`\/etc\/apt\b`)
              : c.distro.family === "arch"
                ? re(String.raw`\/etc\/pacman`)
                : c.distro.family === "redhat"
                  ? re(String.raw`\/etc\/(yum\.repos\.d|dnf)\b`)
                  : null;
          return ran(c, re(String.raw`^(ls|cat|less|head|tail|tree|find)\b`)) && familyRe!.test(c.line);
        },
      }),
    ],
  });
}
