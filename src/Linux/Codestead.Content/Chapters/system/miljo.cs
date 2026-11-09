namespace Codestead.Content;

// The chapter "miljo" (part "system"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Miljo() =>
        new()
        {
            Id = "miljo",
            Part = "system",
            Title = "Variabler, PATH och alias",
            Tasks = new()
            {
                new()
                {
                    Id = "path",
                    Text = "Visa innehållet i variabeln `PATH`.",
                    Solution = Cmds("echo $PATH"),
                    Check = c => Ran(c, Re(@"^(echo|printenv)\b.*PATH")) && c.Output.Contains("/usr/bin"),
                },
                new()
                {
                    Id = "tr-path",
                    Text = "Visa katalogerna i `$PATH` på **varsin rad** genom att byta `:` mot radbrytning med `tr`.",
                    Hint = "Radbrytning skrivs `\\n`: `echo $PATH | tr ':' '\\n'`",
                    Solution = Cmds("echo $PATH | tr ':' '\\n'"),
                    Check = c => Ran(c, Re(@"\btr\b")) && OutLines(c).Count >= 2 && OutLines(c).Contains("/usr/bin"),
                },
                new()
                {
                    Id = "export",
                    Text = "Skapa miljövariabeln `{{favVar}}` med värdet `linux`.",
                    Hint = "Inga mellanslag runt likhetstecknet: `export NAMN=värde`.",
                    Solution = Cmds("export {{favVar}}=linux"),
                    Check = c => Env(c, "{{favVar}}") == "linux",
                },
                new()
                {
                    Id = "which",
                    Text = "Ta reda på i vilken katalog programmet `ls` ligger.",
                    Solution = Cmds("which ls"),
                    Check = c => Ran(c, Re(@"^(which|type)\s+ls\b")) && c.Output.Contains("/usr/bin/ls"),
                },
                new()
                {
                    Id = "alias",
                    Text = "Skapa aliaset `ll` som kör `ls -la`.",
                    Solution = Cmds("alias ll='ls -la'"),
                    Check = c => Re(@"^ls\s+-(la|al)$").IsMatch(c.Sh.Aliases.Get("ll") ?? ""),
                },
                new()
                {
                    Id = "exitcode",
                    Text = "Kör ett kommando som misslyckas, och visa sedan dess slutkod med `echo $?`.",
                    Hint = "Prova `ls /{{missing}}` följt av `echo $?`. Slutkoden ska inte vara 0.",
                    Solution = Cmds("ls /{{missing}}", "echo $?"),
                    Check = c => Re(@"(^|[;&]\s*)echo\s+""?\$\?""?\s*$").IsMatch(c.Line) && Re(@"^[1-9]\d*$").IsMatch(c.Output.Trim()),
                },
            },
        };
}
