namespace Codestead.Content;

// The chapter "pipes" (part "grunder"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Pipes() =>
        new()
        {
            Id = "pipes",
            Part = "grunder",
            Title = "Omdirigering och pipes",
            Tasks = new()
            {
                new()
                {
                    Id = "redirect",
                    Text = "Skriv texten `{{helloShell}}` till filen `~/{{helloFile}}` med `echo` och `>`.",
                    Solution = Cmds("echo \"{{helloShell}}\" > ~/{{helloFile}}"),
                    Check = c => Content(c, "~/{{helloFile}}").Contains(W(c)["helloShell"]),
                },
                new()
                {
                    Id = "append",
                    Text = "Lägg till en rad till i `~/{{helloFile}}` – utan att skriva över den första.",
                    Hint = "Använd `>>` i stället för `>`.",
                    Solution = Cmds("echo \"{{anotherLine}}\" >> ~/{{helloFile}}"),
                    Check = c =>
                    {
                        var lines = Content(c, "~/{{helloFile}}").Split('\n').Where(l => l != "").ToList();
                        return lines.Count >= 2 && lines[0].Contains(W(c)["helloShell"]);
                    },
                },
                new()
                {
                    Id = "count-errors",
                    Text = "Räkna antalet rader med `ERROR` i server.log genom att skicka `grep` vidare till `wc -l` med en pipe.",
                    Solution = Cmds("grep ERROR ~/{{documents}}/server.log | wc -l"),
                    Check = c => Ran(c, Re(@"grep.*\|\s*wc\s+-l")) && c.Output.Trim() == "3",
                },
                new()
                {
                    Id = "uniq",
                    Text = "Visa hur många gånger varje frukt förekommer i `{{fruits}}`, med `sort` och `uniq -c`.",
                    Solution = Cmds("sort ~/{{documents}}/{{fruits}} | uniq -c"),
                    Check = c => Ran(c, Re(@"sort.*\|\s*uniq\s+-c")) && c.Output.Contains("3 " + W(c).File("fruits").Split('\n')[0], StringComparison.Ordinal),
                },
                new()
                {
                    Id = "save-ls",
                    Text = "Spara en lista över filerna i `/etc` i filen `~/{{etcFiles}}`.",
                    Solution = Cmds("ls /etc > ~/{{etcFiles}}"),
                    Check = c => Content(c, "~/{{etcFiles}}").Contains("os-release"),
                },
                new()
                {
                    Id = "devnull",
                    Text = "Kör `ls /{{missing}}`, men skicka felmeddelandet till `/dev/null` så att inget syns.",
                    Solution = Cmds("ls /{{missing}} 2> /dev/null"),
                    Check = c => Re(c, @"^ls\s+\/{{missing}}\b.*2>\s*\/dev\/null").IsMatch(c.Line) && c.Output.Trim() == "",
                },
                new()
                {
                    Id = "xargs",
                    Text = "Räkna raderna i varje fil i `~/{{documents}}`: hitta filerna med `find -type f` och ge dem till `wc -l` med `xargs`.",
                    Hint = "`find ~/{{documents}} -type f | xargs wc -l` – `wc` läser inte filnamn från en pipe, men `xargs` gör dem till argument.",
                    Solution = Cmds("find ~/{{documents}} -type f | xargs wc -l"),
                    Check = c => Ran(c, Re(@"^find\b.*\|\s*xargs\s+(-\S+\s+)*wc\b")) && Re(@"\d+ total").IsMatch(c.Output),
                },
            },
        };
}
