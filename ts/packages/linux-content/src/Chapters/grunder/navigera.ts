// Port of Chapters/grunder/navigera.cs – the chapter "navigera" (part "grunder"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, home, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function navigera(): Chapter {
  return new Chapter({
    id: "navigera",
    part: "grunder",
    title: "Navigera i filsystemet",
    tasks: [
      new ChapterTask({
        id: "etc",
        text: "Gå till katalogen `/etc` och lista vad som finns där.",
        hint: "Två kommandon: först `cd`, sedan `ls`. Du kan också skriva dem på samma rad: `cd /etc && ls`.",
        solution: cmds("cd /etc", "ls"),
        check: (c) => ran(c, re(String.raw`(^|[;&|]\s*)ls(\s|$)`)) && c.sh.cwd === "/etc",
      }),
      new ChapterTask({
        id: "hidden",
        text: "Visa de dolda filerna i din hemkatalog.",
        hint: "Flaggan `-a` visar filer som börjar med punkt. Din hemkatalog är `~`.",
        solution: cmds("ls -a ~"),
        check: (c) => ran(c, re(String.raw`^ls\b.*\s-\w*[aA]`)) && (c.sh.cwd === home(c) || re(c, String.raw`\s(~\/?|\/home\/{{user}}\/?)(\s|$)`).test(c.line)),
      }),
      new ChapterTask({
        id: "relative",
        text: "Ställ dig i roten (`/`) och gå sedan till `/var/log` med en **relativ** sökväg.",
        hint: "En relativ sökväg börjar inte med `/`. Står du i `/` räcker `cd var/log`.",
        solution: cmds("cd /", "cd var/log"),
        check: (c) => c.sh.cwd === "/var/log" && re(String.raw`(^|[;&]\s*)cd\s+(\.\/)?var\/log\/?\s*$`).test(c.line),
      }),
      new ChapterTask({
        id: "up",
        text: "Gå upp en nivå med `cd ..` (cd, mellanslag och två punkter).",
        solution: cmds("cd .."),
        check: (c) => ran(c, re(String.raw`^cd\s+\.\.\/?\s*$`)),
      }),
      new ChapterTask({
        id: "home",
        text: "Gå tillbaka till din hemkatalog med bara `cd`, utan argument.",
        solution: cmds("cd"),
        check: (c) => c.line === "cd" && c.sh.cwd === home(c),
      }),
    ],
  });
}
