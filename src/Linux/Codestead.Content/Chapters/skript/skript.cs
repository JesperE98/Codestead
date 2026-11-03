namespace Codestead.Content;

// The chapter "skript" (part "skript"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Skript() =>
        new()
        {
            Id = "skript",
            Part = "skript",
            Title = "Shell-skript",
            Tasks = new()
            {
                new()
                {
                    Id = "variabel",
                    Text = "Skapa variabeln `{{nameVar}}` med ditt namn, och skriv sedan ut `{{hello}}` följt av namnet med `echo`.",
                    Hint = "Inga mellanslag runt `=`: `{{nameVar}}=Kim`. Använd sedan `echo \"{{hello}} ${{nameVar}}\"`.",
                    Solution = Cmds("{{nameVar}}=Kim", "echo \"{{hello}} ${{nameVar}}\""),
                    Check = c => Ran(c, Re(c, @"^echo\b.*\$\{?{{nameVar}}\b")) && !string.IsNullOrEmpty(Env(c, "{{nameVar}}")) && c.Output.Trim() == $"{W(c)["hello"]} {Env(c, "{{nameVar}}")}",
                },
                new()
                {
                    Id = "rakna",
                    Text = "Räkna ut 17 × 23 med `$(( ))`.",
                    Solution = Cmds("echo $(( 17 * 23 ))"),
                    Check = c => Ran(c, Re(@"\$\(\(")) && c.Output.Trim() == "391",
                },
                new()
                {
                    Id = "substitution",
                    Text = "Spara antalet rader i `~/{{documents}}/server.log` i variabeln `{{linesVar}}`, med `$(...)` och `wc -l`.",
                    Hint = "`wc -l < fil` skriver bara ut antalet, utan filnamnet: `{{linesVar}}=$(wc -l < ~/{{documents}}/server.log)`",
                    Solution = Cmds("{{linesVar}}=$(wc -l < ~/{{documents}}/server.log)"),
                    Check = c => (Env(c, "{{linesVar}}") ?? "").Trim() == "15",
                },
                new()
                {
                    Id = "if",
                    Text = "Skriv ett `if`-villkor som skriver ut `{{exists}}` om filen `~/.bashrc` finns.",
                    Hint = "`if [ -f ~/.bashrc ]; then echo {{exists}}; fi` – glöm inte mellanslagen innanför hakparenteserna.",
                    Solution = Cmds("if [ -f ~/.bashrc ]; then echo {{exists}}; fi"),
                    Check = c => Ran(c, Re(@"^if\b")) && Re(@"\[|\btest\b").IsMatch(c.Line) && c.Output.Trim() == W(c)["exists"],
                },
                new()
                {
                    Id = "for",
                    Text = "Skriv ut talen 1 till 5, ett per rad, med en `for`-loop.",
                    Hint = "Antingen `for i in 1 2 3 4 5; do ...; done` eller `for i in $(seq 1 5); do ...; done`.",
                    Solution = Cmds("for i in 1 2 3 4 5; do echo $i; done"),
                    Check = c => Ran(c, Re(@"^for\b")) && string.Join(",", OutLines(c)) == "1,2,3,4,5",
                },
                new()
                {
                    Id = "while-read",
                    Text = "Läs `~/{{documents}}/{{fruits}}` rad för rad med `while read` och skriv ut `{{fruitLabel}}: ` framför varje rad.",
                    Hint = "`while read {{lineVar}}; do echo \"{{fruitLabel}}: ${{lineVar}}\"; done < ~/{{documents}}/{{fruits}}`",
                    Solution = Cmds("while read {{lineVar}}; do echo \"{{fruitLabel}}: ${{lineVar}}\"; done < ~/{{documents}}/{{fruits}}"),
                    Check = c => Ran(c, Re(@"\bwhile\s+read\b")) && OutLines(c).Count == 10 && OutLines(c).At(0) == $"{W(c)["fruitLabel"]}: {W(c).File("fruits").Split('\n')[0]}",
                },
                new()
                {
                    Id = "funktion",
                    Text = "Skapa funktionen `{{doubleFn}}` som skriver ut sitt första argument gånger två. Testa med `{{doubleFn}} 21`.",
                    Hint = "`{{doubleFn}}() { echo $(( $1 * 2 )); }` – och sedan `{{doubleFn}} 21`.",
                    Solution = Cmds("{{doubleFn}}() { echo $(( $1 * 2 )); }", "{{doubleFn}} 21"),
                    Check = c => Ran(c, Re(c, @"^{{doubleFn}}\s+21\s*$")) && c.Sh.Functions.ContainsKey(W(c)["doubleFn"]) && c.Output.Trim() == "42",
                },
                new()
                {
                    Id = "backup",
                    Text = "Skriv skriptet `~/backup.sh` som kopierar filen i första argumentet till samma namn med `.bak` på slutet. Gör det körbart och kör `./backup.sh {{notes}}` i hemkatalogen.",
                    Hint = "Skapa filen med `cat > ~/backup.sh << '{{heredocEnd}}'`, skriv `#!/bin/bash` och `cp \"$1\" \"$1.bak\"` på varsin rad och avsluta med `{{heredocEnd}}`.",
                    Solution = Cmds("cat > ~/backup.sh << '{{heredocEnd}}'", "#!/bin/bash", "cp \"$1\" \"$1.bak\"", "{{heredocEnd}}", "chmod +x ~/backup.sh", "cd ~", "./backup.sh {{notes}}"),
                    Check = c =>
                        Ran(c, Re(c, @"backup\.sh\s+{{notes}}\s*$")) && Content(c, "~/backup.sh").Contains("$1") && IsFile(c, "~/{{notes}}.bak"),
                },
            },
        };
}
