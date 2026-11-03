namespace Codestead.Shell.Commands;

// The tee command: writes input both to the screen and to files.

public static partial class TextCmd
{
    private static readonly CommandDef Tee = new()
    {
        Name = "tee",
        Summary = "Skriver indata både till skärmen och till filer",
        Man = """
NAMN
       tee - läs från standard input och skriv till både standard output och filer

SYNOPSIS
       tee [-a] [FIL]...

FLAGGOR
       -a    lägg till i filerna i stället för att skriva över

EXEMPEL
       ls | tee lista.txt
       echo "127.0.0.1 test" | sudo tee -a /etc/hosts

TIPS
       "sudo echo text > /etc/fil" fungerar inte, eftersom det är ditt eget
       skal (inte sudo) som öppnar filen. Använd "echo text | sudo tee /etc/fil".
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "a", Long = new() { ["append"] = "a" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var data = ctx.Stdin ?? "";
            var sh = ctx.Sh;
            int code = 0;
            foreach (var f in o.Operands)
            {
                try
                {
                    sh.Vfs.WriteFile(sh.Resolve(f), data, sh.CurrentUser(), o.Flags.Contains("a"));
                }
                catch (FsError e)
                {
                    ctx.Err($"tee: {f}: {e.Message}\n");
                    code = 1;
                }
            }
            ctx.Out(data);
            return code;
        },
    };
}
