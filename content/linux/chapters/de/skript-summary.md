# Zusammenfassung: Skripte und Automatisierung

In diesem Teil hast du Befehle in eigene Programme verwandelt.

## Shell-Skripte

Ein Skript ist eine Textdatei mit Befehlen, die mit dem Shebang `#!/bin/bash`
beginnt. Du kannst es mit einem Here-Document schreiben
(`cat > datei << '{{heredocEnd}}'`), mit `chmod +x` ausführbar machen und mit `./`
ausführen. Zeilen, die mit `#` beginnen, sind Kommentare.

Variablen legst du mit `name=wert` an – ohne Leerzeichen – und verwendest sie
in doppelten Anführungszeichen: `"$name"`, oder `"${name}_text"`, wenn direkt
danach Text folgt. `$(befehl)` wird durch das ersetzt, was der Befehl
ausgibt, und `$(( ))` rechnet mit ganzen Zahlen. Ein Skript liest seine
Argumente aus `$1`, `$2` …, `$#` und `"$@"`.

`if` schaut auf den Exit-Code eines Befehls, meist des Testbefehls `[ ]`.
Zahlen werden mit `-eq`, `-lt` und Co. verglichen, Text mit `=` und `!=`.
`for` läuft über eine Liste, `while` macht weiter, solange eine Bedingung
wahr ist, und `while read` geht eine Datei Zeile für Zeile durch. `case`
wählt zwischen Mustern, Funktionen sind benannte Codestücke mit eigenem `$1`,
und `read` fragt den Benutzer nach einer Eingabe. `exit 1` sagt dem, der das
Skript aufgerufen hat, dass etwas schiefgegangen ist.

## Zeitgesteuerte Jobs mit cron

**cron** führt die Jobs in deiner **crontab** zu festen Zeiten aus. Jede Zeile
hat fünf Zeitfelder – Minute, Stunde, Tag des Monats, Monat und Wochentag –
und danach den Befehl; `*` bedeutet jede und `*/5` jede fünfte. `crontab -l`
zeigt die Jobs, und `crontab -` installiert neue aus seiner Eingabe – und
ersetzt dabei alle alten. Jobs laufen ohne die Einstellungen deines Terminals
und mit einem kurzen `PATH`, also schick ihre Ausgabe in eine Datei.
`journalctl -u cron` zeigt jeden Lauf, und `systemctl list-timers` zeigt die
Timer von systemd.

## Befehle und Syntax

| Syntax | Tut |
|---|---|
| `#!/bin/bash` | Der Shebang: welches Programm das Skript ausführt |
| `cat > datei << '{{heredocEnd}}'` | Zeilen in eine Datei schreiben, bis zur Zeile `{{heredocEnd}}` |
| `name=value` · `"$name"` · `"${name}"` | Eine Variable anlegen · verwenden |
| `$(command)` | Wird durch das ersetzt, was der Befehl ausgibt |
| `$(( a * 6 ))` · `(( a++ ))` | Rechnen mit ganzen Zahlen · eine Variable ändern |
| `$0` · `$1` · `$#` · `"$@"` | Der Name des Skripts · erstes Argument · Anzahl Argumente · alle Argumente |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Bedingungen |
| `-f` · `-d` · `-z` | Datei existiert · Verzeichnis existiert · Variable ist leer |
| `=` · `!=` | Text gleich · verschieden |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Zahlen vergleichen |
| `[[ $file == *.txt ]]` | Der klügere Test von bash, mit Mustern |
| `for x in list; do ...; done` | Über eine Liste laufen |
| `while [ ... ]; do ...; done` | Schleife, solange die Bedingung wahr ist |
| `while read line; do ...; done < file` | Eine Datei Zeile für Zeile durchgehen |
| `break` · `continue` | Die Schleife verlassen · zur nächsten Runde springen |
| `case $x in pattern) ...;; *) ...;; esac` | Nach Muster wählen |
| `name() { ...; }` · `local` · `return` | Eine Funktion · lokale Variable · die Funktion beenden |
| `read -p "Question " var` | Eine Zeile von der Tastatur lesen |
| `exit 1` | Das Skript mit einem Exit-Code beenden |
| `set -euo pipefail` | Das Skript beim ersten Fehler anhalten |
| `crontab -l` · `crontab -r` | Deine crontab anzeigen · entfernen |
| `echo '* * * * * command' \| crontab -` | Eine crontab aus der Eingabe installieren (ersetzt die alte) |
| `(crontab -l; echo 'LINE') \| crontab -` | Einen Job hinzufügen und die alten behalten |
| `MIN HOUR DAY MONTH WEEKDAY command` | Eine crontab-Zeile, z. B. `30 2 * * 1-5` |
| `systemctl list-timers` | Die Timer von systemd anzeigen |
