# Flatpak, Snap und AppImage

Ein normales Paket ist für eine bestimmte Distribution und Version gebaut. Für
jemanden, der ein Desktop-Programm entwickelt, ist das ein Problem: Dasselbe
Programm muss für Debian, Ubuntu, Fedora, Arch und all ihre Versionen neu
paketiert werden. **Universelle Paketformate** lösen das, indem sie das
meiste, was das Programm braucht, mit ins Paket packen – so funktioniert ein
und dasselbe Paket auf jeder Distribution.

Die drei großen sind **Flatpak**, **Snap** und **AppImage**. Sie ersetzen den
Paketmanager der Distribution nicht, sondern ergänzen ihn, vor allem für
Desktop-Programme.

> Der Simulator hat nur ein Terminal. Wenn du ein grafisches Programm startest,
> bekommst du stattdessen eine Zeile, die sagt, dass es sich in einem Fenster
> geöffnet hätte.

## Vier Wege, ein Programm zu installieren

| | Distributionspaket | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Kommt von | Den Repositorys der Distribution | Flathub (oder anderen *Remotes*) | Snap Store (Canonical) | Der Website des Entwicklers |
| Läuft auf | Einer Distribution und Version | Allen | Allen, die `snapd` haben | Allen (braucht FUSE) |
| Sandbox | Nein | Ja | Ja (außer *classic*) | Nein |
| Größe | Klein – teilt Bibliotheken mit dem System | Beim ersten Mal groß (Runtimes), danach geteilt | Groß – jeder Snap samt seiner Basis | Groß – alles in einer Datei |
| Updates | Mit dem System (`apt upgrade` …) | `flatpak update` | Automatisch im Hintergrund | Selbst – neue Datei herunterladen |
| Gut für | Systemprogramme, Kommandozeilenwerkzeuge, Server | Desktop-Programme | Ubuntu, Desktops und Server | Einzelne Programme, neue Versionen ausprobieren |

Eine **Sandbox** bedeutet, dass das Programm nur an das herankommt, was ihm
erlaubt wurde, zum Beispiel das Netzwerk oder deinen Download-Ordner, statt an
dein ganzes Home-Verzeichnis.

```quiz
Welches Format wird automatisch im Hintergrund aktualisiert?
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Flatpak-Programme werden mit `flatpak update` aktualisiert, und ein AppImage
ersetzt du, indem du eine neue Datei herunterlädst.
```

## Flatpak

Flatpak ist das Format, auf das sich die meisten Distributionen für
Desktop-Programme geeinigt haben. Programme werden von einem **Remote**
heruntergeladen – fast immer **Flathub** – und teilen sich gemeinsame
**Runtimes** (zum Beispiel `org.gnome.Platform`), damit nicht jedes Programm
alles selbst mitbringen muss.

:::debian
### Flatpak installieren

Flatpak ist unter {{distro}} nicht vorinstalliert:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Flatpak installieren

Flatpak liegt in den Arch-Repositorys:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak unter {{distro}}

Fedora Workstation bringt Flatpak mit, und das Fedora-eigene Remote `fedora`
ist bereits hinzugefügt:

```sh
flatpak --version
flatpak remotes
```
:::

### Flathub hinzufügen

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` sorgt dafür, dass der Befehl nicht fehlschlägt, wenn Flathub
schon da ist – praktisch in Skripten und Installationsanleitungen.

### Suchen, installieren und ausführen

Jedes Programm hat eine **ID**, die als umgekehrter Domainname geschrieben
wird, zum Beispiel `org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

Flatpak zeigt, welche **Berechtigungen** das Programm haben will und welche
Runtimes mitkommen. Achte auf die Größe: Das erste Programm zieht eine Runtime
von mehreren hundert Megabyte nach sich, aber das nächste Programm, das
dieselbe Runtime verwendet, ist klein.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### Für das ganze System oder nur für dich

Ohne Optionen installiert Flatpak für das **ganze System** (in
`/var/lib/flatpak`). Auf einem Desktop fragt Flatpak in einem Fenster nach
deinem Passwort, sudo ist also nicht nötig. Mit `--user` landet das Programm
stattdessen in deinem Home-Verzeichnis (`~/.local/share/flatpak`), und kein
anderer Benutzer sieht es. Die Benutzerinstallation hat **eigene Remotes**,
deshalb muss Flathub auch mit `--user` hinzugefügt werden:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
Was passiert, wenn du ein Flatpak mit `--user` installierst?
- [ ] Es wird für das ganze System installiert, in `/var/lib/flatpak`
- [x] Es landet in deinem Home-Verzeichnis, und kein anderer Benutzer sieht es
- [ ] Es läuft ohne Sandbox
---
Denk daran, dass die Benutzerinstallation eigene Remotes hat – Flathub muss
auch mit `--user` hinzugefügt werden.
```

### Aktualisieren und entfernen

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` entfernt Runtimes, die kein installiertes Programm mehr verwendet.

## Snap

Snap ist das Format von **Canonical** und die Vorgabe unter Ubuntu – dort ist
zum Beispiel Firefox ein Snap. Snaps kommen aus dem **Snap Store**, den
Canonical betreibt, und werden vom Dienst `snapd` verwaltet. Sie werden
automatisch im Hintergrund aktualisiert.

:::debian
### Snap unter Ubuntu und Debian

Ubuntu hat Snap bereits. Unter Debian installierst du zuerst `snapd`:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap unter Arch

Snap liegt nicht in den Arch-Repositorys – nur im AUR. Bau es wie im Kapitel
über die Arch-Familie:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

Auf einem echten System musst du außerdem den Dienst mit
`sudo systemctl enable --now snapd.socket` starten. Das ist ein Zeichen dafür,
dass Snap unter Arch nicht zu Hause ist: Die meisten dort verwenden Flatpak.
:::

:::redhat
### Snap unter Fedora

Fedora setzt auf Flatpak, aber Snap liegt in den Repositorys:

```sh
sudo dnf install snapd
```
:::

### snap verwenden

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Installierte Snaps tauchen als Programme in `/snap/bin` auf. Installieren und
Entfernen brauchen root-Rechte.

### Strict oder classic

Die meisten Snaps laufen **strikt** in einer Sandbox (*strict*). Programme, die
Zugriff auf das ganze System brauchen, etwa Code-Editoren, werden mit
**Classic Confinement** veröffentlicht. Das musst du dann selbst mit
`--classic` genehmigen:

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
Ein Snap ist mit Classic Confinement veröffentlicht. Was musst du hinzufügen,
um ihn zu installieren?
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### Kanäle und Updates

Jeder Snap hat **Kanäle** (*channels*): `stable`, `candidate`, `beta` und
`edge` (die neueste, ungetestete Version). `snap info` zeigt sie an, und
`--channel=beta` wählt einen anderen aus. Updates passieren automatisch, aber
du kannst sie erzwingen und Snaps entfernen:

```sh
sudo snap refresh
sudo snap remove hello-world
```

Snap hat auch Kritiker: Der Snap Store wird allein von Canonical betrieben,
die automatischen Updates lassen sich nicht vollständig abschalten, und
Programme können beim ersten Start langsam sein.

## AppImage

Ein **AppImage** ist ein ganzes Programm in **einer einzigen Datei**. Du lädst
es von der Website des Programms herunter, machst es ausführbar und startest
es – ohne Installation und ohne root. Um das Programm loszuwerden, löschst du
die Datei.

In deinem Home-Verzeichnis liegt bereits ein heruntergeladenes AppImage, in
`~/{{downloads}}`:

```sh
cd ~/{{downloads}}
ls -l
```

Was passiert, wenn du es gleich startest?

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
Die Datei hat kein `x`-Recht.
```

Heruntergeladene Dateien sind anfangs nie ausführbar. Mach sie ausführbar und
starte sie:

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
Jetzt ist die Datei ausführbar. Prüf es mit `ls -l ~/{{downloads}}`.
```

### FUSE

Ein AppImage hängt sich mithilfe von **FUSE** selbst als Dateisystem ein und
braucht dafür die ältere Version 2 der Bibliothek (`libfuse.so.2`). Ohne sie
bekommst du den Fehler *„AppImages require FUSE to run“*.

:::debian
Unter Ubuntu 24.04 und Debian 13 heißt das Paket `libfuse2t64` (*t64* kommt
von der Umstellung auf 64-Bit-Zeit; in älteren Versionen hieß es
`libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> Installiere unter Ubuntu **nicht** das Paket `fuse` – es ersetzt `fuse3`,
> das der Desktop braucht.
:::

:::arch
Unter Arch heißt das Paket `fuse2`:

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
Unter Fedora heißt das Paket `fuse-libs`:

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### Ein Blick hinein

Ein AppImage lässt sich auch auspacken. Das funktioniert sogar ohne FUSE:

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` packt vorübergehend aus und startet sofort.

### Denk daran

- AppImage hat **keine Sandbox** – das Programm läuft als du und kommt an
  alles heran, woran du auch herankommst. Lade nur von der offiziellen Website
  des Programms herunter.
- Es gibt **keine automatischen Updates**. Du lädst eine neue Datei herunter,
  wenn eine neue Version erscheint (manche Programme können sich selbst
  aktualisieren).
- Das Programm taucht nicht von selbst im Anwendungsmenü auf. Werkzeuge wie
  *Gear Lever* oder *AppImageLauncher* können das erledigen.

## Was soll ich wählen?

1. **Die Pakete der Distribution** für System- und Kommandozeilenprogramme –
   sie sind am kleinsten und schnellsten und werden mit dem Rest des Systems
   aktualisiert.
2. **Flatpak** für Desktop-Programme, wenn du eine neuere Version willst oder
   ein Programm, das in den Repositorys fehlt.
3. **Snap**, wenn du Ubuntu verwendest oder wenn es das Programm nur als Snap
   gibt.
4. **AppImage**, um schnell ein Programm auszuprobieren, oder wenn der
   Entwickler nur dieses Format anbietet.
