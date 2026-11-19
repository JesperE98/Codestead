// Port of Chapters/natverk/filoverforing.cs – the chapter "filoverforing" (part "natverk"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, isFile, outLines, ran, re, rsyncFiles, sequenceEqual, serverNode, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function filoverforing(): Chapter {
  return new Chapter({
    id: "filoverforing",
    part: "natverk",
    title: "Filöverföring och SSH-inställningar",
    tasks: [
      new ChapterTask({
        id: "config",
        text: "Skapa `~/.ssh/config` så att `ssh srv` loggar in som `{{user}}` på `192.168.1.10`. Kör sedan `hostname` på servern med `ssh srv`.",
        hint: "Tre rader: `Host srv`, `    HostName 192.168.1.10` och `    User {{user}}`. Skriv dem med `echo ... >> ~/.ssh/config` och kör sedan `ssh srv hostname`.",
        solution: cmds(
          "mkdir -p ~/.ssh",
          "echo 'Host srv' > ~/.ssh/config",
          "echo '    HostName 192.168.1.10' >> ~/.ssh/config",
          "echo '    User {{user}}' >> ~/.ssh/config",
          "chmod 600 ~/.ssh/config",
          "ssh srv hostname",
          "yes"),
        check: (c) => ran(c, re(String.raw`^ssh\s+(-\S+\s+)*srv\s+hostname\b`)) && outLines(c).some((l) => l.trim() === "server"),
      }),
      new ChapterTask({
        id: "scp-up",
        text: "Kopiera `~/{{notes}}` till din hemkatalog på servern med `scp`.",
        hint: "`scp ~/{{notes}} srv:` – kolonet efter `srv` betyder \"på servern\", och utan sökväg hamnar filen i hemkatalogen där.",
        solution: cmds("scp ~/{{notes}} srv:"),
        check: (c) => ran(c, re(String.raw`^scp\b`)) && serverNode(c, "~/{{notes}}")?.type === "file",
      }),
      new ChapterTask({
        id: "scp-down",
        text: "Hämta filen `{{welcomeFile}}` från hemkatalogen på servern till katalogen `~/{{downloads}}`.",
        hint: "Källan först, målet sist: `scp srv:{{welcomeFile}} ~/{{downloads}}/`.",
        solution: cmds("scp srv:{{welcomeFile}} ~/{{downloads}}/"),
        check: (c) => ran(c, re(String.raw`^scp\b`)) && isFile(c, "~/{{downloads}}/{{welcomeFile}}"),
      }),
      new ChapterTask({
        id: "rsync-local",
        text: "Säkerhetskopiera innehållet i `~/{{documents}}` till katalogen `/tmp/{{documents}}` med `rsync -av`.",
        hint: "Snedstrecket efter källan betyder \"innehållet i\": `rsync -av ~/{{documents}}/ /tmp/{{documents}}`.",
        solution: cmds("rsync -av ~/{{documents}}/ /tmp/{{documents}}"),
        check: (c) => ran(c, re(String.raw`^rsync\b`)) && isFile(c, "/tmp/{{documents}}/{{fruits}}"),
      }),
      new ChapterTask({
        id: "rsync-again",
        text: "Skapa filen `~/{{documents}}/{{todo}}` och kör samma `rsync -av` igen. Bara den nya filen ska skickas.",
        hint: "`touch ~/{{documents}}/{{todo}}` och sedan `rsync -av ~/{{documents}}/ /tmp/{{documents}}`. Utan `-a` skickas allt varje gång.",
        solution: cmds("touch ~/{{documents}}/{{todo}}", "rsync -av ~/{{documents}}/ /tmp/{{documents}}"),
        check: (c) => ran(c, re(String.raw`^rsync\b`)) && isFile(c, "/tmp/{{documents}}/{{todo}}") && sequenceEqual(rsyncFiles(c), [w(c).get("todo")]),
      }),
      new ChapterTask({
        id: "rsync-server",
        text: "Synka innehållet i `~/{{documents}}` till katalogen `{{documents}}` i din hemkatalog på servern.",
        hint: "Samma som förut, men med servern som mål: `rsync -av ~/{{documents}}/ srv:{{documents}}/`.",
        solution: cmds("rsync -av ~/{{documents}}/ srv:{{documents}}/"),
        check: (c) => ran(c, re(String.raw`^rsync\b`)) && serverNode(c, "~/{{documents}}/{{fruits}}")?.type === "file",
      }),
      new ChapterTask({
        id: "dry-run",
        text: "Ta bort `~/{{documents}}/{{todo}}` och provkör sedan `rsync -av --delete` till `/tmp/{{documents}}` med `-n` – så att du ser vad som skulle tas bort, utan att något händer.",
        hint: "`rm ~/{{documents}}/{{todo}}` och sedan `rsync -avn --delete ~/{{documents}}/ /tmp/{{documents}}`.",
        solution: cmds("rm ~/{{documents}}/{{todo}}", "rsync -avn --delete ~/{{documents}}/ /tmp/{{documents}}"),
        check: (c) => ran(c, re(String.raw`^rsync\b.*--delete`)) && c.output.includes("(DRY RUN)") &&
          c.output.includes("deleting " + w(c).get("todo")) && isFile(c, "/tmp/{{documents}}/{{todo}}"),
      }),
    ],
  });
}
