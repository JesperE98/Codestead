namespace Codestead.Shell.Commands;

// The alias command: creates a shortcut for a command.

public static partial class SystemCmd
{
    private static readonly CommandDef Alias = Simple("alias", "Skapar ett kortkommando för ett kommando", ctx =>
    {
        var aliases = ctx.Sh.Aliases;
        if (ctx.Args.Count == 0)
        {
            foreach (var (k, v) in SortedEntries(aliases)) ctx.Out($"alias {k}='{v}'\n");
            return 0;
        }
        int code = 0;
        foreach (var a in ctx.Args)
        {
            int eq = a.IndexOf('=');
            if (eq > 0) aliases[a[..eq]] = a[(eq + 1)..];
            else if (aliases.TryGetValue(a, out var v)) ctx.Out($"alias {a}='{v}'\n");
            else
            {
                ctx.Err($"bash: alias: {a}: not found\n");
                code = 1;
            }
        }
        return code;
    }, """
NAMN
       alias - skapa kortkommandon

SYNOPSIS
       alias NAMN='KOMMANDO'
       alias

EXEMPEL
       alias ll='ls -la'
       alias ..='cd ..'

BESKRIVNING
       Utan argument listas alla alias. Lägg alias i ~/.bashrc för att
       spara dem permanent.
""", true);
}
