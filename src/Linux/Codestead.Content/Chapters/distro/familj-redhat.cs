namespace Codestead.Content;

// The chapter "familj-redhat" (part "distro"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter FamiljRedhat() =>
        new()
        {
            Id = "familj-redhat",
            Part = "distro",
            Family = "redhat",
            Title = "Red Hat-familjen: dnf och COPR",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Hämta ny paketinformation och se om det finns uppdateringar med `dnf check-update`.",
                    Hint = "`dnf check-update` behöver inte root.",
                    Solution = Cmds("dnf check-update"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`dnf search htop`",
                    Solution = Cmds("dnf search htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^dnf5?\s+search\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo dnf install tree` – och svara `y`, eftersom Nej är standard!",
                    Solution = Cmds("sudo dnf install tree", "y"),
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
                    Hint = "`sudo dnf remove tree`",
                    Solution = Cmds("sudo dnf remove tree", "y"),
                    Check = c => Re(@"^dnf5?\s+(remove|rm|erase)\b.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "`sudo dnf upgrade`",
                    Solution = Cmds("sudo dnf upgrade", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Visa vilka förråd dnf använder just nu.",
                    Hint = "`dnf repolist`",
                    Solution = Cmds("dnf repolist"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+repolist\b")),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Aktivera COPR-förrådet `lunatool/moonphase`.",
                    Hint = "`sudo dnf copr enable lunatool/moonphase` – och svara `y`, Nej är standard.",
                    Solution = Cmds("sudo dnf copr enable lunatool/moonphase", "y"),
                    Check = c => Re(@"\bcopr\s+enable\b").IsMatch(c.Line) && ExtrarepoLib.ExtraRepoEnabled(c.Sh, "copr:lunatool/moonphase"),
                },
                new()
                {
                    Id = "granska",
                    Text = "Lista vilka COPR-förråd som är tillagda.",
                    Hint = "`dnf copr list`",
                    Solution = Cmds("dnf copr list"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+copr\s+list\b")) && c.Output.Contains("lunatool/moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Installera paketet `moonphase` från COPR-förrådet.",
                    Hint = "`sudo dnf install moonphase`",
                    Solution = Cmds("sudo dnf install moonphase", "y"),
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
                    Text = "Ta reda på från vilket förråd `moonphase` installerades.",
                    Hint = "`dnf info moonphase` – titta på raden `From repository`.",
                    Solution = Cmds("dnf info moonphase"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+info\b.*\bmoonphase\b")) && c.Output.Contains("copr:"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Stäng av COPR-förrådet igen. Programmet blir kvar, men får inga fler uppdateringar.",
                    Hint = "`sudo dnf copr disable lunatool/moonphase`",
                    Solution = Cmds("sudo dnf copr disable lunatool/moonphase"),
                    Check = c => Re(@"\bcopr\s+(disable|remove)\b").IsMatch(c.Line) && !ExtrarepoLib.ExtraRepoEnabled(c.Sh, "copr:lunatool/moonphase"),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim. Tips: paketet heter inte `vim` i Red Hat-familjen!",
                    Hint = "Sök med `dnf search vim`. Paketet heter `vim-enhanced`.",
                    Solution = Cmds("sudo dnf install vim-enhanced", "y"),
                    Check = c => Installed(c, "vim"),
                },
            },
        };
}
