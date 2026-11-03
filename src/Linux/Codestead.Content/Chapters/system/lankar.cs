namespace Codestead.Content;

// The chapter "lankar" (part "system"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Lankar() =>
        new()
        {
            Id = "lankar",
            Part = "system",
            Title = "Länkar och filinformation",
            Tasks = new()
            {
                new()
                {
                    Id = "symlink",
                    Text = "Skapa en symbolisk länk `~/log` som pekar på katalogen `/var/log`.",
                    Hint = "`ln -s MÅL LÄNKNAMN` – målet först: `ln -s /var/log ~/log`.",
                    Solution = Cmds("ln -s /var/log ~/log"),
                    Check = c => LinkNode(c, "~/log")?.Type == "link" && RealPath(c, "~/log") == "/var/log",
                },
                new()
                {
                    Id = "relative",
                    Text = "Stå i hemkatalogen och skapa länken `{{fruits}}` som pekar på `{{documents}}/{{fruits}}` – med en relativ sökväg.",
                    Hint = "`cd ~` och sedan `ln -s {{documents}}/{{fruits}} {{fruits}}`. En relativ sökväg i länken räknas från katalogen där länken ligger.",
                    Solution = Cmds("cd ~", "ln -s {{documents}}/{{fruits}} {{fruits}}"),
                    Check = c => LinkNode(c, "~/{{fruits}}") is { Type: "link" } l && !(l.Content ?? "").StartsWith('/') &&
                        RealPath(c, "~/{{fruits}}") == Abs(c, "~/{{documents}}/{{fruits}}"),
                },
                new()
                {
                    Id = "readlink",
                    Text = "Visa vart länken `~/{{fruits}}` pekar med `readlink`.",
                    Solution = Cmds("readlink ~/{{fruits}}"),
                    Check = c => Ran(c, Re(@"^readlink\b")) && c.Output.Contains(X(c, "{{documents}}/{{fruits}}"), StringComparison.Ordinal),
                },
                new()
                {
                    Id = "hardlink",
                    Text = "Ge `~/{{notes}}` ett namn till: en **hård** länk som heter `~/{{todo}}`.",
                    Hint = "`ln` utan `-s`: `ln ~/{{notes}} ~/{{todo}}`. Med `ls -li` ser du att båda har samma inodnummer.",
                    Solution = Cmds("ln ~/{{notes}} ~/{{todo}}"),
                    Check = c => LinkNode(c, "~/{{todo}}") is { Type: "file" } t && ReferenceEquals(t, LinkNode(c, "~/{{notes}}")),
                },
                new()
                {
                    Id = "stat",
                    Text = "Ta reda på rättigheterna för `/etc/shadow` som siffror med `stat`.",
                    Hint = "`stat /etc/shadow` och titta på raden `Access: (0640/...)` – eller bara `stat -c %a /etc/shadow`.",
                    Solution = Cmds("stat -c %a /etc/shadow"),
                    Check = c => Ran(c, Re(@"^stat\b.*\/etc\/shadow\b")) && Re(@"\b0?640\b").IsMatch(c.Output),
                },
                new()
                {
                    Id = "file",
                    Text = "Ta reda på vad `~/{{documents}}/{{grades}}` innehåller med `file`.",
                    Solution = Cmds("file ~/{{documents}}/{{grades}}"),
                    Check = c => Ran(c, Re(@"^file\b")) && c.Output.Contains("CSV", StringComparison.Ordinal),
                },
                new()
                {
                    Id = "umask",
                    Text = "Ändra umask så att nya filer bara kan läsas och skrivas av dig, och skapa sedan den tomma filen `~/{{privateFile}}`.",
                    Hint = "`umask 077` tar bort alla rättigheter för gruppen och övriga. Skapa sedan filen med `touch ~/{{privateFile}}` – den får `rw-------`.",
                    Solution = Cmds("umask 077", "touch ~/{{privateFile}}"),
                    Check = c => (c.Sh.Vfs.Umask & Js.Oct(77)) == Js.Oct(77) && Node(c, "~/{{privateFile}}") is { Type: "file" } f && (f.Mode & Js.Oct(777)) == Js.Oct(600),
                },
                new()
                {
                    Id = "umask-back",
                    Text = "Sätt tillbaka umask till det vanliga värdet `022`.",
                    Solution = Cmds("umask 022"),
                    Check = c => c.Sh.Vfs.Umask == Js.Oct(22) && Ran(c, Re(@"^umask\s")),
                },
            },
        };
}
