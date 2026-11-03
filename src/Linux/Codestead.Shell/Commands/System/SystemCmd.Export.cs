namespace Codestead.Shell.Commands;

// The export command: sets an environment variable.

public static partial class SystemCmd
{
    private static readonly Regex IdentifierRe = new(@"^[A-Za-z_][A-Za-z0-9_]*\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Export = Simple("export", "Sätter en miljövariabel", ctx =>
    {
        var env = ctx.Sh.Env;
        if (ctx.Args.Count == 0 || ctx.Args[0] == "-p")
        {
            foreach (var (k, v) in SortedEntries(env)) ctx.Out($"declare -x {k}=\"{v}\"\n");
            return 0;
        }
        foreach (var a in ctx.Args)
        {
            int eq = a.IndexOf('=');
            var key = eq >= 0 ? a[..eq] : a;
            if (!IdentifierRe.IsMatch(key))
            {
                ctx.Err($"bash: export: `{a}': not a valid identifier\n");
                return 1;
            }
            if (eq >= 0) env[key] = a[(eq + 1)..];
            else if (!env.ContainsKey(key)) env[key] = "";
        }
        return 0;
    }, """
NAMN
       export - gör en variabel tillgänglig för program som startas

SYNOPSIS
       export NAMN=VÄRDE

EXEMPEL
       export EDITOR=nano
       export PATH="$HOME/bin:$PATH"

BESKRIVNING
       Variabler som sätts med export gäller bara i den aktuella sessionen.
       Lägg raden i ~/.bashrc om den ska gälla varje gång du öppnar en terminal.
""", true);
}
