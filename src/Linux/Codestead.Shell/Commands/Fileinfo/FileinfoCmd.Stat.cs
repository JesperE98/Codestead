namespace Codestead.Shell.Commands;

// The stat command: display everything about a file: size, permissions, owner, inode and times.

public static partial class FileinfoCmd
{
    private static string FileType(FsNode n) =>
        n.Type == "dir" ? "directory" : n.Type == "link" ? "symbolic link" : (n.Content ?? "") == "" && n.Size is null ? "regular empty file" : "regular file";

    private static int UidOf(Shell sh, string name) => UsersLib.FindUser(sh, name)?.Uid ?? (name == "root" ? 0 : 65534);

    private static int GidOf(Shell sh, string group) => UsersLib.GidOf(sh, group) ?? (group == "root" ? 0 : 65534);

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
}
