namespace Codestead.Shell.Commands;

// The which command: shows where a command is located.

public static partial class SystemCmd
{
    private static readonly CommandDef Which = Simple("which", "Visar var ett kommando finns", ctx =>
    {
        var sh = ctx.Sh;
        int code = 0;
        foreach (var n in ctx.Args)
        {
            var r = sh.ResolveCommand(n);
            if (r.Kind == "binary" || r.Kind == "script") ctx.Out(r.Path + "\n");
            else
            {
                code = 1;
                if (sh.Distro.Family != "debian") ctx.Err($"which: no {n} in ({sh.Env.Get("PATH") ?? ""})\n");
            }
        }
        return code;
    }, """
NAMN
       which - visa den fullständiga sökvägen till ett kommando

BESKRIVNING
       Letar igenom katalogerna i $PATH. Inbyggda skalkommandon (som cd)
       är inga filer och hittas därför inte – använd "type" för dem.

EXEMPEL
       which ls
""");
}
