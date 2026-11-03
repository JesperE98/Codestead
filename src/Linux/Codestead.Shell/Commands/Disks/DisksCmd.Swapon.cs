namespace Codestead.Shell.Commands;

// The swapon command: show and enable swap.

public static partial class DisksCmd
{
    private static readonly CommandDef Swapon = new()
    {
        Name = "swapon",
        Summary = "Visar och slår på swap",
        SummaryEn = "Show and enable swap",
        Man = SwaponMan,
        ManEn = SwaponManEn,
        Run = ctx =>
        {
            var args = ctx.Args;
            var state = ctx.Sh.Disks;
            var active = DisksLib.AllBlocks(state).Where(b => b.Dev.SwapActive).ToList();
            var a0 = args.Count > 0 ? args[0] : null;
            if (args.Count == 0 || a0 == "--show" || a0 == "-s" || a0 == "--summary")
            {
                if (a0 == "-s" || a0 == "--summary")
                {
                    ctx.Out("Filename\t\t\t\tType\t\tSize\t\tUsed\t\tPriority\n");
                    foreach (var b in active)
                        ctx.Out($"{b.Path.PadRight(40)}partition\t{Js.Num(DisksLib.BlockSize(b.Dev) / 1024.0)}\t\t0\t\t{(b.Disk.Tran != "" ? -2 : 100)}\n");
                    return 0;
                }
                var rows = new List<List<string>> { new() { "NAME", "TYPE", "SIZE", "USED", "PRIO" } };
                foreach (var b in active)
                    rows.Add(new List<string> { b.Path, "partition", DisksLib.LsblkSize(DisksLib.BlockSize(b.Dev)), "0B", b.Disk.Tran != "" ? "-2" : "100" });
                ctx.Out(Table(rows, new[] { 'l', 'l', 'r', 'r', 'r' }));
                return 0;
            }
            if (a0 == "-a" || a0 == "--all") return IsRoot(ctx) ? 0 : 1;
            var blk = DisksLib.FindBlock(state, a0!);
            if (blk is null)
            {
                ctx.Err($"swapon: cannot open {a0}: No such file or directory\n");
                return 1;
            }
            if (!IsRoot(ctx))
            {
                ctx.Err($"swapon: {blk.Path}: swapon failed: Operation not permitted\n");
                return 1;
            }
            if (blk.Dev.SwapActive) ctx.Err($"swapon: {blk.Path}: swapon failed: Device or resource busy\n");
            else ctx.Err($"swapon: {blk.Path}: read swap header failed\n");
            return 1;
        },
    };

    private const string SwaponMan = """
        NAMN
               swapon - visa och slå på swap

        SYNOPSIS
               swapon [--show]

        BESKRIVNING
               Swap är utrymme som används när RAM-minnet tar slut: sidor av minnet
               som inte används just nu flyttas dit. Swap kan vara en partition,
               en fil eller – som i Fedora – komprimerat RAM (zram).

               Utan argument, eller med --show, visas swap som används.

        EXEMPEL
               swapon --show
               free -h
        """;

    private const string SwaponManEn = """
        NAME
               swapon - show and enable swap

        SYNOPSIS
               swapon [--show]

        DESCRIPTION
               Swap is space used when RAM runs out: pages of memory that are not
               used right now are moved there. Swap can be a partition, a file or
               – as in Fedora – compressed RAM (zram).

               Without arguments, or with --show, the swap in use is shown.

        EXAMPLES
               swapon --show
               free -h
        """;
}
