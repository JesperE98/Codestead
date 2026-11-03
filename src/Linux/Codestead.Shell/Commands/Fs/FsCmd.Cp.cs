namespace Codestead.Shell.Commands;

// The cp command: copies files and directories.

public static partial class FsCmd
{
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
}
