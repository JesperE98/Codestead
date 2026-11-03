namespace Codestead.Shell.Commands;

// The fastfetch command: shows system information with the distro logo.

public static partial class ExtrasCmd
{
    private static readonly OrderedDictionary<string, string[]> Logos = new(StringComparer.Ordinal)
    {
        ["ubuntu"] = new[]
        {
            "            .-/+oossssoo+/-.     ",
            "        `:+ssssssssssssssssss+:` ",
            "      -+ssssssssssssssssssyyssss+-",
            "    .ossssssssssssssssssdMMMNysssso.",
            "   /ssssssssssshdmmNNmmyNMMMMhssssss/",
            "  +ssssssssshmydMMMMMMMNddddyssssssss+",
            " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/",
            " +sssshhhyNMMNyssssssssssssyNMMMysssssss+",
        },
        ["debian"] = new[]
        {
            "       _,met$$$$$gg.       ",
            "    ,g$$$$$$$$$$$$$$$P.    ",
            "  ,g$$P\"     \"\"\"Y$$.\".     ",
            " ,$$P'              `$$$.  ",
            "',$$P       ,ggs.     `$$b:",
            "`d$$'     ,$P\"'   .    $$$ ",
            " $$P      d$'     ,    $$P ",
            " $$:      $$.   -    ,d$$' ",
        },
        ["arch"] = new[]
        {
            "                  -`                ",
            "                 .o+`               ",
            "                `ooo/               ",
            "               `+oooo:              ",
            "              `+oooooo:             ",
            "              -+oooooo+:            ",
            "            `/:-:++oooo+:           ",
            "           `/++++/+++++++:          ",
        },
        ["fedora"] = new[]
        {
            "             .',;::::;,'.          ",
            "         .';:cccccccccccc:;,.      ",
            "      .;cccccccccccccccccccccc;.   ",
            "    .:cccccccccccccccccccccccccc:. ",
            "  .;ccccccccccccc;.:dddl:.;ccccccc;.",
            " .:ccccccccccccc;OWMKOOXMWd;ccccccc:.",
            ".:ccccccccccccc;KMMc;cc;xMMc;ccccccc:.",
            ",cccccccccccccc;MMM.;cc;;WW:;cccccccc,",
        },
    };

    private static readonly CommandDef Fastfetch = new()
    {
        Name = "fastfetch",
        Summary = "Visar systeminformation med distro-logga",
        Man = """
NAMN
       fastfetch - visa systeminformation tillsammans med distributionens logga

BESKRIVNING
       En snabb efterföljare till neofetch. Populär i skärmdumpar!
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var d = sh.Distro;
            var u = sh.CurrentUser().Name;
            int count = PackagesLib.Packages.Count(p => PackagesLib.IsInstalled(sh, p));
            var pm = d.Family == "debian" ? "dpkg" : d.Family == "arch" ? "pacman" : "rpm";
            var info = new List<string>
            {
                $"{UtilCmd.Color.Bold}{u}@{d.Hostname}{UtilCmd.Color.Reset}",
                "-".Repeat(u.Length + d.Hostname.Length + 1),
                $"OS: {d.Name} x86_64",
                $"Kernel: Linux {d.Kernel}",
                "Uptime: 2 hours, 14 mins",
                $"Packages: {Js.Num(count + 600)} ({pm})",
                "Shell: bash 5.2",
                "Terminal: Codestead Linux",
            };
            var logo = Logos.Get(d.Id) ?? Logos["debian"];
            int width = logo.Max(l => l.Length);
            var color = $"\x1b[1;3{(d.Family == "arch" ? "6" : d.Family == "redhat" ? "4" : "1")}m";
            for (int i = 0; i < Math.Max(logo.Length, info.Count); i++)
            {
                ctx.Out($"{color}{(i < logo.Length ? logo[i] : "").PadRight(width)}{UtilCmd.Color.Reset}  {(i < info.Count ? info[i] : "")}\n");
            }
            return 0;
        },
    };
}
