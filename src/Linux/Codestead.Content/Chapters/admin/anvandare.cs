namespace Codestead.Content;

// The chapter "anvandare" (part "admin"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Anvandare() =>
        new()
        {
            Id = "anvandare",
            Part = "admin",
            Title = "Användare och grupper",
            Tasks = new()
            {
                new()
                {
                    Id = "useradd",
                    Text = "Skapa användaren `kim` med en hemkatalog och `/bin/bash` som skal.",
                    Hint = "`sudo useradd -m -s /bin/bash kim` – `-m` skapar hemkatalogen och `-s` väljer skalet.",
                    Solution = Cmds("sudo useradd -m -s /bin/bash kim"),
                    Check = c =>
                    {
                        var kim = UsersLib.FindUser(c.Sh, "kim");
                        return kim is not null && Re(@"\/bash$").IsMatch(kim.Shell) && IsDir(c, kim.Home);
                    },
                },
                new()
                {
                    Id = "passwd-rad",
                    Text = "Visa kims rad i `/etc/passwd`.",
                    Hint = "`grep kim /etc/passwd` – eller `getent passwd kim`.",
                    Solution = Cmds("grep kim /etc/passwd"),
                    Check = c => c.ExitCode == 0 && Re("passwd").IsMatch(c.Line) && OutLines(c).Any(l => l.StartsWith("kim:x:", StringComparison.Ordinal)),
                },
                new()
                {
                    Id = "losenord",
                    Text = "Ge `kim` ett lösenord med `passwd`.",
                    Hint = "Bara root får sätta lösenord åt andra: `sudo passwd kim`. Skriv samma lösenord två gånger – det syns inte när du skriver.",
                    Solution = Cmds("sudo passwd kim", "{{password}}", "{{password}}"),
                    Check = c => (UsersLib.ShadowHash(c.Sh, "kim") ?? "").StartsWith('$'),
                },
                new()
                {
                    Id = "grupp",
                    Text = "Skapa gruppen `{{devGroup}}` och lägg till `kim` i den.",
                    Hint = "Först `sudo groupadd {{devGroup}}`, sedan `sudo usermod -aG {{devGroup}} kim`.",
                    Solution = Cmds("sudo groupadd {{devGroup}}", "sudo usermod -aG {{devGroup}} kim"),
                    Check = c => UsersLib.FindGroup(c.Sh, W(c)["devGroup"])?.Members.Contains("kim") == true,
                },
                new()
                {
                    Id = "sudo-ratt",
                    Text = "Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `sudo`.",
                    Hint = "`sudo usermod -aG sudo kim` – glöm inte `-a`!",
                    Solution = Cmds("sudo usermod -aG sudo kim"),
                    Check = c => UsersLib.FindGroup(c.Sh, "sudo")?.Members.Contains("kim") == true,
                },
                new()
                {
                    Id = "sudo-u",
                    Text = "Kör `whoami` som `kim` med `sudo -u`.",
                    Hint = "`sudo -u kim whoami`",
                    Solution = Cmds("sudo -u kim whoami"),
                    Check = c => Ran(c, Re(@"^sudo\s+(-\S+\s+)*-u\s*kim\s+whoami\s*$")) && OutLines(c).At(-1) == "kim",
                },
                new()
                {
                    Id = "su",
                    Text = "Logga in som `kim` med `su -` och kör `id`. Gå sedan tillbaka till `{{user}}` med `exit`.",
                    Hint = "Skriv `su - kim` och sedan kims lösenord – det du valde med `passwd`. Prompten visar att du är kim.",
                    Solution = Cmds("su - kim", "{{password}}", "id", "exit"),
                    Check = c => Ran(c, Re(@"^id\s*$")) && c.Sh.CurrentUser().Name == "kim",
                },
                new()
                {
                    Id = "userdel",
                    Text = "Skapa en tillfällig användare `{{tempUser}}` med hemkatalog – och ta sedan bort den igen, **inklusive** hemkatalogen.",
                    Hint = "`sudo useradd -m {{tempUser}}` och sedan `sudo userdel -r {{tempUser}}`.",
                    Solution = Cmds("sudo useradd -m {{tempUser}}", "sudo userdel -r {{tempUser}}"),
                    Check = c =>
                        c.ExitCode == 0 && Re(c, @"^(userdel|deluser)\b.*\b{{tempUser}}\b").IsMatch(Unsudo(c.Line)) && UsersLib.FindUser(c.Sh, W(c)["tempUser"]) is null && !Exists(c, "/home/{{tempUser}}"),
                },
            },
        };
}
