// Port of Chapters/skript/skript.cs – the chapter "skript" (part "skript"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { at, cmds, content, env, isFile, outLines, ran, re, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function skript(): Chapter {
  return new Chapter({
    id: "skript",
    part: "skript",
    title: "Shell-skript",
    tasks: [
      new ChapterTask({
        id: "variabel",
        text: "Skapa variabeln `{{nameVar}}` med ditt namn, och skriv sedan ut `{{hello}}` följt av namnet med `echo`.",
        hint: "Inga mellanslag runt `=`: `{{nameVar}}=Kim`. Använd sedan `echo \"{{hello}} ${{nameVar}}\"`.",
        solution: cmds("{{nameVar}}=Kim", "echo \"{{hello}} ${{nameVar}}\""),
        check: (c) => ran(c, re(c, String.raw`^echo\b.*\$\{?{{nameVar}}\b`)) && !!env(c, "{{nameVar}}") && c.output.trim() === `${w(c).get("hello")} ${env(c, "{{nameVar}}")}`,
      }),
      new ChapterTask({
        id: "rakna",
        text: "Räkna ut 17 × 23 med `$(( ))`.",
        solution: cmds("echo $(( 17 * 23 ))"),
        check: (c) => ran(c, re(String.raw`\$\(\(`)) && c.output.trim() === "391",
      }),
      new ChapterTask({
        id: "substitution",
        text: "Spara antalet rader i `~/{{documents}}/server.log` i variabeln `{{linesVar}}`, med `$(...)` och `wc -l`.",
        hint: "`wc -l < fil` skriver bara ut antalet, utan filnamnet: `{{linesVar}}=$(wc -l < ~/{{documents}}/server.log)`",
        solution: cmds("{{linesVar}}=$(wc -l < ~/{{documents}}/server.log)"),
        check: (c) => (env(c, "{{linesVar}}") ?? "").trim() === "15",
      }),
      new ChapterTask({
        id: "if",
        text: "Skriv ett `if`-villkor som skriver ut `{{exists}}` om filen `~/.bashrc` finns.",
        hint: "`if [ -f ~/.bashrc ]; then echo {{exists}}; fi` – glöm inte mellanslagen innanför hakparenteserna.",
        solution: cmds("if [ -f ~/.bashrc ]; then echo {{exists}}; fi"),
        check: (c) => ran(c, re(String.raw`^if\b`)) && re(String.raw`\[|\btest\b`).test(c.line) && c.output.trim() === w(c).get("exists"),
      }),
      new ChapterTask({
        id: "for",
        text: "Skriv ut talen 1 till 5, ett per rad, med en `for`-loop.",
        hint: "Antingen `for i in 1 2 3 4 5; do ...; done` eller `for i in $(seq 1 5); do ...; done`.",
        solution: cmds("for i in 1 2 3 4 5; do echo $i; done"),
        check: (c) => ran(c, re(String.raw`^for\b`)) && outLines(c).join(",") === "1,2,3,4,5",
      }),
      new ChapterTask({
        id: "while-read",
        text: "Läs `~/{{documents}}/{{fruits}}` rad för rad med `while read` och skriv ut `{{fruitLabel}}: ` framför varje rad.",
        hint: "`while read {{lineVar}}; do echo \"{{fruitLabel}}: ${{lineVar}}\"; done < ~/{{documents}}/{{fruits}}`",
        solution: cmds("while read {{lineVar}}; do echo \"{{fruitLabel}}: ${{lineVar}}\"; done < ~/{{documents}}/{{fruits}}"),
        check: (c) => ran(c, re(String.raw`\bwhile\s+read\b`)) && outLines(c).length === 10 && at(outLines(c), 0) === `${w(c).get("fruitLabel")}: ${w(c).file("fruits").split("\n")[0]}`,
      }),
      new ChapterTask({
        id: "funktion",
        text: "Skapa funktionen `{{doubleFn}}` som skriver ut sitt första argument gånger två. Testa med `{{doubleFn}} 21`.",
        hint: "`{{doubleFn}}() { echo $(( $1 * 2 )); }` – och sedan `{{doubleFn}} 21`.",
        solution: cmds("{{doubleFn}}() { echo $(( $1 * 2 )); }", "{{doubleFn}} 21"),
        check: (c) => ran(c, re(c, String.raw`^{{doubleFn}}\s+21\s*$`)) && c.sh.functions.has(w(c).get("doubleFn")) && c.output.trim() === "42",
      }),
      new ChapterTask({
        id: "backup",
        text: "Skriv skriptet `~/backup.sh` som kopierar filen i första argumentet till samma namn med `.bak` på slutet. Gör det körbart och kör `./backup.sh {{notes}}` i hemkatalogen.",
        hint: "Skapa filen med `cat > ~/backup.sh << '{{heredocEnd}}'`, skriv `#!/bin/bash` och `cp \"$1\" \"$1.bak\"` på varsin rad och avsluta med `{{heredocEnd}}`.",
        solution: cmds("cat > ~/backup.sh << '{{heredocEnd}}'", "#!/bin/bash", "cp \"$1\" \"$1.bak\"", "{{heredocEnd}}", "chmod +x ~/backup.sh", "cd ~", "./backup.sh {{notes}}"),
        check: (c) =>
          ran(c, re(c, String.raw`backup\.sh\s+{{notes}}\s*$`)) && content(c, "~/backup.sh").includes("$1") && isFile(c, "~/{{notes}}.bak"),
      }),
    ],
  });
}
