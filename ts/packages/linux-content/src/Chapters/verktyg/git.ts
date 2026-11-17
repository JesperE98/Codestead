// Port of Chapters/verktyg/git.cs – the chapter "git" (part "verktyg"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, home, installed, outLines, ran, re, w, web } from "../../Checks.js";
import { GitCmd } from "../../ShellCommands.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function git(): Chapter {
  return new Chapter({
    id: "git",
    part: "verktyg",
    title: "Git i terminalen",
    tasks: [
      new ChapterTask({
        id: "installera",
        text: "Installera paketet `git`.",
        hint: "Kör `sudo apt update` och sedan `sudo apt install git`.",
        solution: cmds("sudo apt update", "sudo apt install git"),
        check: (c) => installed(c, "git"),
      }),
      new ChapterTask({
        id: "identitet",
        text: "Berätta för git vem du är: ställ in ditt namn (`user.name`) och din e-postadress (`user.email`) med `git config --global`.",
        hint: "Två kommandon: `git config --global user.name \"Ditt Namn\"` och `git config --global user.email \"du@example.com\"`.",
        solution: cmds("git config --global user.name \"{{gitName}}\"", "git config --global user.email \"{{user}}@example.com\""),
        check: (c) =>
          !!GitCmd.gitGlobalConfig(c.sh, home(c), "user.name") && !!GitCmd.gitGlobalConfig(c.sh, home(c), "user.email"),
      }),
      new ChapterTask({
        id: "init",
        text: "Gå till katalogen `~/{{webProject}}` och gör den till ett git-repo med `git init`.",
        hint: "`cd ~/{{webProject}}` och sedan `git init`. Titta gärna på den nya dolda katalogen med `ls -a`.",
        solution: cmds("cd ~/{{webProject}}", "git init"),
        check: (c) => ran(c, re(String.raw`(^|[;&]\s*)git\s+init\b`)) && GitCmd.gitRepoState(c.sh, web(c)) !== null,
      }),
      new ChapterTask({
        id: "forsta-commit",
        text: "Lägg till alla tre filerna i indexet med `git add` och gör din första commit med ett beskrivande meddelande.",
        hint: "`git add .` lägger till allt i katalogen. Sedan `git commit -m \"{{commitFirst}}\"`. Kolla läget med `git status` före och efter!",
        solution: cmds("cd ~/{{webProject}}", "git add .", "git commit -m \"{{commitFirst}}\""),
        check: (c) => {
          const s = GitCmd.gitRepoState(c.sh, web(c));
          return !!s?.head && ["index.html", "style.css", "README.md"].every((f) => s.files.includes(f));
        },
      }),
      new ChapterTask({
        id: "diff",
        text: "Lägg till en rad i slutet av `README.md` och titta på ändringen med `git diff`.",
        hint: "`echo '{{builtWith}}' >> README.md` och sedan `git diff`. Rader som börjar med `+` är nya.",
        solution: cmds("cd ~/{{webProject}}", "echo '{{builtWith}}' >> README.md", "git diff"),
        check: (c) => ran(c, re(String.raw`(^|[;&|]\s*)git\s+diff\b`)) && outLines(c).some((l) => re(String.raw`^\+(?!\+\+ )`).test(l)),
      }),
      new ChapterTask({
        id: "commit-a",
        text: "Committa ändringen i `README.md`. Prova flaggan `-a`, som tar med alla ändrade filer som git redan följer.",
        hint: "`git commit -a -m \"{{commitDescribe}}\"` – eller kortare `git commit -am \"…\"`.",
        solution: cmds("cd ~/{{webProject}}", "git commit -am \"{{commitDescribe}}\""),
        check: (c) => ran(c, re(String.raw`(^|[;&]\s*)git\s+commit\b`)) && (GitCmd.gitRepoState(c.sh, web(c))?.commits ?? 0) >= 2,
      }),
      new ChapterTask({
        id: "gren",
        text: "Skapa grenen `{{newDesign}}` och byt till den. Ändra något i `style.css` och committa ändringen på den nya grenen.",
        hint: "`git switch -c {{newDesign}}` skapar grenen och byter till den. Ändra sedan t.ex. med `echo 'h1 { color: purple; }' >> style.css` och kör `git commit -am \"{{commitPurple}}\"`.",
        solution: cmds("cd ~/{{webProject}}", "git switch -c {{newDesign}}", "echo 'h1 { color: purple; }' >> style.css", "git commit -am \"{{commitPurple}}\""),
        check: (c) => {
          const s = GitCmd.gitRepoState(c.sh, web(c));
          const design = s?.branches.get(w(c).get("newDesign")) ?? null;
          const main = s === null ? null : (s.branches.get("main") ?? s.branches.get("master") ?? null);
          return !!design && !!main && !GitCmd.gitIsAncestor(c.sh, web(c), design, main);
        },
      }),
      new ChapterTask({
        id: "merge",
        text: "Byt tillbaka till `main` och slå ihop grenen `{{newDesign}}` med `git merge`.",
        hint: "`git switch main` och sedan `git merge {{newDesign}}`. Eftersom `main` inte ändrats sedan du skapade grenen blir det en *fast-forward*.",
        solution: cmds("cd ~/{{webProject}}", "git switch main", "git merge {{newDesign}}"),
        check: (c) => {
          const s = GitCmd.gitRepoState(c.sh, web(c));
          const design = s?.branches.get(w(c).get("newDesign")) ?? null;
          return (
            ran(c, re(String.raw`(^|[;&]\s*)git\s+(merge|pull)\b`)) &&
            !!s?.head &&
            (s.branch === "main" || s.branch === "master") &&
            !!design &&
            GitCmd.gitIsAncestor(c.sh, web(c), design, s.head)
          );
        },
      }),
      new ChapterTask({
        id: "logg",
        text: "Visa historiken med en rad per commit med `git log --oneline`.",
        hint: "Prova också `git log --oneline --graph --all` för att se grenarna.",
        solution: cmds("cd ~/{{webProject}}", "git log --oneline"),
        check: (c) => ran(c, re(String.raw`(^|[;&]\s*)git\s+log\b.*--oneline`)) && outLines(c).length >= 3,
      }),
    ],
  });
}
