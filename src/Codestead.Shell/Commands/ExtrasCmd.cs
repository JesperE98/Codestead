namespace Codestead.Shell.Commands;

// Port of src/shell/commands/extras.ts – programs that are not preinstalled but installed with the package
// manager: tree, htop, fastfetch, cowsay, python3, vim, nano.
// (curl, wget and ssh live in NetCmd.cs and SshCmd.cs.)

public static partial class ExtrasCmd
{
    private static void Note(CmdCtx ctx, string text) => ctx.Out($"{UtilCmd.Color.Dim}{text}{UtilCmd.Color.Reset}\n");

    /// <summary>Math.round in JavaScript (halves round up).</summary>
    private static double JsRound(double v) => Math.Floor(v + 0.5);

    private static readonly CommandDef Tree = new()
    {
        Name = "tree",
        Summary = "Visar kataloger som ett träd",
        Man = """
NAMN
       tree - visa innehållet i kataloger som ett träd

SYNOPSIS
       tree [-a] [-d] [-L NIVÅ] [KATALOG]

FLAGGOR
       -a       visa även dolda filer
       -d       visa bara kataloger
       -L NIVÅ  gå högst NIVÅ nivåer ner
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "ad", Values = "L" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            var levelValue = o.Values.Get("L");
            double maxLevel = !string.IsNullOrEmpty(levelValue) ? Js.Number(levelValue) : double.PositiveInfinity;
            int dirs = 0;
            int files = 0;
            void Walk(FsNode node, string prefix, int level)
            {
                if (level > maxLevel) return;
                if (!VfsLib.HasPerm(node, user, 'r')) return;
                var names = node.Children!.Keys
                    .Where(n => o.Flags.Contains("a") || !n.StartsWith('.'))
                    .Where(n => !o.Flags.Contains("d") || node.Children[n].Type == "dir")
                    .ToList()
                    .StableSort(Js.LocaleCompare);
                for (int i = 0; i < names.Count; i++)
                {
                    var n = names[i];
                    var child = node.Children[n];
                    bool last = i == names.Count - 1;
                    ctx.Out($"{prefix}{(last ? "└── " : "├── ")}{UtilCmd.ColorName(n, child, ctx.IsTTY)}\n");
                    if (child.Type == "dir")
                    {
                        dirs++;
                        Walk(child, prefix + (last ? "    " : "│   "), level + 1);
                    }
                    else
                    {
                        files++;
                    }
                }
            }
            var target = o.Operands.Count > 0 ? o.Operands[0] : ".";
            try
            {
                var node = sh.Vfs.Lookup(sh.Resolve(target), user);
                if (node.Type != "dir")
                {
                    ctx.Out($"{target}  [error opening dir]\n\n0 directories, 0 files\n");
                    return 2;
                }
                ctx.Out(UtilCmd.ColorName(target, node, ctx.IsTTY) + "\n");
                Walk(node, "", 1);
            }
            catch (FsError e)
            {
                ctx.Out($"{target}  [error opening dir: {e.Message}]\n");
                return 2;
            }
            ctx.Out($"\n{dirs} director{(dirs == 1 ? "y" : "ies")}{(o.Flags.Contains("d") ? "" : $", {files} file{(files == 1 ? "" : "s")}")}\n");
            return 0;
        },
    };

    private static readonly CommandDef Htop = new()
    {
        Name = "htop",
        Summary = "Visar processer och resursanvändning",
        Man = """
NAMN
       htop - interaktiv processvisare

BESKRIVNING
       Visar CPU, minne och alla processer som körs. I en riktig terminal
       sorterar du med F6, söker med F3, avslutar processer med F9 och
       stänger htop med q eller F10. I simulatorn visas en ögonblicksbild.
""",
        Run = ctx =>
        {
            var procs = ProcsCmd.CurrentProcs(ctx, "htop").ToList().StableSort((a, b) =>
            {
                double d = b.Cpu - a.Cpu;
                if (d != 0) return d < 0 ? -1 : 1;
                return a.Pid - b.Pid;
            });
            double load = procs.Sum(p => p.Cpu);
            string Bar(double pct) =>
                $"[{UtilCmd.Color.Green}{"|".Repeat((int)JsRound(Math.Min(pct, 100) / 4)).PadRight(25)}{UtilCmd.Color.Reset}{Js.ToFixed(pct, 1).PadLeft(5)}%]";
            string Mb(long kb) => kb >= 1024 ? $"{Js.ToFixed(kb / 1024.0, 1)}M" : $"{Js.Num(kb)}K";
            ctx.Out(
                $"    0{Bar(Math.Min(100, load))}   Tasks: {procs.Count}, 1 running\n" +
                $"    1{Bar(3.2)}   Load average: {Js.ToFixed(load / 100, 2)} {Js.ToFixed(load / 100 * 0.9, 2)} {Js.ToFixed(load / 100 * 0.8, 2)}\n" +
                $"  Mem[{UtilCmd.Color.Green}||||||||||||             {UtilCmd.Color.Reset}1.84G/7.70G]   Uptime: 02:14:07\n" +
                "  Swp[                             0K/2.00G]\n\n" +
                $"\x1b[30;42m    PID USER       PRI  NI  VIRT   RES S CPU% MEM%   TIME+  Command              {UtilCmd.Color.Reset}\n");
            foreach (var p in procs)
            {
                ctx.Out(
                    $"{Js.Num(p.Pid).PadLeft(7)} {p.User.Slice(0, 9).PadRight(10)} 20   0 {Mb(p.Vsz).PadLeft(5)} {Mb(p.Rss).PadLeft(5)} {p.Stat.CharAt(0)} {Js.ToFixed(p.Cpu, 1).PadLeft(4)} {Js.ToFixed(p.Mem, 1).PadLeft(4)} {(p.Time + ".00").PadLeft(8)} {p.Cmd}\n");
            }
            ctx.Out("\nF1Help  F2Setup  F3Search  F4Filter  F5Tree  F6SortBy  F7Nice-  F8Nice+  F9Kill  F10Quit\n");
            Note(ctx, ctx.Sh.Msg(
                "(Simulerad ögonblicksbild. I en riktig terminal är htop interaktivt – avsluta med q.)",
                "(Simulated snapshot. In a real terminal htop is interactive – quit with q.)"));
            return 0;
        },
    };

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
                "Terminal: LinuxLearningTool",
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

    private static readonly CommandDef Cowsay = new()
    {
        Name = "cowsay",
        Summary = "En ko som säger något",
        Man = """
NAMN
       cowsay - en pratande ko

EXEMPEL
       cowsay Hej!
       fortune | cowsay
""",
        Run = ctx =>
        {
            var text = ctx.Args.Count > 0 ? string.Join(" ", ctx.Args) : TextCmd.JsTrim(ctx.Stdin ?? "");
            if (text == "") text = "Muu!";
            var lines = text.Split('\n');
            int w = lines.Max(l => Js.CodePointLength(l));
            string Pad(string l) => l + " ".Repeat(w - Js.CodePointLength(l));
            var bubble = new StringBuilder($" {"_".Repeat(w + 2)}\n");
            if (lines.Length == 1) bubble.Append($"< {Pad(lines[0])} >\n");
            else
            {
                for (int i = 0; i < lines.Length; i++)
                {
                    var (a, b) = i == 0 ? ("/", "\\") : i == lines.Length - 1 ? ("\\", "/") : ("|", "|");
                    bubble.Append($"{a} {Pad(lines[i])} {b}\n");
                }
            }
            bubble.Append($" {"-".Repeat(w + 2)}\n");
            ctx.Out(bubble + "        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||\n");
            return 0;
        },
    };

    private static readonly CommandDef Python3 = new()
    {
        Name = "python3",
        Summary = "Programspråket Python",
        Man = """
NAMN
       python3 - tolk för programspråket Python

BESKRIVNING
       I simulatorn stöds "python3 --version". Ett interaktivt Python-läge
       finns inte ännu.
""",
        Run = ctx =>
        {
            var v = ctx.Sh.Installed.Get("python")?.Split('-')[0] ?? "3.12.3";
            var first = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            if (first == "--version" || first == "-V")
            {
                ctx.Out($"Python {v}\n");
                return 0;
            }
            Note(ctx, ctx.Sh.Msg(
                $"Python {v} – det interaktiva läget stöds inte i simulatorn ännu.",
                $"Python {v} – interactive mode is not supported in the simulator yet."));
            return 0;
        },
    };

    private static CommandDef Editor(string name, string summary, string man) => new()
    {
        Name = name,
        Summary = summary,
        Man = man,
        Run = ctx =>
        {
            Note(ctx, ctx.Sh.Msg(
                $"{name} är en interaktiv texteditor och stöds inte i simulatorn ännu.\n" +
                "Skapa filer med t.ex.  echo 'text' > fil.txt  eller  echo 'mer text' >> fil.txt",
                $"{name} is an interactive text editor and is not supported in the simulator yet.\n" +
                "Create files with e.g.  echo 'text' > file.txt  or  echo 'more text' >> file.txt"));
            return 0;
        },
    };

    public static List<CommandDef> All { get; } = new()
    {
        Tree,
        Htop,
        Fastfetch,
        Cowsay,
        Python3,
        Editor("vim", "Kraftfull texteditor", """
NAMN
       vim - Vi IMproved, en kraftfull texteditor

BESKRIVNING
       vim har lägen: tryck i för att skriva, Esc för att gå tillbaka,
       :w för att spara och :q för att avsluta (:q! utan att spara).
"""),
        Editor("nano", "Enkel texteditor", """
NAMN
       nano - en enkel texteditor

BESKRIVNING
       Kommandona visas längst ner: ^O betyder Ctrl+O (spara) och ^X
       betyder Ctrl+X (avsluta).
"""),
    };
}
