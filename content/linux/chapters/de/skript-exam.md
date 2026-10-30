# Prüfung: Skripte und Automatisierung

Beantworte die Fragen zu Shell-Skripten – zum Bestehen brauchst du 80 %.

```quiz
Was macht die erste Zeile `#!/bin/bash` in einem Skript?
- [ ] Sie ist ein Kommentar, den die Shell überspringt
- [x] Sie sagt dem System, welches Programm die Datei ausführen soll
- [ ] Sie macht die Datei ausführbar
---
Sie heißt *Shebang*. Um die Datei ausführbar zu machen, brauchst du trotzdem
`chmod +x`.
```

```quiz
`namn = Kim` ergibt den Fehler `command not found`. Warum?
- [x] Durch die Leerzeichen um `=` hält die Shell `namn` für einen Befehl
- [ ] Variablennamen müssen in Großbuchstaben geschrieben werden
- [ ] Du musst `$namn = Kim` schreiben
```

```predict
$ antal=$(ls ~/dokument | wc -l)
$ echo "$antal files"
3 files
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
Was enthält `"$@"` in einem Skript?
- [ ] Die Anzahl der Argumente
- [ ] Den Namen des Skripts
- [x] Alle Argumente, jedes einzeln
```

```quiz
Welcher Test ist wahr, wenn die Zahl in `n` größer als 10 ist?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Zahlen werden mit `-eq`, `-lt`, `-gt` und so weiter verglichen; `=` und `<`
vergleichen Text.
```

```predict
$ [ -d ~/finnsinte ] && echo yes || echo no
no
```

```predict
$ fil=rapport.txt
$ case $fil in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` springt direkt zur nächsten Runde, also wird `3` nie ausgegeben.
```

```quiz
Was macht `local` in einer Funktion?
- [x] Legt eine Variable an, die nur innerhalb der Funktion existiert
- [ ] Lässt die Funktion schneller laufen
- [ ] Beendet die Funktion mit einem Exit-Code
```

```quiz
Warum endet ein Skript mit `exit 1`, wenn etwas schiefgeht?
- [ ] Um das Skript neu zu starten
- [x] Damit der, der das Skript aufgerufen hat, am Exit-Code sieht, dass es fehlgeschlagen ist
- [ ] Um die Zahl 1 auszugeben
```

```quiz
Du beginnst ein Here-Document mit `cat > hej.sh << 'SLUT'`. Wann endet es?
- [ ] Wenn du in einer leeren Zeile Enter drückst
- [x] Bei der Zeile `SLUT`
- [ ] Nach zehn Zeilen
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
