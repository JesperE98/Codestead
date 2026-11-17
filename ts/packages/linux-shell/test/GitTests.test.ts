// Port of tests/Linux/Codestead.Shell.Tests/GitTests.cs (src/shell/git.test.ts).

import { afterEach, describe, expect, it } from "vitest";
import * as GitCmd from "../src/Commands/Git/GitCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import { Js } from "../src/Js.js";
import * as PackagesLib from "../src/Packages/PackagesLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { TestShell, itNeeds } from "./TestShell.js";

const Web = "/home/elev/projekt-webb";

/** Shell.create(distro, "sv") with the English UI, git installed and an identity (C# MakeShell). */
function makeShell(distro = "arch", identity = true, git = true): TestShell {
  const s = new TestShell(distro, "en");
  if (git) PackagesLib.installPackage(s.sh, PackagesLib.packages.find((p) => p.id === "git")!);
  if (identity) {
    s.run('git config --global user.name "Elev Elevsson"');
    s.run("git config --global user.email elev@example.com");
  }
  return s;
}

/** A repository in ~/projekt-webb with a first commit. */
function repo(distro = "arch"): TestShell {
  const s = makeShell(distro);
  s.run("cd ~/projekt-webb");
  s.run("git init -q");
  s.run("git add .");
  s.run('git commit -q -m "Första versionen"');
  return s;
}

const hashes = (s: string): string => s.replace(/[0-9a-f]{7}/g, "H");

describe("GitTests", () => {
  afterEach(() => {
    Js.clockOverride = null;
  });

  // objekt

  itNeeds(["git", "echo"], "blob-id blir samma som i riktiga git", () => {
    expect(GitCmd.blobHash("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    expect(GitCmd.blobHash("")).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    expect(GitCmd.sha1("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    const s = makeShell();
    s.run("echo hello > ~/h.txt");
    expect(s.run("git hash-object ~/h.txt").out).toBe("ce013625030ba8dba906f756967f9e9ca394464a\n");
  });

  itNeeds(["git", "sudo", "apt"], "git finns inte förrän paketet installerats", () => {
    const s = makeShell("ubuntu", false, false);
    expect(s.run("git --version").out).toMatch(/not found/);
    s.run("sudo apt update");
    s.run("sudo apt install git");
    expect(s.run("git --version").out).toBe("git version 2.51.1\n");
  });

  // init och config

  itNeeds(["git", "cd"], "git init skapar .git med HEAD, refs och objects och tipsar om grennamnet", () => {
    const s = makeShell();
    s.run("cd ~/projekt-webb");
    const r = s.run("git init");
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("hint: Using 'main' as the name for the initial branch.");
    expect(r.out).toContain("git config --global init.defaultBranch <name>");
    expect(r.out).toContain("Initialized empty Git repository in /home/elev/projekt-webb/.git/\n");
    expect(s.node(`${Web}/.git/HEAD`)?.content).toBe("ref: refs/heads/main\n");
    expect(s.node(`${Web}/.git/refs/heads`)?.type).toBe("dir");
    expect(s.node(`${Web}/.git/objects`)?.type).toBe("dir");
    expect(s.run("git init").out).toBe("Reinitialized existing Git repository in /home/elev/projekt-webb/.git/\n");
  });

  itNeeds(["git"], "init.defaultBranch och -b väljer grennamn utan tips", () => {
    const s = makeShell();
    s.run("git config --global init.defaultBranch master");
    const r = s.run("git init ~/a");
    expect(r.out).toBe("Initialized empty Git repository in /home/elev/a/.git/\n");
    expect(s.node("~/a/.git/HEAD")?.content).toBe("ref: refs/heads/master\n");
    s.run("git init -b trunk ~/b");
    expect(s.node("~/b/.git/HEAD")?.content).toBe("ref: refs/heads/trunk\n");
  });

  itNeeds(["git"], "config sparas i ~/.gitconfig och kan läsas, listas och tas bort", () => {
    const s = makeShell();
    expect(s.node("~/.gitconfig")?.content).toBe("[user]\n\tname = Elev Elevsson\n\temail = elev@example.com\n");
    expect(s.run("git config user.name").out).toBe("Elev Elevsson\n");
    expect(s.run("git config --global --list").out).toBe("user.name=Elev Elevsson\nuser.email=elev@example.com\n");
    expect(s.run("git config get user.email").out).toBe("elev@example.com\n");
    s.run('git config --global alias.st "status -s"');
    expect(s.node("~/.gitconfig")?.content).toContain("[alias]\n\tst = status -s\n");
    s.run("git config --global --unset user.email");
    expect(s.run("git config user.email").exitCode).toBe(1);
    expect(s.run("git config nyckelutansektion").exitCode).toBe(2);
    expect(s.run("git config --local user.name x").out).toBe("fatal: not in a git directory\n");
  });

  itNeeds(["git", "cd"], "commit utan identitet ger gits riktiga fel", () => {
    const s = makeShell("debian", false);
    s.run("cd ~/projekt-webb && git init -q && git add .");
    const r = s.run('git commit -m "Första"');
    expect(r.exitCode).toBe(128);
    expect(r.out).toContain("*** Please tell me who you are.");
    expect(r.out).toContain('git config --global user.email "you@example.com"');
    expect(r.out).toContain("fatal: unable to auto-detect email address (got 'elev@debian.(none)')");
  });

  itNeeds(["git"], "utanför ett repo och okända kommandon", () => {
    const s = makeShell();
    const r = s.run("git status");
    expect(r.exitCode).toBe(128);
    expect(r.out).toBe("fatal: not a git repository (or any of the parent directories): .git\n");
    expect(s.run("git stauts").out).toBe("git: 'stauts' is not a git command. See 'git --help'.\n\nThe most similar command is\n\tstatus\n");
  });

  // status, add och commit

  itNeeds(["git", "cd"], "hela flödet från untracked till commit", () => {
    const s = makeShell();
    s.run("cd ~/projekt-webb");
    s.run("git init -q");
    expect(s.run("git status").out).toBe(
      'On branch main\n\nNo commits yet\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tREADME.md\n\tindex.html\n\tstyle.css\n\nnothing added to commit but untracked files present (use "git add" to track)\n',
    );
    s.run("git add index.html");
    expect(s.run("git status -s").out).toBe("A  index.html\n?? README.md\n?? style.css\n");
    const bad = s.run("git add finnsinte.txt");
    expect(bad.exitCode).toBe(128);
    expect(bad.out).toBe("fatal: pathspec 'finnsinte.txt' did not match any files\n");
    s.run("git add .");
    const c = s.run('git commit -m "Första versionen"');
    expect(c.out).toMatch(
      /^\[main \(root-commit\) [0-9a-f]{7}\] Första versionen\n 3 files changed, 24 insertions\(\+\)\n create mode 100644 README\.md\n create mode 100644 index\.html\n create mode 100644 style\.css\n$/,
    );
    expect(s.run("git status").out).toBe("On branch main\nnothing to commit, working tree clean\n");
    const again = s.run('git commit -m "Igen"');
    expect(again.exitCode).toBe(1);
    expect(again.out).toBe("On branch main\nnothing to commit, working tree clean\n");
  });

  itNeeds(["git", "cd", "sed", "echo", "rm"], "ändringar som inte är tillagda, -a och färger i terminalen", () => {
    const s = repo();
    s.run("sed -i 's/navy/teal/' style.css");
    s.run("echo ny > ny.txt");
    s.run("rm README.md");
    expect(s.run("git status").out).toBe(
      'On branch main\nChanges not staged for commit:\n  (use "git add/rm <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n\tdeleted:    README.md\n\tmodified:   style.css\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tny.txt\n\nno changes added to commit (use "git add" and/or "git commit -a")\n',
    );
    expect(s.sh.execute("git status").output).toContain("\t\x1b[31mmodified:   style.css\x1b[m");
    expect(s.run("git status -s").out).toBe(" D README.md\n M style.css\n?? ny.txt\n");
    expect(s.run('git commit -am "Byt färg"').out).toMatch(/^\[main [0-9a-f]{7}\] Byt färg\n 2 files changed, 1 insertion\(\+\), 4 deletions\(-\)\n delete mode 100644 README\.md\n$/);
    expect(s.run("git status -s").out).toBe("?? ny.txt\n");
  });

  itNeeds(["git", "cd", "echo"], "commit utan -m öppnar ingen editor", () => {
    const s = repo();
    s.run("echo x >> README.md && git add README.md");
    const r = s.run("git commit");
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("Aborting commit due to empty commit message.");
  });

  itNeeds(["git", "cd", "mkdir", "echo", "sed"], "status i en underkatalog visar sökvägar relativt den", () => {
    const s = repo();
    s.run("mkdir -p sidor/bilder && echo a > sidor/om.html && echo b > sidor/bilder/x.png");
    expect(s.run("git status -s").out).toBe("?? sidor/\n");
    s.run("cd sidor && git add om.html");
    expect(s.run("git status -s").out).toBe("A  om.html\n?? bilder/\n");
    s.run("cd .. && sed -i 's/navy/red/' style.css");
    s.run("cd sidor");
    // Sorted by the path in the repository (sidor/om.html before style.css), like real git.
    expect(s.run("git status -s").out).toBe("A  om.html\n M ../style.css\n?? bilder/\n");
    expect(s.run("git add .. && git status -s").out).toBe("A  bilder/x.png\nA  om.html\nM  ../style.css\n");
  });

  itNeeds(["git", "cd"], "--amend byter meddelande på senaste commiten", () => {
    const s = repo();
    s.run('git commit --amend -m "Bättre meddelande"');
    expect(s.run("git log --oneline").out).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) Bättre meddelande\n$/);
  });

  // .gitignore

  itNeeds(["git", "cd", "echo", "mkdir", "printf"], "ignorerade filer syns inte i status och läggs inte till av git add .", () => {
    const s = repo();
    s.run("echo hemligt > hemligt.txt && echo fel > fel.log && mkdir build && echo x > build/app.js && mkdir -p sub && echo y > sub/a.log");
    s.run("printf 'hemligt.txt\\n*.log\\nbuild/\\n' > .gitignore");
    expect(s.run("git status -s").out).toBe("?? .gitignore\n");
    s.run("git add .");
    expect(s.run("git status -s").out).toBe("A  .gitignore\n");
    const r = s.run("git add hemligt.txt");
    expect(r.exitCode).toBe(1);
    expect(r.out).toContain("The following paths are ignored by one of your .gitignore files:\nhemligt.txt\n");
    expect(r.out).toContain("hint: Use -f if you really want to add them.");
    s.run("git add -f hemligt.txt");
    expect(s.run("git status -s").out).toBe("A  .gitignore\nA  hemligt.txt\n");
    s.run("printf '!viktig.log\\n' >> .gitignore && echo v > viktig.log");
    expect(s.run("git status -s --untracked-files=all").out).toBe("AM .gitignore\nA  hemligt.txt\n?? viktig.log\n");
  });

  // diff, restore, rm och mv

  itNeeds(["git", "cd", "echo", "sed", "printf"], "git diff och git diff --staged", () => {
    const s = repo();
    s.run("echo 'Byggd med HTML.' >> README.md");
    const diff = s.run("git diff").out;
    expect(diff).toMatch(
      /^diff --git a\/README\.md b\/README\.md\nindex 1100cf4\.\.[0-9a-f]{7} 100644\n--- a\/README\.md\n\+\+\+ b\/README\.md\n@@ -1,3 \+1,4 @@\n # Min webbplats\n \n En liten webbplats som jag versionshanterar med git\.\n\+Byggd med HTML\.\n$/,
    );
    expect(s.sh.execute("git diff").output).toContain("\x1b[32m+Byggd med HTML.\x1b[m");
    expect(s.run("git diff --staged").out).toBe("");
    s.run("git add README.md");
    expect(s.run("git diff").out).toBe("");
    expect(s.run("git diff --cached").out).toBe(diff);
    s.run("sed -i 's/navy/teal/' style.css");
    expect(s.run("git diff --stat").out).toBe(" style.css | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n");
    expect(s.run("git diff HEAD --name-only").out).toBe("README.md\nstyle.css\n");
    s.run("printf 'utan radslut' > ny.txt && git add ny.txt");
    expect(s.run("git diff --staged ny.txt").out).toContain("new file mode 100644\nindex 0000000..");
    expect(s.run("git diff --staged ny.txt").out).toContain("@@ -0,0 +1 @@\n+utan radslut\n\\ No newline at end of file\n");
  });

  itNeeds(["git", "cd", "echo"], "restore kastar ändringar och restore --staged plockar ur indexet", () => {
    const s = repo();
    const original = s.node(`${Web}/index.html`)!.content;
    s.run("echo hoppsan > index.html");
    s.run("git restore index.html");
    expect(s.node(`${Web}/index.html`)!.content).toBe(original);
    s.run("echo extra >> README.md && git add README.md");
    s.run("git restore --staged README.md");
    expect(s.run("git status -s").out).toBe(" M README.md\n");
    expect(s.node(`${Web}/README.md`)!.content).toContain("extra");
    const r = s.run("git restore finns.inte");
    expect(r.exitCode).toBe(1);
    expect(r.out).toBe("error: pathspec 'finns.inte' did not match any file(s) known to git\n");
    s.run("git checkout -- README.md");
    expect(s.run("git status -s").out).toBe("");
  });

  itNeeds(["git", "cd", "echo"], "git rm och git mv", () => {
    const s = repo();
    expect(s.run("git mv README.md LASMIG.md").exitCode).toBe(0);
    expect(s.node(`${Web}/LASMIG.md`)?.type).toBe("file");
    expect(s.run("git status").out).toContain("\trenamed:    README.md -> LASMIG.md\n");
    expect(s.run("git rm style.css").out).toBe("rm 'style.css'\n");
    expect(s.node(`${Web}/style.css`)).toBeNull();
    s.run("echo x >> index.html");
    expect(s.run("git rm index.html").out).toContain("error: the following file has local modifications:\n    index.html\n");
    s.run("git rm --cached index.html");
    expect(s.node(`${Web}/index.html`)?.type).toBe("file");
    expect(s.run("git status -s").out).toBe("R  README.md -> LASMIG.md\nD  index.html\nD  style.css\n?? index.html\n");
    expect(s.run("git mv finns.inte x").out).toBe("fatal: bad source, source=finns.inte, destination=x\n");
  });

  itNeeds(["git", "cd", "echo"], "reset --hard och reflog", () => {
    const s = repo();
    s.run('echo två >> README.md && git commit -qam "Två"');
    s.run("echo tre >> README.md");
    expect(s.run("git reset --hard HEAD~1").out).toMatch(/^HEAD is now at [0-9a-f]{7} Första versionen\n$/);
    expect(s.run("git status -s").out).toBe("");
    expect(s.run("git reflog").out).toMatch(/HEAD@\{0\}: reset: moving to HEAD~1\n[0-9a-f]{7} HEAD@\{1\}: commit: Två\n[0-9a-f]{7} HEAD@\{2\}: commit \(initial\): Första versionen\n$/);
  });

  // grenar och merge

  itNeeds(["git", "cd", "echo"], "switch byter arbetskatalog och git branch listar grenarna", () => {
    const s = repo();
    expect(s.run("git switch -c ny-design").out).toBe("Switched to a new branch 'ny-design'\n");
    s.run("echo 'h1 { color: purple; }' >> style.css && echo ny > ny.html && git add . && git commit -qm 'Lila'");
    expect(s.run("git branch").out).toBe("  main\n* ny-design\n");
    s.run("git switch main");
    expect(s.node(`${Web}/style.css`)!.content).not.toContain("purple");
    expect(s.node(`${Web}/ny.html`)).toBeNull();
    s.run("git checkout ny-design");
    expect(s.node(`${Web}/ny.html`)?.content).toBe("ny\n");
    const r = s.run("git switch finns-inte");
    expect(r.exitCode).toBe(128);
    expect(r.out).toBe("fatal: invalid reference: finns-inte\n");
    expect(s.run("git branch ny-design").out).toBe("fatal: a branch named 'ny-design' already exists\n");
  });

  itNeeds(["git", "cd", "echo"], "lokala ändringar som skulle skrivas över stoppar bytet", () => {
    const s = repo();
    s.run("git switch -q -c b && echo b >> style.css && git commit -qam b && git switch -q main");
    s.run("echo lokal >> style.css");
    const r = s.run("git switch b");
    expect(r.exitCode).toBe(1);
    expect(r.out).toBe(
      "error: Your local changes to the following files would be overwritten by checkout:\n\tstyle.css\nPlease commit your changes or stash them before you switch branches.\nAborting\n",
    );
    s.run("echo annan >> README.md && git restore style.css");
    expect(s.run("git switch b").out).toBe("M\tREADME.md\nSwitched to branch 'b'\n");
  });

  itNeeds(["git", "cd", "echo"], "fast-forward och git branch -d", () => {
    const s = repo();
    s.run('git switch -c ny-design && echo x >> style.css && git commit -qam "Lila rubriker"');
    s.run("git switch main");
    expect(s.run("git branch -d ny-design").out).toContain("error: the branch 'ny-design' is not fully merged");
    expect(s.run("git merge ny-design").out).toMatch(/^Updating [0-9a-f]{7}\.\.[0-9a-f]{7}\nFast-forward\n style\.css \| 1 \+\n 1 file changed, 1 insertion\(\+\)\n$/);
    expect(s.run("git merge ny-design").out).toBe("Already up to date.\n");
    expect(s.run("git branch -d ny-design").out).toMatch(/^Deleted branch ny-design \(was [0-9a-f]{7}\)\.\n$/);
  });

  itNeeds(["git", "cd", "echo"], "trevägs-merge utan konflikt ger en merge-commit och en graf", () => {
    const s = repo();
    s.run('git switch -c css && echo "p { margin: 0; }" >> style.css && git commit -qam "Marginaler"');
    s.run('git switch main && echo "Mer text." >> README.md && git commit -qam "Mer text"');
    const r = s.run("git merge css");
    expect(r.out).toBe("Merge made by the 'ort' strategy.\n style.css | 1 +\n 1 file changed, 1 insertion(+)\n");
    const state = GitCmd.gitRepoState(s.sh, Web)!;
    expect(state.commits).toBe(4);
    expect(s.run("git log -n 1").out).toMatch(/^commit [0-9a-f]{40} \(HEAD -> main\)\nMerge: [0-9a-f]{7} [0-9a-f]{7}\nAuthor: Elev Elevsson <elev@example.com>\nDate: {3}.+\n\n {4}Merge branch 'css'\n$/);
    const graph = hashes(s.run("git log --oneline --graph --all").out);
    expect(graph).toBe("*   H (HEAD -> main) Merge branch 'css'\n|\\\n| * H (css) Marginaler\n* | H Mer text\n|/\n* H Första versionen\n");
  });

  itNeeds(["git", "cd", "echo"], "git log --graph visar den sammanslagna grenen först, oavsett commit-tider", () => {
    let now = 1_790_000_000_000;
    Js.clockOverride = () => (now += 1000);
    const s = repo();
    s.run('git switch -c css && echo "p { margin: 0; }" >> style.css && git commit -qam "Marginaler"');
    s.run('git switch main && echo "Mer text." >> README.md && git commit -qam "Mer text"');
    s.run("git merge css");
    const graph = hashes(s.run("git log --oneline --graph --all").out);
    expect(graph).toBe("*   H (HEAD -> main) Merge branch 'css'\n|\\\n| * H (css) Marginaler\n* | H Mer text\n|/\n* H Första versionen\n");
    // Without --graph, git log is newest first.
    const log = hashes(s.run("git log --oneline").out);
    expect(log).toBe("H (HEAD -> main) Merge branch 'css'\nH Mer text\nH (css) Marginaler\nH Första versionen\n");
  });

  itNeeds(["git", "cd", "sed"], "konflikt: markeringar i filen, git add och git commit avslutar", () => {
    const s = repo();
    s.run("git switch -c rubrik && sed -i 's/Välkommen!/Hej!/' index.html && git commit -qam 'Hej'");
    s.run("git switch main && sed -i 's/Välkommen!/Tjena!/' index.html && git commit -qam 'Tjena'");
    const r = s.run("git merge rubrik");
    expect(r.exitCode).toBe(1);
    expect(r.out).toBe("Auto-merging index.html\nCONFLICT (content): Merge conflict in index.html\nAutomatic merge failed; fix conflicts and then commit the result.\n");
    expect(s.node(`${Web}/index.html`)!.content).toContain("<body>\n<<<<<<< HEAD\n  <h1>Tjena!</h1>\n=======\n  <h1>Hej!</h1>\n>>>>>>> rubrik\n  <p>");
    expect(s.run("git status -s").out).toBe("UU index.html\n");
    expect(s.run("git status").out).toContain("You have unmerged paths.\n");
    expect(s.run("git status").out).toContain("\tboth modified:   index.html\n");
    expect(s.run("git commit -m x").out).toContain("error: Committing is not possible because you have unmerged files.");
    s.run("sed -i '/^<<<<<<<\\|^=======\\|^>>>>>>>/d' index.html");
    s.run("git add index.html");
    expect(s.run("git status").out).toContain("All conflicts fixed but you are still merging.");
    const c = s.run("git commit");
    expect(c.out).toMatch(/\[main [0-9a-f]{7}\] Merge branch 'rubrik'\n/);
    expect(s.run("git log -n 1 --oneline").out).toMatch(/Merge branch 'rubrik'\n$/);
    expect(s.node(`${Web}/.git/MERGE_HEAD`)).toBeNull();
    expect(s.run("git status").out).toBe("On branch main\nnothing to commit, working tree clean\n");
  });

  itNeeds(["git", "cd", "sed"], "merge --abort och checkout --theirs", () => {
    const s = repo();
    s.run("git switch -c a && sed -i 's/navy/red/' style.css && git commit -qam a");
    s.run("git switch main && sed -i 's/navy/blue/' style.css && git commit -qam b");
    const before = s.node(`${Web}/style.css`)!.content;
    s.run("git merge a");
    s.run("git merge --abort");
    expect(s.node(`${Web}/style.css`)!.content).toBe(before);
    expect(s.run("git status -s").out).toBe("");
    s.run("git merge a");
    s.run("git checkout --theirs style.css && git add style.css && git commit -q");
    expect(s.node(`${Web}/style.css`)!.content).toContain("color: red;");
  });

  itNeeds(["git", "cd", "echo"], "frikopplat HEAD och switch -", () => {
    const s = repo();
    s.run("echo 2 >> README.md && git commit -qam Två");
    const r = s.run("git checkout HEAD~1");
    expect(r.out).toContain("You are in 'detached HEAD' state.");
    expect(s.run("git status").out).toMatch(/^HEAD detached at [0-9a-f]{7}\n/);
    expect(s.run("git switch -").out).toContain("Switched to branch 'main'");
  });

  itNeeds(["git", "cd", "echo"], "stash lägger undan och tar fram ändringar", () => {
    const s = repo();
    s.run("echo tillfälligt >> style.css");
    expect(s.run("git stash").out).toMatch(/^Saved working directory and index state WIP on main: [0-9a-f]{7} Första versionen\n$/);
    expect(s.run("git status -s").out).toBe("");
    expect(s.run("git stash list").out).toMatch(/^stash@\{0\}: WIP on main/);
    s.run("git stash pop");
    expect(s.run("git status -s").out).toBe(" M style.css\n");
  });

  // fjärr-repon

  itNeeds(["git", "cd", "echo"], "clone, push till ett bare-repo och pull", () => {
    const s = repo();
    s.run("cd ~");
    const c = s.run("git clone ~/projekt-webb ~/kopia");
    expect(c.out).toBe("Cloning into '/home/elev/kopia'...\ndone.\n");
    expect(s.node("~/kopia/index.html")?.content).toBe(s.node(`${Web}/index.html`)?.content);
    s.run("cd ~/kopia");
    expect(s.run("git status").out).toBe("On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean\n");
    expect(s.run("git remote -v").out).toBe("origin\t/home/elev/projekt-webb (fetch)\norigin\t/home/elev/projekt-webb (push)\n");
    s.run('echo kopia >> README.md && git commit -qam "Från kopian"');
    expect(s.run("git status").out).toContain("Your branch is ahead of 'origin/main' by 1 commit.");
    expect(s.run("git push").out).toContain("! [remote rejected] main -> main (branch is currently checked out)");

    s.run("git init -q --bare ~/server.git");
    s.run("git remote add server ~/server.git");
    expect(s.run("git push -u server main").out).toBe("To /home/elev/server.git\n * [new branch]      main -> main\nbranch 'main' set up to track 'server/main'.\n");
    s.run("cd ~/projekt-webb && git remote add origin ~/server.git");
    const p = s.run("git pull origin main");
    expect(p.out).toContain("Fast-forward");
    expect(s.node(`${Web}/README.md`)?.content).toContain("kopia");
  });

  itNeeds(["git"], "nätverksadresser fungerar inte i simulatorn", () => {
    const s = makeShell();
    const r = s.run("git clone https://github.com/torvalds/linux.git");
    expect(r.exitCode).toBe(128);
    expect(r.out).toContain("fatal: unable to access 'https://github.com/torvalds/linux.git/': Could not resolve host: github.com");
    expect(r.out).toContain("git clone ~/projekt-webb ~/kopia");
  });

  // sparat tillstånd

  itNeeds(["git", "cd", "echo"], "repot överlever snapshot som JSON", () => {
    const s = repo();
    s.run("git switch -q -c ny && echo x >> style.css && git commit -qam Ny && git switch -q main");
    s.run("echo osparat >> README.md && git add README.md");
    const log = s.run("git log --oneline --all").out;
    const restored = Shell.restoreJson(s.sh.snapshotJson())!;
    restored.lang = "en";
    const out = (l: string): string => UtilCmd.stripAnsi(restored.execute(l).output);
    expect(out("git log --oneline --all")).toBe(log);
    expect(out("git status -s")).toBe("M  README.md\n");
    expect(out("git merge -q ny && git log --oneline -n 1")).toContain("Ny");
  });

  it("gamla sparade terminaler får övningskatalogen", () => {
    const sh = Shell.create("fedora", "sv");
    const snap = Js.clone(sh.snapshot());
    snap.fs.children!.get("home")!.children!.get("elev")!.children!.delete("projekt-webb");
    for (const k of [...snap.flags.keys()]) if (k.includes("projekt-webb")) snap.flags.delete(k);
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup(`${Web}/index.html`, restored.rootUser())?.type).toBe("file");
  });
});
