namespace Codestead.Content;

// The chapter "lasa-text" (part "grunder"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter LasaText() =>
        new()
        {
            Id = "lasa-text",
            Part = "grunder",
            Title = "Läsa och söka i text",
            Tasks = new()
            {
                new()
                {
                    Id = "head",
                    Text = "Visa de **3 första** raderna i `~/{{documents}}/server.log`.",
                    Solution = Cmds("head -n 3 ~/{{documents}}/server.log"),
                    Check = c => Ran(c, Re(@"^head\b")) && OutLines(c).Count == 3 && c.Output.Contains("Server starting"),
                },
                new()
                {
                    Id = "tail",
                    Text = "Visa de **2 sista** raderna i `~/{{documents}}/server.log`.",
                    Solution = Cmds("tail -n 2 ~/{{documents}}/server.log"),
                    Check = c => Ran(c, Re(@"^tail\b")) && OutLines(c).Count == 2 && c.Output.Contains("Rotating"),
                },
                new()
                {
                    Id = "grep",
                    Text = "Visa alla rader som innehåller `ERROR` i `~/{{documents}}/server.log`.",
                    Solution = Cmds("grep ERROR ~/{{documents}}/server.log"),
                    Check = c => Ran(c, Re(@"^grep\b")) && OutLines(c).Count == 3 && OutLines(c).All(l => l.Contains("ERROR")),
                },
                new()
                {
                    Id = "grep-i",
                    Text = "Sök efter `warn` i server.log **utan** att bry dig om stora eller små bokstäver.",
                    Hint = "Flaggan `-i` gör sökningen skiftlägesokänslig. Det ska bli 3 träffar.",
                    Solution = Cmds("grep -i warn ~/{{documents}}/server.log"),
                    Check = c => Ran(c, Re(@"^grep\b.*\s-\w*i")) && Re("warn", "i").IsMatch(c.Line) && (OutLines(c).Count == 3 || c.Output.Trim() == "3"),
                },
                new()
                {
                    Id = "wc",
                    Text = "Räkna hur många rader `~/{{documents}}/{{fruits}}` har.",
                    Solution = Cmds("wc -l ~/{{documents}}/{{fruits}}"),
                    Check = c => Ran(c, Re(@"\bwc\b.*-\w*l")) && Re(@"\b10\b").IsMatch(c.Output),
                },
                new()
                {
                    Id = "sort",
                    Text = "Visa frukterna i `~/{{documents}}/{{fruits}}` i bokstavsordning.",
                    Solution = Cmds("sort ~/{{documents}}/{{fruits}}"),
                    Check = c => Ran(c, Re(@"\bsort\b")) && c.Line.Contains(W(c)["fruits"], StringComparison.Ordinal) && OutLines(c).At(0) == SortedLines(c, W(c).File("fruits"))[0],
                },
                new()
                {
                    Id = "cut",
                    Text = "Visa bara ämnena – fält 2 – i `~/{{documents}}/{{grades}}` med `cut`.",
                    Hint = "Fälten skiljs åt av kommatecken: `-d,` väljer avgränsaren och `-f2` fältet.",
                    Solution = Cmds("cut -d, -f2 ~/{{documents}}/{{grades}}"),
                    Check = c =>
                        Ran(c, Re(@"^cut\b")) && OutLines(c).SequenceEqual(W(c).File("grades").Split('\n').Where(l => l.Trim() != "").Select(l => l.Split(',')[1])),
                },
            },
        };
}
