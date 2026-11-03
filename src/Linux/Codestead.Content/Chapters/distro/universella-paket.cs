namespace Codestead.Content;

// The chapter "universella-paket" (part "distro"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter UniversellaPaket() =>
        new()
        {
            Id = "universella-paket",
            Part = "distro",
            Title = "Flatpak, Snap och AppImage",
            Tasks = new()
            {
                new()
                {
                    Id = "flatpak",
                    PerFamily = true,
                    Text = ByFamily(
                        debian: "Installera Flatpak (paketet `flatpak`).",
                        arch: "Installera Flatpak (paketet `flatpak`).",
                        redhat: "Flatpak finns redan i Fedora Workstation. Kontrollera vilken version du har."),
                    Hint = ByFamily(
                        debian: "`sudo apt update` och sedan `sudo apt install flatpak`.",
                        arch: "`sudo pacman -S flatpak`",
                        redhat: "`flatpak --version`"),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install flatpak"),
                        arch: Cmds("sudo pacman -S flatpak", "y"),
                        redhat: Cmds("flatpak --version")),
                    Check = c => Ran(c, Re(@"\bflatpak\b")) && Installed(c, "flatpak"),
                },
                new()
                {
                    Id = "flathub",
                    PerFamily = true,
                    Text = "Lägg till Flathub som källa (*remote*) för Flatpak.",
                    Hint = "`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`",
                    Solution = Cmds("flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"),
                    Check = c =>
                        Ran(c, Re(@"^flatpak\s+remote-add\b")) &&
                        new[] { Content(c, "/var/lib/flatpak/repo/config"), Content(c, "~/.local/share/flatpak/repo/config") }
                            .Any(t => t.Contains("[remote \"flathub\"]")),
                },
                new()
                {
                    Id = "gimp",
                    PerFamily = true,
                    Text = "Installera bildredigeringsprogrammet GIMP (`org.gimp.GIMP`) från Flathub.",
                    Hint = "`flatpak install flathub org.gimp.GIMP` – och svara ja.",
                    Solution = Cmds("flatpak install flathub org.gimp.GIMP", "y"),
                    Check = c => IsDir(c, "/var/lib/flatpak/app/org.gimp.GIMP") || IsDir(c, "~/.local/share/flatpak/app/org.gimp.GIMP"),
                },
                new()
                {
                    Id = "flatpak-run",
                    PerFamily = true,
                    Text = "Starta GIMP med `flatpak run`.",
                    Hint = "Program startas med sitt fullständiga id: `flatpak run org.gimp.GIMP`",
                    Solution = Cmds("flatpak run org.gimp.GIMP"),
                    Check = c => Ran(c, Re(@"^flatpak\s+run\s+(\S+\s+)*org\.gimp\.GIMP\b")),
                },
                new()
                {
                    Id = "snap",
                    PerFamily = true,
                    Text = ByFamily(
                        debian: "Installera snap-paketet `hello-world` och kör det. I Ubuntu finns Snap redan; i Debian installerar du paketet `snapd` först.",
                        arch: "Snap finns inte i Archs förråd, bara i AUR. Bygg och installera `snapd` från AUR, installera sedan snap-paketet `hello-world` och kör det.",
                        redhat: "Installera Snap (paketet `snapd`), installera sedan snap-paketet `hello-world` och kör det."),
                    Hint = ByFamily(
                        debian: "`sudo apt install snapd` (behövs bara i Debian), `sudo snap install hello-world` och sedan `hello-world`.",
                        arch: "`git clone https://aur.archlinux.org/snapd.git`, `cd snapd`, `makepkg -si`. Sedan `sudo snap install hello-world` och `hello-world`.",
                        redhat: "`sudo dnf install snapd`, `sudo snap install hello-world` och sedan `hello-world`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install snapd", "sudo snap install hello-world", "hello-world"),
                        arch: Cmds(
                            "sudo pacman -S --needed git base-devel",
                            "y",
                            "cd ~",
                            "git clone https://aur.archlinux.org/snapd.git",
                            "cd snapd",
                            "makepkg -si",
                            "y",
                            "y",
                            "sudo snap install hello-world",
                            "hello-world"),
                        redhat: Cmds("sudo dnf install snapd", "y", "sudo snap install hello-world", "hello-world")),
                    Check = c => Ran(c, Re(@"\bhello-world\b")) && c.Output.Contains("Hello World!"),
                },
                new()
                {
                    Id = "appimage-chmod",
                    Text = "I `~/{{downloads}}` ligger en nedladdad AppImage. Gör filen `{{calculator}}` körbar.",
                    Hint = "`chmod +x ~/{{downloads}}/{{calculator}}`",
                    Solution = Cmds("chmod +x ~/{{downloads}}/{{calculator}}"),
                    Check = c => Ran(c, Re(@"^chmod\b")) && (Mode(c, "~/{{downloads}}/{{calculator}}") & Js.Oct(100)) != 0,
                },
                new()
                {
                    Id = "appimage-run",
                    PerFamily = true,
                    Text = "Starta {{calcName}}. Klagar den på FUSE? Installera biblioteket som saknas och försök igen.",
                    Hint = ByFamily(
                        debian: "Biblioteket finns i paketet `libfuse2t64`. Starta sedan med `~/{{downloads}}/{{calculator}}`.",
                        arch: "Biblioteket finns i paketet `fuse2`. Starta sedan med `~/{{downloads}}/{{calculator}}`.",
                        redhat: "Biblioteket finns i paketet `fuse-libs`. Starta sedan med `~/{{downloads}}/{{calculator}}`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install libfuse2t64", "~/{{downloads}}/{{calculator}}"),
                        arch: Cmds("sudo pacman -S fuse2", "y", "~/{{downloads}}/{{calculator}}"),
                        redhat: Cmds("sudo dnf install fuse-libs", "y", "~/{{downloads}}/{{calculator}}")),
                    Check = c => Ran(c, Re(c, @"{{calculator}}|\bAppRun\b")) && !Re(@"--appimage-extract(\s|$)").IsMatch(c.Line),
                },
            },
        };
}
