# Paketverwaltung

Unter Windows und macOS lädt man Programme oft von einer Website herunter.
Unter Linux installierst du stattdessen fast alles mit einem
**Paketmanager**. Das ist der größte Unterschied zwischen den
Distributionsfamilien – und dieses Kapitel sieht je nach gewählter
Distribution anders aus. Gerade ist es **{{pm}}** unter {{distro}}.

## Pakete, Repositorys und Abhängigkeiten

- Ein **Paket** ist ein Programm (oder eine Bibliothek), in eine Datei gepackt,
  zusammen mit Informationen über seine Version und darüber, was es braucht.
- Ein **Repository** ist ein Server, auf dem die Distribution all ihre Pakete
  veröffentlicht. Sie sind getestet und signiert, sodass du weißt, dass niemand
  sie manipuliert hat.
- Eine **Abhängigkeit** ist ein anderes Paket, das benötigt wird. Der
  Paketmanager installiert Abhängigkeiten automatisch.

Der Paketmanager behält außerdem den Überblick darüber, was installiert ist,
und kann mit einem einzigen Befehl *alles* auf dem Rechner aktualisieren.

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

Befehle, die das System verändern, brauchen root-Rechte und werden deshalb mit
`sudo` ausgeführt.

:::debian
## apt unter {{distro}}

### update und upgrade sind zwei verschiedene Dinge

Das verwirrt anfangs fast jeden:

- `apt update` lädt die **Liste** herunter, welche Pakete und Versionen
  verfügbar sind. Es installiert nichts.
- `apt upgrade` **installiert** neue Versionen von dem, was du schon hast.

Führe also immer zuerst `update` aus. Der gängigste Weg, das System zu
aktualisieren, ist:

```sh
sudo apt update && sudo apt upgrade
```

Bevor du `apt update` ausgeführt hast (zum Beispiel auf einem frisch
installierten Server), ist die Paketliste leer, und apt findet überhaupt keine
Pakete.

### Installieren und entfernen

```sh
sudo apt install htop
```

`apt remove` entfernt ein Programm, lässt aber seine Einstellungsdateien
zurück. `apt purge` entfernt auch diese. Wenn apt
`Do you want to continue? [Y/n]` fragt, bedeutet das große `Y`, dass ein
einfaches Enter mit Ja antwortet. Mit der Option `-y` antwortet apt
automatisch mit Ja.

### apt oder apt-get?

`apt` ist die moderne, benutzerfreundliche Variante mit Fortschrittsbalken und
Farben. `apt-get` und `apt-cache` sind älter, haben aber eine stabilere
Ausgabe und werden deshalb in Skripten noch verwendet.

### Unter der Haube: dpkg und .deb

Die Pakete sind `.deb`-Dateien, und eigentlich ist es das Programm `dpkg`, das
sie auspackt. apt kümmert sich um alles drumherum: Herunterladen,
Abhängigkeiten und Updates.
:::

:::arch
## pacman unter {{distro}}

pacman verwendet kurze Optionen, bei denen der **Großbuchstabe** die Operation
ist und die Kleinbuchstaben Modifikatoren sind:

| Option | Bedeutet |
|---|---|
| `-S` | Sync – aus den Repositorys installieren |
| `-R` | Remove – entfernen |
| `-Q` | Query – installierte Pakete abfragen |
| `y` | Die Paketdatenbank aktualisieren |
| `u` | Alle Pakete aktualisieren |
| `s` | Suchen (mit -S und -Q) oder Abhängigkeiten entfernen (mit -R) |
| `i` | Info |

### Das System aktualisieren

```sh
sudo pacman -Syu
```

`-Syu` bedeutet: synchronisieren (`S`), die Datenbank aktualisieren (`y`) und
alles aktualisieren (`u`). Arch ist ein *Rolling Release*, also wirst du das
oft ausführen.

> **Wichtig!** Führe nie nur `pacman -Sy` und danach `pacman -S package` aus.
> Das neue Paket braucht dann womöglich neuere Bibliotheken als die, die du
> hast – ein sogenanntes *Partial Upgrade*, das dein System kaputtmachen kann.
> Nimm immer `-Syu`.

### Installieren und entfernen

```sh
sudo pacman -S htop
```

`pacman -R package` entfernt ein Paket, und `pacman -Rs package` entfernt
zusätzlich Abhängigkeiten, die sonst nichts mehr braucht.

### Das AUR

Neben den offiziellen Repositorys gibt es das **AUR** (*Arch User
Repository*), in dem Benutzer Bauanleitungen für Tausende von Programmen
teilen. Zum Installieren daraus nimmt man oft einen Helfer wie `yay` oder
`paru`. Die Pakete im AUR werden nicht von Arch geprüft – lies immer zuerst
die Bauanleitung (das PKGBUILD).
:::

:::redhat
## dnf unter {{distro}}

### Automatische Metadaten

dnf holt sich neue Paketinformationen selbst, wenn es sie braucht, deshalb
gibt es keinen eigenen Schritt wie `apt update`. Willst du sehen, welche
Updates verfügbar sind, führe aus:

```sh
dnf check-update
```

Der Exit-Code ist `100`, wenn es Updates gibt – praktisch in Skripten.

### Installieren und entfernen

```sh
sudo dnf install htop
```

Achte auf die Frage `Is this ok [y/N]`. Das große `N` bedeutet, dass **Nein**
die Vorgabe ist – drückst du einfach Enter, wird die Installation
abgebrochen. Tippe `y` und Enter, oder nimm `-y`.

### Das System aktualisieren

```sh
sudo dnf upgrade
```

### Unter der Haube: rpm

Die Pakete sind `.rpm`-Dateien, und das Low-Level-Werkzeug heißt `rpm`. dnf
hat das ältere `yum` abgelöst, und mit Fedora 41 kam die neue Version
**dnf5**, die deutlich schneller ist. Unter RHEL, Rocky und AlmaLinux heißt
der Befehl ebenfalls `dnf`.
:::

## Gleiches Programm, verschiedene Namen

Pakete heißen meist überall gleich – aber nicht immer. Ein paar Beispiele:

| Programm | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH-Client | `openssh-client` | `openssh` | `openssh-clients` |

Such immer mit dem Paketmanager, wenn du dir beim Namen nicht sicher bist.

## Universelle Paketformate

Es gibt auch Formate, die auf jeder Distribution funktionieren: **Flatpak**
(verbreitet für Desktop-Anwendungen, über Flathub), **Snap** (von Canonical,
der Standard unter Ubuntu) und **AppImage** (eine einzelne ausführbare Datei).
Sie haben eigene Befehle und ergänzen den Paketmanager der Distribution.
