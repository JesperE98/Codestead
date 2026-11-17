// Port of Chapters/verktyg/skal.cs – the chapter "skal" (part "verktyg"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, content, env, flag, installed, outLines, ran, re, w, x } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function skal(): Chapter {
  return new Chapter({
    id: "skal",
    part: "verktyg",
    title: "Andra skal: zsh och fish",
    tasks: [
      new ChapterTask({
        id: "installera-zsh",
        text: "Installera skalet `zsh`.",
        hint: "`sudo apt update` och sedan `sudo apt install zsh`.",
        solution: cmds("sudo apt update", "sudo apt install zsh"),
        check: (c) => installed(c, "zsh"),
      }),
      new ChapterTask({
        id: "starta-zsh",
        text: "Starta `zsh`. Första gången frågar *zsh-newuser-install* vad du vill göra – svara `2`. Visa sedan vilket skal du kör med `echo $0`.",
        hint: "Skriv `zsh`, svara `2` och skriv sedan `echo $0`. Det ska stå `zsh`.",
        solution: cmds("zsh", "2", "echo $0"),
        check: (c) => c.sh.shellMode === "zsh" && ran(c, re(String.raw`^echo\s+["']?\$\{?0\}?["']?\s*$`)) && c.output.trim() === "zsh",
      }),
      new ChapterTask({
        id: "globstar",
        text: "Använd zsh:s `**` för att lista alla `.txt`-filer i hemkatalogen **och alla underkataloger** med ett enda `ls`.",
        hint: "`ls ~/**/*.txt` – `**` betyder \"alla kataloger, på alla nivåer\".",
        solution: cmds("ls ~/**/*.txt"),
        check: (c) => c.sh.shellMode === "zsh" && ran(c, re(String.raw`\*\*\/`)) && c.output.includes(x(c, "{{documents}}/{{fruits}}")),
      }),
      new ChapterTask({
        id: "tillbaka",
        text: "Lämna zsh och gå tillbaka till bash.",
        hint: "Skriv `exit`. Kontrollera gärna med `echo $0` eller `ps`.",
        solution: cmds("exit"),
        check: (c) => flag(c, "left:zsh") && c.sh.shellMode === "bash",
      }),
      new ChapterTask({
        id: "installera-fish",
        text: "Installera skalet `fish`.",
        hint: "`sudo apt update` och sedan `sudo apt install fish`.",
        solution: cmds("sudo apt update", "sudo apt install fish"),
        check: (c) => installed(c, "fish"),
      }),
      new ChapterTask({
        id: "fish-set",
        text: "Starta `fish`. Skapa variabeln `{{fruitVar}}` med värdet `{{fruitWord}}` på fish-sättet och skriv ut den med `echo`.",
        hint: "`{{fruitVar}}={{fruitWord}}` fungerar inte i fish. Skriv `set {{fruitVar}} {{fruitWord}}` och sedan `echo ${{fruitVar}}`.",
        solution: cmds("fish", "set {{fruitVar}} {{fruitWord}}", "echo ${{fruitVar}}"),
        check: (c) => c.sh.shellMode === "fish" && ran(c, re(c, String.raw`^echo\b.*\${{fruitVar}}\b`)) && env(c, "{{fruitVar}}") === w(c).get("fruitWord") && c.output.trim() === w(c).get("fruitWord"),
      }),
      new ChapterTask({
        id: "fish-for",
        text: "Skriv en `for`-loop med fish-syntax som skriver ut talen 1, 2 och 3, ett per rad. Gå sedan tillbaka till bash med `exit`.",
        hint: "I fish finns inget `do` och `done` – blocket avslutas med `end`: `for i in 1 2 3; echo $i; end`",
        solution: cmds("for i in 1 2 3; echo $i; end", "exit"),
        check: (c) => c.sh.shellMode === "fish" && ran(c, re(String.raw`^for\b.*\bend\s*$`)) && outLines(c).join(",") === "1,2,3",
      }),
      new ChapterTask({
        id: "chsh",
        text: "Se efter i `/etc/shells` vilka skal som är installerade. Gör sedan zsh till ditt inloggningsskal med `chsh`.",
        hint: "`cat /etc/shells` och sedan `chsh -s /usr/bin/zsh`. Kontrollera resultatet med `grep {{user}} /etc/passwd`.",
        solution: cmds("cat /etc/shells", "chsh -s /usr/bin/zsh"),
        check: (c) => re(c, String.raw`^{{user}}:.*:\/(usr\/)?bin\/zsh$`, "m").test(content(c, "/etc/passwd")),
      }),
    ],
  });
}
