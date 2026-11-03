namespace Codestead.Shell.Commands;

// The head and tail commands.

public static partial class TextCmd
{
    private static readonly Regex DashNumberRe = new(@"^-[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingSignRe = new(@"^[+-]", RegexOptions.CultureInvariant);

    private static CommandDef HeadTail(string name)
    {
        var extra = name == "tail"
            ? "\n       -n +N              visa från och med rad N\n       -f                 följ filen när den växer (stöds inte i simulatorn)"
            : "";
        var man = "NAMN\n" +
            $"       {name} - visa {(name == "head" ? "de första" : "de sista")} raderna i filer\n" +
            "\n" +
            "SYNOPSIS\n" +
            $"       {name} [-n ANTAL] [FIL]...\n" +
            "\n" +
            "FLAGGOR\n" +
            $"       -n ANTAL, -ANTAL   visa ANTAL rader (standard är 10){extra}\n" +
            "\n" +
            "EXEMPEL\n" +
            $"       {name} -n 3 server.log\n" +
            $"       {(name == "head" ? "ls -l /etc | head -5" : "tail -n 20 /var/log/syslog")}";
        return new CommandDef
        {
            Name = name,
            Summary = name == "head" ? "Visar början av en fil" : "Visar slutet av en fil",
            Man = man,
            Run = ctx =>
            {
                var args = ctx.Args.Select(a => DashNumberRe.IsMatch(a) ? $"-n{a[1..]}" : a).ToList();
                var o = UtilCmd.ParseOpts(args, new OptSpec { Flags = "fqv", Values = "n", Long = new() { ["lines"] = "n", ["follow"] = "f" } });
                if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
                var spec = o.Values.Get("n") ?? "10";
                bool fromStart = name == "tail" && spec.StartsWith('+');
                double n = Js.Number(LeadingSignRe.Replace(spec, "", 1));
                if (double.IsNaN(n) || double.IsInfinity(n) || n != Math.Floor(n))
                {
                    ctx.Err($"{name}: invalid number of lines: '{spec}'\n");
                    return 1;
                }
                var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands, (l, m) => $"{name}: cannot open '{l}' for reading: {m}");
                for (int i = 0; i < inputs.Count; i++)
                {
                    var input = inputs[i];
                    if (inputs.Count > 1) ctx.Out($"{(i > 0 ? "\n" : "")}==> {input.Label} <==\n");
                    var lines = UtilCmd.SplitLines(input.Content);
                    var picked = name == "head"
                        ? Js.Slice(lines, 0, ToIndex(n))
                        : fromStart ? Js.Slice(lines, ToIndex(Math.Max(0, n - 1))) : n == 0 ? new List<string>() : Js.Slice(lines, ToIndex(-n));
                    ctx.Out(UtilCmd.JoinLines(picked));
                }
                if (o.Flags.Contains("f"))
                {
                    ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("text.tailFollow")}){UtilCmd.Color.Reset}\n");
                }
                return failed ? 1 : 0;
            },
        };
    }
}
