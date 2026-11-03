namespace Codestead.Shell.Commands;

// Links and information about files: ln, readlink, realpath, stat, file and umask.

public static partial class FileinfoCmd
{
    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

    // ---------- ln ----------

    private static readonly CommandDef Ln = new()
    {
        Name = "ln",
        Summary = "Skapar länkar till filer (symboliska med -s)",
        SummaryEn = "Make links between files (symbolic with -s)",
        Man = """
            NAMN
                   ln - skapa länkar mellan filer

            SYNOPSIS
                   ln [-s] [-f] [-v] MÅL [LÄNKNAMN]
                   ln [-s] [-f] [-v] MÅL... KATALOG

            BESKRIVNING
                   Skapar LÄNKNAMN som pekar på MÅL. Utan LÄNKNAMN får länken samma
                   namn som MÅL, i katalogen du står i.

                   En symbolisk länk (-s) är en liten fil som innehåller en sökväg.
                   Den kan peka på kataloger och på andra filsystem, och den slutar
                   fungera om målet tas bort eller flyttas. En relativ sökväg i
                   länken räknas från katalogen där länken ligger.

                   En hård länk (utan -s) är ett namn till på samma fil (samma
                   inod). Filen finns kvar så länge den har minst ett namn.

            FLAGGOR
                   -s, --symbolic   skapa en symbolisk länk
                   -f, --force      ta bort en fil som redan har länkens namn
                   -n               behandla en länk till en katalog som en fil
                   -v, --verbose    berätta vilken länk som skapas

            EXEMPEL
                   ln -s /var/log/syslog loggen
                   ln -s ~/projekt/start.sh ~/bin/start
                   ln anteckningar.txt kopia-som-delar-innehall.txt
            """,
        ManEn = """
            NAME
                   ln - make links between files

            SYNOPSIS
                   ln [-s] [-f] [-v] TARGET [LINK_NAME]
                   ln [-s] [-f] [-v] TARGET... DIRECTORY

            DESCRIPTION
                   Creates LINK_NAME pointing to TARGET. Without LINK_NAME the link
                   gets the same name as TARGET, in the directory you are in.

                   A symbolic link (-s) is a small file that contains a path. It can
                   point to directories and to other file systems, and it stops
                   working if the target is removed or moved. A relative path in the
                   link counts from the directory the link is in.

                   A hard link (without -s) is one more name for the same file (the
                   same inode). The file lives on as long as it has at least one name.

            OPTIONS
                   -s, --symbolic   make a symbolic link
                   -f, --force      remove a file that already has the link's name
                   -n               treat a link to a directory as a file
                   -v, --verbose    print the name of each link made

            EXAMPLES
                   ln -s /var/log/syslog thelog
                   ln -s ~/project/start.sh ~/bin/start
                   ln notes.txt same-file-other-name.txt
            """,
        Run = RunLn,
    };

    private static int RunLn(CmdCtx ctx)
    {
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "sfnvrT",
            Long = new() { ["symbolic"] = "s", ["force"] = "f", ["verbose"] = "v", ["no-dereference"] = "n", ["relative"] = "r", ["no-target-directory"] = "T" },
        });
        if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
        if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing file operand");
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        bool symbolic = o.Flags.Contains("s");
        var ops = o.Operands.ToList();
        string? dest = ops.Count > 1 ? ops[^1] : null;
        var sources = ops.Count > 1 ? ops.Take(ops.Count - 1).ToList() : ops;
        // Where the link(s) go: into a directory (also "." when no name is given) or under a new name.
        string? destDir = null;
        if (dest is null) destDir = ".";
        else if (!o.Flags.Contains("T"))
        {
            var destPath = sh.Resolve(dest);
            var asDir = o.Flags.Contains("n") ? sh.Vfs.TryLookupLink(destPath, user) : sh.Vfs.TryLookup(destPath, user);
            if (asDir?.Type == "dir") destDir = dest;
        }
        if (sources.Count > 1 && destDir is null)
        {
            ctx.Err($"ln: target '{dest}' is not a directory\n");
            return 1;
        }
        int code = 0;
        foreach (var src in sources)
        {
            var label = destDir is null ? dest! : destDir == "." && dest is null ? VfsLib.Basename(src) : JoinPath(destDir.TrimEnd('/') is { Length: > 0 } d ? d : "/", VfsLib.Basename(src));
            var linkPath = sh.Resolve(label);
            var kind = symbolic ? "symbolic link" : "hard link";
            try
            {
                FsNode? target = null;
                if (!symbolic)
                {
                    try
                    {
                        target = sh.Vfs.Lookup(sh.Resolve(src), user);
                    }
                    catch (FsError e)
                    {
                        ctx.Err($"ln: failed to access '{src}': {e.Message}\n");
                        code = 1;
                        continue;
                    }
                    if (target.Type == "dir")
                    {
                        ctx.Err($"ln: {src}: hard link not allowed for directory\n");
                        code = 1;
                        continue;
                    }
                }
                var existing = sh.Vfs.TryLookupLink(linkPath, user);
                if (existing is not null)
                {
                    if (!symbolic && ReferenceEquals(existing, target))
                    {
                        ctx.Err($"ln: '{src}' and '{label}' are the same file\n");
                        code = 1;
                        continue;
                    }
                    if (!o.Flags.Contains("f")) throw new FsError("EEXIST");
                    if (existing.Type == "dir")
                    {
                        ctx.Err($"ln: {label}: cannot overwrite directory\n");
                        code = 1;
                        continue;
                    }
                    sh.Vfs.Remove(linkPath, user);
                }
                if (symbolic)
                {
                    var text = src;
                    // -r: a path relative to where the link is (ln -sr ../a b).
                    if (o.Flags.Contains("r")) text = RelativePath(VfsLib.Dirname(linkPath), sh.Resolve(src));
                    sh.Vfs.Insert(linkPath, VfsLib.MakeLink(text, user.Name, user.Groups.FirstOrDefault()), user);
                    if (o.Flags.Contains("v")) ctx.Out($"'{label}' -> '{text}'\n");
                }
                else
                {
                    sh.Vfs.HardLink(target!, linkPath, user);
                    if (o.Flags.Contains("v")) ctx.Out($"'{label}' => '{src}'\n");
                }
            }
            catch (FsError e)
            {
                ctx.Err($"ln: failed to create {kind} '{label}': {e.Message}\n");
                code = 1;
            }
        }
        return code;
    }

    /// <summary>The path from directory <paramref name="from"/> to <paramref name="to"/>, e.g. "../docs/a.txt".</summary>
    public static string RelativePath(string from, string to)
    {
        var a = from.Split('/').Where(s => s != "").ToList();
        var b = to.Split('/').Where(s => s != "").ToList();
        int i = 0;
        while (i < a.Count && i < b.Count && a[i] == b[i]) i++;
        var parts = Enumerable.Repeat("..", a.Count - i).Concat(b.Skip(i)).ToList();
        return parts.Count == 0 ? "." : string.Join("/", parts);
    }

    // ---------- readlink and realpath ----------

    /// <summary>The path without symbolic links, "." or "..". With <paramref name="lastMayBeMissing"/> the last part need not exist.</summary>
    private static string? Canonical(Shell sh, string arg, bool lastMayBeMissing)
    {
        var user = sh.CurrentUser();
        var path = sh.Resolve(arg);
        try
        {
            return sh.Vfs.RealPath(path, user);
        }
        catch (FsError)
        {
            if (!lastMayBeMissing || path == "/") return null;
            try
            {
                var dir = sh.Vfs.RealPath(VfsLib.Dirname(path), user);
                if (sh.Vfs.Lookup(dir, user).Type != "dir") return null;
                // The last part may be a broken symbolic link: follow it as far as it goes.
                var link = sh.Vfs.TryLookupLink(JoinPath(dir, VfsLib.Basename(path)), user);
                if (link?.Type == "link") return VfsLib.ResolvePath(dir, link.Content ?? "");
                return JoinPath(dir, VfsLib.Basename(path));
            }
            catch (FsError)
            {
                return null;
            }
        }
    }

    private static readonly CommandDef Readlink = new()
    {
        Name = "readlink",
        Summary = "Visar vart en symbolisk länk pekar",
        SummaryEn = "Print where a symbolic link points",
        Man = """
            NAMN
                   readlink - visa vart en symbolisk länk pekar

            SYNOPSIS
                   readlink [-f] FIL...

            BESKRIVNING
                   Skriver ut sökvägen som står i länken, precis som den skrevs
                   med ln -s. Är FIL ingen länk skrivs inget ut (slutstatus 1).

            FLAGGOR
                   -f   följ alla länkar och skriv den fullständiga sökvägen
                        (som realpath)
            """,
        ManEn = """
            NAME
                   readlink - print where a symbolic link points

            SYNOPSIS
                   readlink [-f] FILE...

            DESCRIPTION
                   Prints the path stored in the link, exactly as it was written with
                   ln -s. If FILE is not a link, nothing is printed (exit status 1).

            OPTIONS
                   -f   follow every link and print the full path (like realpath)
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "femnqsvz", Long = new() { ["canonicalize"] = "f", ["canonicalize-existing"] = "e", ["canonicalize-missing"] = "m" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            int code = 0;
            foreach (var arg in o.Operands)
            {
                if (o.Flags.Contains("f") || o.Flags.Contains("e") || o.Flags.Contains("m"))
                {
                    var p = Canonical(sh, arg, !o.Flags.Contains("e"));
                    if (p is null) code = 1;
                    else ctx.Out(p + "\n");
                    continue;
                }
                var node = sh.Vfs.TryLookupLink(sh.Resolve(arg), sh.CurrentUser());
                if (node?.Type == "link") ctx.Out((node.Content ?? "") + "\n");
                else code = 1;
            }
            return code;
        },
    };

    private static readonly CommandDef Realpath = new()
    {
        Name = "realpath",
        Summary = "Skriver den fullständiga sökvägen utan länkar",
        SummaryEn = "Print the full path, without links",
        Man = """
            NAMN
                   realpath - skriv den fullständiga sökvägen

            SYNOPSIS
                   realpath FIL...

            BESKRIVNING
                   Skriver den absoluta sökvägen till FIL, där alla symboliska
                   länkar, . och .. är upplösta.

            EXEMPEL
                   realpath .
                   realpath ~/loggen
            """,
        ManEn = """
            NAME
                   realpath - print the resolved path

            SYNOPSIS
                   realpath FILE...

            DESCRIPTION
                   Prints the absolute path to FILE, with every symbolic link, . and
                   .. resolved.

            EXAMPLES
                   realpath .
                   realpath ~/thelog
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "emqsz", Long = new() { ["canonicalize-existing"] = "e", ["canonicalize-missing"] = "m", ["quiet"] = "q" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            int code = 0;
            foreach (var arg in o.Operands)
            {
                var p = Canonical(ctx.Sh, arg, !o.Flags.Contains("e"));
                if (p is null)
                {
                    if (!o.Flags.Contains("q")) ctx.Err($"realpath: {arg}: No such file or directory\n");
                    code = 1;
                }
                else ctx.Out(p + "\n");
            }
            return code;
        },
    };

    // ---------- stat ----------

    private static string FileType(FsNode n) =>
        n.Type == "dir" ? "directory" : n.Type == "link" ? "symbolic link" : (n.Content ?? "") == "" && n.Size is null ? "regular empty file" : "regular file";

    private static int UidOf(Shell sh, string name) => UsersLib.FindUser(sh, name)?.Uid ?? (name == "root" ? 0 : 65534);

    private static int GidOf(Shell sh, string group) => UsersLib.GidOf(sh, group) ?? (group == "root" ? 0 : 65534);

    /// <summary>A time the way stat shows it: 2026-11-03 10:15:22.000000000 +0100.</summary>
    public static string StatTime(long ms)
    {
        var local = Js.LocalDate(ms);
        var off = TimeZoneInfo.Local.GetUtcOffset(local);
        var sign = off < TimeSpan.Zero ? "-" : "+";
        var abs = off.Duration();
        return local.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) +
            $".{(ms % 1000 + 1000) % 1000:D3}000000 {sign}{abs.Hours:D2}{abs.Minutes:D2}";
    }

    private static string Octal(int mode) => Convert.ToString(mode & Js.Oct(7777), 8);

    private static string StatFormat(Shell sh, string format, string name, FsNode n)
    {
        var sb = new StringBuilder();
        for (int i = 0; i < format.Length; i++)
        {
            char c = format[i];
            if (c == '\\' && i + 1 < format.Length)
            {
                char e = format[++i];
                sb.Append(e switch { 'n' => "\n", 't' => "\t", '\\' => "\\", _ => "\\" + e });
                continue;
            }
            if (c != '%' || i + 1 >= format.Length)
            {
                sb.Append(c);
                continue;
            }
            char f = format[++i];
            sb.Append(f switch
            {
                'n' => name,
                'N' => n.Type == "link" ? $"'{name}' -> '{n.Content}'" : $"'{name}'",
                's' => Js.Num(VfsLib.NodeSize(n)),
                'a' => Octal(n.Mode),
                'A' => UtilCmd.ModeString(n),
                'U' => n.Owner,
                'u' => Js.Num(UidOf(sh, n.Owner)),
                'G' => n.Group,
                'g' => Js.Num(GidOf(sh, n.Group)),
                'i' => Js.Num(sh.Vfs.InoOf(n)),
                'h' => Js.Num(VFS.LinkCount(n)),
                'F' => FileType(n),
                'y' or 'x' or 'z' => StatTime(n.Mtime),
                'Y' or 'X' or 'Z' => Js.Num(n.Mtime / 1000),
                'b' => Js.Num(Blocks(n)),
                '%' => "%",
                _ => "?",
            });
        }
        return sb.ToString();
    }

    private static long Blocks(FsNode n) => n.Type == "link" ? 0 : (long)Math.Ceiling(VfsLib.NodeSize(n) / 4096.0) * 8;

    private static readonly CommandDef Stat = new()
    {
        Name = "stat",
        Summary = "Visar allt om en fil: storlek, rättigheter, ägare, inod och tider",
        SummaryEn = "Display everything about a file: size, permissions, owner, inode and times",
        Man = """
            NAMN
                   stat - visa information om filer

            SYNOPSIS
                   stat [-L] [-c FORMAT] FIL...

            BESKRIVNING
                   Visar filens typ, storlek, inodnummer, antal hårda länkar,
                   rättigheter (både som siffror och som rwx), ägare och grupp och
                   när filen ändrades. En symbolisk länk visas som länk; med -L
                   visas filen den pekar på.

            FLAGGOR
                   -L          följ symboliska länkar
                   -c FORMAT   skriv bara det FORMAT ber om, t.ex.:
                               %n namn   %s storlek   %a rättigheter (644)
                               %A rättigheter (-rw-r--r--)   %U ägare   %G grupp
                               %i inod   %h antal länkar   %F filtyp   %y ändrad

            EXEMPEL
                   stat anteckningar.txt
                   stat -c '%a %U %n' *.txt
            """,
        ManEn = """
            NAME
                   stat - display file status

            SYNOPSIS
                   stat [-L] [-c FORMAT] FILE...

            DESCRIPTION
                   Shows the file's type, size, inode number, number of hard links,
                   permissions (both as digits and as rwx), owner and group and when
                   the file was changed. A symbolic link is shown as a link; with -L
                   the file it points to is shown.

            OPTIONS
                   -L          follow symbolic links
                   -c FORMAT   print only what FORMAT asks for, for example:
                               %n name   %s size   %a permissions (644)
                               %A permissions (-rw-r--r--)   %U owner   %G group
                               %i inode   %h number of links   %F file type   %y modified

            EXAMPLES
                   stat notes.txt
                   stat -c '%a %U %n' *.txt
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "Lt", Values = "c", Long = new() { ["dereference"] = "L", ["terse"] = "t" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var arg in o.Operands)
            {
                FsNode n;
                try
                {
                    n = sh.Vfs.Lookup(sh.Resolve(arg), user, follow: o.Flags.Contains("L"));
                }
                catch (FsError e)
                {
                    ctx.Err($"stat: cannot statx '{arg}': {e.Message}\n");
                    code = 1;
                    continue;
                }
                if (o.Values.TryGetValue("c", out var format))
                {
                    ctx.Out(StatFormat(sh, format, arg, n) + "\n");
                    continue;
                }
                var shown = n.Type == "link" ? $"{arg} -> {n.Content}" : arg;
                var size = Js.Num(VfsLib.NodeSize(n));
                var blocks = Js.Num(Blocks(n));
                var t = StatTime(n.Mtime);
                ctx.Out(
                    $"  File: {shown}\n" +
                    $"  Size: {size,-10}\tBlocks: {blocks,-10} IO Block: 4096   {FileType(n)}\n" +
                    $"Device: 8,3\tInode: {Js.Num(sh.Vfs.InoOf(n)),-11} Links: {Js.Num(VFS.LinkCount(n))}\n" +
                    $"Access: ({Octal(n.Mode).PadLeft(4, '0')}/{UtilCmd.ModeString(n)})  Uid: ({Js.Num(UidOf(sh, n.Owner)),5}/{n.Owner,8})   Gid: ({Js.Num(GidOf(sh, n.Group)),5}/{n.Group,8})\n" +
                    $"Access: {t}\nModify: {t}\nChange: {t}\n Birth: {t}\n");
            }
            return code;
        },
    };

    // ---------- file ----------

    private static readonly Regex ShebangRe = new(@"^#!\s*(\S+)(?:\s+(\S+))?", RegexOptions.CultureInvariant);

    /// <summary>What `file` says about some content (without the name).</summary>
    public static string Describe(string content, bool executable)
    {
        if (content == "") return "empty";
        if (content.StartsWith(VfsLib.Elf, StringComparison.Ordinal))
            return "ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, stripped";
        var archive = ArchiveCmd.ReadArchive(content);
        if (archive?.Format == "tar") return "POSIX tar archive (GNU)";
        if (archive?.Format == "zip") return "Zip archive data, at least v2.0 to extract, compression method=deflate";
        if (content.StartsWith("\u001f\u008b", StringComparison.Ordinal)) return "gzip compressed data, from Unix";
        if (content.StartsWith("-----BEGIN OPENSSH PRIVATE KEY-----", StringComparison.Ordinal)) return "OpenSSH private key";
        if (content.StartsWith("ssh-ed25519 ", StringComparison.Ordinal)) return "OpenSSH ED25519 public key";
        if (content.StartsWith("ssh-rsa ", StringComparison.Ordinal)) return "OpenSSH RSA public key";
        bool ascii = content.All(ch => ch < 128);
        var text = ascii ? "ASCII text" : "Unicode text, UTF-8 text";
        var m = ShebangRe.Match(content);
        if (m.Success)
        {
            var prog = VfsLib.Basename(m.Groups[1].Value == "/usr/bin/env" && m.Groups[2].Success ? m.Groups[2].Value : m.Groups[1].Value);
            var kind = prog switch
            {
                "bash" => "Bourne-Again shell script",
                "sh" or "dash" => "POSIX shell script",
                "zsh" => "Paul Falstad's zsh script",
                "fish" => "fish shell script",
                _ when prog.StartsWith("python", StringComparison.Ordinal) => "Python script",
                _ => $"a {m.Groups[1].Value} script",
            };
            return $"{kind}, {text}{(executable ? " executable" : "")}";
        }
        var trimmed = content.TrimStart();
        if (trimmed.StartsWith("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith("<html", StringComparison.OrdinalIgnoreCase)) return $"HTML document, {text}";
        if ((trimmed.StartsWith('{') || trimmed.StartsWith('[')) && IsJson(trimmed)) return "JSON text data";
        var lines = content.Split('\n').Where(l => l != "").ToList();
        if (lines.Count >= 2 && lines[0].Contains(',') && lines.All(l => l.Count(ch => ch == ',') == lines[0].Count(ch => ch == ','))) return $"CSV {text}";
        return text;
    }

    private static bool IsJson(string s)
    {
        try
        {
            using var _ = System.Text.Json.JsonDocument.Parse(s);
            return true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    private static readonly CommandDef File = new()
    {
        Name = "file",
        Summary = "Gissar vad en fil innehåller (text, skript, arkiv, program ...)",
        SummaryEn = "Determine what kind of data a file contains",
        Man = """
            NAMN
                   file - ta reda på vad en fil innehåller

            SYNOPSIS
                   file [-b] [-L] FIL...

            BESKRIVNING
                   Linux bryr sig inte om filändelser: en fil som heter bild.txt
                   kan vara vad som helst. file tittar på innehållet i stället och
                   säger om det är text, ett skript, ett arkiv, ett program och så
                   vidare. En symbolisk länk visas som länk; med -L undersöks filen
                   den pekar på.

            FLAGGOR
                   -b   skriv bara beskrivningen, inte filnamnet
                   -L   följ symboliska länkar

            EXEMPEL
                   file /usr/bin/ls
                   file *
            """,
        ManEn = """
            NAME
                   file - determine file type

            SYNOPSIS
                   file [-b] [-L] FILE...

            DESCRIPTION
                   Linux does not care about file name extensions: a file called
                   picture.txt can be anything. file looks at the content instead and
                   tells whether it is text, a script, an archive, a program and so on.
                   A symbolic link is shown as a link; with -L the file it points to
                   is examined.

            OPTIONS
                   -b   print only the description, not the file name
                   -L   follow symbolic links

            EXAMPLES
                   file /usr/bin/ls
                   file *
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "bLhiz", Long = new() { ["brief"] = "b", ["dereference"] = "L", ["no-dereference"] = "h" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0)
            {
                ctx.Err("Usage: file [-bcCdEhikLlNnprsSvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e <testname>] [-F <separator>]  [-f <namefile>]\n            [-m <magicfiles>] [-P <parameter=value>] [--exclude-quiet]\n            <file> ...\n       file -C [-m <magicfiles>]\n       file [--help]\n");
                return 1;
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int width = o.Operands.Max(a => a.Length) + 1;
            foreach (var arg in o.Operands)
            {
                var path = sh.Resolve(arg);
                string desc;
                if (path == "/dev/null") desc = "character special (1/3)";
                else
                {
                    var node = sh.Vfs.TryLookupLink(path, user);
                    if (node?.Type == "link" && o.Flags.Contains("L")) node = sh.Vfs.TryLookup(path, user) ?? node;
                    if (node is null) desc = $"cannot open `{arg}' (No such file or directory)";
                    else if (node.Type == "dir") desc = "directory";
                    else if (node.Type == "link")
                        desc = sh.Vfs.TryLookup(path, user) is null ? $"broken symbolic link to {node.Content}" : $"symbolic link to {node.Content}";
                    else if (!VfsLib.HasPerm(node, user, 'r')) desc = $"regular file, no read permission";
                    else desc = Describe(node.Content ?? "", (node.Mode & Js.Oct(111)) != 0);
                }
                ctx.Out(o.Flags.Contains("b") ? desc + "\n" : $"{(arg + ":").PadRight(width)} {desc}\n");
            }
            return 0;
        },
    };

    // ---------- umask ----------

    private static readonly Regex UmaskOctalRe = new("^[0-7]{1,4}\\z", RegexOptions.CultureInvariant);

    /// <summary>The umask as symbols: u=rwx,g=rx,o=rx (what new files may have).</summary>
    private static string SymbolicUmask(int umask)
    {
        string Part(char who, int shift)
        {
            int allowed = ~(umask >> shift) & 7;
            return $"{who}={((allowed & 4) != 0 ? "r" : "")}{((allowed & 2) != 0 ? "w" : "")}{((allowed & 1) != 0 ? "x" : "")}";
        }
        return $"{Part('u', 6)},{Part('g', 3)},{Part('o', 0)}";
    }

    private static readonly CommandDef Umask = new()
    {
        Name = "umask",
        Builtin = true,
        Summary = "Visar eller ändrar vilka rättigheter nya filer inte får",
        SummaryEn = "Show or set which permissions new files do not get",
        Man = """
            NAMN
                   umask - rättigheter som tas bort från nya filer

            SYNOPSIS
                   umask [-S] [MASK]

            BESKRIVNING
                   Nya filer skapas med rw-rw-rw- (666) och nya kataloger med
                   rwxrwxrwx (777), minus de bitar som står i umask. Med den vanliga
                   umask 022 tas skrivrätten bort för gruppen och övriga: filer får
                   644 och kataloger 755. Med umask 077 får bara du komma åt det du
                   skapar (600 och 700).

                   Ändringen gäller bara skalet du står i. Lägg umask-raden i
                   ~/.bashrc för att den ska gälla varje gång.

            FLAGGOR
                   -S   visa masken som symboler (vad nya filer får): u=rwx,g=rx,o=rx

            EXEMPEL
                   umask
                   umask 077
                   umask -S
            """,
        ManEn = """
            NAME
                   umask - permissions removed from new files

            SYNOPSIS
                   umask [-S] [MASK]

            DESCRIPTION
                   New files are created with rw-rw-rw- (666) and new directories with
                   rwxrwxrwx (777), minus the bits in the umask. With the usual umask
                   022, write permission is removed for the group and others: files
                   get 644 and directories 755. With umask 077 only you can access
                   what you create (600 and 700).

                   The change only applies to the shell you are in. Put the umask line
                   in ~/.bashrc to make it apply every time.

            OPTIONS
                   -S   show the mask as symbols (what new files get): u=rwx,g=rx,o=rx

            EXAMPLES
                   umask
                   umask 077
                   umask -S
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var args = ctx.Args.ToList();
            bool symbolic = false;
            while (args.Count > 0 && args[0].StartsWith('-') && args[0].Length > 1)
            {
                if (args[0] == "-S") symbolic = true;
                else if (args[0] != "-p")
                {
                    ctx.Err($"bash: umask: {args[0]}: invalid option\numask: usage: umask [-p] [-S] [mode]\n");
                    return 2;
                }
                args.RemoveAt(0);
            }
            if (args.Count == 0)
            {
                ctx.Out(symbolic ? SymbolicUmask(sh.Vfs.Umask) + "\n" : Octal(sh.Vfs.Umask).PadLeft(4, '0') + "\n");
                return 0;
            }
            var spec = args[0];
            if (UmaskOctalRe.IsMatch(spec))
            {
                sh.Vfs.Umask = Convert.ToInt32(spec, 8) & Js.Oct(777);
                return 0;
            }
            if (spec.All(char.IsDigit))
            {
                ctx.Err($"bash: umask: {spec}: octal number out of range\n");
                return 1;
            }
            // Symbolic: what new files may get, e.g. u=rwx,g=rx,o= (the umask is the opposite).
            var allowed = FsCmd.ApplyMode(~sh.Vfs.Umask & Js.Oct(777), spec, true);
            if (allowed is null)
            {
                ctx.Err($"bash: umask: `{spec[0]}': invalid symbolic mode character\n");
                return 1;
            }
            sh.Vfs.Umask = ~allowed.Value & Js.Oct(777);
            return 0;
        },
    };

    public static List<CommandDef> All { get; } = new() { Ln, Readlink, Realpath, Stat, File, Umask };
}
