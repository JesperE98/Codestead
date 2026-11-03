namespace Codestead.Content;

// The chapter "navigera" (part "grunder"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Navigera() =>
        new()
        {
            Id = "navigera",
            Part = "grunder",
            Title = "Navigera i filsystemet",
            Tasks = new()
            {
                new()
                {
                    Id = "etc",
                    Text = "Gå till katalogen `/etc` och lista vad som finns där.",
                    Hint = "Två kommandon: först `cd`, sedan `ls`. Du kan också skriva dem på samma rad: `cd /etc && ls`.",
                    Solution = Cmds("cd /etc", "ls"),
                    Check = c => Ran(c, Re(@"(^|[;&|]\s*)ls(\s|$)")) && c.Sh.Cwd == "/etc",
                },
                new()
                {
                    Id = "hidden",
                    Text = "Visa de dolda filerna i din hemkatalog.",
                    Hint = "Flaggan `-a` visar filer som börjar med punkt. Din hemkatalog är `~`.",
                    Solution = Cmds("ls -a ~"),
                    Check = c => Ran(c, Re(@"^ls\b.*\s-\w*[aA]")) && (c.Sh.Cwd == Home(c) || Re(c, @"\s(~\/?|\/home\/{{user}}\/?)(\s|$)").IsMatch(c.Line)),
                },
                new()
                {
                    Id = "relative",
                    Text = "Ställ dig i roten (`/`) och gå sedan till `/var/log` med en **relativ** sökväg.",
                    Hint = "En relativ sökväg börjar inte med `/`. Står du i `/` räcker `cd var/log`.",
                    Solution = Cmds("cd /", "cd var/log"),
                    Check = c => c.Sh.Cwd == "/var/log" && Re(@"(^|[;&]\s*)cd\s+(\.\/)?var\/log\/?\s*$").IsMatch(c.Line),
                },
                new()
                {
                    Id = "up",
                    Text = "Gå upp en nivå med `cd ..` (cd, mellanslag och två punkter).",
                    Solution = Cmds("cd .."),
                    Check = c => Ran(c, Re(@"^cd\s+\.\.\/?\s*$")),
                },
                new()
                {
                    Id = "home",
                    Text = "Gå tillbaka till din hemkatalog med bara `cd`, utan argument.",
                    Solution = Cmds("cd"),
                    Check = c => c.Line == "cd" && c.Sh.Cwd == Home(c),
                },
            },
        };
}
