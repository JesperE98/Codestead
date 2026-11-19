// Port of Chapters/start/valkommen.cs – the chapter "valkommen" (part "start"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, ran, re, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function valkommen(): Chapter {
  return new Chapter({
    id: "valkommen",
    part: "start",
    title: "Välkommen till Linux-shell",
    tasks: [
      new ChapterTask({
        id: "echo",
        text: "Skriv ut texten `{{helloWorld}}` med `echo`.",
        solution: cmds("echo {{helloWorld}}"),
        check: (c) => ran(c, re(String.raw`^echo\b`)) && c.output.toUpperCase().includes(w(c).get("helloWorld").toUpperCase()),
      }),
      new ChapterTask({
        id: "whoami",
        text: "Ta reda på vilken användare du är inloggad som, med `whoami`.",
        solution: cmds("whoami"),
        check: (c) => ran(c, re(String.raw`^whoami\s*$`)),
      }),
      new ChapterTask({
        id: "os-release",
        text: "Visa vilken distribution du kör med `cat /etc/os-release`.",
        solution: cmds("cat /etc/os-release"),
        check: (c) => ran(c, re(String.raw`^cat\s+\/etc\/os-release\s*$`)),
      }),
      new ChapterTask({
        id: "help",
        text: "Lista alla kommandon som finns i simulatorn med `help`.",
        solution: cmds("help"),
        check: (c) => ran(c, re(String.raw`^help\b`)),
      }),
    ],
  });
}
