namespace Codestead.Shell.Commands;

// The file command: determine what kind of data a file contains.

public static partial class FileinfoCmd
{
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
}
