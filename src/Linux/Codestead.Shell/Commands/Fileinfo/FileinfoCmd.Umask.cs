namespace Codestead.Shell.Commands;

// The umask command: show or set which permissions new files do not get.

public static partial class FileinfoCmd
{
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
}
