namespace Codestead.Content;

// The chapter "textbearbetning" (part "skript"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Textbearbetning() =>
        new()
        {
            Id = "textbearbetning",
            Part = "skript",
            Title = "Textbearbetning med sed och awk",
            Tasks = new()
            {
                new()
                {
                    Id = "sed-s",
                    Text = "Visa `~/{{documents}}/server.log` med ordet `ERROR` utbytt mot `{{errorWord}}` på alla rader, med `sed`.",
                    Hint = "Kommandot `s/gammalt/nytt/` byter ut text: `sed 's/ERROR/{{errorWord}}/' fil`",
                    Solution = Cmds("sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log"),
                    Check = c =>
                        Ran(c, Re(@"^sed\b")) && OutLines(c).Count == 15 && Re(c, "{{errorWord}} Could not connect").IsMatch(c.Output) && !c.Output.Contains("ERROR"),
                },
                new()
                {
                    Id = "sed-d",
                    Text = "Visa server.log **utan** alla rader som innehåller `INFO`, med `sed`.",
                    Hint = "Adressen `/INFO/` väljer raderna och kommandot `d` tar bort dem: `sed '/INFO/d' fil`",
                    Solution = Cmds("sed '/INFO/d' ~/{{documents}}/server.log"),
                    Check = c => Ran(c, Re(@"^sed\b")) && OutLines(c).Count == 6 && !c.Output.Contains("INFO"),
                },
                new()
                {
                    Id = "awk-print",
                    Text = "Skriv ut användarnamn och skal (fält 1 och 7) ur `/etc/passwd` med `awk`.",
                    Hint = "Fälten skiljs åt av kolon, så använd `-F:`. Programmet blir `'{print $1, $7}'`.",
                    Solution = Cmds("awk -F: '{print $1, $7}' /etc/passwd"),
                    Check = c =>
                        Ran(c, Re(@"^awk\b")) && OutLines(c).Any(l => Re(c, @"^{{user}}\b.*\/bin\/bash$").IsMatch(l) && !l.Contains("1000")),
                },
                new()
                {
                    Id = "awk-sum",
                    Text = "Räkna ut **summan** av poängen (kolumn 3) i `~/{{documents}}/{{grades}}` med `awk`.",
                    Hint = "Hoppa över rubrikraden med `NR > 1`, lägg ihop med `{{sumVar}} += $3` och skriv ut i `END { }`. Avgränsaren är komma: `-F,`.",
                    Solution = Cmds("awk -F, 'NR > 1 {{{sumVar}} += $3} END {print {{sumVar}}}' ~/{{documents}}/{{grades}}"),
                    Check = c => Ran(c, Re(@"\bawk\b")) && Re(@"(^|\D)590(\D|$)").IsMatch(c.Output),
                },
                new()
                {
                    Id = "sed-i",
                    Text = "Byt ut `Linux` mot `GNU/Linux` **direkt i filen** `~/{{notes}}`.",
                    Hint = "Använd `sed -i`. Eftersom ersättningen innehåller `/` är det enklast att byta avgränsare: `s|Linux|GNU/Linux|`.",
                    Solution = Cmds("sed -i 's|Linux|GNU/Linux|' ~/{{notes}}"),
                    Check = c =>
                        c.ExitCode == 0 && Re(@"^sed\b.*\s-\w*i").IsMatch(Unsudo(c.Line)) && Content(c, "~/{{notes}}").Contains("GNU/Linux"),
                },
            },
        };
}
