// Port of Chapters/system/miljo.cs – the chapter "miljo" (part "system"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, exported, outLines, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function miljo(): Chapter {
  return new Chapter({
    id: "miljo",
    part: "system",
    title: "Variabler, PATH och alias",
    tasks: [
      new ChapterTask({
        id: "path",
        text: "Visa innehållet i variabeln `PATH`.",
        solution: cmds("echo $PATH"),
        check: (c) => ran(c, re(String.raw`^(echo|printenv)\b.*PATH`)) && c.output.includes("/usr/bin"),
      }),
      new ChapterTask({
        id: "tr-path",
        text: "Visa katalogerna i `$PATH` på **varsin rad** genom att byta `:` mot radbrytning med `tr`.",
        hint: "Radbrytning skrivs `\\n`: `echo $PATH | tr ':' '\\n'`",
        solution: cmds("echo $PATH | tr ':' '\\n'"),
        check: (c) => ran(c, re(String.raw`\btr\b`)) && outLines(c).length >= 2 && outLines(c).includes("/usr/bin"),
      }),
      new ChapterTask({
        id: "export",
        text: "Skapa miljövariabeln `{{favVar}}` med värdet `linux`.",
        hint: "Inga mellanslag runt likhetstecknet: `export NAMN=värde`.",
        solution: cmds("export {{favVar}}=linux"),
        // An environment variable: {{favVar}}=linux alone only makes a shell variable (export {{favVar}} after it works too).
        check: (c) => exported(c, "{{favVar}}") === "linux",
      }),
      new ChapterTask({
        id: "which",
        text: "Ta reda på i vilken katalog programmet `ls` ligger.",
        solution: cmds("which ls"),
        check: (c) => ran(c, re(String.raw`^(which|type)\s+ls\b`)) && c.output.includes("/usr/bin/ls"),
      }),
      new ChapterTask({
        id: "alias",
        text: "Skapa aliaset `ll` som kör `ls -la`.",
        solution: cmds("alias ll='ls -la'"),
        check: (c) => re(String.raw`^ls\s+-(la|al)$`).test(c.sh.aliases.get("ll") ?? ""),
      }),
      new ChapterTask({
        id: "exitcode",
        text: "Kör ett kommando som misslyckas, och visa sedan dess slutkod med `echo $?`.",
        hint: "Prova `ls /{{missing}}` följt av `echo $?`. Slutkoden ska inte vara 0.",
        solution: cmds("ls /{{missing}}", "echo $?"),
        check: (c) => re(String.raw`(^|[;&]\s*)echo\s+"?\$\?"?\s*$`).test(c.line) && re(String.raw`^[1-9]\d*$`).test(c.output.trim()),
      }),
    ],
  });
}
