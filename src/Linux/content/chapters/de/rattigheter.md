# Benutzer, Rechte und sudo

Linux ist so gebaut, dass sich mehrere Benutzer denselben Rechner teilen
können. Deshalb hat jede Datei einen Besitzer und Regeln dafür, wer was darf.

## Benutzer und Gruppen

Du bist als Benutzer `{{user}}` angemeldet. Jeder Benutzer gehört zu einer oder
mehreren **Gruppen**:

```sh
id
```

Der wichtigste Benutzer ist **root** – der Administrator, der alles darf. Als
root meldet man sich selten an. Stattdessen benutzt man `sudo` (siehe unten).

## Rechte lesen

Führe `ls -l` aus und sieh dir die erste Spalte an:

```text
-rw-r--r-- 1 {{user}} {{user}}  194 Oct 29 13:55 {{notes}}
drwxr-xr-x 2 {{user}} {{user}} 4096 Oct 29 13:55 {{documents}}
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

Danach folgen der Besitzer (`{{user}}`) und die Gruppe (`{{user}}`).

```quiz
Ein Verzeichnis hat die Rechte `drwxr-x---`. Was dürfen Mitglieder seiner Gruppe?
- [ ] Gar nichts
- [x] Den Inhalt auflisten und mit `cd` hineinwechseln, aber darin keine Dateien anlegen oder löschen
- [ ] Alles, was der Besitzer darf
---
Der Block der Gruppe ist `r-x`: Mit `r` kannst du den Inhalt auflisten und mit
`x` in das Verzeichnis wechseln. Ohne `w` kannst du darin keine Dateien anlegen
oder löschen.
```

## Rechte ändern – `chmod`

Rechte lassen sich als **Zahlen** angeben. Jeder Block bekommt eine Ziffer,
die die Summe aus r = 4, w = 2 und x = 1 ist:

| Zahl | Rechte | Typisch für |
|---|---|---|
| `755` | `rwxr-xr-x` | Programme und Verzeichnisse |
| `644` | `rw-r--r--` | Gewöhnliche Dateien |
| `600` | `rw-------` | Geheime Dateien |

```sh
chmod 644 {{notes}}
```

Oder mit **Symbolen**: `u` (der Besitzer), `g` (die Gruppe), `o` (andere),
`a` (alle), gefolgt von `+`, `-` oder `=` und den Rechten:

```sh
chmod u+x skript.sh
chmod go-w datei.txt
```

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | cut -d' ' -f1
-rw-r-----
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

```quiz
Du hast das Skript `test.sh` geschrieben und führst `./test.sh` aus, bekommst
aber `Permission denied`. Was fehlt?
- [ ] Ein `sudo` davor
- [x] Das Ausführungsrecht – führe zuerst `chmod +x test.sh` aus
- [ ] Das `./` – es sollte `test.sh` heißen
---
Damit eine Datei als Programm laufen kann, braucht sie das Recht `x`. Das `./`
ist richtig: Ohne es sucht die Shell nur in den Verzeichnissen aus `PATH`.
```

## root und sudo

Manche Dateien, wie `/etc/shadow`, in der die Passwörter gespeichert sind,
kann nur root lesen. Mit `sudo` (*superuser do*) führst du einen einzelnen
Befehl als root aus:

```sh
sudo whoami
```

Beim ersten Mal fragt `sudo` nach **deinem eigenen** Passwort. Nur Benutzer in
der Administratorengruppe dürfen sudo benutzen. Unter Ubuntu heißt diese
Gruppe **sudo** – du siehst sie unter deinen Gruppen, wenn du `id` ausführst.
Manche andere Distributionen nennen die Gruppe stattdessen `wheel`; mehr über
die Unterschiede zwischen Distributionen liest du im Teil über Distributionen.

Musst du viele Befehle als root ausführen, kannst du mit `sudo -i` eine
root-Shell starten. Der Prompt wechselt dann zu `#`. Mit `exit` kommst du
zurück.

> **Denk daran!** Mit sudo gibt es kein Sicherheitsnetz. Führe nur Befehle
> aus, die du verstehst.

```quiz
`sudo` fragt nach einem Passwort. Wessen Passwort solltest du eingeben?
- [ ] Das Passwort von root
- [x] Dein eigenes Passwort
- [ ] Kein Passwort – einfach Enter drücken
---
`sudo` fragt nach **deinem eigenen** Passwort und lässt dich nur durch, wenn du
in der Administratorengruppe bist.
```

### Eine häufige Falle

```text
sudo echo "text" > /etc/file     # funktioniert NICHT
```

Es ist *deine* Shell – nicht sudo –, die die Datei für `>` öffnet. Nimm
stattdessen `tee`, das mit sudo läuft:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
Warum funktioniert `sudo echo "text" > /etc/file` nicht?
- [ ] `echo` kann nicht mit sudo ausgeführt werden
- [x] Deine eigene Shell öffnet die Datei für `>`, und die läuft nicht als root
- [ ] Dateien in `/etc` können nie geändert werden
---
sudo gilt nur für den Befehl (`echo`). Die Umleitung erledigt deine Shell, und
die läuft als du. `tee` ist das Programm, das die Datei schreibt, also braucht
`tee` das sudo.
```
