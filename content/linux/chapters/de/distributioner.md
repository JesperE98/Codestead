# Distributionen und Familien

Du kennst jetzt die Grundlagen, und die funktionieren auf jeder Distribution
gleich. Was unterscheidet die Distributionen dann eigentlich?

:::debian
Gerade benutzt du **{{distro}}** aus der **Debian-Familie**.
:::

:::arch
Gerade benutzt du **{{distro}}** aus der **Arch-Familie**.
:::

:::redhat
Gerade benutzt du **{{distro}}** aus der **Red-Hat-Familie**.
:::

Dieses Kapitel ist ein Überblick. Wechsle ruhig im Menü oben die Distribution
und mach die Aufgaben noch einmal – du siehst die Unterschiede sofort. Nach
diesem Kapitel kommt ein Kapitel für jede Familie: die **Debian-Familie**
(apt), die **Arch-Familie** (pacman) und die **Red-Hat-Familie** (dnf). Jedes
davon läuft immer auf einer Distribution aus dieser Familie, sodass du alle
drei machen kannst.

## Was ist überall gleich?

- **Der Linux-Kernel** – wenn auch in verschiedenen Versionen.
- **Die Shell bash** und die grundlegenden Werkzeuge (`ls`, `cp`, `grep` ...)
  von GNU.
- **Die Verzeichnisstruktur** – `/etc`, `/home`, `/usr/bin` und so weiter.
- **systemd**, das auf fast jeder großen Distribution das System startet und
  Dienste verwaltet.

Die Variable `SHELL` enthält den vollständigen Pfad der Shell, mit der du dich
anmeldest – bei bash denselben Pfad, den du in die Shebang-Zeile eines Skripts
schreibst.

```predict
$ echo $SHELL
/bin/bash
---
Die Shell ist auf jeder Distribution im Simulator bash – egal, welche du
gewählt hast.
```

## Was ist anders?

| | Debian-Familie | Arch-Familie | Red-Hat-Familie |
|---|---|---|---|
| Paketmanager | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-Level-Werkzeug | `dpkg` | (pacman) | `rpm` |
| Sudo-Gruppe | `sudo` | `wheel` | `wheel` |
| Veröffentlichungen | Stabile Versionen | Rolling | Alle 6 Monate eine neue Version (Fedora) |

```quiz
In welchen Familien heißt die Gruppe, die sudo benutzen darf, `wheel`?
- [ ] Die Debian-Familie
- [x] Die Arch-Familie
- [x] Die Red-Hat-Familie
---
Die Debian-Familie nennt die Gruppe `sudo`; Arch und Red Hat nennen sie `wheel`.
```

### Release-Modelle

- **Stabil mit festen Versionen** – Debian bringt ungefähr alle zwei Jahre eine
  neue Version heraus, und Ubuntu LTS (*Long Term Support*) erscheint alle zwei
  Jahre mit fünf Jahren Support. Programme bekommen Sicherheitsupdates, werden
  aber selten durch neuere Versionen ersetzt. Ideal für Server.
- **Rolling** – Arch hat überhaupt keine Versionen. Du aktualisierst laufend
  und bekommst immer das Neueste. Das verlangt dir als Benutzer etwas mehr ab.
- **Schnelllebig** – Fedora veröffentlicht etwa alle sechs Monate eine neue
  Version und dient als eine Art Testfeld für Red Hat Enterprise Linux (RHEL),
  das wiederum zehn Jahre Support hat und von Unternehmen eingesetzt wird.

```quiz
Welche Distribution hat überhaupt keine Versionen, sondern wird laufend
aktualisiert (*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## Welche Distribution benutze ich?

Die Datei `/etc/os-release` gibt es auf allen modernen Distributionen; sie
verrät dir Name und Version:

```sh
cat /etc/os-release
```

Die Kernel-Version zeigt `uname -r`:

```sh
uname -r
```

```try
cat /etc/os-release
---
Die Zeilen `NAME` und `PRETTY_NAME` verraten dir, welche Distribution es ist.
```

## Pakete, Repositorys und Abhängigkeiten

Unter Windows und macOS lädst du Programme oft von einer Website herunter.
Unter Linux installierst du stattdessen fast alles mit einem
**Paketmanager**. Das ist der größte Unterschied zwischen den
Distributionsfamilien.

- Ein **Paket** ist ein Programm (oder eine Bibliothek), in eine Datei gepackt,
  zusammen mit Informationen über seine Version und darüber, was es braucht.
- Ein **Repository** ist ein Server, auf dem die Distribution all ihre Pakete
  veröffentlicht. Sie sind getestet und signiert, sodass du weißt, dass niemand
  sie manipuliert hat.
- Eine **Abhängigkeit** ist ein anderes Paket, das benötigt wird. Der
  Paketmanager installiert Abhängigkeiten automatisch.

Der Paketmanager behält außerdem den Überblick darüber, was installiert ist,
und kann mit einem einzigen Befehl *alles* auf dem Rechner aktualisieren.
Befehle, die das System verändern, brauchen root-Rechte und werden deshalb mit
`sudo` ausgeführt.

```quiz
Ein Paket braucht ein anderes Paket, das du nicht hast. Was passiert, wenn du
es mit dem Paketmanager installierst?
- [ ] Die Installation bricht ab, und du musst das andere Paket selbst suchen
- [x] Der Paketmanager installiert die Abhängigkeit automatisch
- [ ] Das Paket wird installiert, funktioniert aber erst, wenn du das andere herunterlädst
```

### Dasselbe Programm, verschiedene Namen

Pakete heißen meistens überall gleich – aber nicht immer. Ein paar Beispiele:

| Programm | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| SSH-Client | `openssh-client` | `openssh` | `openssh-clients` |

Such im Zweifel immer mit dem Paketmanager nach dem Namen.

## Die Konfiguration des Paketmanagers

:::debian
In der Debian-Familie legen die Dateien in `/etc/apt/sources.list.d/` fest,
aus welchen *Repositorys* apt Pakete holt:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
In der Arch-Familie wird pacman über `/etc/pacman.conf` konfiguriert, und die
Liste der Spiegelserver liegt in `/etc/pacman.d/mirrorlist`:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
In der Red-Hat-Familie stehen die Einstellungen von dnf in `/etc/dnf/dnf.conf`,
und die *Repositorys* werden durch Dateien in `/etc/yum.repos.d/` beschrieben:

```sh
ls /etc/yum.repos.d
```
:::

## Welche soll ich nehmen?

Eine richtige Antwort gibt es nicht, aber hier ist eine Faustregel:

- **Neu bei Linux?** Ubuntu, Linux Mint oder Fedora.
- **Ein Server?** Debian, Ubuntu LTS oder ein RHEL-Klon wie Rocky Linux.
- **Willst du lernen, wie alles zusammenhängt?** Arch – und sein
  ausgezeichnetes Wiki.
