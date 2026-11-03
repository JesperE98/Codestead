namespace Codestead.Shell.Commands;

// The moonphase command: shows the phase of the moon (made-up program from a PPA, the AUR and COPR).

public static partial class ReposCmd
{
    private static readonly string[] Phases = { "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent" };

    private static string MoonArt(double age)
    {
        var angle = (2 * Math.PI * age) / Synodic;
        var waxing = age < Synodic / 2;
        const int R = 5;
        var rows = new List<string>();
        for (int yi = 0; yi < 2 * R; yi++)
        {
            var y = yi - R + 0.5;
            var w = Math.Sqrt(R * R - y * y);
            var row = new StringBuilder();
            for (int xi = -2 * R; xi <= 2 * R; xi++)
            {
                var x = xi / 2.0;
                if (Math.Abs(x) > w + 0.25)
                {
                    row.Append(' ');
                    continue;
                }
                var t = w * Math.Cos(angle);
                var lit = waxing ? x > t : x < -t;
                row.Append(lit ? '@' : '.');
            }
            rows.Add(row.ToString().TrimEnd());
        }
        return string.Join("\n", rows) + "\n";
    }

    private static readonly CommandDef Moonphase = new()
    {
        Name = "moonphase",
        Summary = "Visar månens fas (påhittat program från PPA, AUR och COPR)",
        SummaryEn = "Shows the phase of the moon (made-up program from a PPA, the AUR and COPR)",
        Man = """
NAMN
       moonphase - visa månens fas i terminalen

SYNOPSIS
       moonphase [--version]

BESKRIVNING
       Ritar månen som den ser ut i dag och berättar hur stor del som är
       upplyst. Ett påhittat program som finns i de extra förråden
       ppa:lunatool/moonphase, AUR och COPR-projektet lunatool/moonphase.
""",
        ManEn = """
NAME
       moonphase - show the phase of the moon in the terminal

SYNOPSIS
       moonphase [--version]

DESCRIPTION
       Draws the moon as it looks today and tells you how much of it is
       lit. A made-up program that lives in the extra repositories
       ppa:lunatool/moonphase, the AUR and the COPR project
       lunatool/moonphase.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count > 0 && (ctx.Args[0] == "--version" || ctx.Args[0] == "-V"))
            {
                ctx.Out($"moonphase {(ctx.Sh.Installed.Get("moonphase") ?? "1.4.2").Split('-')[0]}\n");
                return 0;
            }
            if (ctx.Args.Count != 0)
            {
                ctx.Err($"moonphase: unknown option '{ctx.Args[0]}'\nUsage: moonphase [--version]\n");
                return 2;
            }
            var now = Js.Now();
            var age = MoonAge(now);
            var illum = Math.Floor(((1 - Math.Cos((2 * Math.PI * age) / Synodic)) / 2) * 100 + 0.5);
            var name = Phases[(int)Math.Floor(((age + Synodic / 16) % Synodic) / (Synodic / 8))];
            var toFull = (Synodic / 2 - age + Synodic) % Synodic;
            var full = DateTimeOffset.FromUnixTimeMilliseconds((long)Math.Truncate(now + toFull * 86_400_000)).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            ctx.Out($"{MoonArt(age)}\n{name}, {Js.Num(illum)}% illuminated (day {Js.ToFixed(age, 1)} of {Js.ToFixed(Synodic, 1)})\nNext full moon: {full}\n");
            return 0;
        },
    };
}
