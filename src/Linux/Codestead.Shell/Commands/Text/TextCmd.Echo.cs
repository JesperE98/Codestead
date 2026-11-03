namespace Codestead.Shell.Commands;

// The echo command: prints text.

public static partial class TextCmd
{
    private static readonly Regex EchoFlagRe = new(@"^-[neE]+\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Echo = new()
    {
        Name = "echo",
        Builtin = true,
        Summary = "Skriver ut text",
        Man = """
NAMN
       echo - skriv ut en rad text

SYNOPSIS
       echo [-n] [-e] [TEXT]...

FLAGGOR
       -n    skriv inte ut någon radbrytning på slutet
       -e    tolka \n (ny rad) och \t (tabb)

EXEMPEL
       echo Hej världen
       echo "Min hemkatalog är $HOME"
       echo 'Enkla citattecken: $HOME skrivs ut som det står'
""",
        Run = ctx =>
        {
            bool newline = true;
            bool escapes = false;
            var args = ctx.Args.ToList();
            while (args.Count > 0 && EchoFlagRe.IsMatch(args[0]))
            {
                var f = args[0];
                args.RemoveAt(0);
                if (f.Contains('n')) newline = false;
                if (f.Contains('e')) escapes = true;
                if (f.Contains('E')) escapes = false;
            }
            var text = string.Join(" ", args);
            if (escapes) text = text.Replace("\\n", "\n").Replace("\\t", "\t").Replace("\\\\", "\\");
            ctx.Out(text + (newline ? "\n" : ""));
            return 0;
        },
    };
}
