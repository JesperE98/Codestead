// Port of Chapters/grunder/lasa-text.cs – the chapter "lasa-text" (part "grunder"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { at, cmds, item, outLines, ran, re, sequenceEqual, sortedLines, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function lasaText(): Chapter {
  return new Chapter({
    id: "lasa-text",
    part: "grunder",
    title: "Läsa och söka i text",
    tasks: [
      new ChapterTask({
        id: "head",
        text: "Visa de **3 första** raderna i `~/{{documents}}/server.log`.",
        solution: cmds("head -n 3 ~/{{documents}}/server.log"),
        check: (c) => ran(c, re(String.raw`^head\b`)) && outLines(c).length === 3 && c.output.includes("Server starting"),
      }),
      new ChapterTask({
        id: "tail",
        text: "Visa de **2 sista** raderna i `~/{{documents}}/server.log`.",
        solution: cmds("tail -n 2 ~/{{documents}}/server.log"),
        check: (c) => ran(c, re(String.raw`^tail\b`)) && outLines(c).length === 2 && c.output.includes("Rotating"),
      }),
      new ChapterTask({
        id: "grep",
        text: "Visa alla rader som innehåller `ERROR` i `~/{{documents}}/server.log`.",
        solution: cmds("grep ERROR ~/{{documents}}/server.log"),
        check: (c) => ran(c, re(String.raw`^grep\b`)) && outLines(c).length === 3 && outLines(c).every((l) => l.includes("ERROR")),
      }),
      new ChapterTask({
        id: "grep-i",
        text: "Sök efter `warn` i server.log **utan** att bry dig om stora eller små bokstäver.",
        hint: "Flaggan `-i` gör sökningen skiftlägesokänslig. Det ska bli 3 träffar.",
        solution: cmds("grep -i warn ~/{{documents}}/server.log"),
        check: (c) => ran(c, re(String.raw`^grep\b.*\s-\w*i`)) && re("warn", "i").test(c.line) && (outLines(c).length === 3 || c.output.trim() === "3"),
      }),
      new ChapterTask({
        id: "wc",
        text: "Räkna hur många rader `~/{{documents}}/{{fruits}}` har.",
        solution: cmds("wc -l ~/{{documents}}/{{fruits}}"),
        check: (c) => ran(c, re(String.raw`\bwc\b.*-\w*l`)) && re(String.raw`\b10\b`).test(c.output),
      }),
      new ChapterTask({
        id: "sort",
        text: "Visa frukterna i `~/{{documents}}/{{fruits}}` i bokstavsordning.",
        solution: cmds("sort ~/{{documents}}/{{fruits}}"),
        check: (c) => ran(c, re(String.raw`\bsort\b`)) && c.line.includes(w(c).get("fruits")) && at(outLines(c), 0) === item(sortedLines(c, w(c).file("fruits")), 0),
      }),
      new ChapterTask({
        id: "cut",
        text: "Visa bara ämnena – fält 2 – i `~/{{documents}}/{{grades}}` med `cut`.",
        hint: "Fälten skiljs åt av kommatecken: `-d,` väljer avgränsaren och `-f2` fältet.",
        solution: cmds("cut -d, -f2 ~/{{documents}}/{{grades}}"),
        check: (c) =>
          ran(c, re(String.raw`^cut\b`)) && sequenceEqual(
            outLines(c),
            w(c)
              .file("grades")
              .split("\n")
              .filter((l) => l.trim() !== "")
              .map((l) => item(l.split(","), 1)),
          ),
      }),
    ],
  });
}
