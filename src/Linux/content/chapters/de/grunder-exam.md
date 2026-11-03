# Prüfung: Grundlagen

Beantworte die Fragen unten, um zu zeigen, was du in diesem Teil gelernt hast.

```quiz
Welcher dieser Pfade ist **absolut**?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `{{documents}}`
---
Ein absoluter Pfad beginnt mit `/`, bei der Wurzel. Die anderen gehen von dem
Verzeichnis aus, in dem du gerade bist.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Jedes `..` geht eine Ebene nach oben: von `/var/log` nach `/var` und dann
nach `/`.
```

```quiz
Was macht `cd -`?
- [ ] Geht eine Ebene nach oben
- [ ] Geht in dein Home-Verzeichnis
- [x] Geht zurück in das Verzeichnis, in dem du zuletzt warst
```

```quiz
Du willst das ganze Verzeichnis `{{pictures}}` mit allem, was darin ist, nach `{{pictures}}-kopie` kopieren. Welcher Befehl funktioniert?
- [ ] `cp {{pictures}} {{pictures}}-kopie`
- [x] `cp -r {{pictures}} {{pictures}}-kopie`
- [ ] `mv {{pictures}} {{pictures}}-kopie`
---
Ein Verzeichnis wird mit `-r` (*rekursiv*) kopiert. `mv` würde es
verschieben, statt es zu kopieren.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` legt `a`, `a/b` und `a/b/c` in einem Rutsch an, also enthält `a/b` das
Verzeichnis `c`.
```

```quiz
Du tippst `touch meine datei.txt` – ohne Anführungszeichen. Was passiert?
- [ ] Eine Datei namens `meine datei.txt` wird angelegt
- [x] Zwei Dateien werden angelegt: `meine` und `datei.txt`
- [ ] Nichts, weil der Name ein Leerzeichen enthält
---
Die Shell teilt die Zeile an Leerzeichen auf, also bekommt `touch` zwei
Argumente. Schreib `touch "meine datei.txt"`, um eine einzige Datei zu bekommen.
```

```quiz
Welche Zeilen zeigt `grep -i error {{documents}}/server.log`?
- [ ] Nur Zeilen mit `error` in Kleinbuchstaben
- [ ] Nur Zeilen mit `ERROR` in Großbuchstaben
- [x] Zeilen mit `error` in beliebiger Groß- und Kleinschreibung
```

```quiz
Du willst eine Logdatei beobachten und neue Zeilen sehen, sobald sie geschrieben werden. Welcher Befehl passt?
- [ ] `head -n 10 {{documents}}/server.log`
- [x] `tail -f {{documents}}/server.log`
- [ ] `wc -l {{documents}}/server.log`
---
`tail -f` *verfolgt* die Datei. Beende es mit **Strg+C**.
```

```quiz
Was gibt `wc` aus, wenn du ihm eine Datei und keine Optionen gibst?
- [ ] Nur die Anzahl der Zeilen
- [x] Die Anzahl der Zeilen, Wörter und Bytes
- [ ] Die ersten 10 Zeilen der Datei
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` hat `b` angehängt, aber das letzte `>` hat die ganze Datei
überschrieben.
```

```quiz
Wann läuft `b` in `a || b`?
- [ ] Immer, nach `a`
- [ ] Nur wenn `a` geklappt hat
- [x] Nur wenn `a` fehlgeschlagen ist
```

```try
grep ERROR ~/{{documents}}/server.log | tee fehler.txt | wc -l
---
`tee` hat die Fehlerzeilen in `fehler.txt` gespeichert und an `wc -l`
weitergereicht, das sie gezählt hat.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` macht das Komma zum Trennzeichen, und `-f2` behält Feld 2.
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` ist die Anzahl der Felder in der Zeile. Felder werden durch Leerzeichen
getrennt.
```

```quiz
Warum sollte ein awk-Programm wie `'{print $3}'` in **einfachen** Anführungszeichen stehen?
- [ ] awk kann keine doppelten Anführungszeichen lesen
- [x] Sonst hält die Shell `$3` für eine Shell-Variable und ersetzt sie, bevor awk startet
- [ ] Einfache Anführungszeichen lassen awk schneller laufen
```
