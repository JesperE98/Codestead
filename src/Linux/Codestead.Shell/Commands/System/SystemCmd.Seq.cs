namespace Codestead.Shell.Commands;

// The seq command: prints a sequence of numbers.

public static partial class SystemCmd
{
    private static readonly CommandDef Seq = Simple("seq", "Skriver ut en talföljd", ctx =>
    {
        var n = ctx.Args.Select(a => Js.Number(a)).ToList();
        if (n.Count == 0 || n.Any(double.IsNaN)) return UtilCmd.BadOption(ctx, "missing operand");
        var (first, inc, last) = n.Count == 1 ? (1.0, 1.0, n[0]) : n.Count == 2 ? (n[0], 1.0, n[1]) : (n[0], n[1], n[2]);
        if (inc == 0) return 1;
        int c = 0;
        for (double i = first; inc > 0 ? i <= last : i >= last; i += inc, c++)
        {
            if (c > 10_000) break;
            ctx.Out(Js.Num(i) + "\n");
        }
        return 0;
    }, """
NAMN
       seq - skriv ut en talföljd

SYNOPSIS
       seq SISTA
       seq FÖRSTA SISTA
       seq FÖRSTA STEG SISTA
""");
}
