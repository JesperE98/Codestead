# Text lesen und durchsuchen

Fast alles unter Linux ist Text: Einstellungen, Logs, Listen. Deshalb gibt es
viele kleine Werkzeuge zum Lesen und Durchsuchen von Textdateien. In deinem
Home-Verzeichnis liegt ein Verzeichnis namens `dokument` mit zwei Dateien zum
Üben: `frukter.txt` (eine Liste von Früchten) und `server.log` (ein Log eines
ausgedachten Webservers). Ihr Inhalt ist auf Schwedisch, aber die Wörter, nach
denen du suchen wirst – `INFO`, `WARN` und `ERROR` –, sind dieselben wie in
echten Logs.

## Eine Datei anzeigen – `cat` und `less`

`cat` gibt die ganze Datei aus:

```sh
cat dokument/frukter.txt
```

Für lange Dateien ist `less` besser. Dort blätterst du mit den Pfeiltasten und
der Leertaste, suchst mit `/word` und beendest mit `q`.

## Anfang und Ende – `head` und `tail`

`head` zeigt die ersten Zeilen und `tail` die letzten. Standard sind 10
Zeilen, aber mit `-n` kannst du selbst wählen:

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` *verfolgt* eine Datei und zeigt neue Zeilen, sobald sie geschrieben
werden – perfekt für Logs. Beende es mit **Strg+C**.

## Zählen – `wc`

`wc` (*word count*) zählt Zeilen, Wörter und Bytes:

```sh
wc dokument/frukter.txt
```

Oft willst du nur die Anzahl der Zeilen: `wc -l`.

## Suchen – `grep`

`grep` ist einer der nützlichsten Befehle überhaupt. Er zeigt jede Zeile, die
ein Muster enthält:

```sh
grep INFO dokument/server.log
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
grep -n WARN dokument/server.log
```

Das Muster ist ein *regulärer Ausdruck*. Ein paar Beispiele: `^` bedeutet
Zeilenanfang und `$` Zeilenende, also findet `grep "^2026"` Zeilen, die mit
2026 beginnen.

## Sortieren – `sort` und `uniq`

`sort` sortiert Zeilen alphabetisch (`-n` für Zahlen, `-r` für umgekehrte
Reihenfolge). `uniq` entfernt Zeilen, die mit der Zeile *direkt darüber*
identisch sind – deshalb wird es fast immer nach `sort` verwendet:

```sh
sort dokument/frukter.txt
```

## Das Handbuch – `man`

Vergessen, was eine Option macht? Jeder Befehl hat eine Handbuchseite
(*man page*):

```sh
man grep
```
