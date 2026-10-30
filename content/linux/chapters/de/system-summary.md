# Zusammenfassung: Das System

In diesem Teil hast du dir angesehen, was rund um deine Befehle passiert: das
Gedächtnis der Shell, wer was darf, welche Programme laufen und wie Dateien
zusammengepackt werden.

## Variablen, PATH und Aliase

Eine Variable liest du mit `$NAME` und legst sie mit `NAME=wert` an – ohne
Leerzeichen um das `=`. `export` macht sie zu einer Umgebungsvariablen, die
auch Programme lesen können, die du startest. In doppelten Anführungszeichen
werden Variablen durch ihre Werte ersetzt; in einfachen Anführungszeichen wird
alles genau so ausgegeben, wie es dasteht. Die Shell sucht Befehle in den
Verzeichnissen in `PATH`, und `$?` enthält den Exit-Code des letzten Befehls:
`0` bedeutet, dass alles gut gegangen ist. Aliase und Variablen verschwinden,
wenn du das Terminal schließt, es sei denn, du trägst sie in `~/.bashrc` ein.

## Benutzer, Rechte und sudo

Jede Datei hat einen Besitzer, eine Gruppe und drei Sätze von Rechten – für
den Besitzer, die Gruppe und alle anderen. `r` = 4, `w` = 2 und `x` = 1, also
ist `755` gleich `rwxr-xr-x` und `600` gleich `rw-------`. Ein Skript braucht
das Recht `x` und wird mit `./` ausgeführt, weil das Verzeichnis, in dem du
bist, nicht zu `PATH` gehört. `sudo` führt einen einzelnen Befehl als root aus
und fragt nach deinem eigenen Passwort. Unter Ubuntu dürfen die Benutzer in
der Gruppe `sudo` es verwenden.

## Prozesse und Jobs

Jedes laufende Programm ist ein Prozess mit einer PID und einem Elternprozess
(PPID). `ps aux` zeigt sie alle, und `top` zeigt sie live, nach
Prozessorauslastung sortiert. `kill` schickt ein Signal: standardmäßig
`SIGTERM` (15) und als letztes Mittel `SIGKILL` (9). Mit `&` läuft ein Befehl
im Hintergrund, und mit `jobs`, `fg` und `bg` verwaltest du die Jobs in
deinem Terminal.

## Archive und Komprimierung

`tar` sammelt Dateien in einem Archiv, und `gzip` macht eine einzelne Datei
kleiner – zusammen ergeben sie ein `.tar.gz`. Genau eines von `c`, `x` und
`t` sagt tar, was es tun soll, und auf `f` folgt der Name des Archivs. `zcat`
liest eine `.gz`-Datei, ohne sie auszupacken, und `zip -r` / `unzip` kümmern
sich um zip-Dateien, die sich leicht mit Windows und macOS teilen lassen.

## Befehle und Optionen

| Befehl | Tut |
|---|---|
| `echo $NAME` | Den Wert einer Variablen anzeigen |
| `export NAME=value` | Eine Umgebungsvariable anlegen |
| `env` | Alle Umgebungsvariablen auflisten |
| `which ls` · `type cd` | Zeigen, wo ein Programm liegt · was ein Name ist |
| `echo $?` | Den Exit-Code des vorigen Befehls anzeigen |
| `alias ll='ls -la'` · `unalias ll` | Einen Alias anlegen · entfernen |
| `source ~/.bashrc` | `~/.bashrc` sofort laden |
| `id` · `groups` | Deinen Benutzer und deine Gruppen anzeigen |
| `ls -l` | Rechte, Besitzer und Gruppe anzeigen |
| `chmod 644 file` · `chmod u+x file` | Rechte mit Zahlen · Symbolen ändern |
| `sudo command` · `sudo -i` | Einen Befehl als root ausführen · eine root-Shell starten |
| `sudo tee -a file` | Am Ende einer Pipe: Text an eine Datei anhängen, die nur root ändern darf |
| `ps` · `ps aux` · `ps -ef` | Deine Prozesse · alle Prozesse · mit der PID des Elternprozesses |
| `ps aux --sort=-%cpu` | Alle Prozesse, die schwersten zuerst |
| `pgrep -l name` | Die PID eines Prozesses anhand des Namens finden |
| `top` | Eine Live-Ansicht der Prozesse |
| `kill PID` · `kill -9 PID` | Einen Prozess bitten, sich zu beenden · ihn zwingen |
| `pkill pattern` · `killall name` | Prozesse anhand des Namens beenden |
| `command &` | Einen Befehl im Hintergrund ausführen |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | Jobs auflisten · in den Vordergrund · in den Hintergrund · einen Job beenden |
| `uptime` · `free -h` | Last · Arbeitsspeicher |
| `tar -czvf archive.tar.gz dir` | Ein Verzeichnis packen und komprimieren |
| `tar -tzvf archive.tar.gz` | Den Inhalt eines Archivs auflisten |
| `tar -xzvf archive.tar.gz -C dir` | Ein Archiv in ein Verzeichnis auspacken |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | Komprimieren · das Original behalten · auspacken |
| `zcat file.gz` | Eine komprimierte Datei direkt lesen |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | Eine zip-Datei anlegen · auspacken |
| `du -sh dir` | Zeigen, wie viel Platz etwas belegt |
