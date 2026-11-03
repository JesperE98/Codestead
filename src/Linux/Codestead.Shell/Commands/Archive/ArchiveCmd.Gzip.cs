namespace Codestead.Shell.Commands;

// The gzip, gunzip and zcat commands.

public static partial class ArchiveCmd
{
    private static string Ratio(long compressed, long uncompressed)
    {
        double r = uncompressed == 0 ? 0 : (1 - (double)compressed / uncompressed) * 100;
        return $"{AwkCmd.JsToFixed(r, 1).PadLeft(5)}%";
    }

    private static readonly (string Suffix, string Replacement)[] GzSuffixes =
    {
        (".tgz", ".tar"),
        (".gz", ""),
    };

    private static Func<CmdCtx, int> GzipLike(string mode) => ctx =>
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "cdfklqrtv123456789",
            Long = new Dictionary<string, string>
            {
                ["stdout"] = "c",
                ["to-stdout"] = "c",
                ["decompress"] = "d",
                ["uncompress"] = "d",
                ["force"] = "f",
                ["keep"] = "k",
                ["list"] = "l",
                ["quiet"] = "q",
                ["recursive"] = "r",
                ["test"] = "t",
                ["verbose"] = "v",
                ["fast"] = "1",
                ["best"] = "9",
            },
        });
        if (o.Error is not null)
        {
            ctx.Err($"gzip: {o.Error}\nTry `gzip --help' for more information.\n");
            return 1;
        }
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool Has(string f) => o.Flags.Contains(f);
        bool decompress = mode != "gzip" || Has("d") || Has("l") || Has("t");
        bool toStdout = mode == "zcat" || Has("c");
        bool verbose = Has("v") && !Has("q");
        int code = 0;
        void Warn() => code = Math.Max(code, 2);
        void Fail() => code = 1;
        int NotToTerminal()
        {
            ctx.Err("gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h\n");
            return 1;
        }
        var listRows = new List<(long C, long U, string Name)>();

        void HandleStdin()
        {
            var input = ctx.Stdin ?? "";
            if (!decompress)
            {
                if (ctx.IsTTY && !Has("f"))
                {
                    code = NotToTerminal();
                    return;
                }
                ctx.Out(GzipString(input));
                return;
            }
            if (input == "")
            {
                ctx.Err("gzip: stdin: unexpected end of file\n");
                Fail();
                return;
            }
            var gz = GunzipString(input);
            if (gz is null)
            {
                ctx.Err("gzip: stdin: not in gzip format\n");
                Fail();
                return;
            }
            if (Has("l")) listRows.Add((LogicalSize(input), gz.S ?? LogicalSize(gz.D), "stdout"));
            else if (!Has("t")) ctx.Out(gz.D);
        }

        void HandleFile(string label, string abs, FsNode node)
        {
            string content;
            try
            {
                content = sh.Vfs.ReadFile(abs, user);
            }
            catch (FsError e)
            {
                ctx.Err($"gzip: {label}: {e.Message}\n");
                Fail();
                return;
            }

            // Creates the output file with the same permissions and time as the original, and removes the original.
            bool Replace(string outLabel, string data, long? size = null)
            {
                var outAbs = JoinPath(VfsLib.Dirname(abs), VfsLib.Basename(outLabel));
                if (sh.Vfs.TryLookup(outAbs, user) is not null && !Has("f"))
                {
                    ctx.Err($"gzip: {outLabel} already exists; not overwritten\n");
                    Warn();
                    return false;
                }
                try
                {
                    var outNode = VfsLib.MakeFile(data, user.Uid == 0 ? node.Owner : user.Name, node.Mode, user.Uid == 0 ? node.Group : user.Groups.FirstOrDefault());
                    outNode.Mtime = node.Mtime;
                    if (size is not null) outNode.Size = size;
                    sh.Vfs.Insert(outAbs, outNode, user);
                    if (!Has("k")) sh.Vfs.Remove(abs, user);
                }
                catch (FsError e)
                {
                    ctx.Err($"gzip: {outLabel}: {e.Message}\n");
                    Fail();
                    return false;
                }
                return true;
            }

            if (decompress)
            {
                (string Suffix, string Replacement)? suffix = null;
                foreach (var sfx in GzSuffixes)
                {
                    if (label.EndsWith(sfx.Suffix, StringComparison.Ordinal) && label.Length > sfx.Suffix.Length)
                    {
                        suffix = sfx;
                        break;
                    }
                }
                if (suffix is null && !toStdout && !Has("l") && !Has("t"))
                {
                    ctx.Err($"gzip: {label}: unknown suffix -- ignored\n");
                    Warn();
                    return;
                }
                var gz = GunzipString(content);
                if (gz is null)
                {
                    ctx.Err($"gzip: {label}: not in gzip format\n");
                    Fail();
                    return;
                }
                var outLabel = suffix is { } sx ? label[..^sx.Suffix.Length] + sx.Replacement : label;
                long uncompressed = gz.S ?? LogicalSize(gz.D);
                if (Has("l"))
                {
                    listRows.Add((VfsLib.NodeSize(node), uncompressed, outLabel));
                }
                else if (Has("t"))
                {
                    if (verbose) ctx.Err($"{label}:\t OK\n");
                }
                else if (toStdout)
                {
                    ctx.Out(gz.D);
                }
                else if (Replace(outLabel, gz.D, gz.S))
                {
                    if (verbose) ctx.Err($"{label}:\t{Ratio(VfsLib.NodeSize(node), uncompressed)} -- {(Has("k") ? "created" : "replaced with")} {outLabel}\n");
                }
                return;
            }

            if (GzSuffixes.Any(s => label.EndsWith(s.Suffix, StringComparison.Ordinal)) && !toStdout)
            {
                ctx.Err($"gzip: {label} already has {(label.EndsWith(".tgz", StringComparison.Ordinal) ? ".tgz" : ".gz")} suffix -- unchanged\n");
                Warn();
                return;
            }
            var data = GzipString(content, VfsLib.Basename(label), node.Size);
            if (toStdout)
            {
                if (ctx.IsTTY && !Has("f"))
                {
                    code = NotToTerminal();
                    return;
                }
                ctx.Out(data);
            }
            else if (Replace($"{label}.gz", data))
            {
                if (verbose) ctx.Err($"{label}:\t{Ratio(LogicalSize(data), VfsLib.NodeSize(node))} -- {(Has("k") ? "created" : "replaced with")} {label}.gz\n");
            }
        }

        void Visit(string label, string abs)
        {
            FsNode node;
            try
            {
                node = sh.Vfs.Lookup(abs, user);
            }
            catch (FsError e)
            {
                ctx.Err($"gzip: {label}: {e.Message}\n");
                Fail();
                return;
            }
            if (node.Type == "dir")
            {
                if (!Has("r"))
                {
                    ctx.Err($"gzip: {label} is a directory -- ignored\n");
                    Warn();
                    return;
                }
                if (!VfsLib.HasPerm(node, user, 'r'))
                {
                    ctx.Err($"gzip: {label}: Permission denied\n");
                    Fail();
                    return;
                }
                foreach (var child in SortedChildren(node))
                    Visit(label.EndsWith('/') ? label + child : $"{label}/{child}", JoinPath(abs, child));
                return;
            }
            HandleFile(label, abs, node);
        }

        var operands = o.Operands.Count > 0 ? o.Operands : new List<string> { "-" };
        foreach (var op in operands)
        {
            if (op == "-") HandleStdin();
            else Visit(op, sh.Resolve(op));
        }

        if (listRows.Count > 0)
        {
            string Row(long c, long u, string name) =>
                $"{Js.Num(c).PadLeft(19)} {Js.Num(u).PadLeft(19)} {Ratio(c, u)} {name}\n";
            ctx.Out($"{"compressed".PadLeft(19)} {"uncompressed".PadLeft(19)}  ratio uncompressed_name\n");
            foreach (var r in listRows) ctx.Out(Row(r.C, r.U, r.Name));
            if (listRows.Count > 1)
            {
                long c = listRows.Sum(r => r.C);
                long u = listRows.Sum(r => r.U);
                ctx.Out(Row(c, u, "(totals)"));
            }
        }
        return code;
    };

    private const string GzipMan = """
NAMN
       gzip, gunzip, zcat - komprimera och dekomprimera filer

SYNOPSIS
       gzip [-k] [-v] [-d] [-c] [-l] FIL...
       gunzip FIL.gz...
       zcat FIL.gz...

BESKRIVNING
       gzip komprimerar EN fil i taget: fil.txt ersätts med den mindre
       filen fil.txt.gz. Rättigheter och tidsstämpel följer med. Vill du
       komprimera en hel katalog packar du först ihop den med tar (eller
       använder tar -z direkt).

       gunzip är samma sak som gzip -d och zcat samma sak som gzip -dc:
       zcat skriver ut innehållet utan att packa upp filen.

       Mycket små filer blir ofta STÖRRE av att komprimeras, eftersom
       gzip lägger till ett huvud med bland annat filnamnet.

FLAGGOR
       -k, --keep         behåll originalfilen
       -d, --decompress   dekomprimera (som gunzip)
       -c, --stdout       skriv resultatet till standard output
       -l, --list         visa storlek före och efter komprimering
       -v, --verbose      berätta hur mycket mindre filen blev
       -r, --recursive    komprimera alla filer i kataloger, var för sig
       -f, --force        skriv över filer som redan finns
       -1 ... -9          snabbare (-1) eller bättre (-9) komprimering

EXEMPEL
       gzip -kv server.log         komprimera, men behåll originalet
       gzip -l server.log.gz       hur mycket sparade vi?
       zcat server.log.gz | grep ERROR
""";

    private static readonly CommandDef Gzip = new() { Name = "gzip", Summary = "Komprimerar filer (fil → fil.gz)", Man = GzipMan, Run = GzipLike("gzip") };
    private static readonly CommandDef Gunzip = new() { Name = "gunzip", Summary = "Packar upp .gz-filer (samma som gzip -d)", Man = GzipMan, Run = GzipLike("gunzip") };
    private static readonly CommandDef Zcat = new() { Name = "zcat", Summary = "Visar innehållet i .gz-filer utan att packa upp dem", Man = GzipMan, Run = GzipLike("zcat") };
}
