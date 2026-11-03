namespace Codestead.Shell.Commands;

// The cat command: shows the contents of files.

public static partial class TextCmd
{
    private static readonly CommandDef Cat = CatLike(
        "cat",
        "Visar innehållet i filer",
        """
NAMN
       cat - slå ihop filer och skriv ut dem (concatenate)

SYNOPSIS
       cat [-n] [FIL]...

BESKRIVNING
       Skriver ut innehållet i en eller flera filer. Utan FIL läser cat
       från standard input, t.ex. från en pipe.

FLAGGOR
       -n    numrera raderna

EXEMPEL
       cat /etc/os-release
       cat del1.txt del2.txt > allt.txt
""");
}
