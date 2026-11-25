// The optional project of the main chapter "verktyg": pack your dotfiles. The learner gets a new computer soon and
// keeps the settings files of the home directory in a git repository, ~/{{dotfilesDir}}: copies of ~/.bashrc and
// ~/.gitconfig, a file of aliases of their own ({{aliasFile}}), a .gitignore that keeps a password file out of the
// history, new aliases on a branch that is merged – and finally the aliases loaded into the shell and used. Its place
// is set by defineProjects() in ChapterDefinitions.ts; the brief is src/Linux/content/chapters/<lang>/verktyg-project.md.

import { ChapterKinds } from "@codestead/learning";
import { cmds, content, home, isFile, ran, re, w } from "../../Checks.js";
import { GitCmd } from "../../ShellCommands.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

/** The dotfiles repository, e.g. /home/student/dotfiles. */
function dots(c: CheckContext): string {
  return `${home(c)}/${w(c).get("dotfilesDir")}`;
}

function state(c: CheckContext): GitCmd.RepoState | null {
  return GitCmd.gitRepoState(c.sh, dots(c));
}

/** The repository's copy of a settings file: with or without the leading dot (".bashrc" or "bashrc"). */
function copyOf(c: CheckContext, file: string): string | null {
  for (const name of [file, file.slice(1)]) if (isFile(c, `${dots(c)}/${name}`)) return name;
  return null;
}

/** The aliases in the alias file: name → value without the quotes. */
function aliases(c: CheckContext): Map<string, string> {
  const found = new Map<string, string>();
  for (const l of content(c, `${dots(c)}/${w(c).get("aliasFile")}`).split("\n")) {
    const m = /^\s*alias\s+([A-Za-z0-9_.-]+)=(.*?)\s*$/.exec(l);
    if (m !== null) found.set(m[1]!, m[2]!.replace(/^(["'])(.*)\1$/, "$2"));
  }
  return found;
}

/** The main branch (main, or master in older gits) and its commit. */
function mainBranch(s: GitCmd.RepoState): { name: string; head: string } | null {
  for (const name of ["main", "master"]) {
    const head = s.branches.get(name);
    if (head !== undefined) return { name, head };
  }
  return null;
}

/** True if a line of .gitignore (a name or a glob such as `*.txt`) matches the file name. */
function ignores(gitignore: string, name: string): boolean {
  return gitignore.split("\n").some((raw) => {
    const line = raw.trim().replace(/^\//, "");
    if (line === "" || line.startsWith("#") || line.startsWith("!") || line.endsWith("/")) return false;
    const pattern = line.replace(/[\\^$.+()[\]{}|]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
    return new RegExp(`^(.*/)?${pattern}$`).test(name);
  });
}

export function verktygProject(): Chapter {
  return new Chapter({
    id: "verktyg-project",
    part: "verktyg",
    kind: ChapterKinds.Project,
    title: "Projekt: Packa dina dotfiles",
    tasks: [
      new ChapterTask({
        id: "repo",
        text: "Skapa katalogen `~/{{dotfilesDir}}` och gör den till ett git-repo.",
        hint: "`mkdir`, `cd` och sedan `git init`. Är git inte installerat? Installera det med pakethanteraren, som i kapitlet om git.",
        solution: cmds("mkdir ~/{{dotfilesDir}}", "cd ~/{{dotfilesDir}}", "git init"),
        check: (c) => state(c) !== null,
      }),
      new ChapterTask({
        id: "pack",
        text: "Packa ner inställningarna du redan har: kopiera `~/.bashrc` och `~/.gitconfig` till `~/{{dotfilesDir}}`.",
        hint:
          "`cp` tar flera filer på en gång: `cp ~/.bashrc ~/.gitconfig ~/{{dotfilesDir}}/`. Saknas `~/.gitconfig`? Då har du inte " +
          "berättat för git vem du är än – gör det med `git config --global`.",
        solution: cmds("cp ~/.bashrc ~/.gitconfig ~/{{dotfilesDir}}/"),
        check: (c) => {
          const bashrc = copyOf(c, ".bashrc");
          const gitconfig = copyOf(c, ".gitconfig");
          return (
            bashrc !== null &&
            gitconfig !== null &&
            content(c, `${dots(c)}/${bashrc}`) === content(c, "~/.bashrc") &&
            content(c, `${dots(c)}/${gitconfig}`) === content(c, "~/.gitconfig") &&
            content(c, "~/.gitconfig") !== ""
          );
        },
      }),
      new ChapterTask({
        id: "aliases",
        text: "Skriv filen `{{aliasFile}}` i repot, med minst två alias som du själv har nytta av.",
        hint:
          "Ett alias per rad, t.ex. `alias ll='ls -la'`. Skriv raderna med `echo \"…\" >> {{aliasFile}}` – " +
          "dubbla citattecken utanför, enkla inuti.",
        solution: cmds("cd ~/{{dotfilesDir}}", "echo \"alias ll='ls -la'\" > {{aliasFile}}", "echo \"alias gs='git status'\" >> {{aliasFile}}"),
        check: (c) => aliases(c).size >= 2,
      }),
      new ChapterTask({
        id: "first-commit",
        text: "Spara läget: gör en commit som innehåller båda kopiorna och `{{aliasFile}}`.",
        hint: "`git add` och sedan `git commit -m \"…\"`. Kolla med `git status` innan, så att du vet vad som kommer med.",
        solution: cmds("cd ~/{{dotfilesDir}}", "git add .", "git commit -m \"Pack my settings\""),
        check: (c) => {
          const files = state(c)?.files ?? [];
          return (
            files.some((f) => f === ".bashrc" || f === "bashrc") &&
            files.some((f) => f === ".gitconfig" || f === "gitconfig") &&
            files.includes(w(c).get("aliasFile"))
          );
        },
      }),
      new ChapterTask({
        id: "secret",
        text:
          "Lösenordet till wifi:t ska ligga i `~/{{dotfilesDir}}/{{secretFile}}`, men det får aldrig hamna i historiken. " +
          "Skapa filen, se till att git struntar i den och committa det som behövs för det.",
        hint:
          "Skriv filens namn i `.gitignore` och committa `.gitignore`. `git status` ska inte längre visa `{{secretFile}}`. " +
          "Har filen redan kommit med i en commit? Då tar `git rm --cached` bort den ur repot men inte från disken.",
        solution: cmds(
          "cd ~/{{dotfilesDir}}",
          "echo 'wifi=hunter2' > {{secretFile}}",
          "echo '{{secretFile}}' > .gitignore",
          "git add .gitignore",
          "git commit -m \"Never commit the passwords\"",
        ),
        check: (c) => {
          const files = state(c)?.files ?? [];
          const secret = w(c).get("secretFile");
          return (
            isFile(c, `${dots(c)}/${secret}`) &&
            files.includes(".gitignore") &&
            !files.includes(secret) &&
            ignores(content(c, `${dots(c)}/.gitignore`), secret)
          );
        },
      }),
      new ChapterTask({
        id: "branch",
        text: "Prova nya alias på en gren: skapa grenen `{{aliasBranch}}`, lägg till minst ett alias till i `{{aliasFile}}` och committa på grenen.",
        hint: "`git switch -c {{aliasBranch}}`, sedan `echo \"…\" >> {{aliasFile}}` och `git commit -am \"…\"`.",
        solution: cmds(
          "cd ~/{{dotfilesDir}}",
          "git switch -c {{aliasBranch}}",
          "echo \"alias gl='git log --oneline --graph --all'\" >> {{aliasFile}}",
          "git commit -am \"Alias for the history\"",
        ),
        check: (c) => {
          const s = state(c);
          const branch = s?.branches.get(w(c).get("aliasBranch"));
          const main = s === null ? null : mainBranch(s);
          return branch !== undefined && main !== null && !GitCmd.gitIsAncestor(c.sh, dots(c), branch, main.head);
        },
      }),
      new ChapterTask({
        id: "merge-and-use",
        text:
          "Aliasen fungerar – slå ihop `{{aliasBranch}}` med huvudgrenen. Läs sedan in `{{aliasFile}}` i skalet med `source` " +
          "och kör ett av dina alias.",
        hint:
          "`git switch main` och `git merge {{aliasBranch}}`. Sedan `source {{aliasFile}}` – och skriv namnet på ett alias som om det vore ett kommando.",
        solution: cmds("cd ~/{{dotfilesDir}}", "git switch main", "git merge {{aliasBranch}}", "source {{aliasFile}}", "gl"),
        check: (c) => {
          const s = state(c);
          const branch = s?.branches.get(w(c).get("aliasBranch"));
          const main = s === null ? null : mainBranch(s);
          const defined = aliases(c);
          const name = c.line.split(/\s+/)[0]!;
          return (
            branch !== undefined &&
            main !== null &&
            s?.branch === main.name &&
            GitCmd.gitIsAncestor(c.sh, dots(c), branch, main.head) &&
            defined.size >= 3 &&
            defined.has(name) &&
            c.sh.aliases.get(name) === defined.get(name) &&
            !ran(c, re(String.raw`^alias\b`))
          );
        },
      }),
    ],
  });
}
