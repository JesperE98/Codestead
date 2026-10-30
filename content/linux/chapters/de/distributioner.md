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

Wechsle ruhig im Menü oben die Distribution und mach die Aufgaben noch einmal
– du siehst die Unterschiede sofort.

## Was ist überall gleich?

- **Der Linux-Kernel** – wenn auch in verschiedenen Versionen.
- **Die Shell bash** und die grundlegenden Werkzeuge (`ls`, `cp`, `grep` ...)
  von GNU.
- **Die Verzeichnisstruktur** – `/etc`, `/home`, `/usr/bin` und so weiter.
- **systemd**, das auf fast jeder großen Distribution das System startet und
  Dienste verwaltet.

## Was ist anders?

| | Debian-Familie | Arch-Familie | Red-Hat-Familie |
|---|---|---|---|
| Paketmanager | `apt` | `pacman` | `dnf` |
| Paketformat | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Low-Level-Werkzeug | `dpkg` | (pacman) | `rpm` |
| Sudo-Gruppe | `sudo` | `wheel` | `wheel` |
| Veröffentlichungen | Stabile Versionen | Rolling | Alle 6 Monate eine neue Version (Fedora) |

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
