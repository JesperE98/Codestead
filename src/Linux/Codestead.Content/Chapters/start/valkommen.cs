namespace Codestead.Content;

// The chapter "valkommen" (part "start"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Valkommen() =>
        new()
        {
            Id = "valkommen",
            Part = "start",
            Title = "Välkommen till Linux-shell",
            Tasks = new()
            {
                new()
                {
                    Id = "echo",
                    Text = "Skriv ut texten `{{helloWorld}}` med `echo`.",
                    Solution = Cmds("echo {{helloWorld}}"),
                    Check = c => Ran(c, Re(@"^echo\b")) && c.Output.Contains(W(c)["helloWorld"], StringComparison.OrdinalIgnoreCase),
                },
                new()
                {
                    Id = "whoami",
                    Text = "Ta reda på vilken användare du är inloggad som, med `whoami`.",
                    Solution = Cmds("whoami"),
                    Check = c => Ran(c, Re(@"^whoami\s*$")),
                },
                new()
                {
                    Id = "os-release",
                    Text = "Visa vilken distribution du kör med `cat /etc/os-release`.",
                    Solution = Cmds("cat /etc/os-release"),
                    Check = c => Ran(c, Re(@"^cat\s+\/etc\/os-release\s*$")),
                },
                new()
                {
                    Id = "help",
                    Text = "Lista alla kommandon som finns i simulatorn med `help`.",
                    Solution = Cmds("help"),
                    Check = c => Ran(c, Re(@"^help\b")),
                },
            },
        };
}
