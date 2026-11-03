# Die Debian-Familie: apt und PPAs

Debian, Ubuntu und darauf aufbauende Distributionen wie Linux Mint bilden die
**Debian-Familie**. Sie alle verwenden den Paketmanager **apt** und Pakete im
Format `.deb`. Dieses Kapitel läuft immer auf einer Distribution aus der
Debian-Familie – gerade ist es **{{distro}}**. Im Menü oben kannst du zwischen
Ubuntu und Debian wechseln.

## apt in Kürze

| Was | Befehl |
|---|---|
| Paketliste aktualisieren | `apt update` |
| Alles aktualisieren | `apt upgrade` |
| Installieren | `apt install X` |
| Entfernen | `apt remove X` |
| Suchen | `apt search X` |
| Paketinfo | `apt show X` |
| Installierte auflisten | `apt list --installed` |

Befehle, die das System verändern, brauchen root-Rechte und werden deshalb mit
`sudo` ausgeführt.

```quiz
Welche dieser Befehle verändern das System und brauchen deshalb `sudo`?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Suchen und Informationen anzeigen lesen nur die Paketlisten. Installieren und
Entfernen verändern das System.
```

## update und upgrade sind zwei verschiedene Dinge

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

```quiz
Was macht `sudo apt update`?
- [x] Lädt die Liste herunter, welche Pakete und Versionen verfügbar sind
- [ ] Installiert neue Versionen der Pakete, die du schon hast
- [ ] Aktualisiert apt selbst auf die neueste Version
---
`apt update` aktualisiert nur die Liste. `apt upgrade` ist das, was die neuen
Versionen installiert.
```

## Installieren und entfernen

```sh
sudo apt install htop
```

`apt remove` entfernt ein Programm, lässt aber seine Einstellungsdateien
zurück. `apt purge` entfernt auch diese. Wenn apt
`Do you want to continue? [Y/n]` fragt, bedeutet das große `Y`, dass ein
einfaches Enter mit Ja antwortet. Mit der Option `-y` antwortet apt
automatisch mit Ja.

Suchen braucht kein root. Probier es aus:

```try
apt search htop
```

### apt oder apt-get?

`apt` ist die moderne, benutzerfreundliche Variante mit Fortschrittsbalken und
Farben. `apt-get` und `apt-cache` sind älter, haben aber eine stabilere
Ausgabe und werden deshalb in Skripten noch verwendet.

### Unter der Haube: dpkg und .deb

Die Pakete sind `.deb`-Dateien, und eigentlich ist es das Programm `dpkg`, das
sie auspackt. apt kümmert sich um alles drumherum: Herunterladen,
Abhängigkeiten und Updates.

## Zusätzliche Repositorys – bequem, aber auf eigene Gefahr

Die Repositorys der Distribution enthalten Zehntausende von Paketen – aber
nicht alles. Ein Nischenprogramm fehlt vielleicht ganz oder ist nur in einer
alten Version vorhanden. Deshalb gibt es **zusätzliche Repositorys**, in denen
Entwickler und Nutzer ihre eigenen Pakete teilen.

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
dann nach einem Flatpak (im Kapitel über universelle Pakete) und erst danach
in einem zusätzlichen Repository von jemandem, dem du vertraust.

## PPAs

Ein **PPA** (*Personal Package Archive*) ist ein kleines Repository auf
Launchpad, dem Dienst von Canonical für Ubuntu. Der Entwickler lädt den
Quellcode hoch, und Launchpad baut `.deb`-Pakete für verschiedene
Ubuntu-Versionen. Ein PPA schreibt man `ppa:user/name`. PPAs werden nicht von
der Distribution geprüft.

Im Rest dieses Kapitels installierst du ein ausgedachtes Programm,
`moonphase` (es zeigt die Mondphase im Terminal an), aus einem PPA.

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

```quiz
Du fügst ein Repository von Hand hinzu, indem du eine Datei in
`/etc/apt/sources.list.d/` anlegst. Was musst du tun, bevor apt Pakete daraus
installieren kann?
- [ ] Nichts – apt liest die Datei beim nächsten Installieren von selbst
- [x] `sudo apt update` ausführen
- [ ] Den Rechner neu starten
---
`add-apt-repository` führt `apt update` für dich aus. Wenn du die Datei selbst
anlegst, musst du das selbst erledigen.
```

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

```quiz
Dasselbe Paket liegt sowohl im Repository der Distribution als auch in einem
PPA, das du hinzugefügt hast. Welche Version nimmt apt?
- [ ] Immer die aus dem Repository der Distribution
- [ ] Die aus dem Repository, das zuletzt hinzugefügt wurde
- [x] Die höchste Version
---
Deshalb kann ein PPA eines der eigenen Pakete der Distribution ersetzen.
```

### PPAs unter Debian?

PPAs sind für Ubuntu gebaut, nicht für Debian. Unter Debian funktionieren sie
vielleicht, aber die Pakete können andere Bibliotheksversionen brauchen, als
Debian hat. Eine Mischung aus Debian- und Ubuntu-Paketen nennt man scherzhaft
*FrankenDebian*, und sie ist ein beliebter Weg, das System kaputtzumachen.
Unter Debian greifst du besser zu *Backports*, einem Flatpak oder dem eigenen
Debian-Repository des Entwicklers.

### Updates und ein PPA entfernen

Pakete aus einem PPA werden zusammen mit allem anderen aktualisiert, mit
`sudo apt update && sudo apt upgrade`. So entfernst du das PPA:

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

Das Programm bleibt, bekommt aber keine Updates mehr. Um es ganz loszuwerden,
führe zusätzlich `sudo apt remove moonphase` aus.

Jedes Repository, das du hinzufügst, ist ein Absender mehr, dem du vertraust.
Halte die Liste kurz und räum auf, was du nicht mehr brauchst.
