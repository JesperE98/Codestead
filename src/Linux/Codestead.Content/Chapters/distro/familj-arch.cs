namespace Codestead.Content;

// The chapter "familj-arch" (part "distro"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter FamiljArch() =>
        new()
        {
            Id = "familj-arch",
            Part = "distro",
            Family = "arch",
            Title = "Arch-familjen: pacman och AUR",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Synkronisera paketdatabasen och uppgradera systemet med `pacman -Syu`.",
                    Hint = "Kommandot ändrar systemet och kräver root: `sudo pacman -Syu`.",
                    Solution = Cmds("sudo pacman -Syu", "y"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`pacman -Ss htop`",
                    Solution = Cmds("pacman -Ss htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^pacman\s+-Ss\w*\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo pacman -S tree` och svara ja på frågan.",
                    Solution = Cmds("sudo pacman -S tree", "y"),
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
                    Hint = "`sudo pacman -R tree`",
                    Solution = Cmds("sudo pacman -R tree", "y"),
                    Check = c => Re(@"^pacman\s+-R\w*\s+.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "`sudo pacman -Syu` gör allt på en gång.",
                    Solution = Cmds("sudo pacman -Syu", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Installera det som behövs för att bygga paket från AUR: `git` och `base-devel`.",
                    Hint = "`sudo pacman -S --needed git base-devel`",
                    Solution = Cmds("sudo pacman -S --needed git base-devel", "y"),
                    Check = c => Installed(c, "git") && Installed(c, "base-devel"),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Hämta byggreceptet för AUR-paketet `moonphase` till din hemkatalog med `git clone`. Adressen är `https://aur.archlinux.org/moonphase.git`.",
                    Hint = "`cd ~` och sedan `git clone https://aur.archlinux.org/moonphase.git`",
                    Solution = Cmds("cd ~", "git clone https://aur.archlinux.org/moonphase.git"),
                    Check = c => Ran(c, Re(@"\bgit\s+clone\s+.*aur\.archlinux\.org\/moonphase(\.git)?\b")),
                },
                new()
                {
                    Id = "granska",
                    Text = "Läs byggreceptet `PKGBUILD` innan du bygger något!",
                    Hint = "`cd ~/moonphase` och sedan `less PKGBUILD` (eller `cat PKGBUILD`).",
                    Solution = Cmds("cd ~/moonphase", "less PKGBUILD"),
                    Check = c => Ran(c, Re(@"^(cat|less|more|head|tail)\b.*PKGBUILD")) && c.Output.Contains("pkgname=moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Bygg och installera `moonphase` med `makepkg`.",
                    Hint = "Stå i katalogen `~/moonphase` och kör `makepkg -si` – utan sudo!",
                    Solution = Cmds("cd ~/moonphase", "makepkg -si", "y"),
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
                    Text = "Lista alla installerade paket som inte kommer från Archs egna förråd.",
                    Hint = "Sådana paket kallas *foreign*: `pacman -Qm`",
                    Solution = Cmds("pacman -Qm"),
                    Check = c => Ran(c, Re(@"^(pacman|yay)\s+-Q\w*m")) && c.Output.Contains("moonphase"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Bonus: installera AUR-hjälparen `yay` (AUR-paketet `yay-bin`) och använd den för att installera AUR-paketet `snowfall`.",
                    Hint = "Som förut: `cd ~`, `git clone https://aur.archlinux.org/yay-bin.git`, `cd yay-bin` och `makepkg -si`. Sedan `yay -S snowfall` – utan sudo.",
                    Solution = Cmds("cd ~", "git clone https://aur.archlinux.org/yay-bin.git", "cd yay-bin", "makepkg -si", "y", "yay -S snowfall", "y"),
                    Check = c => Installed(c, "snowfall"),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim.",
                    Hint = "Sök med `pacman -Ss vim`. Paketet heter `vim`.",
                    Solution = Cmds("sudo pacman -S vim", "y"),
                    Check = c => Installed(c, "vim"),
                },
            },
        };
}
