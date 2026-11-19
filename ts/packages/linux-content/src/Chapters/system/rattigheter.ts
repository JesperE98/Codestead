// Port of Chapters/system/rattigheter.cs – the chapter "rattigheter" (part "system"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { Js } from "@codestead/linux-shell";
import { cmds, content, mode, ran, re, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function rattigheter(): Chapter {
  return new Chapter({
    id: "rattigheter",
    part: "system",
    title: "Användare, rättigheter och sudo",
    tasks: [
      new ChapterTask({
        id: "groups",
        text: "Ta reda på vilka grupper du tillhör.",
        solution: cmds("groups"),
        check: (c) => ran(c, re(String.raw`^(groups|id)\b`)),
      }),
      new ChapterTask({
        id: "shadow",
        text: "Försök läsa `/etc/shadow` med `cat` – och gör det sedan med `sudo`.",
        solution: cmds("cat /etc/shadow", "sudo cat /etc/shadow"),
        check: (c) => ran(c, re(String.raw`^sudo\s+(cat|less|head|tail)\s+\/etc\/shadow\s*$`)),
      }),
      new ChapterTask({
        id: "script",
        text: "Skapa skriptet `~/{{helloScript}}` som innehåller raden `echo {{helloScriptText}}`.",
        hint: "Använd enkla citattecken: `echo 'echo {{helloScriptText}}' > ~/{{helloScript}}`",
        solution: cmds("echo 'echo {{helloScriptText}}' > ~/{{helloScript}}"),
        check: (c) => re(c, String.raw`echo\s+.*{{helloScriptText}}`).test(content(c, "~/{{helloScript}}")),
      }),
      new ChapterTask({
        id: "chmod-x",
        text: "Gör `~/{{helloScript}}` körbart.",
        solution: cmds("chmod +x ~/{{helloScript}}"),
        check: (c) => (mode(c, "~/{{helloScript}}") & Js.oct(100)) !== 0,
      }),
      new ChapterTask({
        id: "run-script",
        text: "Kör skriptet med `./{{helloScript}}` (stå i hemkatalogen).",
        solution: cmds("cd ~", "./{{helloScript}}"),
        check: (c) => ran(c, re(c, String.raw`(\.\/|~\/|\/home\/{{user}}\/){{helloScript}}\s*$`)) && c.output.includes(w(c).get("helloScriptText")),
      }),
      new ChapterTask({
        id: "chmod-600",
        text: "Gör `~/{{notes}}` läsbar och skrivbar **bara** för dig (`rw-------`).",
        hint: "r = 4, w = 2, x = 1. Ägaren ska ha 4 + 2 och övriga 0.",
        solution: cmds("chmod 600 ~/{{notes}}"),
        check: (c) => (mode(c, "~/{{notes}}") & Js.oct(777)) === Js.oct(600),
      }),
    ],
  });
}
