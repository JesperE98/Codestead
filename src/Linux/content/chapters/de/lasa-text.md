# Text lesen und durchsuchen

Fast alles unter Linux ist Text: Einstellungen, Logs, Listen. Deshalb gibt es
viele kleine Werkzeuge zum Lesen und Durchsuchen von Textdateien. In deinem
Home-Verzeichnis liegt ein Verzeichnis namens `{{documents}}` mit Dateien zum Üben,
darunter `{{fruits}}`, eine Liste von Früchten, und `server.log`, das Log eines
ausgedachten Webservers. Die Wörter, nach denen du suchen wirst – `INFO`,
`WARN` und `ERROR` –, sind dieselben wie in echten Logs.

## Eine Datei anzeigen – `cat` und `less`

`cat` gibt die ganze Datei aus:

```sh
cat {{documents}}/{{fruits}}
```

Für lange Dateien ist `less` besser. Dort blätterst du mit den Pfeiltasten und
der Leertaste, suchst mit `/word` und beendest mit `q`.

Sieh dir die Liste der Früchte an – du brauchst sie für die nächste Frage:

```try
cat {{documents}}/{{fruits}}
```

## Anfang und Ende – `head` und `tail`

`head` zeigt die ersten Zeilen und `tail` die letzten. Standard sind 10
Zeilen, aber mit `-n` kannst du selbst wählen:

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

`tail -f` *verfolgt* eine Datei und zeigt neue Zeilen, sobald sie geschrieben
werden – perfekt für Logs. Beende es mit **Strg+C**.

```predict
$ tail -n 1 {{documents}}/{{fruits}}
Mango
---
`tail -n 1` zeigt nur die allerletzte Zeile.
```

## Zählen – `wc`

`wc` (*word count*) zählt Zeilen, Wörter und Bytes:

```sh
wc {{documents}}/{{fruits}}
```

Oft willst du nur die Anzahl der Zeilen: `wc -l`.

## Suchen – `grep`

`grep` ist einer der nützlichsten Befehle überhaupt. Er zeigt jede Zeile, die
ein Muster enthält:

```sh
grep INFO {{documents}}/server.log
```

Ein paar Optionen, die du oft brauchen wirst:

| Option | Bedeutung |
|---|---|
| `-i` | Groß- und Kleinschreibung ignorieren |
| `-n` | Zeilennummern anzeigen |
| `-v` | Zeilen anzeigen, die *nicht* passen |
| `-c` | Passende Zeilen zählen |
| `-r` | Rekursiv in allen Dateien eines Verzeichnisses suchen |
| `-E` | Erweiterte Muster, z. B. `"ERROR|WARN"` |

```sh
grep -n WARN {{documents}}/server.log
```

Das Muster ist ein *regulärer Ausdruck*. Ein paar Beispiele: `^` bedeutet
Zeilenanfang und `$` Zeilenende, also findet `grep "^2026"` Zeilen, die mit
2026 beginnen.

```quiz
`server.log` hat zwei Zeilen mit `WARN` und eine Zeile mit `warn` in
Kleinbuchstaben. Was gibt `grep -c WARN {{documents}}/server.log` aus?
- [ ] 1
- [x] 2
- [ ] 3
---
`-c` zählt die passenden Zeilen, und ohne `-i` werden Groß- und Kleinschreibung
unterschieden. `grep -ic WARN` würde alle drei zählen.
```

```quiz
Welcher Befehl zeigt jede Zeile in `server.log`, die **nicht** `INFO` enthält?
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## Sortieren – `sort` und `uniq`

`sort` sortiert Zeilen alphabetisch (`-n` für Zahlen, `-r` für umgekehrte
Reihenfolge). `uniq` entfernt Zeilen, die mit der Zeile *direkt darüber*
identisch sind – deshalb wird es fast immer nach `sort` verwendet:

```sh
sort {{documents}}/{{fruits}}
```

```quiz
Warum wird `uniq` fast immer nach `sort` verwendet?
- [ ] `uniq` funktioniert nur mit sortierten Dateien und schlägt sonst fehl
- [x] `uniq` entfernt nur Zeilen, die mit der Zeile direkt darüber identisch sind, also müssen gleiche Zeilen nebeneinanderstehen
- [ ] `sort` entfernt Duplikate und `uniq` fügt sie wieder ein
```

## Felder herausschneiden – `cut`

In `{{documents}}` gibt es eine dritte Übungsdatei, `{{grades}}`, eine CSV-Datei mit
den Punkten der Schüler in verschiedenen Fächern:

```sh
cat ~/{{documents}}/{{grades}}
```

CSV steht für *comma-separated values* – die Spalten sind durch Kommas
getrennt, und die erste Zeile ist eine Kopfzeile.

Besteht eine Datei aus Feldern mit einem Trennzeichen dazwischen, kann `cut`
ein Feld herauspicken. `-d` wählt das Trennzeichen (*delimiter*) und `-f`, welches
Feld übrig bleiben soll. Hier sind die Fächer – Feld 2 – aus der CSV-Datei:

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

In `/etc/passwd` sind die Felder durch Doppelpunkte getrennt, und Feld 1 ist
der Benutzername, also listet `cut -d: -f1 /etc/passwd` alle Benutzer auf.

## Das Handbuch – `man`

Vergessen, was eine Option macht? Jeder Befehl hat eine Handbuchseite
(*man page*):

```sh
man grep
```
