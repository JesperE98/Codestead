// Port of Chapters/grunder/filer.cs – the chapter "filer" (part "grunder"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, exists, isDir, isFile } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function filer(): Chapter {
  return new Chapter({
    id: "filer",
    part: "grunder",
    title: "Filer och kataloger",
    tasks: [
      new ChapterTask({
        id: "mkdir",
        text: "Skapa katalogen `~/{{project}}/src` med **ett** kommando.",
        hint: "`mkdir` behöver flaggan `-p` för att skapa `{{project}}` och `src` på en gång.",
        solution: cmds("mkdir -p ~/{{project}}/src"),
        check: (c) => isDir(c, "~/{{project}}/src"),
      }),
      new ChapterTask({
        id: "touch",
        text: "Skapa en tom fil som heter `~/{{project}}/README.md`.",
        solution: cmds("touch ~/{{project}}/README.md"),
        check: (c) => isFile(c, "~/{{project}}/README.md"),
      }),
      new ChapterTask({
        id: "cp",
        text: "Kopiera `~/{{notes}}` till katalogen `~/{{project}}/`.",
        solution: cmds("cp ~/{{notes}} ~/{{project}}/"),
        check: (c) => isFile(c, "~/{{project}}/{{notes}}") && isFile(c, "~/{{notes}}"),
      }),
      new ChapterTask({
        id: "mv",
        text: "Byt namn på `~/{{project}}/{{notes}}` till `~/{{project}}/{{todo}}`.",
        hint: "Att byta namn är samma sak som att flytta – använd `mv`.",
        solution: cmds("mv ~/{{project}}/{{notes}} ~/{{project}}/{{todo}}"),
        check: (c) => isFile(c, "~/{{project}}/{{todo}}") && !exists(c, "~/{{project}}/{{notes}}"),
      }),
      new ChapterTask({
        id: "rm",
        text: "Ta bort katalogen `~/{{old}}` och allt som finns i den.",
        hint: "Katalogen är inte tom, så `rmdir` räcker inte. Använd `rm -r`.",
        solution: cmds("rm -r ~/{{old}}"),
        check: (c) => !exists(c, "~/{{old}}"),
      }),
    ],
  });
}
