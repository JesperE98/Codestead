namespace Codestead.Content;

// The chapter "schemalaggning" (part "skript"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Schemalaggning() =>
        new()
        {
            Id = "schemalaggning",
            Part = "skript",
            Title = "Schemalagda jobb med cron",
            Tasks = new()
            {
                new()
                {
                    Id = "crontab-l",
                    Text = "Visa din crontab.",
                    Hint = "`crontab -l`. Har du inga jobb än svarar den *no crontab for {{user}}*.",
                    Solution = Cmds("crontab -l"),
                    Check = c => Re(@"^crontab\s+-l\s*$").IsMatch(c.Line) && (c.ExitCode == 0 || c.Output.Contains("no crontab for", StringComparison.Ordinal)),
                },
                new()
                {
                    Id = "every-minute",
                    Text = "Lägg till ett jobb som kör `date >> ~/cron.log` varje minut.",
                    Hint = "Fem stjärnor betyder varje minut: `echo '* * * * * date >> ~/cron.log' | crontab -`.",
                    Solution = Cmds("echo '* * * * * date >> ~/cron.log' | crontab -"),
                    Check = c => CronJobs(c).Any(j => Every(j.When[0], 0, 59) && Every(j.When[1], 0, 23) && j.Command.Contains("date") && j.Command.Contains("cron.log")),
                },
                new()
                {
                    Id = "weekdays",
                    Text = "Lägg till ett jobb som kör `~/{{helloScript}}` klockan 07.00 måndag till fredag – utan att ta bort det första jobbet.",
                    Hint = "Minut 0, timme 7, veckodag 1-5. Behåll de gamla raderna: `(crontab -l; echo '0 7 * * 1-5 ~/{{helloScript}}') | crontab -`.",
                    Solution = Cmds("(crontab -l; echo '0 7 * * 1-5 ~/{{helloScript}}') | crontab -"),
                    Check = c =>
                    {
                        var jobs = CronJobs(c);
                        return jobs.Any(j => j.Command.Contains("cron.log")) && jobs.Any(j =>
                            j.When[0].SetEquals(new[] { 0 }) && j.When[1].SetEquals(new[] { 7 }) && Every(j.When[2], 1, 31) && Every(j.When[3], 1, 12) &&
                            j.When[4].SetEquals(new[] { 1, 2, 3, 4, 5 }) && j.Command.Contains(W(c)["helloScript"], StringComparison.Ordinal));
                    },
                },
                new()
                {
                    Id = "journal",
                    Text = "Visa vad tjänsten `cron` har skrivit i journalen.",
                    Hint = "`journalctl -u cron`. När ditt jobb har körts står det där som *CMD (date >> ~/cron.log)*.",
                    Solution = Cmds("journalctl -u cron"),
                    Check = c => Ran(c, Re(@"^(sudo\s+)?journalctl\b.*-u\s*cron\b")) && c.Output.Contains("cron", StringComparison.Ordinal),
                },
                new()
                {
                    Id = "timers",
                    Text = "Visa systemd:s timers – jobben som systemd själv kör på bestämda tider.",
                    Solution = Cmds("systemctl list-timers"),
                    Check = c => Ran(c, Re(@"^systemctl\s+(-\S+\s+)*list-timers\b")),
                },
                new()
                {
                    Id = "remove",
                    Text = "Ta bort jobbet som körs varje minut, men behåll jobbet klockan 07.00.",
                    Hint = "Filtrera bort raden med `grep -v` och installera resten: `crontab -l | grep -v cron.log | crontab -`.",
                    Solution = Cmds("crontab -l | grep -v cron.log | crontab -"),
                    Check = c =>
                    {
                        var jobs = CronJobs(c);
                        return !jobs.Any(j => j.Command.Contains("cron.log")) && jobs.Any(j => j.Command.Contains(W(c)["helloScript"], StringComparison.Ordinal));
                    },
                },
            },
        };
}
