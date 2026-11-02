# Prüfung: Das System

Beantworte die Fragen zu Variablen, Rechten, Prozessen und Archiven – zum Bestehen brauchst du 80 %.

```predict
$ echo "$HOME" '$USER'
/home/{{user}} $USER
---
Doppelte Anführungszeichen ersetzen die Variable durch ihren Wert; einfache
Anführungszeichen geben sie genau so aus, wie sie dasteht.
```

```quiz
Was macht `export` mit einer Variablen?
- [ ] Speichert sie in `~/.bashrc`
- [x] Macht sie zu einer Umgebungsvariablen, die auch die Programme lesen können, die du startest
- [ ] Löscht sie
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` ist gut gegangen, also ist der Exit-Code `0`. Die Ausgabe selbst ist in
`/dev/null` verschwunden.
```

```quiz
Welche Zahl ergibt die Rechte `rwxr-x---`?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Besitzer: 4 + 2 + 1 = 7. Gruppe: 4 + 1 = 5. Andere: 0.
```

```predict
$ touch werkzeug.sh
$ chmod 755 werkzeug.sh
$ chmod go-x werkzeug.sh
$ ls -l werkzeug.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
Die Mitglieder welcher Gruppe dürfen unter Ubuntu `sudo` verwenden?
- [x] `sudo`
- [ ] `root`
- [ ] `{{user}}`
```

```quiz
Was macht `sudo -i`?
- [ ] Zeigt Informationen über sudo
- [x] Startet eine root-Shell, in der sich der Prompt zu `#` ändert, bis du `exit` tippst
- [ ] Führt den vorigen Befehl noch einmal als root aus
```

```quiz
In `ps aux` hat ein Prozess `R` in der Spalte `STAT`. Was bedeutet das?
- [x] Er läuft
- [ ] Er schläft
- [ ] Er gehört root
```

```quiz
Welche Variable enthält die PID des zuletzt gestarteten Hintergrundjobs?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
Du versuchst `kill 812` bei einem Prozess, der root gehört, und bekommst
`Operation not permitted`. Was tust du?
- [ ] Stattdessen `kill -9 812` verwenden
- [x] Es mit `sudo` ausführen: `sudo kill 812`
- [ ] Nichts – die Prozesse von root lassen sich nie beenden
```

```quiz
Was ist der Unterschied zwischen `pkill` und `killall`?
- [x] `pkill` sucht nach einem Muster, `killall` braucht den genauen Namen
- [ ] `pkill` schickt `SIGKILL`, `killall` schickt `SIGTERM`
- [ ] Es gibt keinen – es ist dasselbe Programm
```

```quiz
Was ist falsch an `tar -cvf {{documents}} {{documents}}.tar`?
- [ ] `-v` lässt sich nicht mit `-c` kombinieren
- [x] Die Reihenfolge: Der Name des Archivs muss direkt nach `f` kommen, vor den Dateien
- [ ] Ein tar-Archiv muss auf `.tgz` enden
```

```predict
$ cp {{documents}}/{{fruits}} .
$ gzip {{fruits}}
$ gunzip {{fruits}}.gz
$ ls fruechte*
{{fruits}}
```

```quiz
Was macht `zcat server.log.gz`?
- [x] Gibt den entpackten Inhalt aus, und `server.log.gz` bleibt, wie es ist
- [ ] Packt die Datei nach `server.log` aus
- [ ] Komprimiert die Datei noch einmal
---
`zcat` ist dasselbe wie `gzip -dc`: auf die Standardausgabe entpacken.
```

```try
du -sh {{documents}}
---
`-s` gibt eine einzige Summe für das ganze Verzeichnis, und `-h` macht die
Größe leicht lesbar.
```
