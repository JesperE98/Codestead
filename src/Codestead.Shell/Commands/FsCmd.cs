namespace Codestead.Shell.Commands;

// Port of src/shell/commands/fs.ts – navigating and handling files: cd, pwd, ls, mkdir, touch, rm, cp, mv,
// find, chmod, chown.

public static partial class FsCmd
{
    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

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

    private static readonly CommandDef Cd = new()
    {
        Name = "cd",
        Builtin = true,
        Summary = "Byter aktuell katalog",
        Man = """
NAMN
       cd - byt katalog (change directory)

SYNOPSIS
       cd [KATALOG]

BESKRIVNING
       Gör KATALOG till den aktuella katalogen. Utan argument går du till
       din hemkatalog ($HOME).

       cd ..     gå upp en nivå
       cd ~      gå till hemkatalogen
       cd -      gå tillbaka till föregående katalog
       cd /      gå till rotkatalogen
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (ctx.Args.Count > 1)
            {
                ctx.Err("bash: cd: too many arguments\n");
                return 1;
            }
            var target = ctx.Args.Count > 0 ? ctx.Args[0] : sh.Home;
            if (target == "-")
            {
                var oldpwd = sh.Env.Get("OLDPWD");
                if (string.IsNullOrEmpty(oldpwd))
                {
                    ctx.Err("bash: cd: OLDPWD not set\n");
                    return 1;
                }
                target = oldpwd;
                ctx.Out(target + "\n");
            }
            if (target == "") return 0;
            var path = sh.Resolve(target);
            var user = sh.CurrentUser();
            try
            {
                var node = sh.Vfs.Lookup(path, user);
                if (node.Type != "dir") throw new FsError("ENOTDIR");
                if (!VfsLib.HasPerm(node, user, 'x')) throw new FsError("EACCES");
            }
            catch (FsError e)
            {
                ctx.Err($"bash: cd: {target}: {e.Message}\n");
                return 1;
            }
            sh.Env["OLDPWD"] = sh.Cwd;
            sh.Cwd = path;
            sh.Env["PWD"] = path;
            return 0;
        },
    };

    private static readonly CommandDef Pwd = new()
    {
        Name = "pwd",
        Builtin = true,
        Summary = "Skriver ut aktuell katalog",
        Man = """
NAMN
       pwd - skriv ut namnet på aktuell katalog (print working directory)

SYNOPSIS
       pwd

BESKRIVNING
       Skriver ut den absoluta sökvägen till katalogen du står i.
""",
        Run = ctx =>
        {
            ctx.Out(ctx.Sh.Cwd + "\n");
            return 0;
        },
    };

    private sealed record Entry(string Name, FsNode Node);

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
       -F              lägg till / efter kataloger och * efter körbara filer
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
            Flags = "laAh1dF",
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
                var node = sh.Vfs.Lookup(path, user);
                if (node.Type == "dir" && !o.Flags.Contains("d")) dirs.Add((t, path, node));
                else files.Add(new Entry(t, node));
            }
            catch (FsError e)
            {
                ctx.Err($"ls: cannot access '{t}': {e.Message}\n");
                code = 2;
            }
        }

        string Suffix(FsNode n) => !o.Flags.Contains("F") ? "" : n.Type == "dir" ? "/" : (n.Mode & Js.Oct(111)) != 0 ? "*" : "";
        string Display(Entry e) => UtilCmd.ColorName(e.Name, e.Node, ctx.IsTTY) + Suffix(e.Node);
        string Size(FsNode n) => o.Flags.Contains("h") ? UtilCmd.HumanSize(VfsLib.NodeSize(n)) : Js.Num(VfsLib.NodeSize(n));
        int Links(FsNode n) => n.Type == "dir" ? 2 + (n.Children?.Values.Count(c => c.Type == "dir") ?? 0) : 1;

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
                foreach (var e in entries)
                {
                    ctx.Out(
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
            var entries = names.Select(n => new Entry(n, d.Node.Children![n])).ToList();
            if (o.Flags.Contains("a"))
            {
                var parent = sh.Vfs.TryLookup(sh.Resolve(d.Path + "/.."), user) ?? d.Node;
                entries.InsertRange(0, new[] { new Entry(".", d.Node), new Entry("..", parent) });
            }
            Render(entries, true);
        }
        return code;
    }

    private static readonly CommandDef Mkdir = new()
    {
        Name = "mkdir",
        Summary = "Skapar kataloger",
        Man = """
NAMN
       mkdir - skapa kataloger (make directory)

SYNOPSIS
       mkdir [FLAGGA]... KATALOG...

FLAGGOR
       -p, --parents   skapa även föräldrakataloger som saknas, och ge
                       inget fel om katalogen redan finns
       -v, --verbose   berätta om varje katalog som skapas

EXEMPEL
       mkdir -p projekt/src/test
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "pv", Long = new() { ["parents"] = "p", ["verbose"] = "v" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in o.Operands)
            {
                var path = sh.Resolve(t);
                try
                {
                    if (o.Flags.Contains("p"))
                    {
                        var segs = path.Split('/').Where(s => s != "");
                        var cur = "";
                        foreach (var seg in segs)
                        {
                            cur += "/" + seg;
                            var existing = sh.Vfs.TryLookup(cur, user);
                            if (existing is not null)
                            {
                                if (existing.Type != "dir") throw new FsError("ENOTDIR");
                                continue;
                            }
                            sh.Vfs.Mkdir(cur, user);
                            if (o.Flags.Contains("v")) ctx.Out($"mkdir: created directory '{cur}'\n");
                        }
                    }
                    else
                    {
                        sh.Vfs.Mkdir(path, user);
                        if (o.Flags.Contains("v")) ctx.Out($"mkdir: created directory '{t}'\n");
                    }
                }
                catch (FsError e)
                {
                    ctx.Err($"mkdir: cannot create directory '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    private static readonly CommandDef Rmdir = new()
    {
        Name = "rmdir",
        Summary = "Tar bort tomma kataloger",
        Man = """
NAMN
       rmdir - ta bort tomma kataloger

SYNOPSIS
       rmdir KATALOG...

BESKRIVNING
       Tar bort katalogen bara om den är tom. Använd rm -r för att ta bort
       en katalog med innehåll.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in ctx.Args)
            {
                try
                {
                    var path = sh.Resolve(t);
                    var node = sh.Vfs.Lookup(path, user);
                    if (node.Type != "dir") throw new FsError("ENOTDIR");
                    if (node.Children!.Count > 0) throw new FsError("ENOTEMPTY");
                    sh.Vfs.Remove(path, user);
                }
                catch (FsError e)
                {
                    ctx.Err($"rmdir: failed to remove '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    private static readonly CommandDef Touch = new()
    {
        Name = "touch",
        Summary = "Skapar tomma filer eller uppdaterar tidsstämpeln",
        Man = """
NAMN
       touch - ändra tidsstämpel på filer, eller skapa tomma filer

SYNOPSIS
       touch FIL...

BESKRIVNING
       Om FIL inte finns skapas en tom fil. Om den finns uppdateras dess
       ändringstid till nu.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0)
            {
                ctx.Err("touch: missing file operand\nTry 'touch --help' for more information.\n");
                return 1;
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in ctx.Args)
            {
                var path = sh.Resolve(t);
                try
                {
                    var node = sh.Vfs.TryLookup(path, user);
                    if (node is not null)
                    {
                        if (!VfsLib.HasPerm(node, user, 'w') && node.Owner != user.Name && user.Uid != 0) throw new FsError("EACCES");
                        node.Mtime = Js.Now();
                    }
                    else
                    {
                        sh.Vfs.WriteFile(path, "", user);
                    }
                }
                catch (FsError e)
                {
                    ctx.Err($"touch: cannot touch '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    private static readonly CommandDef Rm = new()
    {
        Name = "rm",
        Summary = "Tar bort filer och kataloger",
        Man = """
NAMN
       rm - ta bort filer eller kataloger (remove)

SYNOPSIS
       rm [FLAGGA]... FIL...

BESKRIVNING
       Tar bort filer. Det finns ingen papperskorg – det som tas bort är borta!

FLAGGOR
       -r, -R, --recursive   ta bort kataloger och allt innehåll
       -f, --force           ignorera filer som inte finns, fråga aldrig
       -v, --verbose         berätta vad som tas bort

VARNING
       rm -rf är kraftfullt. Dubbelkolla alltid sökvägen innan du trycker Enter.
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "rRfiv",
                Long = new() { ["recursive"] = "r", ["force"] = "f", ["verbose"] = "v", ["no-preserve-root"] = "P" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            bool force = o.Flags.Contains("f");
            bool recursive = o.Flags.Contains("r") || o.Flags.Contains("R");
            if (o.Operands.Count == 0)
            {
                if (force) return 0;
                return UtilCmd.BadOption(ctx, "missing operand");
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in o.Operands)
            {
                var path = sh.Resolve(t);
                var b = VfsLib.Basename(t);
                if (b == "." || b == "..")
                {
                    ctx.Err($"rm: refusing to remove '.' or '..' directory: skipping '{t}'\n");
                    code = 1;
                    continue;
                }
                if (path == "/")
                {
                    if (!recursive)
                    {
                        ctx.Err("rm: cannot remove '/': Is a directory\n");
                        code = 1;
                        continue;
                    }
                    if (!o.Flags.Contains("P"))
                    {
                        ctx.Err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n");
                        code = 1;
                        continue;
                    }
                    if (user.Uid != 0)
                    {
                        ctx.Err("rm: cannot remove '/': Permission denied\n");
                        code = 1;
                        continue;
                    }
                    sh.Vfs.Root.Children = Js.Obj<FsNode>();
                    continue;
                }
                try
                {
                    var node = sh.Vfs.Lookup(path, user);
                    if (node.Type == "dir" && !recursive) throw new FsError("EISDIR");
                    sh.Vfs.Remove(path, user);
                    if (o.Flags.Contains("v")) ctx.Out(node.Type == "dir" ? $"removed directory '{t}'\n" : $"removed '{t}'\n");
                }
                catch (FsError e)
                {
                    if (force && e.Code == "ENOENT") continue;
                    ctx.Err($"rm: cannot remove '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    private static void ChownTree(FsNode node, User user)
    {
        node.Owner = user.Name;
        node.Group = user.Groups.FirstOrDefault()!;
        node.Mtime = Js.Now();
        foreach (var c in node.Children?.Values.ToList() ?? new List<FsNode>()) ChownTree(c, user);
    }

    private static readonly Regex TrailingSlashes = new(@"/+\z", RegexOptions.CultureInvariant);

    /// <summary>Shared logic for cp and mv.</summary>
    private static int CopyOrMove(CmdCtx ctx, bool move)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = move ? "fivn" : "rRfivan",
            Long = new() { ["recursive"] = "r", ["force"] = "f", ["verbose"] = "v", ["archive"] = "a", ["interactive"] = "i" },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        var name = ctx.Name;
        var ops = o.Operands.ToList();
        if (ops.Count == 0) return UtilCmd.BadOption(ctx, "missing file operand");
        if (ops.Count == 1) return UtilCmd.BadOption(ctx, $"missing destination file operand after '{ops[0]}'");
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var dest = ops[^1];
        ops.RemoveAt(ops.Count - 1);
        var destPath = sh.Resolve(dest);
        var destNode = sh.Vfs.TryLookup(destPath, user);
        if (ops.Count > 1 && destNode?.Type != "dir")
        {
            ctx.Err($"{name}: target '{dest}' is not a directory\n");
            return 1;
        }
        bool recursive = move || o.Flags.Contains("r") || o.Flags.Contains("R") || o.Flags.Contains("a");
        int code = 0;
        foreach (var src in ops)
        {
            var srcPath = sh.Resolve(src);
            FsNode node;
            try
            {
                node = sh.Vfs.Lookup(srcPath, user);
            }
            catch (FsError e)
            {
                ctx.Err($"{name}: cannot stat '{src}': {e.Message}\n");
                code = 1;
                continue;
            }
            if (node.Type == "dir" && !recursive)
            {
                ctx.Err($"cp: -r not specified; omitting directory '{src}'\n");
                code = 1;
                continue;
            }
            var target = destNode?.Type == "dir" ? JoinPath(destPath, VfsLib.Basename(srcPath)) : destPath;
            var trimmedDest = TrailingSlashes.Replace(dest, "", 1);
            var targetLabel = destNode?.Type == "dir" ? JoinPath(trimmedDest != "" ? trimmedDest : "/", VfsLib.Basename(srcPath)) : dest;
            if (target == srcPath)
            {
                ctx.Err($"{name}: '{src}' and '{targetLabel}' are the same file\n");
                code = 1;
                continue;
            }
            if (node.Type == "dir" && target.StartsWith(srcPath + "/", StringComparison.Ordinal))
            {
                ctx.Err(move
                    ? $"mv: cannot move '{src}' to a subdirectory of itself, '{targetLabel}'\n"
                    : $"cp: cannot copy a directory, '{src}', into itself, '{targetLabel}'\n");
                code = 1;
                continue;
            }
            var existing = sh.Vfs.TryLookup(target, user);
            if (existing?.Type == "dir" && node.Type != "dir")
            {
                ctx.Err($"{name}: cannot overwrite directory '{targetLabel}' with non-directory\n");
                code = 1;
                continue;
            }
            try
            {
                if (move)
                {
                    var (dir, _) = sh.Vfs.Parent(srcPath, user);
                    if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
                    sh.Vfs.Insert(target, node, user);
                    dir.Children!.Remove(VfsLib.Basename(srcPath));
                }
                else
                {
                    if (node.Type == "file" && !VfsLib.HasPerm(node, user, 'r'))
                    {
                        ctx.Err($"cp: cannot open '{src}' for reading: Permission denied\n");
                        code = 1;
                        continue;
                    }
                    if (existing?.Type == "file")
                    {
                        if (!VfsLib.HasPerm(existing, user, 'w')) throw new FsError("EACCES");
                        existing.Content = node.Content;
                        existing.Size = node.Size;
                        existing.Mtime = Js.Now();
                    }
                    else
                    {
                        var copy = VfsLib.CloneNode(node);
                        if (!o.Flags.Contains("a")) ChownTree(copy, user);
                        sh.Vfs.Insert(target, copy, user);
                    }
                }
                if (o.Flags.Contains("v")) ctx.Out(move ? $"renamed '{src}' -> '{targetLabel}'\n" : $"'{src}' -> '{targetLabel}'\n");
            }
            catch (FsError e)
            {
                var msg = e.Message;
                ctx.Err(move
                    ? $"mv: cannot move '{src}' to '{targetLabel}': {msg}\n"
                    : $"cp: cannot create {(node.Type == "dir" ? "directory" : "regular file")} '{targetLabel}': {msg}\n");
                code = 1;
            }
        }
        return code;
    }

    private static readonly CommandDef Cp = new()
    {
        Name = "cp",
        Summary = "Kopierar filer och kataloger",
        Man = """
NAMN
       cp - kopiera filer och kataloger (copy)

SYNOPSIS
       cp [FLAGGA]... KÄLLA MÅL
       cp [FLAGGA]... KÄLLA... KATALOG

FLAGGOR
       -r, -R, --recursive   kopiera kataloger med allt innehåll
       -a, --archive         som -r, men behåll ägare och rättigheter
       -v, --verbose         berätta vad som kopieras

EXEMPEL
       cp rapport.txt rapport-kopia.txt
       cp -r projekt/ backup/
""",
        Run = ctx => CopyOrMove(ctx, false),
    };

    private static readonly CommandDef Mv = new()
    {
        Name = "mv",
        Summary = "Flyttar eller byter namn på filer",
        Man = """
NAMN
       mv - flytta eller byt namn på filer (move)

SYNOPSIS
       mv [FLAGGA]... KÄLLA MÅL
       mv [FLAGGA]... KÄLLA... KATALOG

BESKRIVNING
       Om MÅL är en befintlig katalog flyttas KÄLLA dit. Annars byter
       KÄLLA namn till MÅL. Kataloger kan flyttas utan -r.

FLAGGOR
       -v, --verbose   berätta vad som flyttas
""",
        Run = ctx => CopyOrMove(ctx, true),
    };

    private static readonly CommandDef Find = new()
    {
        Name = "find",
        Summary = "Söker efter filer i en katalogstruktur",
        Man = """
NAMN
       find - sök efter filer i en katalogstruktur

SYNOPSIS
       find [SÖKVÄG...] [UTTRYCK]

UTTRYCK
       -name MÖNSTER     filnamnet matchar MÖNSTER (t.ex. "*.txt")
       -iname MÖNSTER    som -name men skiftlägesokänsligt
       -type f|d         bara filer (f) eller kataloger (d)
       -maxdepth N       gå högst N nivåer ner
       -mindepth N       visa inget på nivåer grundare än N

EXEMPEL
       find ~ -name "*.txt"
       find /etc -maxdepth 1 -type d

TIPS
       Sätt mönstret inom citattecken, annars expanderar skalet * innan
       find ens får se det.
""",
        Run = RunFind,
    };

    private static int RunFind(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        var args = ctx.Args.ToList();
        string? Shift()
        {
            if (args.Count == 0) return null;
            var first = args[0];
            args.RemoveAt(0);
            return first;
        }
        var paths = new List<string>();
        while (args.Count > 0 && !args[0].StartsWith('-')) paths.Add(Shift()!);
        if (paths.Count == 0) paths.Add(".");
        var tests = new List<Func<string, FsNode, bool>>();
        double maxDepth = double.PositiveInfinity;
        double minDepth = 0;
        while (args.Count > 0)
        {
            var a = Shift()!;
            var v = Shift();
            if (v is null && a != "-print")
            {
                ctx.Err($"find: missing argument to `{a}'\n");
                return 1;
            }
            switch (a)
            {
                case "-name":
                case "-iname":
                {
                    var re = ParserLib.GlobToRegex(v!);
                    var rx = a == "-iname" ? new Regex(re.ToString(), re.Options | RegexOptions.IgnoreCase) : re;
                    tests.Add((name, _) => rx.IsMatch(name));
                    break;
                }
                case "-type":
                    if (v != "f" && v != "d")
                    {
                        ctx.Err($"find: Unknown argument to -type: {v}\n");
                        return 1;
                    }
                    tests.Add((_, node) => v == "f" ? node.Type == "file" : node.Type == "dir");
                    break;
                case "-maxdepth":
                    maxDepth = Js.Number(v);
                    break;
                case "-mindepth":
                    minDepth = Js.Number(v);
                    break;
                case "-print":
                    if (v is not null) args.Insert(0, v);
                    break;
                default:
                    ctx.Err($"find: unknown predicate `{a}'\n");
                    return 1;
            }
        }
        int code = 0;
        void Walk(string display, FsNode node, int depth)
        {
            var name = VfsLib.Basename(display);
            if (depth >= minDepth && tests.All(t => t(name, node))) ctx.Out(display + "\n");
            if (node.Type != "dir" || depth >= maxDepth) return;
            if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
            {
                ctx.Err($"find: '{display}': Permission denied\n");
                code = 1;
                return;
            }
            foreach (var child in node.Children!.Keys.ToList().SortJs())
            {
                Walk(display.EndsWith('/') ? display + child : $"{display}/{child}", node.Children[child], depth + 1);
            }
        }
        foreach (var p in paths)
        {
            try
            {
                Walk(p, sh.Vfs.Lookup(sh.Resolve(p), user), 0);
            }
            catch (FsError e)
            {
                ctx.Err($"find: '{p}': {e.Message}\n");
                code = 1;
            }
        }
        return code;
    }

    private static readonly Regex ModeRe = new(@"^([ugoa]*[-+=][rwxXst]*)(,[ugoa]*[-+=][rwxXst]*)*\z", RegexOptions.CultureInvariant);
    private static readonly Regex OctalModeRe = new(@"^[0-7]{1,4}\z", RegexOptions.CultureInvariant);
    private static readonly Regex ClauseRe = new(@"^([ugoa]*)([-+=])([rwxXst]*)\z", RegexOptions.CultureInvariant);

    public static int? ApplyMode(int current, string spec, bool isDir)
    {
        if (OctalModeRe.IsMatch(spec)) return Convert.ToInt32(spec, 8);
        if (!ModeRe.IsMatch(spec)) return null;
        int mode = current;
        foreach (var clause in spec.Split(','))
        {
            var m = ClauseRe.Match(clause);
            var who = m.Groups[1].Value != "" ? m.Groups[1].Value : "a";
            var classes = who.Contains('a') ? new List<char> { 'u', 'g', 'o' } : who.Distinct().ToList();
            int bits = 0;
            int clear = 0;
            foreach (var c in classes)
            {
                int shift = c == 'u' ? 6 : c == 'g' ? 3 : 0;
                clear |= 7 << shift;
                foreach (var p in m.Groups[3].Value)
                {
                    if (p == 'r') bits |= 4 << shift;
                    if (p == 'w') bits |= 2 << shift;
                    if (p == 'x') bits |= 1 << shift;
                    if (p == 'X' && (isDir || (current & Js.Oct(111)) != 0)) bits |= 1 << shift;
                    if (p == 's' && c == 'u') bits |= Js.Oct(4000);
                    if (p == 's' && c == 'g') bits |= Js.Oct(2000);
                    if (p == 't' && c == 'o') bits |= Js.Oct(1000);
                }
            }
            var op = m.Groups[2].Value;
            if (op == "+") mode |= bits;
            else if (op == "-") mode &= ~bits;
            else mode = (mode & ~clear) | bits;
        }
        return mode;
    }

    private static readonly CommandDef Chmod = new()
    {
        Name = "chmod",
        Summary = "Ändrar rättigheter på filer",
        Man = """
NAMN
       chmod - ändra rättigheter (change mode)

SYNOPSIS
       chmod [-R] LÄGE FIL...

BESKRIVNING
       LÄGE kan anges med siffror eller symboler.

       Siffror (oktalt): en siffra per grupp – ägare, grupp, övriga.
       r = 4, w = 2, x = 1. Lägg ihop dem:
           chmod 755 skript.sh   rwxr-xr-x
           chmod 644 fil.txt     rw-r--r--
           chmod 600 hemligt     rw-------

       Symboler: [ugoa][+-=][rwx]
           u = ägare (user), g = grupp, o = övriga (others), a = alla
           chmod +x skript.sh    gör körbar för alla
           chmod u+x,g-w fil     lägg till x för ägaren, ta bort w för gruppen
           chmod o= fil          ta bort alla rättigheter för övriga

FLAGGOR
       -R    ändra rekursivt i kataloger
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            bool recursive = false;
            string? mode = null;
            var files = new List<string>();
            foreach (var a in ctx.Args)
            {
                if (a == "-R" || a == "--recursive") recursive = true;
                else if (mode is null) mode = a;
                else files.Add(a);
            }
            if (mode is null) return UtilCmd.BadOption(ctx, "missing operand");
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{mode}'");
            if (ApplyMode(0, mode, false) is null) return UtilCmd.BadOption(ctx, $"invalid mode: '{mode}'");
            int code = 0;
            void Apply(string label, FsNode node)
            {
                if (user.Uid != 0 && node.Owner != user.Name)
                {
                    ctx.Err($"chmod: changing permissions of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                node.Mode = ApplyMode(node.Mode, mode, node.Type == "dir")!.Value;
                if (recursive && node.Type == "dir")
                {
                    foreach (var (n, c) in node.Children!.ToList()) Apply($"{label}/{n}", c);
                }
            }
            foreach (var f in files)
            {
                try
                {
                    Apply(f, sh.Vfs.Lookup(sh.Resolve(f), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"chmod: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    private static readonly CommandDef Chown = new()
    {
        Name = "chown",
        Summary = "Byter ägare på filer (kräver root)",
        Man = """
NAMN
       chown - byt ägare och grupp på filer (change owner)

SYNOPSIS
       chown [-R] ÄGARE[:GRUPP] FIL...

BESKRIVNING
       Bara root kan byta ägare på filer, så du behöver oftast sudo:
           sudo chown elev:elev fil.txt

FLAGGOR
       -R    ändra rekursivt i kataloger
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            bool recursive = false;
            string? spec = null;
            var files = new List<string>();
            foreach (var a in ctx.Args)
            {
                if (a == "-R" || a == "--recursive") recursive = true;
                else if (spec is null) spec = a;
                else files.Add(a);
            }
            if (spec is null) return UtilCmd.BadOption(ctx, "missing operand");
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{spec}'");
            var parts = spec.Split(':');
            var owner = parts[0];
            string? groupSpec = parts.Length > 1 ? parts[1] : null;
            // Users and groups live in /etc/passwd and /etc/group. "kim:" means kim's login group.
            if (owner != "" && !UsersLib.UserExists(sh, owner))
            {
                ctx.Err($"chown: invalid user: '{spec}'\n");
                return 1;
            }
            var group = groupSpec == "" && owner != "" ? sh.GetUser(owner).Groups.FirstOrDefault() : groupSpec;
            if (!string.IsNullOrEmpty(group) && !UsersLib.GroupExists(sh, group))
            {
                ctx.Err($"chown: invalid group: '{spec}'\n");
                return 1;
            }
            int code = 0;
            void Apply(string label, FsNode node)
            {
                // Ordinary users may only change the group of their own files, to a group they belong to.
                bool ownGroupChange = (owner == "" || owner == user.Name) && node.Owner == user.Name && !string.IsNullOrEmpty(group) && user.Groups.Contains(group);
                if (user.Uid != 0 && !ownGroupChange)
                {
                    ctx.Err($"chown: changing ownership of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                if (owner != "") node.Owner = owner;
                if (!string.IsNullOrEmpty(group)) node.Group = group;
                if (recursive && node.Type == "dir")
                {
                    foreach (var (n, c) in node.Children!.ToList()) Apply($"{label}/{n}", c);
                }
            }
            foreach (var f in files)
            {
                try
                {
                    Apply(f, sh.Vfs.Lookup(sh.Resolve(f), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"chown: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    public static List<CommandDef> All { get; } = new() { Cd, Pwd, Ls, Mkdir, Rmdir, Touch, Rm, Cp, Mv, Find, Chmod, Chown };
}
