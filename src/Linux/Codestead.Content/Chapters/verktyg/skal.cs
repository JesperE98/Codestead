namespace Codestead.Content;

// The chapter "skal" (part "verktyg"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Skal() =>
        new()
        {
            Id = "skal",
            Part = "verktyg",
            Title = "Andra skal: zsh och fish",
            Tasks = new()
            {
                new()
                {
                    Id = "installera-zsh",
                    Text = "Installera skalet `zsh`.",
                    Hint = "`sudo apt update` och sedan `sudo apt install zsh`.",
                    Solution = Cmds("sudo apt update", "sudo apt install zsh"),
                    Check = c => Installed(c, "zsh"),
                },
                new()
                {
                    Id = "starta-zsh",
                    Text = "Starta `zsh`. Första gången frågar *zsh-newuser-install* vad du vill göra – svara `2`. Visa sedan vilket skal du kör med `echo $0`.",
                    Hint = "Skriv `zsh`, svara `2` och skriv sedan `echo $0`. Det ska stå `zsh`.",
                    Solution = Cmds("zsh", "2", "echo $0"),
                    Check = c => c.Sh.ShellMode == "zsh" && Ran(c, Re(@"^echo\s+[""']?\$\{?0\}?[""']?\s*$")) && c.Output.Trim() == "zsh",
                },
                new()
                {
                    Id = "globstar",
                    Text = "Använd zsh:s `**` för att lista alla `.txt`-filer i hemkatalogen **och alla underkataloger** med ett enda `ls`.",
                    Hint = "`ls ~/**/*.txt` – `**` betyder \"alla kataloger, på alla nivåer\".",
                    Solution = Cmds("ls ~/**/*.txt"),
                    Check = c => c.Sh.ShellMode == "zsh" && Ran(c, Re(@"\*\*\/")) && c.Output.Contains(X(c, "{{documents}}/{{fruits}}")),
                },
                new()
                {
                    Id = "tillbaka",
                    Text = "Lämna zsh och gå tillbaka till bash.",
                    Hint = "Skriv `exit`. Kontrollera gärna med `echo $0` eller `ps`.",
                    Solution = Cmds("exit"),
                    Check = c => Flag(c, "left:zsh") && c.Sh.ShellMode == "bash",
                },
                new()
                {
                    Id = "installera-fish",
                    Text = "Installera skalet `fish`.",
                    Hint = "`sudo apt update` och sedan `sudo apt install fish`.",
                    Solution = Cmds("sudo apt update", "sudo apt install fish"),
                    Check = c => Installed(c, "fish"),
                },
                new()
                {
                    Id = "fish-set",
                    Text = "Starta `fish`. Skapa variabeln `{{fruitVar}}` med värdet `{{fruitWord}}` på fish-sättet och skriv ut den med `echo`.",
                    Hint = "`{{fruitVar}}={{fruitWord}}` fungerar inte i fish. Skriv `set {{fruitVar}} {{fruitWord}}` och sedan `echo ${{fruitVar}}`.",
                    Solution = Cmds("fish", "set {{fruitVar}} {{fruitWord}}", "echo ${{fruitVar}}"),
                    Check = c => c.Sh.ShellMode == "fish" && Ran(c, Re(c, @"^echo\b.*\${{fruitVar}}\b")) && Env(c, "{{fruitVar}}") == W(c)["fruitWord"] && c.Output.Trim() == W(c)["fruitWord"],
                },
                new()
                {
                    Id = "fish-for",
                    Text = "Skriv en `for`-loop med fish-syntax som skriver ut talen 1, 2 och 3, ett per rad. Gå sedan tillbaka till bash med `exit`.",
                    Hint = "I fish finns inget `do` och `done` – blocket avslutas med `end`: `for i in 1 2 3; echo $i; end`",
                    Solution = Cmds("for i in 1 2 3; echo $i; end", "exit"),
                    Check = c => c.Sh.ShellMode == "fish" && Ran(c, Re(@"^for\b.*\bend\s*$")) && string.Join(",", OutLines(c)) == "1,2,3",
                },
                new()
                {
                    Id = "chsh",
                    Text = "Se efter i `/etc/shells` vilka skal som är installerade. Gör sedan zsh till ditt inloggningsskal med `chsh`.",
                    Hint = "`cat /etc/shells` och sedan `chsh -s /usr/bin/zsh`. Kontrollera resultatet med `grep {{user}} /etc/passwd`.",
                    Solution = Cmds("cat /etc/shells", "chsh -s /usr/bin/zsh"),
                    Check = c => Re(c, @"^{{user}}:.*:\/(usr\/)?bin\/zsh$", "m").IsMatch(Content(c, "/etc/passwd")),
                },
            },
        };
}
