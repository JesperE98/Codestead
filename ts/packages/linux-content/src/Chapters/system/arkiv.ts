// Port of Chapters/system/arkiv.cs – the chapter "arkiv" (part "system"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { archiveHas, cmds, content, isFile, outLines, ran, re, tarOps, x } from "../../Checks.js";
import { ArchiveCmd } from "../../ShellCommands.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function arkiv(): Chapter {
  return new Chapter({
    id: "arkiv",
    part: "system",
    title: "Arkiv och komprimering",
    tasks: [
      new ChapterTask({
        id: "tar-czf",
        text: "Packa ihop katalogen `~/{{documents}}` till det komprimerade arkivet `~/{{documents}}.tar.gz`.",
        hint: "Stå i hemkatalogen och använd *create zipped verbose file*: `tar -czvf {{documents}}.tar.gz {{documents}}`.",
        solution: cmds("cd ~", "tar -czvf {{documents}}.tar.gz {{documents}}"),
        check: (c) => archiveHas(c, "~/{{documents}}.tar.gz", "tar.gz", "{{documents}}/{{fruits}}"),
      }),
      new ChapterTask({
        id: "tar-t",
        text: "Lista innehållet i `~/{{documents}}.tar.gz` – utan att packa upp det.",
        hint: "`t` betyder lista: `tar -tzvf ~/{{documents}}.tar.gz`.",
        solution: cmds("tar -tzvf ~/{{documents}}.tar.gz"),
        check: (c) => ran(c, re(String.raw`\btar\b`)) && tarOps(c.line) === "t" && c.output.includes(x(c, "{{documents}}/server.log")),
      }),
      new ChapterTask({
        id: "tar-x",
        text: "Skapa katalogen `~/{{unpacked}}` och packa upp `~/{{documents}}.tar.gz` i den.",
        hint: "Med `-C` väljer du var tar packar upp: `tar -xzvf ~/{{documents}}.tar.gz -C ~/{{unpacked}}`.",
        solution: cmds("mkdir ~/{{unpacked}}", "tar -xzvf ~/{{documents}}.tar.gz -C ~/{{unpacked}}"),
        check: (c) => tarOps(c.line).includes("x") && isFile(c, "~/{{unpacked}}/{{documents}}/{{fruits}}"),
      }),
      new ChapterTask({
        id: "gzip",
        text: "Kopiera `~/{{documents}}/server.log` till din hemkatalog och komprimera kopian med `gzip`, så att du får `~/server.log.gz`.",
        hint: "Först `cp ~/{{documents}}/server.log ~`, sedan `gzip ~/server.log`.",
        solution: cmds("cp ~/{{documents}}/server.log ~", "gzip -v ~/server.log"),
        check: (c) => ArchiveCmd.gunzipString(content(c, "~/server.log.gz"))?.d.includes("Server starting") ?? false,
      }),
      new ChapterTask({
        id: "zcat",
        text: "Visa raderna med `ERROR` i `~/server.log.gz` – utan att packa upp filen.",
        hint: "`zcat` skriver ut innehållet i en .gz-fil. Skicka det vidare till `grep` med en pipe.",
        solution: cmds("zcat ~/server.log.gz | grep ERROR"),
        check: (c) =>
          ran(c, re(String.raw`\bzcat\b|\bgunzip\s+-\w*c|\bgzip\s+-\w*(d\w*c|c\w*d)`)) &&
          isFile(c, "~/server.log.gz") &&
          ((outLines(c).length === 3 && outLines(c).every((l) => l.includes("ERROR"))) || c.output.trim() === "3"),
      }),
      new ChapterTask({
        id: "zip",
        text: "Installera paketen `zip` och `unzip`, och packa sedan ihop `~/{{documents}}` till `~/{{documents}}.zip`.",
        hint: "Kör `sudo apt update` och `sudo apt install zip unzip`. Glöm inte `-r` till zip: `zip -r {{documents}}.zip {{documents}}`.",
        solution: cmds("sudo apt update", "sudo apt install zip unzip", "cd ~", "zip -r {{documents}}.zip {{documents}}"),
        check: (c) => archiveHas(c, "~/{{documents}}.zip", "zip", "{{documents}}/{{fruits}}"),
      }),
      new ChapterTask({
        id: "unzip",
        text: "Packa upp `~/{{documents}}.zip` i den nya katalogen `~/{{fromZip}}` med `unzip`.",
        hint: "`-d` väljer katalog och skapar den om den saknas: `unzip ~/{{documents}}.zip -d ~/{{fromZip}}`.",
        solution: cmds("unzip ~/{{documents}}.zip -d ~/{{fromZip}}"),
        check: (c) =>
          re(String.raw`\bunzip\b`).test(c.line) &&
          (isFile(c, "~/{{fromZip}}/{{documents}}/{{fruits}}") || isFile(c, "~/{{fromZip}}/home/{{user}}/{{documents}}/{{fruits}}")),
      }),
    ],
  });
}
