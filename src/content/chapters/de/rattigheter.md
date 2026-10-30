# Benutzer, Rechte und sudo

Linux ist so gebaut, dass sich mehrere Benutzer denselben Rechner teilen
können. Deshalb hat jede Datei einen Besitzer und Regeln dafür, wer was darf.

## Benutzer und Gruppen

Du bist als Benutzer `elev` angemeldet. Jeder Benutzer gehört zu einer oder
mehreren **Gruppen**:

```sh
id
```

Der wichtigste Benutzer ist **root** – der Administrator, der alles darf. Als
root meldet man sich selten an. Stattdessen benutzt man `sudo` (siehe unten).

## Rechte lesen

Führe `ls -l` aus und sieh dir die erste Spalte an:

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

Das erste Zeichen ist der Typ: `-` für eine Datei, `d` für ein Verzeichnis.
Danach kommen drei Blöcke mit je drei Zeichen:

```text
-     rw-      r--     r--
Typ   Besitzer Gruppe  Andere
```

| Zeichen | Bei einer Datei | Bei einem Verzeichnis |
|---|---|---|
| `r` (read) | Den Inhalt lesen | Den Inhalt auflisten |
| `w` (write) | Den Inhalt ändern | Darin Dateien anlegen und löschen |
| `x` (execute) | Die Datei als Programm ausführen | Mit `cd` in das Verzeichnis wechseln |

Danach folgen der Besitzer (`elev`) und die Gruppe (`elev`).

## Rechte ändern – `chmod`

Rechte lassen sich als **Zahlen** angeben. Jeder Block bekommt eine Ziffer,
die die Summe aus r = 4, w = 2 und x = 1 ist:

| Zahl | Rechte | Typisch für |
|---|---|---|
| `755` | `rwxr-xr-x` | Programme und Verzeichnisse |
| `644` | `rw-r--r--` | Gewöhnliche Dateien |
| `600` | `rw-------` | Geheime Dateien |

```sh
chmod 644 anteckningar.txt
```

Oder mit **Symbolen**: `u` (der Besitzer), `g` (die Gruppe), `o` (andere),
`a` (alle), gefolgt von `+`, `-` oder `=` und den Rechten:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## Skripte

Ein **Skript** ist eine Textdatei mit Befehlen. Die erste Zeile,
`#!/bin/bash`, heißt *Shebang* und sagt dem System, welches Programm die Datei
ausführen soll:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Heute ist:"; date' >> datum.sh
cat datum.sh
```

Damit du das Skript als Programm ausführen kannst, muss es ausführbar sein:

```sh
chmod +x datum.sh
./datum.sh
```

Das `./` ist nötig, weil das aktuelle Verzeichnis nicht im `PATH` steht.

## root und sudo

Manche Dateien, wie `/etc/shadow`, in der die Passwörter gespeichert sind,
kann nur root lesen. Mit `sudo` (*superuser do*) führst du einen einzelnen
Befehl als root aus:

```sh
sudo whoami
```

Beim ersten Mal fragt `sudo` nach **deinem eigenen** Passwort. Nur Benutzer in
der Administratorengruppe dürfen sudo benutzen. Unter {{distro}} heißt diese
Gruppe **{{adminGroup}}**:

:::debian
In der Debian-Familie heißt die Gruppe `sudo`.
:::

:::arch
In der Arch-Familie heißt die Gruppe `wheel` – ein alter Unix-Name für „die,
die das Sagen haben“ (ein *big wheel* ist im Englischen ein hohes Tier).
:::

:::redhat
In der Red-Hat-Familie heißt die Gruppe `wheel` – ein alter Unix-Name für „die,
die das Sagen haben“ (ein *big wheel* ist im Englischen ein hohes Tier).
:::

Musst du viele Befehle als root ausführen, kannst du mit `sudo -i` eine
root-Shell starten. Der Prompt wechselt dann zu `#`. Mit `exit` kommst du
zurück.

> **Denk daran!** Mit sudo gibt es kein Sicherheitsnetz. Führe nur Befehle
> aus, die du verstehst.

### Eine häufige Falle

```text
sudo echo "text" > /etc/file     # funktioniert NICHT
```

Es ist *deine* Shell – nicht sudo –, die die Datei für `>` öffnet. Nimm
stattdessen `tee`, das mit sudo läuft:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
