using System.Collections.Concurrent;
using Codestead.Shell.Commands;

namespace Codestead.Content;

// Port of src/content/chapters.ts – all chapters and their tasks.
// The text is in src/content/chapters/<lang>/*.md; the tasks and their checks are here
// (the chapter definitions are in ChapterDefinitions.cs).

public static partial class ChaptersLib
{
    private const string Home = "/home/elev";
    /// <summary>The file that `add-apt-repository ppa:lunatool/moonphase` creates. (Computed on use.)</summary>
    private static string PpaFile => ExtrarepoLib.PpaSourcesPath(ExtrarepoLib.ParsePpa("ppa:lunatool/moonphase")!);
    /// <summary>The practice project in the git chapter.</summary>
    private const string Web = Home + "/projekt-webb";

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

    // ---------- Helpers for the checks ----------

    private static FsNode? Node(CheckContext c, string p) =>
        c.Sh.Vfs.TryLookup(p.StartsWith('~') ? Home + p[1..] : p, c.Sh.RootUser());
    private static bool IsFile(CheckContext c, string p) => Node(c, p)?.Type == "file";
    private static bool IsDir(CheckContext c, string p) => Node(c, p)?.Type == "dir";
    private static bool Exists(CheckContext c, string p) => Node(c, p) is not null;
    private static string Content(CheckContext c, string p) => Node(c, p)?.Content ?? "";
    /// <summary>The line matches and the command succeeded.</summary>
    private static bool Ran(CheckContext c, Regex re) => c.ExitCode == 0 && re.IsMatch(c.Line);
    private static List<string> OutLines(CheckContext c) => c.Output.Split('\n').Where(l => l.Trim() != "").ToList();
    /// <summary>The line without a leading "sudo".</summary>
    private static string Unsudo(string line) => Re(@"^sudo\s+(-\S+\s+)*").Replace(line, "", 1);
    private static int Mode(CheckContext c, string p) => Node(c, p)?.Mode ?? 0;
    private static bool Flag(CheckContext c, string name) => c.Sh.Flags.TryGetValue(name, out var v) && v;
    private static bool Installed(CheckContext c, string pkg) => c.Sh.Installed.ContainsKey(pkg);
    private static string? Env(CheckContext c, string name) => c.Sh.Env.Get(name);

    private static PerDistro<T> ByFamily<T>(T debian, T arch, T redhat) =>
        new(d => d.Family switch
        {
            "debian" => debian,
            "arch" => arch,
            "redhat" => redhat,
            _ => default!,
        });

    private static List<string> Cmds(params string[] lines) => lines.ToList();

    /// <summary>True if the file is an archive (tar, tar.gz or zip) of the right kind containing a file whose path ends with <paramref name="suffix"/>.</summary>
    private static bool ArchiveHas(CheckContext c, string p, string format, string suffix)
    {
        var a = ArchiveCmd.ReadArchive(Content(c, p));
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

    public static List<Part> Parts { get; } = new()
    {
        new() { Id = "start", Title = "Kom igång" },
        new() { Id = "grunder", Title = "Grunderna" },
        new() { Id = "system", Title = "Systemet" },
        new() { Id = "admin", Title = "Systemadministration" },
        new() { Id = "natverk", Title = "Nätverk" },
        new() { Id = "distro", Title = "Distributioner och paket" },
        new() { Id = "skript", Title = "Skript och automatisering" },
        new() { Id = "verktyg", Title = "Fler verktyg" },
    };

    /// <summary>
    /// All chapters, shown in the same order as the parts in <see cref="Parts"/>
    /// (stable sort keeps the order within a part).
    /// </summary>
    public static List<Chapter> Chapters { get; } = DefineChapters()
        .OrderBy(ch => Parts.FindIndex(p => p.Id == ch.Part))
        .ToList();

    /// <summary>Planned chapters – shown in the menu as "coming soon".</summary>
    public static List<string> Upcoming { get; } = new();

    public static string TaskKey(string chapterId, string taskId, bool? perFamily, Family family) =>
        perFamily == true ? $"{chapterId}/{taskId}@{family}" : $"{chapterId}/{taskId}";
}
