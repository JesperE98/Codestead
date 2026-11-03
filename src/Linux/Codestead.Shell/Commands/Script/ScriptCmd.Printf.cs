namespace Codestead.Shell.Commands;

// The printf command: prints formatted text.

public static partial class ScriptCmd
{
    private static readonly CommandDef Printf = new()
    {
        Name = "printf",
        Builtin = true,
        Summary = "Skriver ut formaterad text",
        Man = """
NAMN
       printf - skriv ut formaterad text

SYNOPSIS
       printf FORMAT [ARGUMENT]...

BESKRIVNING
       Som echo, men du styr exakt hur utskriften ser ut. Ingen radbrytning
       läggs till automatiskt – skriv \n där du vill ha en.

FORMAT
       %s     text            %d     heltal
       %5s    högerjustera i 5 tecken   %-10s  vänsterjustera i 10 tecken
       %.2f   decimaltal med 2 decimaler
       %%     ett procenttecken

EXEMPEL
       printf "Hej %s!\n" "$USER"
       printf "%-10s %5d\n" äpplen 3
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0)
            {
                ctx.Err("printf: usage: printf format [arguments]\n");
                return 2;
            }
            ctx.Out(FormatPrintf(ctx.Args[0], ctx.Args.Skip(1).ToList()));
            return 0;
        },
    };
}
