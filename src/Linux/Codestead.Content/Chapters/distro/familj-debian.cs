namespace Codestead.Content;

// The chapter "familj-debian" (part "distro"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter FamiljDebian() =>
        new()
        {
            Id = "familj-debian",
            Part = "distro",
            Family = "debian",
            Title = "Debian-familjen: apt och PPA",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Hämta de senaste paketlistorna med `apt update`.",
                    Hint = "Kommandot ändrar systemet och kräver root: `sudo apt update`.",
                    Solution = Cmds("sudo apt update"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`apt search htop`",
                    Solution = Cmds("apt search htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^apt(-cache)?\s+search\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo apt install tree`",
                    Solution = Cmds("sudo apt install tree"),
                    Check = c => Installed(c, "tree"),
                },
                new()
                {
                    Id = "run-tree",
                    Text = "Kör `tree` i din hemkatalog.",
                    Solution = Cmds("cd ~", "tree"),
                    Check = c => Ran(c, Re(@"^tree\b")) && Installed(c, "tree"),
                },
                new()
                {
                    Id = "remove",
                    Text = "Ta bort paketet `tree` igen.",
                    Hint = "`sudo apt remove tree`",
                    Solution = Cmds("sudo apt remove tree", "y"),
                    Check = c => Re(@"^apt(-get)?\s+(remove|purge)\b.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "Efter `sudo apt update` kör du `sudo apt upgrade`.",
                    Solution = Cmds("sudo apt update", "sudo apt upgrade", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Se till att du har kommandot `add-apt-repository`. Det finns i paketet `software-properties-common` – förinstallerat i Ubuntu, men inte i Debian.",
                    Hint = "`sudo apt update` och sedan `sudo apt install software-properties-common`.",
                    Solution = Cmds("sudo apt update", "sudo apt install software-properties-common"),
                    Check = c =>
                        Installed(c, "software-properties-common") &&
                        Ran(c, Re(@"\badd-apt-repository\b|\bapt(-get)?\s+install\b.*\bsoftware-properties-common\b")),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Lägg till PPA:t `ppa:lunatool/moonphase`.",
                    Hint = "`sudo add-apt-repository ppa:lunatool/moonphase` – och tryck Enter när den frågar.",
                    Solution = Cmds("sudo add-apt-repository -y ppa:lunatool/moonphase"),
                    Check = c =>
                        Re(@"\badd-apt-repository\b").IsMatch(c.Line) && IsFile(c, PpaFile) && ExtrarepoLib.ExtraRepoEnabled(c.Sh, "ppa:lunatool/moonphase"),
                },
                new()
                {
                    Id = "granska",
                    Text = "Titta i filen som `add-apt-repository` skapade i `/etc/apt/sources.list.d/`.",
                    Hint = "`ls /etc/apt/sources.list.d` och sedan `cat` på filen vars namn börjar med `lunatool`.",
                    // The PPA file name is computed when the solution is shown (TS: `cat ${PPA_FILE}`).
                    Solution = new PerDistro<List<string>>(_ => Cmds("ls /etc/apt/sources.list.d", $"cat {PpaFile}")),
                    Check = c => Ran(c, Re(@"^(cat|less|more|head|tail|grep)\b")) && c.Output.Contains("ppa.launchpadcontent.net/lunatool/moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Installera paketet `moonphase` från PPA:t.",
                    Hint = "`add-apt-repository` körde redan `apt update` åt dig, så `sudo apt install moonphase` räcker.",
                    Solution = Cmds("sudo apt install moonphase"),
                    Check = c => Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "kor",
                    Text = "Kör programmet `moonphase`.",
                    Solution = Cmds("moonphase"),
                    Check = c => Ran(c, Re(@"^moonphase\b")) && Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "ursprung",
                    Text = "Ta reda på varifrån `moonphase` kommer.",
                    Hint = "`apt policy moonphase`",
                    Solution = Cmds("apt policy moonphase"),
                    Check = c => Ran(c, Re(@"^apt\s+policy\b.*\bmoonphase\b")) && c.Output.Contains("ppa.launchpadcontent.net"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Ta bort PPA:t igen. Programmet blir kvar, men får inga fler uppdateringar.",
                    Hint = "`sudo add-apt-repository --remove ppa:lunatool/moonphase`",
                    Solution = Cmds("sudo add-apt-repository -y --remove ppa:lunatool/moonphase"),
                    Check = c => Re(@"\badd-apt-repository\b.*\s(-\w*r|--remove)\b|^rm\b").IsMatch(Unsudo(c.Line)) && !IsFile(c, PpaFile),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim.",
                    Hint = "Sök med `apt search vim`. Paketet heter `vim`.",
                    Solution = Cmds("sudo apt update", "sudo apt install vim"),
                    Check = c => Installed(c, "vim"),
                },
            },
        };
}
