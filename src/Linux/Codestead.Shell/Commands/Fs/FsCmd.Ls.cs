namespace Codestead.Shell.Commands;

// The ls command: lists the contents of directories.

public static partial class FsCmd
{
    private static readonly Regex LeadingDots = new(@"^\.+", RegexOptions.CultureInvariant);

    private static int LsCompare(string a, string b)
    {
        var ka = LeadingDots.Replace(a, "", 1).ToLowerInvariant();
        var kb = LeadingDots.Replace(b, "", 1).ToLowerInvariant();
        int c = string.CompareOrdinal(ka, kb);
        if (c != 0) return c < 0 ? -1 : 1;
        c = string.CompareOrdinal(a, b);
        return c < 0 ? -1 : c > 0 ? 1 : 0;
    }

    /// <summary>A name ls shows. <paramref name="Path"/> is where it is (to follow a symbolic link).</summary>
    private sealed record Entry(string Name, FsNode Node, string Path);

    private static readonly CommandDef Ls = new()
    {
        Name = "ls",
        Summary = "Listar innehållet i kataloger",
        Man = """
NAMN
       ls - lista innehållet i kataloger

SYNOPSIS
       ls [FLAGGA]... [FIL]...

BESKRIVNING
       Listar filer och kataloger. Utan argument listas aktuell katalog.

FLAGGOR
       -a, --all       visa även dolda filer (namn som börjar med .)
       -A              som -a, men utan . och ..
       -l              långt format: rättigheter, ägare, storlek, datum
       -h              läsbara storlekar (1K, 4.0M) tillsammans med -l
       -d              lista katalogen själv, inte dess innehåll
       -F              lägg till / efter kataloger, * efter körbara filer och
                       @ efter symboliska länkar
       -i              visa inodnumret före varje namn
       -1              en fil per rad

EXEMPEL
       ls -la ~        allt i hemkatalogen, i långt format
""",
        Run = RunLs,
    };

    private static int RunLs(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "laAh1dFi",
            Long = new() { ["all"] = "a", ["almost-all"] = "A", ["human-readable"] = "h", ["directory"] = "d", ["classify"] = "F" },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool isLong = o.Flags.Contains("l");
        var targets = o.Operands.Count > 0 ? o.Operands : new List<string> { "." };
        int code = 0;

        var files = new List<Entry>();
        var dirs = new List<(string Label, string Path, FsNode Node)>();
        foreach (var t in targets)
        {
            try
            {
                var path = sh.Resolve(t);
                // A symbolic link given by name is shown as a link with -l and -d (ls link/ follows it).
                var node = (isLong || o.Flags.Contains("d")) && !t.EndsWith('/') ? sh.Vfs.Lookup(path, user, follow: false) : sh.Vfs.Lookup(path, user);
                if (node.Type == "dir" && !o.Flags.Contains("d")) dirs.Add((t, path, node));
                else files.Add(new Entry(t, node, path));
            }
            catch (FsError e)
            {
                ctx.Err($"ls: cannot access '{t}': {e.Message}\n");
                code = 2;
            }
        }

        bool Broken(Entry e) => e.Node.Type == "link" && sh.Vfs.TryLookup(e.Path, user) is null;
        string Suffix(FsNode n) => !o.Flags.Contains("F") ? "" : n.Type == "dir" ? "/" : n.Type == "link" ? (isLong ? "" : "@") : (n.Mode & Js.Oct(111)) != 0 ? "*" : "";
        string Display(Entry e) =>
            (o.Flags.Contains("i") && !isLong ? $"{Js.Num(sh.Vfs.InoOf(e.Node))} " : "") +
            UtilCmd.ColorName(e.Name, e.Node, ctx.IsTTY, Broken(e)) + Suffix(e.Node) +
            (isLong && e.Node.Type == "link" ? $" -> {e.Node.Content}" : "");
        string Size(FsNode n) => o.Flags.Contains("h") ? UtilCmd.HumanSize(VfsLib.NodeSize(n)) : Js.Num(VfsLib.NodeSize(n));
        int Links(FsNode n) => VFS.LinkCount(n);

        void Render(List<Entry> entries, bool showTotal)
        {
            if (isLong)
            {
                if (showTotal)
                {
                    long blocks = entries.Sum(e => (long)Math.Ceiling(VfsLib.NodeSize(e.Node) / 4096.0) * 4);
                    ctx.Out($"total {blocks}\n");
                }
                int wLinks = entries.Select(e => Js.Num(Links(e.Node)).Length).Append(1).Max();
                int wOwner = entries.Select(e => e.Node.Owner.Length).Append(1).Max();
                int wGroup = entries.Select(e => e.Node.Group.Length).Append(1).Max();
                int wSize = entries.Select(e => Size(e.Node).Length).Append(1).Max();
                int wIno = o.Flags.Contains("i") ? entries.Select(e => Js.Num(sh.Vfs.InoOf(e.Node)).Length).Append(1).Max() : 0;
                foreach (var e in entries)
                {
                    ctx.Out(
                        (o.Flags.Contains("i") ? Js.Num(sh.Vfs.InoOf(e.Node)).PadLeft(wIno) + " " : "") +
                        $"{UtilCmd.ModeString(e.Node)} {Js.Num(Links(e.Node)).PadLeft(wLinks)} {e.Node.Owner.PadRight(wOwner)} " +
                        $"{e.Node.Group.PadRight(wGroup)} {Size(e.Node).PadLeft(wSize)} {UtilCmd.LsDate(e.Node.Mtime)} {Display(e)}\n");
                }
            }
            else if (entries.Count > 0)
            {
                if (ctx.IsTTY && !o.Flags.Contains("1")) ctx.Out(string.Join("  ", entries.Select(Display)) + "\n");
                else foreach (var e in entries) ctx.Out(Display(e) + "\n");
            }
        }

        Render(files, false);
        for (int idx = 0; idx < dirs.Count; idx++)
        {
            var d = dirs[idx];
            if (targets.Count > 1) ctx.Out($"{(files.Count > 0 || idx > 0 ? "\n" : "")}{d.Label}:\n");
            if (!VfsLib.HasPerm(d.Node, user, 'r'))
            {
                ctx.Err($"ls: cannot open directory '{d.Label}': Permission denied\n");
                code = 2;
                continue;
            }
            var names = d.Node.Children!.Keys.ToList();
            if (!o.Flags.Contains("a") && !o.Flags.Contains("A")) names = names.Where(n => !n.StartsWith('.')).ToList();
            names.StableSort(LsCompare);
            var entries = names.Select(n => new Entry(n, d.Node.Children![n], JoinPath(d.Path, n))).ToList();
            if (o.Flags.Contains("a"))
            {
                var parent = sh.Vfs.TryLookup(sh.Resolve(d.Path + "/.."), user) ?? d.Node;
                entries.InsertRange(0, new[] { new Entry(".", d.Node, d.Path), new Entry("..", parent, VfsLib.Dirname(d.Path)) });
            }
            Render(entries, true);
        }
        return code;
    }
}
