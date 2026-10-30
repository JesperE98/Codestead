using System.Text.RegularExpressions;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/git.test.ts
public class GitTests
{
    private const string Web = "/home/elev/projekt-webb";

    private sealed class S
    {
        public required Shell Sh { get; init; }

        public RunResult Run(string line) => new() { Result = Sh.Execute(line) };

        public FsNode? Node(string path) =>
            Sh.Vfs.TryLookup(path.StartsWith('~') ? "/home/elev" + path[1..] : path, Sh.RootUser());
    }

    private static S MakeShell(string distro = "arch", bool identity = true, bool git = true)
    {
        var sh = Shell.Create(distro);
        sh.Lang = "en";
        if (git) PackagesLib.InstallPackage(sh, PackagesLib.Packages.Find(p => p.Id == "git")!);
        var s = new S { Sh = sh };
        if (identity)
        {
            s.Run("git config --global user.name \"Elev Elevsson\"");
            s.Run("git config --global user.email elev@example.com");
        }
        return s;
    }

    /// <summary>A repository in ~/projekt-webb with a first commit.</summary>
    private static S Repo(string distro = "arch")
    {
        var s = MakeShell(distro);
        s.Run("cd ~/projekt-webb");
        s.Run("git init -q");
        s.Run("git add .");
        s.Run("git commit -q -m \"Första versionen\"");
        return s;
    }

    // objekt

    [Fact(DisplayName = "blob-id blir samma som i riktiga git")]
    public void BlobIdSameAsRealGit()
    {
        Assert.Equal("ce013625030ba8dba906f756967f9e9ca394464a", GitCmd.BlobHash("hello\n"));
        Assert.Equal("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391", GitCmd.BlobHash(""));
        Assert.Equal("a9993e364706816aba3e25717850c26c9cd0d89d", GitCmd.Sha1("abc"));
        var s = MakeShell();
        s.Run("echo hello > ~/h.txt");
        Assert.Equal("ce013625030ba8dba906f756967f9e9ca394464a\n", s.Run("git hash-object ~/h.txt").Out);
    }

    [Fact(DisplayName = "git finns inte förrän paketet installerats")]
    public void GitNotUntilInstalled()
    {
        var s = MakeShell("ubuntu", git: false, identity: false);
        Assert.Matches("not found", s.Run("git --version").Out);
        s.Run("sudo apt update");
        s.Run("sudo apt install git");
        Assert.Equal("git version 2.51.1\n", s.Run("git --version").Out);
    }

    // init och config

    [Fact(DisplayName = "git init skapar .git med HEAD, refs och objects och tipsar om grennamnet")]
    public void InitCreatesGitDir()
    {
        var s = MakeShell();
        s.Run("cd ~/projekt-webb");
        var r = s.Run("git init");
        Assert.Equal(0, r.ExitCode);
        Assert.Contains("hint: Using 'main' as the name for the initial branch.", r.Out);
        Assert.Contains("git config --global init.defaultBranch <name>", r.Out);
        Assert.Contains("Initialized empty Git repository in /home/elev/projekt-webb/.git/\n", r.Out);
        Assert.Equal("ref: refs/heads/main\n", s.Node($"{Web}/.git/HEAD")?.Content);
        Assert.Equal("dir", s.Node($"{Web}/.git/refs/heads")?.Type);
        Assert.Equal("dir", s.Node($"{Web}/.git/objects")?.Type);
        Assert.Equal("Reinitialized existing Git repository in /home/elev/projekt-webb/.git/\n", s.Run("git init").Out);
    }

    [Fact(DisplayName = "init.defaultBranch och -b väljer grennamn utan tips")]
    public void DefaultBranchConfig()
    {
        var s = MakeShell();
        s.Run("git config --global init.defaultBranch master");
        var r = s.Run("git init ~/a");
        Assert.Equal("Initialized empty Git repository in /home/elev/a/.git/\n", r.Out);
        Assert.Equal("ref: refs/heads/master\n", s.Node("~/a/.git/HEAD")?.Content);
        s.Run("git init -b trunk ~/b");
        Assert.Equal("ref: refs/heads/trunk\n", s.Node("~/b/.git/HEAD")?.Content);
    }

    [Fact(DisplayName = "config sparas i ~/.gitconfig och kan läsas, listas och tas bort")]
    public void ConfigSavedReadListedRemoved()
    {
        var s = MakeShell();
        Assert.Equal("[user]\n\tname = Elev Elevsson\n\temail = elev@example.com\n", s.Node("~/.gitconfig")?.Content);
        Assert.Equal("Elev Elevsson\n", s.Run("git config user.name").Out);
        Assert.Equal("user.name=Elev Elevsson\nuser.email=elev@example.com\n", s.Run("git config --global --list").Out);
        Assert.Equal("elev@example.com\n", s.Run("git config get user.email").Out);
        s.Run("git config --global alias.st \"status -s\"");
        Assert.Contains("[alias]\n\tst = status -s\n", s.Node("~/.gitconfig")?.Content);
        s.Run("git config --global --unset user.email");
        Assert.Equal(1, s.Run("git config user.email").ExitCode);
        Assert.Equal(2, s.Run("git config nyckelutansektion").ExitCode);
        Assert.Equal("fatal: not in a git directory\n", s.Run("git config --local user.name x").Out);
    }

    [Fact(DisplayName = "commit utan identitet ger gits riktiga fel")]
    public void CommitWithoutIdentity()
    {
        var s = MakeShell("debian", identity: false);
        s.Run("cd ~/projekt-webb && git init -q && git add .");
        var r = s.Run("git commit -m \"Första\"");
        Assert.Equal(128, r.ExitCode);
        Assert.Contains("*** Please tell me who you are.", r.Out);
        Assert.Contains("git config --global user.email \"you@example.com\"", r.Out);
        Assert.Contains("fatal: unable to auto-detect email address (got 'elev@debian.(none)')", r.Out);
    }

    [Fact(DisplayName = "utanför ett repo och okända kommandon")]
    public void OutsideRepoAndUnknownCommands()
    {
        var s = MakeShell();
        var r = s.Run("git status");
        Assert.Equal(128, r.ExitCode);
        Assert.Equal("fatal: not a git repository (or any of the parent directories): .git\n", r.Out);
        Assert.Equal("git: 'stauts' is not a git command. See 'git --help'.\n\nThe most similar command is\n\tstatus\n", s.Run("git stauts").Out);
    }

    // status, add och commit

    [Fact(DisplayName = "hela flödet från untracked till commit")]
    public void UntrackedToCommit()
    {
        var s = MakeShell();
        s.Run("cd ~/projekt-webb");
        s.Run("git init -q");
        Assert.Equal(
            "On branch main\n\nNo commits yet\n\nUntracked files:\n  (use \"git add <file>...\" to include in what will be committed)\n\tREADME.md\n\tindex.html\n\tstyle.css\n\nnothing added to commit but untracked files present (use \"git add\" to track)\n",
            s.Run("git status").Out);
        s.Run("git add index.html");
        Assert.Equal("A  index.html\n?? README.md\n?? style.css\n", s.Run("git status -s").Out);
        var bad = s.Run("git add finnsinte.txt");
        Assert.Equal(128, bad.ExitCode);
        Assert.Equal("fatal: pathspec 'finnsinte.txt' did not match any files\n", bad.Out);
        s.Run("git add .");
        var c = s.Run("git commit -m \"Första versionen\"");
        Assert.Matches(@"^\[main \(root-commit\) [0-9a-f]{7}\] Första versionen\n 3 files changed, 24 insertions\(\+\)\n create mode 100644 README\.md\n create mode 100644 index\.html\n create mode 100644 style\.css\n\z", c.Out);
        Assert.Equal("On branch main\nnothing to commit, working tree clean\n", s.Run("git status").Out);
        var again = s.Run("git commit -m \"Igen\"");
        Assert.Equal(1, again.ExitCode);
        Assert.Equal("On branch main\nnothing to commit, working tree clean\n", again.Out);
    }

    [Fact(DisplayName = "ändringar som inte är tillagda, -a och färger i terminalen")]
    public void UnstagedChangesAndColors()
    {
        var s = Repo();
        s.Run("sed -i 's/navy/teal/' style.css");
        s.Run("echo ny > ny.txt");
        s.Run("rm README.md");
        Assert.Equal(
            "On branch main\nChanges not staged for commit:\n  (use \"git add/rm <file>...\" to update what will be committed)\n  (use \"git restore <file>...\" to discard changes in working directory)\n\tdeleted:    README.md\n\tmodified:   style.css\n\nUntracked files:\n  (use \"git add <file>...\" to include in what will be committed)\n\tny.txt\n\nno changes added to commit (use \"git add\" and/or \"git commit -a\")\n",
            s.Run("git status").Out);
        Assert.Contains("\t\x1b[31mmodified:   style.css\x1b[m", s.Sh.Execute("git status").Output);
        Assert.Equal(" D README.md\n M style.css\n?? ny.txt\n", s.Run("git status -s").Out);
        Assert.Matches(@"^\[main [0-9a-f]{7}\] Byt färg\n 2 files changed, 1 insertion\(\+\), 4 deletions\(-\)\n delete mode 100644 README\.md\n\z", s.Run("git commit -am \"Byt färg\"").Out);
        Assert.Equal("?? ny.txt\n", s.Run("git status -s").Out);
    }

    [Fact(DisplayName = "commit utan -m öppnar ingen editor")]
    public void CommitWithoutMessage()
    {
        var s = Repo();
        s.Run("echo x >> README.md && git add README.md");
        var r = s.Run("git commit");
        Assert.Equal(1, r.ExitCode);
        Assert.Contains("Aborting commit due to empty commit message.", r.Out);
    }

    [Fact(DisplayName = "status i en underkatalog visar sökvägar relativt den")]
    public void StatusInSubdirectory()
    {
        var s = Repo();
        s.Run("mkdir -p sidor/bilder && echo a > sidor/om.html && echo b > sidor/bilder/x.png");
        Assert.Equal("?? sidor/\n", s.Run("git status -s").Out);
        s.Run("cd sidor && git add om.html");
        Assert.Equal("A  om.html\n?? bilder/\n", s.Run("git status -s").Out);
        s.Run("cd .. && sed -i 's/navy/red/' style.css");
        s.Run("cd sidor");
        // Sorted by the path in the repository (sidor/om.html before style.css), like real git.
        Assert.Equal("A  om.html\n M ../style.css\n?? bilder/\n", s.Run("git status -s").Out);
        Assert.Equal("A  bilder/x.png\nA  om.html\nM  ../style.css\n", s.Run("git add .. && git status -s").Out);
    }

    [Fact(DisplayName = "--amend byter meddelande på senaste commiten")]
    public void AmendChangesMessage()
    {
        var s = Repo();
        s.Run("git commit --amend -m \"Bättre meddelande\"");
        Assert.Matches(@"^[0-9a-f]{7} \(HEAD -> main\) Bättre meddelande\n\z", s.Run("git log --oneline").Out);
    }

    // .gitignore

    [Fact(DisplayName = "ignorerade filer syns inte i status och läggs inte till av git add .")]
    public void IgnoredFiles()
    {
        var s = Repo();
        s.Run("echo hemligt > hemligt.txt && echo fel > fel.log && mkdir build && echo x > build/app.js && mkdir -p sub && echo y > sub/a.log");
        s.Run("printf 'hemligt.txt\\n*.log\\nbuild/\\n' > .gitignore");
        Assert.Equal("?? .gitignore\n", s.Run("git status -s").Out);
        s.Run("git add .");
        Assert.Equal("A  .gitignore\n", s.Run("git status -s").Out);
        var r = s.Run("git add hemligt.txt");
        Assert.Equal(1, r.ExitCode);
        Assert.Contains("The following paths are ignored by one of your .gitignore files:\nhemligt.txt\n", r.Out);
        Assert.Contains("hint: Use -f if you really want to add them.", r.Out);
        s.Run("git add -f hemligt.txt");
        Assert.Equal("A  .gitignore\nA  hemligt.txt\n", s.Run("git status -s").Out);
        s.Run("printf '!viktig.log\\n' >> .gitignore && echo v > viktig.log");
        Assert.Equal("AM .gitignore\nA  hemligt.txt\n?? viktig.log\n", s.Run("git status -s --untracked-files=all").Out);
    }

    // diff, restore, rm och mv

    [Fact(DisplayName = "git diff och git diff --staged")]
    public void DiffAndDiffStaged()
    {
        var s = Repo();
        s.Run("echo 'Byggd med HTML.' >> README.md");
        var diff = s.Run("git diff").Out;
        Assert.Matches(
            @"^diff --git a/README\.md b/README\.md\nindex 1100cf4\.\.[0-9a-f]{7} 100644\n--- a/README\.md\n\+\+\+ b/README\.md\n@@ -1,3 \+1,4 @@\n # Min webbplats\n \n En liten webbplats som jag versionshanterar med git\.\n\+Byggd med HTML\.\n\z",
            diff);
        Assert.Contains("\x1b[32m+Byggd med HTML.\x1b[m", s.Sh.Execute("git diff").Output);
        Assert.Equal("", s.Run("git diff --staged").Out);
        s.Run("git add README.md");
        Assert.Equal("", s.Run("git diff").Out);
        Assert.Equal(diff, s.Run("git diff --cached").Out);
        s.Run("sed -i 's/navy/teal/' style.css");
        Assert.Equal(" style.css | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)\n", s.Run("git diff --stat").Out);
        Assert.Equal("README.md\nstyle.css\n", s.Run("git diff HEAD --name-only").Out);
        s.Run("printf 'utan radslut' > ny.txt && git add ny.txt");
        Assert.Contains("new file mode 100644\nindex 0000000..", s.Run("git diff --staged ny.txt").Out);
        Assert.Contains("@@ -0,0 +1 @@\n+utan radslut\n\\ No newline at end of file\n", s.Run("git diff --staged ny.txt").Out);
    }

    [Fact(DisplayName = "restore kastar ändringar och restore --staged plockar ur indexet")]
    public void RestoreAndRestoreStaged()
    {
        var s = Repo();
        var original = s.Node($"{Web}/index.html")!.Content;
        s.Run("echo hoppsan > index.html");
        s.Run("git restore index.html");
        Assert.Equal(original, s.Node($"{Web}/index.html")!.Content);
        s.Run("echo extra >> README.md && git add README.md");
        s.Run("git restore --staged README.md");
        Assert.Equal(" M README.md\n", s.Run("git status -s").Out);
        Assert.Contains("extra", s.Node($"{Web}/README.md")!.Content);
        var r = s.Run("git restore finns.inte");
        Assert.Equal(1, r.ExitCode);
        Assert.Equal("error: pathspec 'finns.inte' did not match any file(s) known to git\n", r.Out);
        s.Run("git checkout -- README.md");
        Assert.Equal("", s.Run("git status -s").Out);
    }

    [Fact(DisplayName = "git rm och git mv")]
    public void RmAndMv()
    {
        var s = Repo();
        Assert.Equal(0, s.Run("git mv README.md LASMIG.md").ExitCode);
        Assert.Equal("file", s.Node($"{Web}/LASMIG.md")?.Type);
        Assert.Contains("\trenamed:    README.md -> LASMIG.md\n", s.Run("git status").Out);
        Assert.Equal("rm 'style.css'\n", s.Run("git rm style.css").Out);
        Assert.Null(s.Node($"{Web}/style.css"));
        s.Run("echo x >> index.html");
        Assert.Contains("error: the following file has local modifications:\n    index.html\n", s.Run("git rm index.html").Out);
        s.Run("git rm --cached index.html");
        Assert.Equal("file", s.Node($"{Web}/index.html")?.Type);
        Assert.Equal("R  README.md -> LASMIG.md\nD  index.html\nD  style.css\n?? index.html\n", s.Run("git status -s").Out);
        Assert.Equal("fatal: bad source, source=finns.inte, destination=x\n", s.Run("git mv finns.inte x").Out);
    }

    [Fact(DisplayName = "reset --hard och reflog")]
    public void ResetHardAndReflog()
    {
        var s = Repo();
        s.Run("echo två >> README.md && git commit -qam \"Två\"");
        s.Run("echo tre >> README.md");
        Assert.Matches(@"^HEAD is now at [0-9a-f]{7} Första versionen\n\z", s.Run("git reset --hard HEAD~1").Out);
        Assert.Equal("", s.Run("git status -s").Out);
        Assert.Matches(@"HEAD@\{0\}: reset: moving to HEAD~1\n[0-9a-f]{7} HEAD@\{1\}: commit: Två\n[0-9a-f]{7} HEAD@\{2\}: commit \(initial\): Första versionen\n\z", s.Run("git reflog").Out);
    }

    // grenar och merge

    [Fact(DisplayName = "switch byter arbetskatalog och git branch listar grenarna")]
    public void SwitchAndBranchList()
    {
        var s = Repo();
        Assert.Equal("Switched to a new branch 'ny-design'\n", s.Run("git switch -c ny-design").Out);
        s.Run("echo 'h1 { color: purple; }' >> style.css && echo ny > ny.html && git add . && git commit -qm 'Lila'");
        Assert.Equal("  main\n* ny-design\n", s.Run("git branch").Out);
        s.Run("git switch main");
        Assert.DoesNotContain("purple", s.Node($"{Web}/style.css")!.Content);
        Assert.Null(s.Node($"{Web}/ny.html"));
        s.Run("git checkout ny-design");
        Assert.Equal("ny\n", s.Node($"{Web}/ny.html")?.Content);
        var r = s.Run("git switch finns-inte");
        Assert.Equal(128, r.ExitCode);
        Assert.Equal("fatal: invalid reference: finns-inte\n", r.Out);
        Assert.Equal("fatal: a branch named 'ny-design' already exists\n", s.Run("git branch ny-design").Out);
    }

    [Fact(DisplayName = "lokala ändringar som skulle skrivas över stoppar bytet")]
    public void LocalChangesStopSwitch()
    {
        var s = Repo();
        s.Run("git switch -q -c b && echo b >> style.css && git commit -qam b && git switch -q main");
        s.Run("echo lokal >> style.css");
        var r = s.Run("git switch b");
        Assert.Equal(1, r.ExitCode);
        Assert.Equal(
            "error: Your local changes to the following files would be overwritten by checkout:\n\tstyle.css\nPlease commit your changes or stash them before you switch branches.\nAborting\n",
            r.Out);
        s.Run("echo annan >> README.md && git restore style.css");
        Assert.Equal("M\tREADME.md\nSwitched to branch 'b'\n", s.Run("git switch b").Out);
    }

    [Fact(DisplayName = "fast-forward och git branch -d")]
    public void FastForwardAndBranchDelete()
    {
        var s = Repo();
        s.Run("git switch -c ny-design && echo x >> style.css && git commit -qam \"Lila rubriker\"");
        s.Run("git switch main");
        Assert.Contains("error: the branch 'ny-design' is not fully merged", s.Run("git branch -d ny-design").Out);
        Assert.Matches(@"^Updating [0-9a-f]{7}\.\.[0-9a-f]{7}\nFast-forward\n style\.css \| 1 \+\n 1 file changed, 1 insertion\(\+\)\n\z", s.Run("git merge ny-design").Out);
        Assert.Equal("Already up to date.\n", s.Run("git merge ny-design").Out);
        Assert.Matches(@"^Deleted branch ny-design \(was [0-9a-f]{7}\)\.\n\z", s.Run("git branch -d ny-design").Out);
    }

    [Fact(DisplayName = "trevägs-merge utan konflikt ger en merge-commit och en graf")]
    public void ThreeWayMergeAndGraph()
    {
        var s = Repo();
        s.Run("git switch -c css && echo \"p { margin: 0; }\" >> style.css && git commit -qam \"Marginaler\"");
        s.Run("git switch main && echo \"Mer text.\" >> README.md && git commit -qam \"Mer text\"");
        var r = s.Run("git merge css");
        Assert.Equal("Merge made by the 'ort' strategy.\n style.css | 1 +\n 1 file changed, 1 insertion(+)\n", r.Out);
        var state = GitCmd.GitRepoState(s.Sh, Web)!;
        Assert.Equal(4, state.Commits);
        Assert.Matches(@"^commit [0-9a-f]{40} \(HEAD -> main\)\nMerge: [0-9a-f]{7} [0-9a-f]{7}\nAuthor: Elev Elevsson <elev@example.com>\nDate: {3}.+\n\n {4}Merge branch 'css'\n\z", s.Run("git log -n 1").Out);
        var graph = Regex.Replace(s.Run("git log --oneline --graph --all").Out, "[0-9a-f]{7}", "H");
        Assert.Equal("*   H (HEAD -> main) Merge branch 'css'\n|\\\n| * H (css) Marginaler\n* | H Mer text\n|/\n* H Första versionen\n", graph);
    }

    [Fact(DisplayName = "git log --graph visar den sammanslagna grenen först, oavsett commit-tider")]
    public void GraphOrderDoesNotDependOnCommitTimes()
    {
        long now = 1_790_000_000_000;
        Js.ClockOverride = () => now += 1000;
        try
        {
            var s = Repo();
            s.Run("git switch -c css && echo \"p { margin: 0; }\" >> style.css && git commit -qam \"Marginaler\"");
            s.Run("git switch main && echo \"Mer text.\" >> README.md && git commit -qam \"Mer text\"");
            s.Run("git merge css");
            var graph = Regex.Replace(s.Run("git log --oneline --graph --all").Out, "[0-9a-f]{7}", "H");
            Assert.Equal("*   H (HEAD -> main) Merge branch 'css'\n|\\\n| * H (css) Marginaler\n* | H Mer text\n|/\n* H Första versionen\n", graph);
            // Without --graph, git log is newest first.
            var log = Regex.Replace(s.Run("git log --oneline").Out, "[0-9a-f]{7}", "H");
            Assert.Equal("H (HEAD -> main) Merge branch 'css'\nH Mer text\nH (css) Marginaler\nH Första versionen\n", log);
        }
        finally
        {
            Js.ClockOverride = null;
        }
    }

    [Fact(DisplayName = "konflikt: markeringar i filen, git add och git commit avslutar")]
    public void ConflictMarkersAddCommit()
    {
        var s = Repo();
        s.Run("git switch -c rubrik && sed -i 's/Välkommen!/Hej!/' index.html && git commit -qam 'Hej'");
        s.Run("git switch main && sed -i 's/Välkommen!/Tjena!/' index.html && git commit -qam 'Tjena'");
        var r = s.Run("git merge rubrik");
        Assert.Equal(1, r.ExitCode);
        Assert.Equal("Auto-merging index.html\nCONFLICT (content): Merge conflict in index.html\nAutomatic merge failed; fix conflicts and then commit the result.\n", r.Out);
        Assert.Contains("<body>\n<<<<<<< HEAD\n  <h1>Tjena!</h1>\n=======\n  <h1>Hej!</h1>\n>>>>>>> rubrik\n  <p>", s.Node($"{Web}/index.html")!.Content);
        Assert.Equal("UU index.html\n", s.Run("git status -s").Out);
        Assert.Contains("You have unmerged paths.\n", s.Run("git status").Out);
        Assert.Contains("\tboth modified:   index.html\n", s.Run("git status").Out);
        Assert.Contains("error: Committing is not possible because you have unmerged files.", s.Run("git commit -m x").Out);
        s.Run("sed -i '/^<<<<<<<\\|^=======\\|^>>>>>>>/d' index.html");
        s.Run("git add index.html");
        Assert.Contains("All conflicts fixed but you are still merging.", s.Run("git status").Out);
        var c = s.Run("git commit");
        Assert.Matches(@"\[main [0-9a-f]{7}\] Merge branch 'rubrik'\n", c.Out);
        Assert.Matches(@"Merge branch 'rubrik'\n\z", s.Run("git log -n 1 --oneline").Out);
        Assert.Null(s.Node($"{Web}/.git/MERGE_HEAD"));
        Assert.Equal("On branch main\nnothing to commit, working tree clean\n", s.Run("git status").Out);
    }

    [Fact(DisplayName = "merge --abort och checkout --theirs")]
    public void MergeAbortAndCheckoutTheirs()
    {
        var s = Repo();
        s.Run("git switch -c a && sed -i 's/navy/red/' style.css && git commit -qam a");
        s.Run("git switch main && sed -i 's/navy/blue/' style.css && git commit -qam b");
        var before = s.Node($"{Web}/style.css")!.Content;
        s.Run("git merge a");
        s.Run("git merge --abort");
        Assert.Equal(before, s.Node($"{Web}/style.css")!.Content);
        Assert.Equal("", s.Run("git status -s").Out);
        s.Run("git merge a");
        s.Run("git checkout --theirs style.css && git add style.css && git commit -q");
        Assert.Contains("color: red;", s.Node($"{Web}/style.css")!.Content);
    }

    [Fact(DisplayName = "frikopplat HEAD och switch -")]
    public void DetachedHeadAndSwitchBack()
    {
        var s = Repo();
        s.Run("echo 2 >> README.md && git commit -qam Två");
        var r = s.Run("git checkout HEAD~1");
        Assert.Contains("You are in 'detached HEAD' state.", r.Out);
        Assert.Matches(@"^HEAD detached at [0-9a-f]{7}\n", s.Run("git status").Out);
        Assert.Contains("Switched to branch 'main'", s.Run("git switch -").Out);
    }

    [Fact(DisplayName = "stash lägger undan och tar fram ändringar")]
    public void StashPushAndPop()
    {
        var s = Repo();
        s.Run("echo tillfälligt >> style.css");
        Assert.Matches(@"^Saved working directory and index state WIP on main: [0-9a-f]{7} Första versionen\n\z", s.Run("git stash").Out);
        Assert.Equal("", s.Run("git status -s").Out);
        Assert.Matches(@"^stash@\{0\}: WIP on main", s.Run("git stash list").Out);
        s.Run("git stash pop");
        Assert.Equal(" M style.css\n", s.Run("git status -s").Out);
    }

    // fjärr-repon

    [Fact(DisplayName = "clone, push till ett bare-repo och pull")]
    public void ClonePushPull()
    {
        var s = Repo();
        s.Run("cd ~");
        var c = s.Run("git clone ~/projekt-webb ~/kopia");
        Assert.Equal("Cloning into '/home/elev/kopia'...\ndone.\n", c.Out);
        Assert.Equal(s.Node($"{Web}/index.html")?.Content, s.Node("~/kopia/index.html")?.Content);
        s.Run("cd ~/kopia");
        Assert.Equal("On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean\n", s.Run("git status").Out);
        Assert.Equal("origin\t/home/elev/projekt-webb (fetch)\norigin\t/home/elev/projekt-webb (push)\n", s.Run("git remote -v").Out);
        s.Run("echo kopia >> README.md && git commit -qam \"Från kopian\"");
        Assert.Contains("Your branch is ahead of 'origin/main' by 1 commit.", s.Run("git status").Out);
        Assert.Contains("! [remote rejected] main -> main (branch is currently checked out)", s.Run("git push").Out);

        s.Run("git init -q --bare ~/server.git");
        s.Run("git remote add server ~/server.git");
        Assert.Equal("To /home/elev/server.git\n * [new branch]      main -> main\nbranch 'main' set up to track 'server/main'.\n", s.Run("git push -u server main").Out);
        s.Run("cd ~/projekt-webb && git remote add origin ~/server.git");
        var p = s.Run("git pull origin main");
        Assert.Contains("Fast-forward", p.Out);
        Assert.Contains("kopia", s.Node($"{Web}/README.md")?.Content);
    }

    [Fact(DisplayName = "nätverksadresser fungerar inte i simulatorn")]
    public void NetworkUrlsDoNotWork()
    {
        var s = MakeShell();
        var r = s.Run("git clone https://github.com/torvalds/linux.git");
        Assert.Equal(128, r.ExitCode);
        Assert.Contains("fatal: unable to access 'https://github.com/torvalds/linux.git/': Could not resolve host: github.com", r.Out);
        Assert.Contains("git clone ~/projekt-webb ~/kopia", r.Out);
    }

    // sparat tillstånd

    [Fact(DisplayName = "repot överlever snapshot som JSON")]
    public void RepoSurvivesSnapshot()
    {
        var s = Repo();
        s.Run("git switch -q -c ny && echo x >> style.css && git commit -qam Ny && git switch -q main");
        s.Run("echo osparat >> README.md && git add README.md");
        var log = s.Run("git log --oneline --all").Out;
        var restored = Shell.RestoreJson(s.Sh.SnapshotJson())!;
        restored.Lang = "en";
        string Out(string l) => UtilCmd.StripAnsi(restored.Execute(l).Output);
        Assert.Equal(log, Out("git log --oneline --all"));
        Assert.Equal("M  README.md\n", Out("git status -s"));
        Assert.Contains("Ny", Out("git merge -q ny && git log --oneline -n 1"));
    }

    [Fact(DisplayName = "gamla sparade terminaler får övningskatalogen")]
    public void OldSnapshotsGetPracticeDirectory()
    {
        var sh = Shell.Create("fedora");
        var snap = Js.Clone(sh.Snapshot());
        snap.Fs.Children!["home"].Children!["elev"].Children!.Remove("projekt-webb");
        foreach (var k in snap.Flags.Keys.ToList())
            if (k.Contains("projekt-webb")) snap.Flags.Remove(k);
        var restored = Shell.Restore(snap)!;
        Assert.Equal("file", restored.Vfs.TryLookup($"{Web}/index.html", restored.RootUser())?.Type);
    }
}
