# distro-project – Project: The second-hand laptop

Huvudkapitel: `distro` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/distro-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/distro/distro-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder kommandona från Distributioner och paket. Delmålen räknas per
familj; lösningarna körs i Ubuntu, Debian, Arch och Fedora och med alla språks världar av testet `ChaptersTests`
("alla uppgifter går att lösa").

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `apt update` fetches the package lists, `apt upgrade` installs the new versions |  | ogranskad |  |
| `pacman -Syu` synchronizes the databases and upgrades everything in one command |  | ogranskad |  |
| `dnf upgrade` fetches the repository metadata itself |  | ogranskad |  |
| `apt search`, `pacman -Ss` and `dnf search` look in both package names and descriptions |  | ogranskad |  |
| The Go compiler is the package `golang-go` on Debian/Ubuntu, `go` on Arch and `golang` on Fedora |  | ogranskad |  |
| `htop` is called `htop` in all three families |  | ogranskad |  |
| Vim is `vim` on Debian/Ubuntu and Arch, and `vim-enhanced` on Fedora (as the part teaches) |  | ogranskad |  |
| `apt install`, `pacman -S` and `dnf install` accept several packages at once |  | ogranskad |  |
| `apt list --installed`, `pacman -Q` (`pacman -Q NAME`) and `dnf list --installed` list installed packages |  | ogranskad |  |
| `apt remove`, `pacman -R` and `dnf remove` uninstall a package |  | ogranskad |  |
| dnf's `[y/N]` means that Enter answers no |  | ogranskad |  |
| VLC is on Flathub with the ID `org.videolan.VLC` |  | ogranskad |  |
| `flatpak install flathub ID` installs an app from Flathub; Flathub is added with `flatpak remote-add` |  | ogranskad |  |
| `go version` prints the installed Go version |  | ogranskad |  |
