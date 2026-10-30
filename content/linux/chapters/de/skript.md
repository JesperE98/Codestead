# Shell-Skripte

Alles, was du bisher im Terminal getippt hast, kannst du auch in einer Datei
speichern und immer wieder ausführen. So eine Datei heißt **Skript**. Mit
Skripten automatisierst du die langweiligen Sachen: Backups, hundert Dateien
umbenennen oder jeden Morgen die Logs prüfen. Außerdem ist bash eine echte
Programmiersprache, mit Variablen, Bedingungen, Schleifen und Funktionen.

## Ein erstes Skript

Ein Skript ist eine ganz normale Textdatei. Auf echten Rechnern würdest du sie
in einem Texteditor wie `nano` oder `vim` schreiben. Ein anderer Weg, der
sowohl hier als auch auf Servern funktioniert, ist ein **Here-Dokument**: Alles
zwischen `<< 'SLUT'` und der Zeile `SLUT` wird an den Befehl übergeben.
(*Slut* ist einfach Schwedisch für „Ende“ – du kannst jedes beliebige Wort
nehmen, `EOF` ist eine verbreitete Wahl.)

Tippe die erste Zeile und drücke Enter. Der Prompt wechselt zu `> ` – die Shell
wartet auf den Rest. Tippe die Zeilen nacheinander ein und schließe mit `SLUT`
ab:

```sh
cat > hej.sh << 'SLUT'
#!/bin/bash
echo "Hallo aus einem Skript!"
echo "Heute ist $(date)"
SLUT
```

Die erste Zeile, `#!/bin/bash`, heißt *Shebang* und sagt dem System, welches
Programm die Datei ausführen soll. Mach das Skript ausführbar und starte es:

```sh
chmod +x hej.sh
./hej.sh
```

Zeilen, die mit `#` beginnen (abgesehen von der Shebang-Zeile), sind
**Kommentare**, die die Shell überspringt. Erkläre damit, was der Code tut!

## Variablen

Eine Variable legst du mit `name=value` an. Um das Gleichheitszeichen dürfen
**keine** Leerzeichen stehen – sonst hält die Shell `name` für einen Befehl.

```sh
stad=Göteborg
echo "Ich wohne in $stad"
```

(*Stad* bedeutet „Stadt“.) Setze Variablen immer in **doppelte
Anführungszeichen**, wenn du sie verwendest. Ohne Anführungszeichen wird der
Wert an Leerzeichen aufgeteilt, was zu seltsamen Fehlern führt, wenn ein
Dateiname ein Leerzeichen enthält. Willst du direkt nach dem Variablennamen
Text schreiben, nimm geschweifte Klammern: `"${stad}_2026"` – ohne sie würde
bash nach einer Variable namens `stad_2026` suchen.

## Befehlssubstitution – `$(...)`

`$(command)` wird durch das ersetzt, was der Befehl ausgibt. So speicherst du
das Ergebnis eines Befehls in einer Variable:

```sh
idag=$(date)
filer=$(ls ~ | wc -l)
echo "In deinem Home-Verzeichnis liegen $filer Einträge"
```

## Rechnen – `$(( ))`

Bash rechnet mit ganzen Zahlen innerhalb von `$(( ))`. Innerhalb der Klammern
brauchst du kein `$` vor Variablen:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) Rest $(( 17 % 5 ))
```

Um eine Variable zu ändern, schreibst du `(( a++ ))` oder `(( a += 10 ))`.

## Argumente

Wenn du `./skript.sh one two` ausführst, kann das Skript die Argumente lesen:

| Variable | Enthält |
|---|---|
| `$0` | Den Namen des Skripts |
| `$1`, `$2` ... | Das erste, zweite ... Argument |
| `$#` | Die Anzahl der Argumente |
| `"$@"` | Alle Argumente, jedes einzeln |
| `$?` | Den Exit-Code des vorherigen Befehls |

## Bedingungen – `if`

`if` führt einen Befehl aus und schaut auf seinen **Exit-Code**: 0 bedeutet
wahr, alles andere falsch. Meistens verwendest du den Befehl `[` (auch bekannt
als `test`):

```sh
if [ -f ~/.bashrc ]; then echo "Die Datei existiert"; else echo "Die Datei fehlt"; fi
```

Die Leerzeichen innerhalb von `[ ]` sind Pflicht! Über mehrere Zeilen
geschrieben, wie in einem Skript, sieht das so aus:

```text
if [ "$answer" = "ja" ]; then
    echo "Super!"
elif [ "$answer" = "nein" ]; then
    echo "Schade."
else
    echo "Bitte antworte mit ja oder nein."
fi
```

Die häufigsten Tests:

| Test | Wahr, wenn |
|---|---|
| `-f FILE` | die Datei existiert (und eine normale Datei ist) |
| `-d DIR` | das Verzeichnis existiert |
| `-z "$x"` | die Variable leer ist |
| `"$a" = "$b"` | die Zeichenketten gleich sind (`!=` verschieden) |
| `$a -eq $b` | die Zahlen gleich sind |
| `$a -lt $b` | kleiner als (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDITION` | die Bedingung *nicht* wahr ist |

Beachte, dass Zahlen mit `-eq`, `-lt` und so weiter verglichen werden, während
`=` und `<` Text vergleichen. Bash hat außerdem `[[ ... ]]`, das etwas
schlauer ist: Dort kannst du `&&` und `||` schreiben und gegen Muster wie
`[[ $file == *.txt ]]` prüfen.

Für kurze Bedingungen reichen oft `&&` und `||`:

```sh
[ -d ~/bilder ] && echo "Das Verzeichnis bilder existiert"
```

## Schleifen

Eine **for-Schleife** macht dasselbe für jedes Element einer Liste:

```sh
for frukt in äpple banan kiwi; do echo "Ich mag $frukt"; done
```

Die Liste kann aus Wildcards oder einem Befehl stammen:

```sh
for fil in ~/dokument/*; do echo "Datei: $fil"; done
for i in $(seq 1 3); do echo "Runde $i"; done
```

Eine **while-Schleife** läuft, solange die Bedingung wahr ist:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

Der gängigste Weg, eine Datei Zeile für Zeile durchzugehen, ist `while read`,
wobei die Datei mit `<` nach `done` hineingefüttert wird:

```sh
while read rad; do echo "> $rad"; done < ~/dokument/frukter.txt
```

`break` verlässt eine Schleife, und `continue` springt direkt zur nächsten
Runde.

> **Vorsicht vor Endlosschleifen!** Eine Schleife, deren Bedingung nie falsch
> wird, läuft ewig. In einem echten Terminal stoppst du sie mit **Strg+C**.
> Der Simulator stoppt sie nach 20 000 Schritten von selbst.

## Auswählen mit `case`

Wenn eine Variable viele verschiedene Werte haben kann, ist `case`
übersichtlicher als eine lange Kette von `elif`:

```sh
fil=semester.jpg
case $fil in *.jpg|*.png) echo "Ein Bild";; *.txt) echo "Eine Textdatei";; *) echo "Unbekannter Typ";; esac
```

Jede Alternative endet mit `;;`, und `*)` fängt alles andere ab.

## Funktionen

Eine **Funktion** ist ein benanntes Stück Code, das du wie einen eigenen Befehl
aufrufen kannst. Sie bekommt Argumente genauso wie ein Skript – `$1`, `$2` und
`$#`:

```sh
halsa() { echo "Hallo $1, willkommen!"; }
halsa Kim
```

Variablen, die nur innerhalb der Funktion existieren sollen, legst du mit
`local` an, und `return` beendet die Funktion mit einem Exit-Code.

## Den Benutzer fragen – `read`

`read` liest eine Zeile von der Tastatur in eine Variable:

```sh
read -p "Wie heißt du? " namn; echo "Hallo $namn!"
```

## Ein vollständiges Beispiel

Hier ist ein Skript, das das meiste aus diesem Kapitel verwendet. Es legt
Sicherungskopien der Dateien an, die du ihm als Argumente übergibst:

```text
#!/bin/bash
# backup.sh – kopiert jede Datei nach datei.bak

if [ $# -eq 0 ]; then
    echo "Aufruf: $0 DATEI..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "$file kopiert"
    else
        echo "$file nicht gefunden" >&2
    fi
done
```

`exit 1` beendet das Skript mit dem Exit-Code 1, damit der Aufrufer des
Skripts sieht, dass etwas schiefgegangen ist.

## Tipps für gute Skripte

- Beginne mit `#!/bin/bash` und schreibe Kommentare.
- Setze Variablen in Anführungszeichen: `"$file"`, nicht `$file`.
- Viele beginnen ihre Skripte mit `set -euo pipefail`, damit das Skript beim
  ersten Fehler anhält, statt blind weiterzumachen.
- Das Programm **ShellCheck** findet häufige Fehler in bash-Skripten – du
  kannst es auf jeder großen Distribution mit dem Paketmanager installieren.
