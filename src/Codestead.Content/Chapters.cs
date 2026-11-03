using System.Collections.Concurrent;
using Codestead.Shell.Commands;

namespace Codestead.Content;

// Port of src/content/chapters.ts – all chapters and their tasks.
// The text is in src/content/chapters/<lang>/*.md; the tasks and their checks are here
// (the chapter definitions are in ChapterDefinitions.cs).

public static partial class ChaptersLib
{
    /// <summary>The file that `add-apt-repository ppa:lunatool/moonphase` creates. (Computed on use.)</summary>
    private static string PpaFile => ExtrarepoLib.PpaSourcesPath(ExtrarepoLib.ParsePpa("ppa:lunatool/moonphase")!);

    // ---------- The student's world ----------
    // Names of the exercise files, the user and so on depend on the language (see Shell/World.cs). Texts,
    // solutions and checks write them as {{placeholders}}: "~/{{documents}}/{{fruits}}".

    private static World W(CheckContext c) => c.Sh.World;
    /// <summary>The student's home directory, e.g. /home/student.</summary>
    private static string Home(CheckContext c) => c.Sh.World.Home;
    /// <summary>The practice project in the git chapter.</summary>
    private static string Web(CheckContext c) => $"{Home(c)}/{c.Sh.World["webProject"]}";
    /// <summary>A text with the world's placeholders filled in.</summary>
    private static string X(CheckContext c, string text) => c.Sh.World.Expand(text);

    // ---------- Regexes ----------
    // The checks use many one-off regexes; they are compiled once and cached here.
    // Without the "i" flag they use RegexOptions.ECMAScript, so \w, \d, \s and \b are ASCII like in JavaScript.

    private static readonly ConcurrentDictionary<(string Pattern, string Flags), Regex> regexCache = new();

    private static Regex Re(string pattern, string flags = "") =>
        regexCache.GetOrAdd((pattern, flags), k =>
        {
            var opts = k.Flags.Contains('i') ? RegexOptions.IgnoreCase | RegexOptions.CultureInvariant : RegexOptions.ECMAScript;
            if (k.Flags.Contains('m')) opts |= RegexOptions.Multiline;
            return new Regex(k.Pattern, opts);
        });

    /// <summary>A regex with the world's {{placeholders}} filled in (as literal text).</summary>
    private static Regex Re(CheckContext c, string pattern, string flags = "") =>
        Re(PlaceholderRe.Replace(pattern, m =>
        {
            var key = m.Groups[1].Value;
            return c.Sh.World.Names.ContainsKey(key) || c.Sh.World.Words.ContainsKey(key) ? Regex.Escape(c.Sh.World[key]) : m.Value;
        }), flags);

    private static readonly Regex PlaceholderRe = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);

    // ---------- Helpers for the checks ----------

    /// <summary>A file by path; "~" and {{placeholders}} are filled in.</summary>
    private static FsNode? Node(CheckContext c, string p)
    {
        p = X(c, p);
        return c.Sh.Vfs.TryLookup(p.StartsWith('~') ? Home(c) + p[1..] : p, c.Sh.RootUser());
    }
    private static bool IsFile(CheckContext c, string p) => Node(c, p)?.Type == "file";
    private static bool IsDir(CheckContext c, string p) => Node(c, p)?.Type == "dir";
    private static bool Exists(CheckContext c, string p) => Node(c, p) is not null;
    private static string Content(CheckContext c, string p) => Node(c, p)?.Content ?? "";
    /// <summary>The line matches and the command succeeded.</summary>
    private static bool Ran(CheckContext c, Regex re) => c.ExitCode == 0 && re.IsMatch(c.Line);
    /// <summary>The non-empty lines of a text, in the order `sort` prints them in this terminal.</summary>
    private static List<string> SortedLines(CheckContext c, string text) =>
        TextCmd.SortLines(c.Sh, text.Split('\n').Where(l => l.Trim() != ""));
    private static List<string> OutLines(CheckContext c) => c.Output.Split('\n').Where(l => l.Trim() != "").ToList();
    /// <summary>The line without a leading "sudo".</summary>
    private static string Unsudo(string line) => Re(@"^sudo\s+(-\S+\s+)*").Replace(line, "", 1);
    private static int Mode(CheckContext c, string p) => Node(c, p)?.Mode ?? 0;
    private static bool Flag(CheckContext c, string name) => c.Sh.Flags.TryGetValue(name, out var v) && v;
    private static bool Installed(CheckContext c, string pkg) => c.Sh.Installed.ContainsKey(pkg);
    /// <summary>A shell variable; the name may be a {{placeholder}}.</summary>
    private static string? Env(CheckContext c, string name) => c.Sh.Env.Get(X(c, name));

    /// <summary>A path itself, also when it is a symbolic link (like lstat); "~" and {{placeholders}} are filled in.</summary>
    private static FsNode? LinkNode(CheckContext c, string p) => c.Sh.Vfs.TryLookupLink(Abs(c, p), c.Sh.RootUser());
    /// <summary>The path without "~" and {{placeholders}}.</summary>
    private static string Abs(CheckContext c, string p)
    {
        p = X(c, p);
        return p.StartsWith('~') ? Home(c) + p[1..] : p;
    }
    /// <summary>The real path (symbolic links followed), or null.</summary>
    private static string? RealPath(CheckContext c, string p)
    {
        try
        {
            return c.Sh.Vfs.RealPath(Abs(c, p), c.Sh.RootUser());
        }
        catch (FsError)
        {
            return null;
        }
    }
    /// <summary>A file on the server (server.lan), with "~" meaning the home directory there.</summary>
    private static FsNode? ServerNode(CheckContext c, string p)
    {
        var server = SshCmd.ServerFor(c.Sh);
        p = X(c, p);
        return server.Vfs.TryLookup(p.StartsWith('~') ? server.World.Home + p[1..] : p, server.RootUser());
    }
    /// <summary>The jobs in the student's crontab.</summary>
    private static List<CronCmd.Job> CronJobs(CheckContext c)
    {
        var node = c.Sh.Vfs.TryLookup($"{CronCmd.SpoolDir(c.Sh)}/{W(c).User}", c.Sh.RootUser());
        return node?.Type == "file" ? CronCmd.Parse(node.Content ?? "", W(c).User).Jobs : new List<CronCmd.Job>();
    }
    private static bool Every(HashSet<int> set, int min, int max) => Enumerable.Range(min, max - min + 1).All(set.Contains);
    /// <summary>The file names rsync -v listed (between "sending incremental file list" and the empty line).</summary>
    private static List<string> RsyncFiles(CheckContext c) =>
        c.Output.Split('\n').SkipWhile(l => !l.StartsWith("sending incremental file list", StringComparison.Ordinal)).Skip(1)
            .TakeWhile(l => l.Trim() != "").Where(l => !l.EndsWith('/') && !l.StartsWith("created directory", StringComparison.Ordinal)).ToList();

    private static PerDistro<T> ByFamily<T>(T debian, T arch, T redhat) =>
        new(d => d.Family switch
        {
            "debian" => debian,
            "arch" => arch,
            "redhat" => redhat,
            _ => default!,
        });

    /// <summary>Solution commands. They may contain the world's {{placeholders}} (see <see cref="ChapterTask.SolutionFor"/>).</summary>
    private static List<string> Cmds(params string[] lines) => lines.ToList();

    /// <summary>True if the file is an archive (tar, tar.gz or zip) of the right kind containing a file whose path ends with <paramref name="suffix"/>.</summary>
    private static bool ArchiveHas(CheckContext c, string p, string format, string suffix)
    {
        var a = ArchiveCmd.ReadArchive(Content(c, p));
        suffix = X(c, suffix);
        return a?.Format == format && a.Value.Entries.Any(e => e.Path == suffix || e.Path.EndsWith("/" + suffix, StringComparison.Ordinal));
    }

    private static readonly OrderedDictionary<string, string> TarLongOps = new(StringComparer.Ordinal)
    {
        ["--create"] = "c",
        ["--extract"] = "x",
        ["--get"] = "x",
        ["--list"] = "t",
    };

    /// <summary>Which tar operations (c, x, t) the command line contains, e.g. "x" for `cd ~ &amp;&amp; tar -xzf a.tgz`.</summary>
    private static string TarOps(string line) =>
        string.Concat(
            Re(@"&&|\|\||[;|]").Split(line)
                .Select(part => Re(@"\s+").Split(Unsudo(part.Trim())))
                .Where(words => words[0] == "tar")
                .SelectMany(words => words.Skip(1).Select((w, i) =>
                {
                    if (w.StartsWith("--", StringComparison.Ordinal)) return TarLongOps.TryGetValue(w, out var op) ? op : "";
                    return w.StartsWith('-') || i == 0 ? Re(@"[^cxt]").Replace(w, "") : "";
                })));

    // ---------- Parts and chapters ----------

    /// <summary>The distribution the terminal runs outside the "distro" main chapter.</summary>
    public const string DefaultDistro = "ubuntu";

    /// <summary>
    /// The main chapters in order. The fundamentals come first and are the same on every distribution;
    /// distributions and package managers get their own main chapter (the only one with a distro choice).
    /// </summary>
    public static List<Part> Parts { get; } = new()
    {
        new() { Id = "start", Title = "Kom igång" },
        new() { Id = "grunder", Title = "Grunderna" },
        new() { Id = "system", Title = "Systemet" },
        new() { Id = "distro", Title = "Distributioner och paket", DistroChoice = true },
        new() { Id = "admin", Title = "Systemadministration" },
        new() { Id = "natverk", Title = "Nätverk" },
        new() { Id = "skript", Title = "Skript och automatisering" },
        new() { Id = "verktyg", Title = "Fler verktyg" },
    };

    /// <summary>
    /// All chapters, shown in the same order as the parts in <see cref="Parts"/>
    /// (stable sort keeps the order within a part). Each main chapter ends with a summary and an exam
    /// when their texts exist (content/linux/chapters/&lt;lang&gt;/&lt;part&gt;-summary.md and -exam.md).
    /// </summary>
    public static List<Chapter> Chapters { get; } = WithSummariesAndExams(DefineChapters())
        .OrderBy(ch => Parts.FindIndex(p => p.Id == ch.Part))
        .ToList();

    private static IEnumerable<Chapter> WithSummariesAndExams(IEnumerable<Chapter> lessons)
    {
        var list = lessons.ToList();
        foreach (var part in Parts)
        {
            int last = list.FindLastIndex(c => c.Part == part.Id);
            if (last < 0) continue;
            var extra = new List<Chapter>();
            foreach (var kind in new[] { ChapterKinds.Summary, ChapterKinds.Exam })
            {
                var id = $"{part.Id}-{kind}";
                if (Resources.Read($"chapters/en/{id}.md") is null) continue;
                extra.Add(new Chapter { Id = id, Part = part.Id, Kind = kind });
            }
            list.InsertRange(last + 1, extra);
        }
        return list;
    }

    public static Part PartOf(Chapter chapter) => Parts.First(p => p.Id == chapter.Part);

    /// <summary>
    /// The distribution a chapter runs on: outside the distro main chapter always <see cref="DefaultDistro"/>;
    /// inside it the student's choice – limited to the chapter's family for a family chapter
    /// (the family's first distribution if the choice belongs to another family).
    /// </summary>
    public static string DistroFor(Chapter chapter, string chosenDistroId)
    {
        if (!PartOf(chapter).DistroChoice) return DefaultDistro;
        var choices = DistrosFor(chapter);
        return choices.FirstOrDefault(d => d.Id == chosenDistroId)?.Id ?? choices[0].Id;
    }

    /// <summary>The distributions the student can choose between in a chapter (one = no choice).</summary>
    public static List<Distro> DistrosFor(Chapter chapter) =>
        !PartOf(chapter).DistroChoice ? new() { DistrosLib.GetDistro(DefaultDistro) }
        : chapter.Family is null ? DistrosLib.Distros.ToList()
        : DistrosLib.Distros.Where(d => d.Family == chapter.Family).ToList();

    /// <summary>The lesson chapters of a main chapter (not the summary and exam).</summary>
    public static List<Chapter> LessonsIn(string partId) =>
        Chapters.Where(c => c.Part == partId && c.Kind == ChapterKinds.Lesson).ToList();

    /// <summary>Planned chapters – shown in the menu as "coming soon".</summary>
    public static List<string> Upcoming { get; } = new();

    public static string TaskKey(string chapterId, string taskId, bool? perFamily, Family family) =>
        perFamily == true ? $"{chapterId}/{taskId}@{family}" : $"{chapterId}/{taskId}";
}
