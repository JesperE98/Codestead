// Port of Chapters/grunder/pipes.cs – the chapter "pipes" (part "grunder"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, content, outLines, ran, re, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function pipes(): Chapter {
  return new Chapter({
    id: "pipes",
    part: "grunder",
    title: "Omdirigering och pipes",
    tasks: [
      new ChapterTask({
        id: "redirect",
        text: "Skriv texten `{{helloShell}}` till filen `~/{{helloFile}}` med `echo` och `>`.",
        solution: cmds("echo \"{{helloShell}}\" > ~/{{helloFile}}"),
        check: (c) => content(c, "~/{{helloFile}}").includes(w(c).get("helloShell")),
      }),
      new ChapterTask({
        id: "append",
        text: "Lägg till en rad till i `~/{{helloFile}}` – utan att skriva över den första.",
        hint: "Använd `>>` i stället för `>`.",
        solution: cmds("echo \"{{anotherLine}}\" >> ~/{{helloFile}}"),
        check: (c) => {
          const lines = content(c, "~/{{helloFile}}").split("\n").filter((l) => l !== "");
          return lines.length >= 2 && lines[0]!.includes(w(c).get("helloShell"));
        },
      }),
      new ChapterTask({
        id: "count-errors",
        text: "Räkna antalet rader med `ERROR` i server.log genom att skicka `grep` vidare till `wc -l` med en pipe.",
        solution: cmds("grep ERROR ~/{{documents}}/server.log | wc -l"),
        check: (c) => ran(c, re(String.raw`grep.*\|\s*wc\s+-l`)) && c.output.trim() === "3",
      }),
      new ChapterTask({
        id: "uniq",
        text: "Visa hur många gånger varje frukt förekommer i `{{fruits}}`, med `sort` och `uniq -c`.",
        solution: cmds("sort ~/{{documents}}/{{fruits}} | uniq -c"),
        check: (c) => ran(c, re(String.raw`sort.*\|\s*uniq\s+-c`)) && c.output.includes("3 " + w(c).file("fruits").split("\n")[0]),
      }),
      new ChapterTask({
        id: "save-ls",
        text: "Spara en lista över filerna i `/etc` i filen `~/{{etcFiles}}`.",
        solution: cmds("ls /etc > ~/{{etcFiles}}"),
        check: (c) => content(c, "~/{{etcFiles}}").includes("os-release"),
      }),
      new ChapterTask({
        id: "devnull",
        text: "Kör `ls /{{missing}}`, men skicka felmeddelandet till `/dev/null` så att inget syns.",
        solution: cmds("ls /{{missing}} 2> /dev/null"),
        check: (c) => re(c, String.raw`^ls\s+\/{{missing}}\b.*2>\s*\/dev\/null`).test(c.line) && c.output.trim() === "",
      }),
      new ChapterTask({
        id: "tr-upper",
        text: "Skriv ut alla användarnamn i `/etc/passwd` med **versaler**: plocka ut fält 1 med `cut` och skicka vidare till `tr`.",
        hint: "`cut -d: -f1 /etc/passwd` ger användarnamnen. Lägg till `| tr a-z A-Z`.",
        solution: cmds("cut -d: -f1 /etc/passwd | tr a-z A-Z"),
        check: (c) => ran(c, re(String.raw`\|\s*tr\b`)) && outLines(c).includes("ROOT") && outLines(c).includes(w(c).user.toUpperCase()),
      }),
      new ChapterTask({
        id: "xargs",
        text: "Räkna raderna i varje fil i `~/{{documents}}`: hitta filerna med `find -type f` och ge dem till `wc -l` med `xargs`.",
        hint: "`find ~/{{documents}} -type f | xargs wc -l` – `wc` läser inte filnamn från en pipe, men `xargs` gör dem till argument.",
        solution: cmds("find ~/{{documents}} -type f | xargs wc -l"),
        check: (c) => ran(c, re(String.raw`^find\b.*\|\s*xargs\s+(-\S+\s+)*wc\b`)) && re(String.raw`\d+ total`).test(c.output),
      }),
    ],
  });
}
