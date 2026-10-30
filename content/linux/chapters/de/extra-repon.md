# AUR, PPA und COPR

Die Repositorys der Distribution enthalten Zehntausende von Paketen – aber
nicht alles. Ein Nischenprogramm fehlt vielleicht ganz oder ist nur in einer
alten Version vorhanden. Deshalb gibt es **zusätzliche Repositorys**, in denen
Entwickler und Nutzer ihre eigenen Pakete teilen. Jede Familie hat ihr
eigenes: **PPA** unter Ubuntu, das **AUR** unter Arch und **COPR** unter
Fedora.

In diesem Kapitel installierst du dasselbe ausgedachte Programm, `moonphase`
(es zeigt die Mondphase im Terminal an), aus dem zusätzlichen Repository unter
{{distro}}. Wechsle die Distribution im Menü, wenn du vergleichen willst, wie
es in den anderen Familien funktioniert.

## Bequem – aber auf eigene Gefahr

Die Pakete in den eigenen Repositorys der Distribution werden gemeinsam
getestet, signiert und von den Entwicklern der Distribution geprüft. Ein
zusätzliches Repository kann dagegen jeder anlegen. Behalte das im Hinterkopf,
bevor du eines hinzufügst:

- **Pakete werden als root installiert.** Ein Paket kann mit dem Rechner
  alles Mögliche anstellen. Du vertraust demjenigen, der es gebaut hat,
  genauso sehr wie der Distribution.
- **Es kann zu Konflikten kommen.** Ein Paket aus einem zusätzlichen
  Repository kann die eigenen Bibliotheken des Systems ersetzen oder andere
  Versionen brauchen als die, die du hast.
- **Es kann aufhören, aktualisiert zu werden.** Wenn die Person, die das
  Repository betreibt, die Lust verliert, bekommst du keine Sicherheitsupdates
  mehr für das Programm.

Eine gute Faustregel: Schau zuerst in den Repositorys der Distribution nach,
dann nach einem Flatpak (nächstes Kapitel) und erst danach in einem
zusätzlichen Repository von jemandem, dem du vertraust.

## Drei Familien, drei Lösungen

| | PPA | AUR | COPR |
|---|---|---|---|
| Familie | Ubuntu (und z. B. Linux Mint) | Arch (und z. B. Manjaro, EndeavourOS) | Fedora (und die RHEL-Familie) |
| Website | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| Was du herunterlädst | Fertige `.deb`-Pakete | Ein Baurezept (`PKGBUILD`) – du baust selbst | Fertige `.rpm`-Pakete |
| Hinzufügen | `add-apt-repository ppa:…` | `git clone …` und `makepkg -si` | `dnf copr enable …` |
| Von der Distribution geprüft | Nein | Nein | Nein |

:::debian
## PPAs unter {{distro}}

Ein **PPA** (*Personal Package Archive*) ist ein kleines Repository auf
Launchpad, dem Dienst von Canonical für Ubuntu. Der Entwickler lädt den
Quellcode hoch, und Launchpad baut `.deb`-Pakete für verschiedene
Ubuntu-Versionen. Ein PPA schreibt man `ppa:user/name`.

### Das Werkzeug add-apt-repository

PPAs werden mit `add-apt-repository` hinzugefügt, das im Paket
`software-properties-common` steckt. Unter Ubuntu ist es vorinstalliert, unter
Debian nicht:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Das PPA hinzufügen

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Du siehst, was hinzugefügt wird, und eine Beschreibung des PPA. Drück Enter,
um fortzufahren (mit `-y` überspringst du die Frage). Zwei Dinge passieren:

1. In `/etc/apt/sources.list.d/` wird eine Datei angelegt. Sie sagt, wo das
   Repository liegt, und enthält den Schlüssel, mit dem die Pakete signiert
   sind.
2. `add-apt-repository` führt `apt update` für dich aus – sonst wüsste apt
   nichts von den neuen Paketen. Wenn du eine Quelle von Hand hinzufügst
   (indem du eine Datei anlegst), musst du danach selbst `sudo apt update`
   ausführen.

Sieh dir die Datei an:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Beachte `Suites: noble` – die Pakete sind für Ubuntu 24.04 gebaut.

### Installieren und ausführen

Jetzt wird das Paket wie jedes andere Paket installiert:

```sh
sudo apt install moonphase
moonphase
```

### Woher kommt das Paket?

`apt policy` zeigt, in welchen Repositorys ein Paket liegt und welches
gewinnt:

```sh
apt policy moonphase
```

`***` markiert die installierte Version. Die Zahl `500` ist die Priorität des
Repositorys, und `100` bedeutet „das, was schon installiert ist“. Liegt
dasselbe Paket in mehreren Repositorys, nimmt apt die höchste Version – ein
PPA kann also eines der eigenen Pakete der Distribution durch seine eigene
Version ersetzen.

### PPAs unter Debian?

PPAs sind für Ubuntu gebaut, nicht für Debian. Unter Debian funktionieren sie
vielleicht, aber die Pakete können andere Bibliotheksversionen brauchen, als
Debian hat. Eine Mischung aus Debian- und Ubuntu-Paketen nennt man scherzhaft
*FrankenDebian*, und sie ist ein beliebter Weg, das System kaputtzumachen.
Unter Debian greifst du besser zu *Backports*, einem Flatpak oder dem eigenen
Debian-Repository des Entwicklers.

### Ein PPA entfernen

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Das Programm bleibt, bekommt aber keine Updates mehr. Um es ganz loszuwerden,
führe zusätzlich `sudo apt remove moonphase` aus.
:::

:::arch
## Das AUR unter {{distro}}

Das **AUR** (*Arch User Repository*) ist anders als die anderen: Es gibt dort
keine fertigen Pakete, sondern nur **Baurezepte**. Ein Rezept heißt
`PKGBUILD` und ist ein kleines bash-Skript, das angibt, wo der Quellcode liegt
und wie das Programm gebaut wird. Du lädst das Rezept herunter, baust das
Paket selbst und installierst es mit pacman. Das AUR ist riesig – fast alles,
was es für Linux gibt, findet sich dort –, aber jeder kann ein Rezept
hochladen.

### Vorbereitungen

Um Rezepte herunterzuladen und Pakete zu bauen, brauchst du `git` und
`base-devel` (einen Compiler, `make`, `fakeroot` und mehr):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` überspringt, was schon installiert ist.

### Das Rezept holen

Jedes AUR-Paket ist ein eigenes git-Repository:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Wenn du dich beim Paketnamen vertippst, sagt git *„You appear to have cloned
> an empty repository“*, und das Verzeichnis ist leer. Das AUR lässt dich
> alles klonen!

### Lies das PKGBUILD – jedes Mal

```sh
less PKGBUILD
```

`PKGBUILD` ist ein Skript, das auf deinem Rechner läuft. Prüfe mindestens,

- dass `source=` von der echten Website des Programms herunterlädt,
- dass `build()` und `package()` nur bauen und Dateien kopieren – und nicht
  zum Beispiel etwas anderes herunterladen und ausführen (`curl … | sh`),
- dass das Paket gepflegt aussieht (Datumsangaben, Kommentare auf
  aur.archlinux.org).

### Bauen und installieren

```sh
makepkg -si
```

`makepkg` liest `PKGBUILD`, lädt den Quellcode herunter, baut ihn und packt
eine `.pkg.tar.zst`-Datei. `-s` installiert fehlende Abhängigkeiten, und `-i`
installiert das Paket mit pacman, wenn es fertig ist. Führe makepkg **nicht**
mit sudo aus – es weigert sich, als root zu laufen, und verwendet sudo von
selbst, wenn es nötig ist.

```sh
ls
moonphase
```

### „Fremde“ Pakete

pacman weiß nichts vom AUR. Pakete, die nicht aus den Repositorys stammen,
heißen *foreign* (fremd) und werden so aufgelistet:

```sh
pacman -Qm
```

Das bedeutet auch, dass `sudo pacman -Syu` AUR-Pakete **nicht** aktualisiert.
Du musst das neue Rezept selbst holen (`git pull`) und neu bauen – oder das
einem AUR-Helper überlassen.

### Der AUR-Helper yay

Ein AUR-Helper erledigt all das für dich: Er sucht, lädt herunter, zeigt das
`PKGBUILD`, baut und installiert. Der verbreitetste ist **yay** (ein anderer
ist *paru*). yay selbst gibt es nur im AUR, deshalb wird er einmal von Hand
installiert. Das Paket `yay-bin` ist vorkompiliert und am schnellsten:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Danach wird yay ganz ähnlich wie pacman verwendet – aber ohne sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (oder einfach `yay`) aktualisiert sowohl die Pakete aus den
Repositorys als auch deine AUR-Pakete. Bequemlichkeit heißt aber nicht, dass
du aufhören darfst, die Rezepte zu lesen!
:::

:::redhat
## COPR unter {{distro}}

**COPR** (*Cool Other Package Repo*) ist der Build-Dienst von Fedora. Jeder
mit einem Fedora-Konto kann dort `.rpm`-Pakete bauen, und jedes Projekt wird
zu einem eigenen Repository namens `user/project`.

### Die Repositorys, die du jetzt hast

```sh
dnf repolist
```

### Ein COPR-Repository aktivieren

```sh
sudo dnf copr enable lunatool/moonphase
```

dnf erinnert dich daran, dass das Repository nicht zu Fedora gehört und die
Qualität schwanken kann. Die Vorgabe bei der Frage ist **Nein**, antworte also
mit `y`. In `/etc/yum.repos.d/` wird eine neue Datei angelegt:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Installieren und ausführen

dnf holt sich die Informationen des neuen Repositorys von selbst, sodass das
Paket sofort installiert werden kann:

```sh
sudo dnf install moonphase
moonphase
```

### Woher kommt das Paket?

```sh
dnf info moonphase
```

Die Zeile `From repository` zeigt, dass das Paket aus COPR kommt. Pakete aus
COPR werden wie gewohnt mit `sudo dnf upgrade` aktualisiert.

### Deaktivieren oder entfernen

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

`disable` lässt die Datei, wo sie ist, schaltet das Repository aber ab;
`remove` löscht es vollständig. Das Programm bleibt, bekommt aber keine
Updates mehr.

### RPM Fusion

Ein weiteres verbreitetes zusätzliches Repository für Fedora ist **RPM
Fusion**. Es enthält Dinge, die Fedora nicht aufnehmen kann oder will, etwa
bestimmte Medien-Codecs und Treiber. Es ist ein großes, gemeinsames Projekt –
kein Repository eines einzelnen Nutzers wie bei COPR.
:::

## Updates und Pflege

| | Aktualisiert mit | Repository entfernen |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – oder selbst neu bauen | – (es gibt kein Repository zum Entfernen) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Zusätzliche Repositorys sind ein mächtiges Werkzeug, aber jedes Repository,
das du hinzufügst, ist ein Absender mehr, dem du vertraust. Halte die Liste
kurz und räum auf, was du nicht mehr brauchst.
