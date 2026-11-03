using System.Security.Cryptography;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/git.ts – this part: errors and output, help, the subcommand table and the command
// itself. Each subcommand is in GitCmd.<Subcommand>.cs; objects, refs, revisions, index, config, work tree,
// diff and status are in their own GitCmd.*.cs files.
//
// git – a small but real version control system working against the virtual file system.
// The repository is stored in .git/ as ordinary files: objects (blob, tree, commit, tag) under
// .git/objects/xx/…, branches under .git/refs/heads/, HEAD, index, config and a simple reflog
// in .git/logs/HEAD. Everything is text, so the repository is saved with the terminal as JSON.
// Objects are hashed with SHA-1 like real git – a blob gets the same id as on a real computer.
// Trees are stored simplified as a flat list of paths.

public static partial class GitCmd
{
    private const RegexOptions RO = RegexOptions.CultureInvariant;

    // ---------- SHA-1 ----------

    public static string Sha1(string text) => Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes(text)));

    /// <summary>The same id as `git hash-object` gives for a file with the content `data`.</summary>
    public static string BlobHash(string data) => Sha1($"blob {Js.Utf8Length(data)}\0{data}");

    private static readonly string Zero = "0".Repeat(40);
    private static string Short(string h) => h.Slice(0, 7);

    // ---------- Errors and output ----------

    /// <summary>Aborts the git command with a text on stderr and an exit status.</summary>
    private sealed class GitExit : Exception
    {
        public string Text { get; }
        public int Code { get; }

        public GitExit(string text, int code) : base(text)
        {
            Text = text;
            Code = code;
        }
    }

    private static GitExit Fatal(string msg) => new($"fatal: {msg}\n", 128);

    private static GitExit Fail(string text, int code = 1) => new(text.EndsWith('\n') || text == "" ? text : text + "\n", code);

    private static class Col
    {
        public const string Reset = "\x1b[m";
        public const string Bold = "\x1b[1m";
        public const string Red = "\x1b[31m";
        public const string Green = "\x1b[32m";
        public const string Yellow = "\x1b[33m";
        public const string Cyan = "\x1b[36m";
        public const string BoldRed = "\x1b[1;31m";
        public const string BoldGreen = "\x1b[1;32m";
        public const string BoldYellow = "\x1b[1;33m";
        public const string BoldCyan = "\x1b[1;36m";
        public const string Blue = "\x1b[34m";
    }

    private sealed class G
    {
        public required CmdCtx Ctx;
        public required Shell Sh;
        public required User User;
        public required string Cwd;
        public required bool Tty;
        public required Action<string> Out;
        public required Action<string> Err;

        /// <summary>Colours the text if output goes to the terminal.</summary>
        public string C(string color, string s) => Tty && s != "" ? $"{color}{s}{Col.Reset}" : s;

        public void Note(string key, params (string Name, object? Value)[] args) => Ctx.Err($"{UtilCmd.Color.Dim}{Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

        public void Hint(string text) =>
            Ctx.Err(string.Join("\n", text.Split('\n').Select(l => Tty ? $"{Col.Yellow}hint:{(l != "" ? " " + l : "")}{Col.Reset}" : $"hint:{(l != "" ? " " + l : "")}")) + "\n");
    }

    private static G MakeG(CmdCtx ctx) => new()
    {
        Ctx = ctx,
        Sh = ctx.Sh,
        User = ctx.Sh.CurrentUser(),
        Cwd = ctx.Sh.Cwd,
        Tty = ctx.IsTTY,
        Out = s => ctx.Out(s),
        Err = s => ctx.Err(s),
    };

    // help / version

    private const string Common = """
usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           <command> [<args>]

These are common Git commands used in various situations:

start a working area
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change
   add        Add file contents to the index
   mv         Move or rename a file, a directory, or a symlink
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index

examine the history and state
   diff       Show changes between commits, commit and working tree, etc
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   commit     Record changes to the repository
   merge      Join two or more development histories together
   reset      Reset current HEAD to the specified state
   switch     Switch branches
   tag        Create, list, delete or verify a tag object signed with GPG

collaborate
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.
""" + "\n";

    private static readonly OrderedDictionary<string, Func<G, List<string>, int>> Subs = new(StringComparer.Ordinal)
    {
        ["init"] = CmdInit,
        ["config"] = CmdConfig,
        ["status"] = CmdStatus,
        ["add"] = CmdAdd,
        ["commit"] = CmdCommit,
        ["log"] = CmdLog,
        ["diff"] = CmdDiff,
        ["restore"] = CmdRestore,
        ["rm"] = CmdRm,
        ["mv"] = CmdMv,
        ["branch"] = CmdBranch,
        ["switch"] = CmdSwitch,
        ["checkout"] = CmdCheckout,
        ["merge"] = CmdMerge,
        ["reset"] = CmdReset,
        ["show"] = CmdShow,
        ["tag"] = CmdTag,
        ["clone"] = CmdClone,
        ["remote"] = CmdRemote,
        ["fetch"] = CmdFetch,
        ["pull"] = CmdPull,
        ["push"] = CmdPush,
        ["stash"] = CmdStash,
        ["reflog"] = CmdReflog,
        ["rev-parse"] = CmdRevParse,
        ["cat-file"] = CmdCatFile,
        ["hash-object"] = CmdHashObject,
        ["ls-files"] = CmdLsFiles,
        ["ls-tree"] = CmdLsTree,
    };

    private static int Levenshtein(string a, string b) => UtilCmd.Levenshtein(a, b);

    private static readonly Regex WhitespaceRunRe = new("\\s+", RO);

    private static int RunGit(G g, List<string> args, int depth = 0)
    {
        // Global flags before the subcommand.
        while (args.Count > 0 && args[0].StartsWith('-'))
        {
            var a = args[0];
            if (a == "--version" || a == "-v")
            {
                g.Out("git version 2.51.1\n");
                return 0;
            }
            if (a == "--help" || a == "-h")
            {
                g.Out(Common);
                return 0;
            }
            if (a == "-C")
            {
                if (args.Count < 2 || args[1] == "") throw Fail("error: no directory given for '-C' option\n", 129);
                var dir = VfsLib.ResolvePath(g.Cwd, ExpandTilde(g, args[1]));
                if (!IsDirAt(g, dir)) throw Fatal($"cannot change to '{args[1]}': No such file or directory");
                g.Cwd = dir;
                args = args.Skip(2).ToList();
                continue;
            }
            if (a is "--no-pager" or "-P" or "--paginate" or "-p")
            {
                args = args.Skip(1).ToList();
                continue;
            }
            if (a == "-c")
            {
                args = args.Skip(2).ToList();
                continue;
            }
            throw Fail($"unknown option: {a}\n{string.Join("\n", Common.Split('\n').Take(2))}", 129);
        }
        var cmd = args.Count > 0 ? args[0] : null;
        var rest = args.Skip(1).ToList();
        if (string.IsNullOrEmpty(cmd))
        {
            g.Out(Common);
            return 1;
        }
        if (cmd == "version")
        {
            g.Out("git version 2.51.1\n");
            return 0;
        }
        if (cmd == "help")
        {
            if (rest.Count > 0 && rest[0] != "" && Subs.ContainsKey(rest[0]))
            {
                g.Note("git.manGitHint");
                return 0;
            }
            g.Out(Common);
            return 0;
        }
        if (rest.Contains("-h") && Subs.ContainsKey(cmd))
        {
            g.Out($"usage: git {cmd} [<options>]\n");
            g.Note("git.manGitOptions");
            return 129;
        }
        if (Subs.TryGetValue(cmd, out var sub)) return sub(g, rest);
        var r = Discover(g, g.Cwd);
        var alias = GetConfig(g, r, $"alias.{cmd}");
        if (!string.IsNullOrEmpty(alias) && depth < 5)
        {
            if (alias.StartsWith('!'))
            {
                g.Note("git.shellAliasUnsupported");
                return 1;
            }
            return RunGit(g, WhitespaceRunRe.Split(alias).Where(x => x != "").Concat(rest).ToList(), depth + 1);
        }
        g.Err($"git: '{cmd}' is not a git command. See 'git --help'.\n");
        var prefixed = cmd.Length >= 2 ? Subs.Keys.Where(s => s.StartsWith(cmd, StringComparison.Ordinal)).ToList() : new List<string>();
        var dist = Subs.Keys.Select(s => (S: s, D: Levenshtein(s, cmd))).ToList();
        int best = dist.Min(x => x.D);
        var similar = prefixed.Count > 0 ? prefixed : best <= 2 ? dist.Where(x => x.D == best).Select(x => x.S).ToList() : new List<string>();
        if (similar.Count > 0) g.Err($"\nThe most similar command{(similar.Count > 1 ? "s are" : " is")}\n{string.Concat(similar.Select(s => $"\t{s}\n"))}");
        return 1;
    }

    // ---------- The command ----------

    private const string ManSv = """
NAMN
       git - distribuerad versionshantering

SYNOPSIS
       git [-C KATALOG] KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       git sparar ögonblicksbilder (commits) av filerna i ett projekt så att
       du kan se vad som ändrats, gå tillbaka och arbeta i flera grenar.
       Repot ligger i den dolda katalogen .git i projektets rot.

       Arbetskatalogen är filerna du ser. Indexet (staging area) är det som
       ska med i nästa commit. En commit är en sparad version med meddelande,
       författare och tid.

       Simulatorn har en egen, förenklad git som sparar allt i .git som
       textfiler. Nätverk saknas, men clone, fetch, pull och push fungerar
       mot repon på samma dator.

KOMMANDON
       init [KATALOG]           skapa ett nytt repo (-b GREN, --bare)
       config                   inställningar, t.ex.
                                git config --global user.name "Namn"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         visa vad som ändrats (git status är kompassen!)
       add FIL... | . | -A      lägg ändringar i indexet (-u, -f, -n)
       commit -m MEDDELANDE     spara en commit (-a, --amend, --allow-empty)
       log                      historiken (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FIL)
       diff                     arbetskatalog mot index (--staged, --stat,
                                COMMIT, A B, -- FIL)
       show [COMMIT[:FIL]]      visa en commit eller en fil i en commit
       restore FIL              ångra ändringar i arbetskatalogen
                                (--staged för att plocka ur indexet,
                                --source=COMMIT, --ours, --theirs)
       rm [--cached] [-r] FIL   ta bort filer (ur indexet)
       mv KÄLLA MÅL             flytta eller byt namn
       branch [NAMN]            lista eller skapa grenar (-d, -D, -m, -v, -a)
       switch GREN              byt gren (-c NY för att skapa, -, --detach)
       checkout GREN | -- FIL   äldre kommando: byt gren eller återställ fil
                                (-b NY)
       merge GREN               slå ihop en gren (--no-ff, --ff-only,
                                --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FIL
                                flytta grenen eller plocka ur indexet
       stash [list|pop|apply|drop]
                                lägg undan ändringar tillfälligt
       tag [-a -m MEDD] NAMN    märk en commit (t.ex. v1.0)
       clone KÄLLA [MÅL]        kopiera ett repo (bara lokala i simulatorn)
       remote [-v] | remote add NAMN URL
       fetch, pull, push [-u] FJÄRR GREN
                                utbyt commits med ett annat repo
       reflog                   var HEAD har varit (bra för att rädda saker)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                titta in i maskineriet

FILER
       ~/.gitconfig             dina globala inställningar
       .git/                    repot: objects/, refs/heads/, HEAD, index ...
       .gitignore               filer som git ska strunta i

EXEMPEL
       git config --global user.name "Elev Elevsson"
       git init
       git add .
       git commit -m "Första versionen"
       git switch -c ny-design
       git log --oneline --graph --all
""";

    private const string ManEn = """
NAME
       git - distributed version control

SYNOPSIS
       git [-C DIR] COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       git stores snapshots (commits) of the files in a project so you can
       see what changed, go back in time and work in several branches.
       The repository lives in the hidden directory .git in the project root.

       The working tree is the files you see. The index (staging area) is
       what will go into the next commit. A commit is a saved version with a
       message, an author and a time.

       The simulator has its own simplified git that stores everything in
       .git as text files. There is no network, but clone, fetch, pull and
       push work with repositories on the same computer.

COMMANDS
       init [DIR]               create a new repository (-b BRANCH, --bare)
       config                   settings, e.g.
                                git config --global user.name "Name"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         show what changed (git status is your compass!)
       add FILE... | . | -A     add changes to the index (-u, -f, -n)
       commit -m MESSAGE        record a commit (-a, --amend, --allow-empty)
       log                      history (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FILE)
       diff                     working tree vs index (--staged, --stat,
                                COMMIT, A B, -- FILE)
       show [COMMIT[:FILE]]     show a commit or a file in a commit
       restore FILE             discard changes in the working tree
                                (--staged to unstage, --source=COMMIT,
                                --ours, --theirs)
       rm [--cached] [-r] FILE  remove files (from the index)
       mv SOURCE DEST           move or rename
       branch [NAME]            list or create branches (-d, -D, -m, -v, -a)
       switch BRANCH            switch branches (-c NEW to create, -, --detach)
       checkout BRANCH | -- FILE
                                older command: switch branch or restore file
                                (-b NEW)
       merge BRANCH             join a branch (--no-ff, --ff-only, --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FILE
                                move the branch or unstage
       stash [list|pop|apply|drop]
                                put changes aside for a while
       tag [-a -m MSG] NAME     mark a commit (e.g. v1.0)
       clone SOURCE [DEST]      copy a repository (local only in the simulator)
       remote [-v] | remote add NAME URL
       fetch, pull, push [-u] REMOTE BRANCH
                                exchange commits with another repository
       reflog                   where HEAD has been (great for rescues)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                look inside the machinery

FILES
       ~/.gitconfig             your global settings
       .git/                    the repository: objects/, refs/heads/, HEAD, index ...
       .gitignore               files git should ignore

EXAMPLES
       git config --global user.name "Ada Lovelace"
       git init
       git add .
       git commit -m "First version"
       git switch -c new-design
       git log --oneline --graph --all
""";

    private static int RunCommand(CmdCtx ctx)
    {
        var g = MakeG(ctx);
        try
        {
            return RunGit(g, ctx.Args);
        }
        catch (GitExit e)
        {
            if (e.Text != "") g.Err(e.Text);
            return e.Code;
        }
        catch (FsError e)
        {
            g.Err($"fatal: {e.Message}\n");
            return 128;
        }
    }

    public static List<CommandDef> All { get; } = new()
    {
        new CommandDef
        {
            Name = "git",
            Summary = "Versionshantering",
            SummaryEn = "Version control",
            Man = ManSv,
            ManEn = ManEn,
            Run = RunCommand,
        },
    };
}
