// Port of Chapters/skript/textbearbetning.cs – the chapter "textbearbetning" (part "skript"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, content, outLines, ran, re, unsudo } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function textbearbetning(): Chapter {
  return new Chapter({
    id: "textbearbetning",
    part: "skript",
    title: "Textbearbetning med sed och awk",
    tasks: [
      new ChapterTask({
        id: "sed-s",
        text: "Visa `~/{{documents}}/server.log` med ordet `ERROR` utbytt mot `{{errorWord}}` på alla rader, med `sed`.",
        hint: "Kommandot `s/gammalt/nytt/` byter ut text: `sed 's/ERROR/{{errorWord}}/' fil`",
        solution: cmds("sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log"),
        check: (c) =>
          ran(c, re(String.raw`^sed\b`)) && outLines(c).length === 15 && re(c, "{{errorWord}} Could not connect").test(c.output) && !c.output.includes("ERROR"),
      }),
      new ChapterTask({
        id: "sed-d",
        text: "Visa server.log **utan** alla rader som innehåller `INFO`, med `sed`.",
        hint: "Adressen `/INFO/` väljer raderna och kommandot `d` tar bort dem: `sed '/INFO/d' fil`",
        solution: cmds("sed '/INFO/d' ~/{{documents}}/server.log"),
        check: (c) => ran(c, re(String.raw`^sed\b`)) && outLines(c).length === 6 && !c.output.includes("INFO"),
      }),
      new ChapterTask({
        id: "awk-print",
        text: "Skriv ut användarnamn och skal (fält 1 och 7) ur `/etc/passwd` med `awk`.",
        hint: "Fälten skiljs åt av kolon, så använd `-F:`. Programmet blir `'{print $1, $7}'`.",
        solution: cmds("awk -F: '{print $1, $7}' /etc/passwd"),
        check: (c) =>
          ran(c, re(String.raw`^awk\b`)) && outLines(c).some((l) => re(c, String.raw`^{{user}}\b.*\/bin\/bash$`).test(l) && !l.includes("1000")),
      }),
      new ChapterTask({
        id: "awk-sum",
        text: "Räkna ut **summan** av poängen (kolumn 3) i `~/{{documents}}/{{grades}}` med `awk`.",
        hint: "Hoppa över rubrikraden med `NR > 1`, lägg ihop med `{{sumVar}} += $3` och skriv ut i `END { }`. Avgränsaren är komma: `-F,`.",
        solution: cmds("awk -F, 'NR > 1 {{{sumVar}} += $3} END {print {{sumVar}}}' ~/{{documents}}/{{grades}}"),
        check: (c) => ran(c, re(String.raw`\bawk\b`)) && re(String.raw`(^|\D)590(\D|$)`).test(c.output),
      }),
      new ChapterTask({
        id: "sed-i",
        text: "Byt ut `Linux` mot `GNU/Linux` **direkt i filen** `~/{{notes}}`.",
        hint: "Använd `sed -i`. Eftersom ersättningen innehåller `/` är det enklast att byta avgränsare: `s|Linux|GNU/Linux|`.",
        solution: cmds("sed -i 's|Linux|GNU/Linux|' ~/{{notes}}"),
        check: (c) =>
          c.exitCode === 0 && re(String.raw`^sed\b.*\s-\w*i`).test(unsudo(c.line)) && content(c, "~/{{notes}}").includes("GNU/Linux"),
      }),
    ],
  });
}
