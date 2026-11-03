namespace Codestead.Content;

// The chapter "rattigheter" (part "system"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Rattigheter() =>
        new()
        {
            Id = "rattigheter",
            Part = "system",
            Title = "Användare, rättigheter och sudo",
            Tasks = new()
            {
                new()
                {
                    Id = "groups",
                    Text = "Ta reda på vilka grupper du tillhör.",
                    Solution = Cmds("groups"),
                    Check = c => Ran(c, Re(@"^(groups|id)\b")),
                },
                new()
                {
                    Id = "shadow",
                    Text = "Försök läsa `/etc/shadow` med `cat` – och gör det sedan med `sudo`.",
                    Solution = Cmds("cat /etc/shadow", "sudo cat /etc/shadow"),
                    Check = c => Ran(c, Re(@"^sudo\s+(cat|less|head|tail)\s+\/etc\/shadow\s*$")),
                },
                new()
                {
                    Id = "script",
                    Text = "Skapa skriptet `~/{{helloScript}}` som innehåller raden `echo {{helloScriptText}}`.",
                    Hint = "Använd enkla citattecken: `echo 'echo {{helloScriptText}}' > ~/{{helloScript}}`",
                    Solution = Cmds("echo 'echo {{helloScriptText}}' > ~/{{helloScript}}"),
                    Check = c => Re(c, @"echo\s+.*{{helloScriptText}}").IsMatch(Content(c, "~/{{helloScript}}")),
                },
                new()
                {
                    Id = "chmod-x",
                    Text = "Gör `~/{{helloScript}}` körbart.",
                    Solution = Cmds("chmod +x ~/{{helloScript}}"),
                    Check = c => (Mode(c, "~/{{helloScript}}") & Js.Oct(100)) != 0,
                },
                new()
                {
                    Id = "run-script",
                    Text = "Kör skriptet med `./{{helloScript}}` (stå i hemkatalogen).",
                    Solution = Cmds("cd ~", "./{{helloScript}}"),
                    Check = c => Ran(c, Re(c, @"(\.\/|~\/|\/home\/{{user}}\/){{helloScript}}\s*$")) && c.Output.Contains(W(c)["helloScriptText"]),
                },
                new()
                {
                    Id = "chmod-600",
                    Text = "Gör `~/{{notes}}` läsbar och skrivbar **bara** för dig (`rw-------`).",
                    Hint = "r = 4, w = 2, x = 1. Ägaren ska ha 4 + 2 och övriga 0.",
                    Solution = Cmds("chmod 600 ~/{{notes}}"),
                    Check = c => (Mode(c, "~/{{notes}}") & Js.Oct(777)) == Js.Oct(600),
                },
            },
        };
}
