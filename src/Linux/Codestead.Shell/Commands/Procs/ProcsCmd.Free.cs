namespace Codestead.Shell.Commands;

// The free command: shows how much memory is used.

public static partial class ProcsCmd
{
    private static readonly CommandDef Free = new()
    {
        Name = "free",
        Summary = "Visar hur mycket minne som används",
        Man = """
            NAMN
                   free - visa använt och ledigt minne

            FLAGGOR
                   -h    läsbara enheter (Mi, Gi)
                   -m    i mebibyte
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "hmgk", Long = new Dictionary<string, string> { ["human"] = "h" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            const long total = 8_073_420, used = 1_929_820, free = 5_327_976, shared = 102_400, cache = 815_624, avail = 6_143_600, swap = 2_097_148;
            string F(long n) => o.Flags.Contains("h")
                ? (n >= 1_048_576 ? $"{Js.ToFixed(n / 1_048_576.0, 1)}Gi" : $"{Js.Num(JsRound(n / 1024.0))}Mi")
                : o.Flags.Contains("m") ? Js.Num(JsRound(n / 1024.0)) : Js.Num(n);
            string C(long n) => F(n).PadLeft(12);
            ctx.Out($"{"".PadRight(7)}{"total".PadLeft(12)}{"used".PadLeft(12)}{"free".PadLeft(12)}{"shared".PadLeft(12)}{"buff/cache".PadLeft(12)}{"available".PadLeft(12)}\n");
            ctx.Out($"Mem:   {C(total)}{C(used)}{C(free)}{C(shared)}{C(cache)}{C(avail)}\n");
            ctx.Out($"Swap:  {C(swap)}{C(0)}{C(swap)}\n");
            return 0;
        },
    };
}
