// The optional project of the main chapter "grunder": the log detective. The learner investigates the night the
// server had trouble (~/{{documents}}/server.log) with what the part taught – folders, copies, grep, wc, head, cut,
// sort, pipes and redirection – and writes a small case report. Its place is set by defineProjects() in
// ChapterDefinitions.ts; the brief is src/Linux/content/chapters/<lang>/grunder-project.md.

import { ChapterKinds } from "@codestead/learning";
import { InitfsLib } from "@codestead/linux-shell";
import { cmds, content, isDir, isFile, outLines, ran, re } from "../../Checks.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

const errorLines = InitfsLib.ServerLog.split("\n").filter((l) => l.includes("ERROR"));

/** The lines of the case report (empty when there is none). */
function report(c: CheckContext): string[] {
  return content(c, "~/{{caseDir}}/{{caseReport}}")
    .split("\n")
    .map((l) => l.trim());
}

/** A line of the report that gives the number of warnings: 3, alone or after a label ("Warnings: 3"). */
function countLine(l: string): boolean {
  return /(^|[^0-9])3$/.test(l) && !l.includes("2026");
}

export function grunderProject(): Chapter {
  return new Chapter({
    id: "grunder-project",
    part: "grunder",
    kind: ChapterKinds.Project,
    title: "Projekt: Loggdetektiven",
    tasks: [
      new ChapterTask({
        id: "case-folder",
        text: "Skapa en mapp för utredningen, `~/{{caseDir}}`, med undermappen `{{evidence}}` – med **ett** kommando.",
        hint: "`mkdir -p` skapar alla mappar på vägen på en gång.",
        solution: cmds("mkdir -p ~/{{caseDir}}/{{evidence}}"),
        check: (c) => isDir(c, "~/{{caseDir}}/{{evidence}}"),
      }),
      new ChapterTask({
        id: "copy-log",
        text: "Säkra bevisen: kopiera `~/{{documents}}/server.log` till `~/{{caseDir}}/{{evidence}}/`. Originalet ska ligga kvar.",
        hint: "Kopiera med `cp`, inte `mv` – en detektiv flyttar aldrig bevisen från brottsplatsen.",
        solution: cmds("cp ~/{{documents}}/server.log ~/{{caseDir}}/{{evidence}}/"),
        check: (c) =>
          content(c, "~/{{caseDir}}/{{evidence}}/server.log") === InitfsLib.ServerLog && isFile(c, "~/{{documents}}/server.log"),
      }),
      new ChapterTask({
        id: "errors",
        text: "Spara alla rader med `ERROR` ur loggen i filen `~/{{caseDir}}/{{errorsFile}}`.",
        hint: "`grep` hittar raderna och `>` skickar dem till en fil i stället för till skärmen.",
        solution: cmds("grep ERROR ~/{{caseDir}}/{{evidence}}/server.log > ~/{{caseDir}}/{{errorsFile}}"),
        check: (c) => {
          const lines = content(c, "~/{{caseDir}}/{{errorsFile}}").split("\n").filter((l) => l !== "");
          return lines.length === errorLines.length && lines.every((l, i) => l === errorLines[i]);
        },
      }),
      new ChapterTask({
        id: "count-warnings",
        text:
          "Hur många varningar finns det? Räkna raderna med `WARN` – oavsett stora eller små bokstäver – och skriv antalet " +
          "som första rad i rapporten `~/{{caseDir}}/{{caseReport}}`.",
        hint: "`grep -i` bryr sig inte om stora och små bokstäver, och `wc -l` räknar raderna. Koppla ihop dem med en pipe och avsluta med `>`.",
        solution: cmds("grep -i warn ~/{{caseDir}}/{{evidence}}/server.log | wc -l > ~/{{caseDir}}/{{caseReport}}"),
        check: (c) => countLine(report(c)[0] ?? ""),
      }),
      new ChapterTask({
        id: "first-error",
        text: "När började problemen? Lägg till **den första** felraden i rapporten – utan att skriva över antalet som redan står där.",
        hint: "`head -n 1` tar bara första raden. `>>` lägger till i slutet av filen, medan `>` skriver över den.",
        solution: cmds("grep ERROR ~/{{caseDir}}/{{evidence}}/server.log | head -n 1 >> ~/{{caseDir}}/{{caseReport}}"),
        check: (c) => {
          const lines = report(c);
          return lines.some(countLine) && lines.includes(errorLines[0]!);
        },
      }),
      new ChapterTask({
        id: "times",
        text:
          "Lägg till **bara klockslagen** för alla fel i rapporten, ett per rad och sorterade från det senaste till det tidigaste.",
        hint:
          "Fälten i loggen skiljs åt av mellanslag, och klockslaget är fält 2: `cut -d' ' -f2`. `sort -r` sorterar baklänges. " +
          "Bygg en pipe från `grep` via `cut` och `sort` och avsluta med `>>`.",
        solution: cmds("grep ERROR ~/{{caseDir}}/{{evidence}}/server.log | cut -d' ' -f2 | sort -r >> ~/{{caseDir}}/{{caseReport}}"),
        check: (c) => {
          const lines = report(c);
          const i = lines.indexOf("18:00:00");
          return lines.some(countLine) && lines.includes(errorLines[0]!) && i >= 0 && lines[i + 1] === "13:30:00" && lines[i + 2] === "09:15:10";
        },
      }),
      new ChapterTask({
        id: "show-report",
        text: "Fallet är löst! Visa hela rapporten i terminalen och kontrollera att allt kom med.",
        solution: cmds("cat ~/{{caseDir}}/{{caseReport}}"),
        check: (c) => {
          const lines = report(c).filter((l) => l !== "");
          return (
            lines.length >= 5 &&
            ran(c, re(String.raw`^(cat|less|more|head|tail)\b`)) &&
            c.exitCode === 0 &&
            lines.every((l) => outLines(c).some((o) => o.trim() === l))
          );
        },
      }),
    ],
  });
}
