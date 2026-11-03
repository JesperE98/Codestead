namespace Codestead.Shell.Commands;

// The uniq command: removes repeated lines (that are next to each other).

public static partial class TextCmd
{
    private static readonly CommandDef Uniq = new()
    {
        Name = "uniq",
        Summary = "Tar bort upprepade rader (som står bredvid varandra)",
        Man = """
NAMN
       uniq - rapportera eller ta bort upprepade rader

SYNOPSIS
       uniq [FLAGGA]... [FIL]

BESKRIVNING
       Tar bort rader som är likadana som raden direkt ovanför. Därför
       används uniq nästan alltid efter sort.

FLAGGOR
       -c    skriv antalet förekomster framför varje rad
       -d    visa bara rader som förekommer flera gånger
       -u    visa bara rader som är unika
       -i    ignorera skillnad mellan stora och små bokstäver

EXEMPEL
       sort frukter.txt | uniq -c
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "cdui", Long = new() { ["count"] = "c", ["repeated"] = "d", ["unique"] = "u", ["ignore-case"] = "i" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, Js.Slice(o.Operands, 0, 1));
            if (failed) return 1;
            var lines = UtilCmd.SplitLines(inputs.Count > 0 ? inputs[0].Content : "");
            bool Same(string a, string b) => o.Flags.Contains("i") ? a.ToLowerInvariant() == b.ToLowerInvariant() : a == b;
            var groups = new List<(string Line, int Count)>();
            foreach (var l in lines)
            {
                if (groups.Count > 0 && Same(groups[^1].Line, l)) groups[^1] = (groups[^1].Line, groups[^1].Count + 1);
                else groups.Add((l, 1));
            }
            foreach (var g in groups)
            {
                if (o.Flags.Contains("d") && g.Count < 2) continue;
                if (o.Flags.Contains("u") && g.Count > 1) continue;
                ctx.Out(o.Flags.Contains("c") ? $"{Js.Num(g.Count).PadLeft(7)} {g.Line}\n" : $"{g.Line}\n");
            }
            return 0;
        },
    };
}
