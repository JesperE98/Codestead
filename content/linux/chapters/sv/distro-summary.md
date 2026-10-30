# Sammanfattning: Distributioner och paket

## Familjer

Grunden är densamma i alla distributioner: Linuxkärnan, bash och GNU-verktygen,
katalogstrukturen och (nästan överallt) systemd. Det som skiljer familjerna åt
är främst hur program installeras.

| | Debian-familjen | Arch-familjen | Red Hat-familjen |
|---|---|---|---|
| Exempel | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Pakethanterare | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Verktyg på låg nivå | `dpkg` | (pacman) | `rpm` |
| Sudo-grupp | `sudo` | `wheel` | `wheel` |
| Utgåvor | Stabila versioner | Rullande | En ny version var sjätte månad (Fedora) |

- `cat /etc/os-release` visar vilken distribution du kör, och `uname -r` visar
  kärnans version.
- Ett **paket** är ett program packat i en fil, ett **förråd** är en server med
  distributionens testade och signerade paket, och ett **beroende** är ett
  annat paket som behövs – pakethanteraren installerar det automatiskt.
- Kommandon som ändrar systemet kräver root, så de körs med `sudo`.

## Samma sak – tre dialekter

| Vad | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Uppdatera paketlistan | `apt update` | `pacman -Sy` | `dnf check-update` |
| Uppgradera allt | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Installera | `apt install X` | `pacman -S X` | `dnf install X` |
| Ta bort | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Sök | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Information om paketet | `apt show X` | `pacman -Si X` | `dnf info X` |
| Lista installerade | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Att komma ihåg:

- **apt**: `apt update` laddar bara ner listan över paket – `apt upgrade`
  installerar de nya versionerna. Kör `update` först. `[Y/n]` betyder att
  Enter svarar ja.
- **pacman**: den stora bokstaven är operationen (`-S`, `-R`, `-Q`) och de små
  bokstäverna är tillägg. Uppgradera alltid med `-Syu` – aldrig `-Sy` följt av
  `-S paket` (en delvis uppgradering kan förstöra systemet).
- **dnf**: hämtar paketinformationen själv. `dnf check-update` avslutas med
  `100` när det finns uppdateringar. `[y/N]` betyder att Enter svarar **nej**.

Paketnamnen är oftast desamma överallt, men inte alltid – Vim heter
`vim-enhanced` i Fedora. Sök om du är osäker.

## Extra förråd

| | PPA | AUR | COPR |
|---|---|---|---|
| Familj | Ubuntu (och t.ex. Linux Mint) | Arch (och t.ex. Manjaro, EndeavourOS) | Fedora (och RHEL-familjen) |
| Det du laddar ner | Färdiga `.deb`-paket | Ett byggrecept (`PKGBUILD`) – du bygger själv | Färdiga `.rpm`-paket |
| Lägg till | `add-apt-repository ppa:…` | `git clone …` och `makepkg -si` | `dnf copr enable …` |
| Uppdateras med | `sudo apt update && sudo apt upgrade` | `yay -Syu` – eller bygg om själv | `sudo dnf upgrade` |
| Ta bort förrådet | `sudo add-apt-repository --remove ppa:…` | – (det finns inget förråd att ta bort) | `sudo dnf copr remove …` |
| Granskat av distributionen | Nej | Nej | Nej |

- Paket från ett extra förråd installeras som root, kan krocka med systemets
  egna paket och kan sluta uppdateras. Titta först i distributionens förråd,
  sedan efter en Flatpak, och först därefter i ett extra förråd från någon du
  litar på.
- `apt policy` visar varifrån ett paket kommer; apt väljer den högsta
  versionen.
- Läs alltid `PKGBUILD` innan du bygger. Kör inte `makepkg` med sudo.
  `pacman -Qm` listar *främmande* paket, och `pacman -Syu` uppdaterar dem inte
  – det gör en AUR-hjälpare som `yay`.

## Universella paket

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Kommer från | Flathub (eller andra *remotes*) | Snap Store (Canonical) | Utvecklarens webbplats |
| Sandlåda | Ja | Ja (utom *classic*) | Nej |
| Uppdateringar | `flatpak update` | Automatiskt i bakgrunden | Själv – ladda ner en ny fil |
| Installera | `flatpak install flathub ID` | `sudo snap install namn` | `chmod +x fil` och kör den |

- Flatpak-program har ett ID som skrivs som ett baklänges domännamn
  (`org.gimp.GIMP`) och startas med `flatpak run`. `--user` installerar i din
  hemkatalog, med egna remotes.
- Snap är standard i Ubuntu. Snaps med classic-inneslutning behöver
  `--classic`, och varje snap har kanaler som `stable` och `edge`.
- En AppImage behöver FUSE 2 (`libfuse2t64` i Ubuntu 24.04 och Debian 13,
  `fuse2` i Arch, `fuse-libs` i Fedora) och har ingen sandlåda och inga
  automatiska uppdateringar.

**Tumregel:** distributionens paket för system- och kommandoradsprogram,
Flatpak för skrivbordsprogram, Snap i Ubuntu eller när ett program bara finns
som snap, och AppImage för att snabbt prova ett program.
