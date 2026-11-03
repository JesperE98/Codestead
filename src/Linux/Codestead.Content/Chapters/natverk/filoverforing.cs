namespace Codestead.Content;

// The chapter "filoverforing" (part "natverk"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Filoverforing() =>
        new()
        {
            Id = "filoverforing",
            Part = "natverk",
            Title = "Filöverföring och SSH-inställningar",
            Tasks = new()
            {
                new()
                {
                    Id = "config",
                    Text = "Skapa `~/.ssh/config` så att `ssh srv` loggar in som `{{user}}` på `192.168.1.10`. Kör sedan `hostname` på servern med `ssh srv`.",
                    Hint = "Tre rader: `Host srv`, `    HostName 192.168.1.10` och `    User {{user}}`. Skriv dem med `echo ... >> ~/.ssh/config` och kör sedan `ssh srv hostname`.",
                    Solution = Cmds(
                        "mkdir -p ~/.ssh",
                        "echo 'Host srv' > ~/.ssh/config",
                        "echo '    HostName 192.168.1.10' >> ~/.ssh/config",
                        "echo '    User {{user}}' >> ~/.ssh/config",
                        "chmod 600 ~/.ssh/config",
                        "ssh srv hostname",
                        "yes"),
                    Check = c => Ran(c, Re(@"^ssh\s+(-\S+\s+)*srv\s+hostname\b")) && OutLines(c).Any(l => l.Trim() == "server"),
                },
                new()
                {
                    Id = "scp-up",
                    Text = "Kopiera `~/{{notes}}` till din hemkatalog på servern med `scp`.",
                    Hint = "`scp ~/{{notes}} srv:` – kolonet efter `srv` betyder \"på servern\", och utan sökväg hamnar filen i hemkatalogen där.",
                    Solution = Cmds("scp ~/{{notes}} srv:"),
                    Check = c => Ran(c, Re(@"^scp\b")) && ServerNode(c, "~/{{notes}}")?.Type == "file",
                },
                new()
                {
                    Id = "scp-down",
                    Text = "Hämta filen `{{welcomeFile}}` från hemkatalogen på servern till katalogen `~/{{downloads}}`.",
                    Hint = "Källan först, målet sist: `scp srv:{{welcomeFile}} ~/{{downloads}}/`.",
                    Solution = Cmds("scp srv:{{welcomeFile}} ~/{{downloads}}/"),
                    Check = c => Ran(c, Re(@"^scp\b")) && IsFile(c, "~/{{downloads}}/{{welcomeFile}}"),
                },
                new()
                {
                    Id = "rsync-local",
                    Text = "Säkerhetskopiera innehållet i `~/{{documents}}` till katalogen `/tmp/{{documents}}` med `rsync -av`.",
                    Hint = "Snedstrecket efter källan betyder \"innehållet i\": `rsync -av ~/{{documents}}/ /tmp/{{documents}}`.",
                    Solution = Cmds("rsync -av ~/{{documents}}/ /tmp/{{documents}}"),
                    Check = c => Ran(c, Re(@"^rsync\b")) && IsFile(c, "/tmp/{{documents}}/{{fruits}}"),
                },
                new()
                {
                    Id = "rsync-again",
                    Text = "Skapa filen `~/{{documents}}/{{todo}}` och kör samma `rsync -av` igen. Bara den nya filen ska skickas.",
                    Hint = "`touch ~/{{documents}}/{{todo}}` och sedan `rsync -av ~/{{documents}}/ /tmp/{{documents}}`. Utan `-a` skickas allt varje gång.",
                    Solution = Cmds("touch ~/{{documents}}/{{todo}}", "rsync -av ~/{{documents}}/ /tmp/{{documents}}"),
                    Check = c => Ran(c, Re(@"^rsync\b")) && IsFile(c, "/tmp/{{documents}}/{{todo}}") && RsyncFiles(c).SequenceEqual(new[] { W(c)["todo"] }),
                },
                new()
                {
                    Id = "rsync-server",
                    Text = "Synka innehållet i `~/{{documents}}` till katalogen `{{documents}}` i din hemkatalog på servern.",
                    Hint = "Samma som förut, men med servern som mål: `rsync -av ~/{{documents}}/ srv:{{documents}}/`.",
                    Solution = Cmds("rsync -av ~/{{documents}}/ srv:{{documents}}/"),
                    Check = c => Ran(c, Re(@"^rsync\b")) && ServerNode(c, "~/{{documents}}/{{fruits}}")?.Type == "file",
                },
                new()
                {
                    Id = "dry-run",
                    Text = "Ta bort `~/{{documents}}/{{todo}}` och provkör sedan `rsync -av --delete` till `/tmp/{{documents}}` med `-n` – så att du ser vad som skulle tas bort, utan att något händer.",
                    Hint = "`rm ~/{{documents}}/{{todo}}` och sedan `rsync -avn --delete ~/{{documents}}/ /tmp/{{documents}}`.",
                    Solution = Cmds("rm ~/{{documents}}/{{todo}}", "rsync -avn --delete ~/{{documents}}/ /tmp/{{documents}}"),
                    Check = c => Ran(c, Re(@"^rsync\b.*--delete")) && c.Output.Contains("(DRY RUN)", StringComparison.Ordinal) &&
                        c.Output.Contains("deleting " + W(c)["todo"], StringComparison.Ordinal) && IsFile(c, "/tmp/{{documents}}/{{todo}}"),
                },
            },
        };
}
