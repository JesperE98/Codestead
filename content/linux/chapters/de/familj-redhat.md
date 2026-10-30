# Die Red-Hat-Familie: dnf und COPR

Fedora, Red Hat Enterprise Linux (RHEL) und RHEL-Klone wie Rocky Linux
bilden die **Red-Hat-Familie**. Sie verwenden den Paketmanager **dnf** und
Pakete im Format `.rpm`. Dieses Kapitel läuft immer auf einer Distribution
aus der Red-Hat-Familie – gerade ist es **{{distro}}**.

## dnf in Kürze

| Was | Befehl |
|---|---|
| Paketliste aktualisieren | `dnf check-update` |
| Alles aktualisieren | `dnf upgrade` |
| Installieren | `dnf install X` |
| Entfernen | `dnf remove X` |
| Suchen | `dnf search X` |
| Paketinfo | `dnf info X` |
| Installierte auflisten | `dnf list --installed` |

Befehle, die das System verändern, brauchen root-Rechte und werden deshalb mit
`sudo` ausgeführt.

## Automatische Metadaten

dnf holt sich neue Paketinformationen selbst, wenn es sie braucht, deshalb
gibt es keinen eigenen Schritt wie `apt update` in der Debian-Familie. Willst
du sehen, welche Updates verfügbar sind, führe aus:

```sh
dnf check-update
```

`dnf check-update` braucht keine root-Rechte. Der Exit-Code ist `100`, wenn
es Updates gibt – praktisch in Skripten. Im Simulator warten Updates. Was
gibt das hier aus?

```predict
$ dnf check-update > /dev/null; echo $?
100
---
`> /dev/null` versteckt die Liste, und `$?` ist der Exit-Code des letzten
Befehls: `100` bedeutet, dass es Updates gibt.
```

## Installieren und entfernen

```sh
sudo dnf install htop
```

Achte auf die Frage `Is this ok [y/N]`. Das große `N` bedeutet, dass **Nein**
die Vorgabe ist – drückst du einfach Enter, wird die Installation
abgebrochen. Tippe `y` und Enter, oder nimm `-y`.

```quiz
dnf fragt `Is this ok [y/N]`, und du drückst einfach Enter. Was passiert?
- [ ] Das Paket wird installiert
- [x] Die Installation wird abgebrochen
- [ ] dnf fragt noch einmal
---
Der Großbuchstabe ist die Vorgabe. In der Debian-Familie fragt apt `[Y/n]`,
dort bedeutet Enter also Ja.
```

`dnf remove package` entfernt ein Paket wieder.

## Das System aktualisieren

```sh
sudo dnf upgrade
```

## Unter der Haube: rpm

Die Pakete sind `.rpm`-Dateien, und das Low-Level-Werkzeug heißt `rpm`. dnf
hat das ältere `yum` abgelöst, und mit Fedora 41 kam die neue Version
**dnf5**, die deutlich schneller ist. Unter RHEL, Rocky und AlmaLinux heißt
der Befehl ebenfalls `dnf`.

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

## COPR

**COPR** (*Cool Other Package Repo*) ist der Build-Dienst von Fedora. Jeder
mit einem Fedora-Konto kann dort `.rpm`-Pakete bauen, und jedes Projekt wird
zu einem eigenen Repository namens `user/project`. COPR-Repositorys werden
nicht von der Distribution geprüft.

Im Rest dieses Kapitels installierst du ein ausgedachtes Programm,
`moonphase` (es zeigt die Mondphase im Terminal an), aus COPR.

### Die Repositorys, die du jetzt hast

```sh
dnf repolist
```

```try
dnf repolist
---
Das sind die eigenen Repositorys von Fedora.
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

```quiz
Jeder mit einem Fedora-Konto kann in COPR Pakete bauen. Wer prüft sie?
- [ ] Die Entwickler von Fedora, bevor sie veröffentlicht werden
- [ ] Red Hat
- [x] Niemand – du musst dem vertrauen, der das Repository betreibt
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

```quiz
Was ist der Unterschied zwischen `dnf copr disable` und `dnf copr remove`?
- [x] `disable` schaltet das Repository ab, lässt aber die Datei liegen, `remove` löscht sie
- [ ] `disable` deinstalliert auch die Pakete, `remove` nicht
- [ ] Es gibt keinen Unterschied
```

### RPM Fusion

Ein weiteres verbreitetes zusätzliches Repository für Fedora ist **RPM
Fusion**. Es enthält Dinge, die Fedora nicht aufnehmen kann oder will, etwa
bestimmte Medien-Codecs und Treiber. Es ist ein großes, gemeinsames Projekt –
kein Repository eines einzelnen Nutzers wie bei COPR.

Jedes Repository, das du hinzufügst, ist ein Absender mehr, dem du vertraust.
Halte die Liste kurz und räum auf, was du nicht mehr brauchst.
