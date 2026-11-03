using Codestead.Shell.Commands;

namespace Codestead.Content;

// The chapter "arkiv" (part "system"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Arkiv() =>
        new()
        {
            Id = "arkiv",
            Part = "system",
            Title = "Arkiv och komprimering",
            Tasks = new()
            {
                new()
                {
                    Id = "tar-czf",
                    Text = "Packa ihop katalogen `~/{{documents}}` till det komprimerade arkivet `~/{{documents}}.tar.gz`.",
                    Hint = "Stå i hemkatalogen och använd *create zipped verbose file*: `tar -czvf {{documents}}.tar.gz {{documents}}`.",
                    Solution = Cmds("cd ~", "tar -czvf {{documents}}.tar.gz {{documents}}"),
                    Check = c => ArchiveHas(c, "~/{{documents}}.tar.gz", "tar.gz", "{{documents}}/{{fruits}}"),
                },
                new()
                {
                    Id = "tar-t",
                    Text = "Lista innehållet i `~/{{documents}}.tar.gz` – utan att packa upp det.",
                    Hint = "`t` betyder lista: `tar -tzvf ~/{{documents}}.tar.gz`.",
                    Solution = Cmds("tar -tzvf ~/{{documents}}.tar.gz"),
                    Check = c => Ran(c, Re(@"\btar\b")) && TarOps(c.Line) == "t" && c.Output.Contains(X(c, "{{documents}}/server.log")),
                },
                new()
                {
                    Id = "tar-x",
                    Text = "Skapa katalogen `~/{{unpacked}}` och packa upp `~/{{documents}}.tar.gz` i den.",
                    Hint = "Med `-C` väljer du var tar packar upp: `tar -xzvf ~/{{documents}}.tar.gz -C ~/{{unpacked}}`.",
                    Solution = Cmds("mkdir ~/{{unpacked}}", "tar -xzvf ~/{{documents}}.tar.gz -C ~/{{unpacked}}"),
                    Check = c => TarOps(c.Line).Contains('x') && IsFile(c, "~/{{unpacked}}/{{documents}}/{{fruits}}"),
                },
                new()
                {
                    Id = "gzip",
                    Text = "Kopiera `~/{{documents}}/server.log` till din hemkatalog och komprimera kopian med `gzip`, så att du får `~/server.log.gz`.",
                    Hint = "Först `cp ~/{{documents}}/server.log ~`, sedan `gzip ~/server.log`.",
                    Solution = Cmds("cp ~/{{documents}}/server.log ~", "gzip -v ~/server.log"),
                    Check = c => ArchiveCmd.GunzipString(Content(c, "~/server.log.gz"))?.D.Contains("Server starting") ?? false,
                },
                new()
                {
                    Id = "zcat",
                    Text = "Visa raderna med `ERROR` i `~/server.log.gz` – utan att packa upp filen.",
                    Hint = "`zcat` skriver ut innehållet i en .gz-fil. Skicka det vidare till `grep` med en pipe.",
                    Solution = Cmds("zcat ~/server.log.gz | grep ERROR"),
                    Check = c =>
                        Ran(c, Re(@"\bzcat\b|\bgunzip\s+-\w*c|\bgzip\s+-\w*(d\w*c|c\w*d)")) &&
                        IsFile(c, "~/server.log.gz") &&
                        ((OutLines(c).Count == 3 && OutLines(c).All(l => l.Contains("ERROR"))) || c.Output.Trim() == "3"),
                },
                new()
                {
                    Id = "zip",
                    Text = "Installera paketen `zip` och `unzip`, och packa sedan ihop `~/{{documents}}` till `~/{{documents}}.zip`.",
                    Hint = "Kör `sudo apt update` och `sudo apt install zip unzip`. Glöm inte `-r` till zip: `zip -r {{documents}}.zip {{documents}}`.",
                    Solution = Cmds("sudo apt update", "sudo apt install zip unzip", "cd ~", "zip -r {{documents}}.zip {{documents}}"),
                    Check = c => ArchiveHas(c, "~/{{documents}}.zip", "zip", "{{documents}}/{{fruits}}"),
                },
                new()
                {
                    Id = "unzip",
                    Text = "Packa upp `~/{{documents}}.zip` i den nya katalogen `~/{{fromZip}}` med `unzip`.",
                    Hint = "`-d` väljer katalog och skapar den om den saknas: `unzip ~/{{documents}}.zip -d ~/{{fromZip}}`.",
                    Solution = Cmds("unzip ~/{{documents}}.zip -d ~/{{fromZip}}"),
                    Check = c =>
                        Re(@"\bunzip\b").IsMatch(c.Line) &&
                        (IsFile(c, "~/{{fromZip}}/{{documents}}/{{fruits}}") || IsFile(c, "~/{{fromZip}}/home/{{user}}/{{documents}}/{{fruits}}")),
                },
            },
        };
}
