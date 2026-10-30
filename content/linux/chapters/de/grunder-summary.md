# Zusammenfassung: Grundlagen

Du hast die Befehle gelernt, die du jeden Tag benutzen wirst, auf jeder
Distribution. Hier ist ein kurzer Rückblick vor der Prüfung.

## Im Dateisystem navigieren

Alles liegt in einem einzigen Baum, der bei der Wurzel `/` beginnt.
Einstellungen liegen in `/etc`, Programme in `/usr/bin`, Logs in `/var/log`
und deine eigenen Dateien in deinem Home-Verzeichnis `~`. `pwd` zeigt, wo du
bist, `ls` listet auf, was dort liegt, und `cd` bringt dich woandershin. Ein
**absoluter** Pfad beginnt mit `/`; ein **relativer** Pfad geht von dem
Verzeichnis aus, in dem du gerade bist. `..` ist das Verzeichnis darüber, und
`cd` ohne Argumente bringt dich nach Hause.

## Dateien und Verzeichnisse

`mkdir` legt Verzeichnisse an (`-p` legt mehrere Ebenen auf einmal an), und
`touch` legt leere Dateien an. `cp` kopiert (`-r` für ganze Verzeichnisse),
`mv` verschiebt und benennt um, und `rm` löscht – endgültig, es gibt keinen
Papierkorb. `rmdir` entfernt nur leere Verzeichnisse; `rm -r` entfernt ein
Verzeichnis mit allem, was darin ist. Platzhalter wie `*`, `?` und `[abc]`
werden von der Shell aufgelöst, bevor der Befehl läuft, und Namen mit
Leerzeichen brauchen Anführungszeichen.

## Text lesen und durchsuchen

`cat` gibt eine Datei aus, und mit `less` kannst du durch sie blättern.
`head` und `tail` zeigen den Anfang und das Ende (`-n` wählt, wie viele
Zeilen, `tail -f` verfolgt eine Datei). `wc` zählt Zeilen, Wörter und Bytes.
`grep` zeigt die Zeilen, die zu einem Muster passen, `sort` sortiert Zeilen,
und `uniq` entfernt wiederholte Zeilen, die direkt aufeinander folgen. `man`
zeigt das Handbuch zu einem Befehl.

## Umleitungen und Pipes

Jedes Programm hat drei Datenströme: stdin, stdout und stderr. `>` schickt
stdout in eine Datei (und überschreibt sie), `>>` hängt an, `<` liest stdin
aus einer Datei, und `2>` leitet Fehlermeldungen um – zum Beispiel nach
`/dev/null`. Eine Pipe `|` schickt die Ausgabe eines Befehls in den nächsten,
und `tee` speichert unterwegs eine Kopie. `;`, `&&` und `||` führen mehrere
Befehle in einer Zeile aus.

## Textbearbeitung mit sed, tr und awk

`tr` ersetzt, löscht (`-d`) oder staucht (`-s`) einzelne Zeichen und liest
nur von stdin. `sed` bearbeitet Zeilen: `s/alt/neu/` ersetzt (`g` für jeden
Treffer), Adressen wählen Zeilen aus, `d` löscht, und `-n` mit `p` gibt nur
das aus, worum du bittest. `sed -i` ändert die Datei selbst. `cut` pickt ein
Feld heraus, und `awk` arbeitet mit Spalten: `-F` legt das Trennzeichen fest,
`$1` … `$NF` sind die Felder, ein Muster vor `{ }` wählt Zeilen aus, und
`END { }` läuft nach der letzten Zeile.

## Befehle und Optionen

| Befehl | Was er tut | Optionen und Syntax aus diesem Teil |
|---|---|---|
| `pwd` | Zeigt das Verzeichnis, in dem du bist | |
| `ls` | Listet den Inhalt eines Verzeichnisses auf | `-l` langes Format, `-a` auch versteckte Dateien |
| `cd` | Wechselt das Verzeichnis | `..` hoch, `~` nach Hause, `-` das letzte Verzeichnis, kein Argument = nach Hause |
| `mkdir` | Legt ein Verzeichnis an | `-p` mehrere Ebenen auf einmal |
| `touch` | Legt eine leere Datei an | |
| `cp` | Kopiert | `-r` ganze Verzeichnisse |
| `mv` | Verschiebt oder benennt um | |
| `rm` | Löscht | `-r` Verzeichnisse samt Inhalt, `-f` ohne Nachfrage |
| `rmdir` | Entfernt ein leeres Verzeichnis | |
| `cat` | Gibt eine Datei aus | |
| `less` | Zeigt eine Datei seitenweise | `/wort` sucht, `q` beendet |
| `head` / `tail` | Die ersten / letzten Zeilen | `-n N` Anzahl Zeilen, `tail -f` verfolgt |
| `wc` | Zählt Zeilen, Wörter und Bytes | `-l` nur Zeilen |
| `grep` | Zeigt passende Zeilen | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Sortiert Zeilen | `-n` Zahlen, `-r` umgekehrte Reihenfolge |
| `uniq` | Entfernt wiederholte benachbarte Zeilen | `-c` zählt sie |
| `man` | Zeigt die Handbuchseite | |
| `tee` | Reicht die Eingabe weiter und speichert eine Kopie | |
| `tr` | Übersetzt Zeichen | `-d` löschen, `-s` stauchen |
| `sed` | Bearbeitet einen Strom von Zeilen | `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` |
| `cut` | Pickt Felder heraus | `-d` Trennzeichen, `-f` Feld |
| `awk` | Arbeitet mit Spalten | `-F` Trennzeichen, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` |

| Syntax | Bedeutet |
|---|---|
| `>` / `>>` | stdout in eine Datei (überschreiben / anhängen) |
| `<` | stdin aus einer Datei |
| `2>` | stderr in eine Datei, z. B. `2> /dev/null` |
| `2>&1` | stderr denselben Weg wie stdout |
| `\|` | Pipe: stdout eines Befehls in stdin des nächsten |
| `a ; b` | a ausführen, dann b |
| `a && b` | b nur ausführen, wenn a geklappt hat |
| `a \|\| b` | b nur ausführen, wenn a fehlgeschlagen ist |
| `*`, `?`, `[abc]` | Platzhalter für Dateinamen |
