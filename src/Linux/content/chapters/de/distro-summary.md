# Zusammenfassung: Distributionen und Pakete

## Familien

Die Grundlagen sind auf jeder Distribution gleich: der Linux-Kernel, bash und
die GNU-Werkzeuge, die Verzeichnisstruktur und (fast überall) systemd. Was die
Familien unterscheidet, ist vor allem, wie Programme installiert werden.

| | Debian-Familie | Arch-Familie | Red-Hat-Familie |
|---|---|---|---|
| Beispiele | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Paketmanager | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-Level-Werkzeug | `dpkg` | (pacman) | `rpm` |
| sudo-Gruppe | `sudo` | `wheel` | `wheel` |
| Veröffentlichungen | Stabile Versionen | Rolling | Alle 6 Monate eine neue Version (Fedora) |

- `cat /etc/os-release` zeigt, welche Distribution du verwendest, und
  `uname -r` zeigt die Kernel-Version.
- Ein **Paket** ist ein Programm, in eine Datei gepackt, ein **Repository**
  ist ein Server mit den getesteten und signierten Paketen der Distribution,
  und eine **Abhängigkeit** ist ein anderes Paket, das benötigt wird – der
  Paketmanager installiert es automatisch.
- Befehle, die das System verändern, brauchen root-Rechte und werden deshalb
  mit `sudo` ausgeführt.

## Dasselbe in drei Dialekten

| Was | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Paketliste aktualisieren | `apt update` | `pacman -Sy` | `dnf check-update` |
| Alles aktualisieren | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Installieren | `apt install X` | `pacman -S X` | `dnf install X` |
| Entfernen | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Suchen | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Paketinfo | `apt show X` | `pacman -Si X` | `dnf info X` |
| Installierte auflisten | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Das solltest du dir merken:

- **apt**: `apt update` lädt nur die Liste der Pakete herunter –
  `apt upgrade` installiert die neuen Versionen. Führe zuerst `update` aus.
  `[Y/n]` bedeutet, dass Enter mit Ja antwortet.
- **pacman**: Der Großbuchstabe ist die Operation (`-S`, `-R`, `-Q`), und die
  Kleinbuchstaben sind Modifikatoren. Aktualisiere immer mit `-Syu` – nie
  `-Sy` gefolgt von `-S package` (ein Partial Upgrade kann das System
  kaputtmachen).
- **dnf**: Holt sich die Paketinformationen selbst. `dnf check-update` endet
  mit `100`, wenn es Updates gibt. `[y/N]` bedeutet, dass Enter mit **Nein**
  antwortet.

Pakete heißen meist überall gleich, aber nicht immer – Vim heißt unter Fedora
`vim-enhanced`. Such, wenn du dir nicht sicher bist.

## Zusätzliche Repositorys

| | PPA | AUR | COPR |
|---|---|---|---|
| Familie | Ubuntu (und z. B. Linux Mint) | Arch (und z. B. Manjaro, EndeavourOS) | Fedora (und die RHEL-Familie) |
| Was du herunterlädst | Fertige `.deb`-Pakete | Ein Baurezept (`PKGBUILD`) – du baust selbst | Fertige `.rpm`-Pakete |
| Hinzufügen | `add-apt-repository ppa:…` | `git clone …` und `makepkg -si` | `dnf copr enable …` |
| Aktualisiert mit | `sudo apt update && sudo apt upgrade` | `yay -Syu` – oder selbst neu bauen | `sudo dnf upgrade` |
| Repository entfernen | `sudo add-apt-repository --remove ppa:…` | – (es gibt kein Repository zum Entfernen) | `sudo dnf copr remove …` |
| Von der Distribution geprüft | Nein | Nein | Nein |

- Pakete aus einem zusätzlichen Repository werden als root installiert,
  können mit den eigenen Paketen des Systems in Konflikt geraten und können
  aufhören, aktualisiert zu werden. Schau zuerst in den Repositorys der
  Distribution nach, dann nach einem Flatpak und erst danach in einem
  zusätzlichen Repository von jemandem, dem du vertraust.
- `apt policy` zeigt, woher ein Paket kommt; apt nimmt die höchste Version.
- Lies immer das `PKGBUILD`, bevor du baust. Führe `makepkg` nicht mit sudo
  aus. `pacman -Qm` listet *fremde* Pakete auf, und `pacman -Syu`
  aktualisiert sie nicht – ein AUR-Helper wie `yay` schon.

## Universelle Pakete

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Kommt von | Flathub (oder anderen *Remotes*) | Snap Store (Canonical) | Der Website des Entwicklers |
| Sandbox | Ja | Ja (außer *classic*) | Nein |
| Updates | `flatpak update` | Automatisch im Hintergrund | Selbst – eine neue Datei herunterladen |
| Installieren | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` und ausführen |

- Flatpak-Programme haben eine ID, die als umgekehrter Domainname geschrieben
  wird (`org.gimp.GIMP`), und werden mit `flatpak run` gestartet. `--user`
  installiert in dein Home-Verzeichnis, mit eigenen Remotes.
- Snap ist der Standard unter Ubuntu. Snaps mit Classic Confinement brauchen
  `--classic`, und jeder Snap hat Kanäle wie `stable` und `edge`.
- Ein AppImage braucht FUSE 2 (`libfuse2t64` unter Ubuntu 24.04 und
  Debian 13, `fuse2` unter Arch, `fuse-libs` unter Fedora) und hat keine
  Sandbox und keine automatischen Updates.

**Faustregel:** die Pakete der Distribution für System- und
Kommandozeilenprogramme, Flatpak für Desktop-Programme, Snap unter Ubuntu oder
wenn es ein Programm nur als Snap gibt, und AppImage, um ein Programm schnell
auszuprobieren.
