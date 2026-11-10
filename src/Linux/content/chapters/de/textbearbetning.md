# Textverarbeitung mit sed und awk

Du kennst schon einige Werkzeuge für Text: `grep` findet Zeilen, `cut` zieht
ein Feld heraus und `tr` ersetzt einzelne Zeichen. In diesem Kapitel geht es
um zwei mächtigere Werkzeuge – für den Fall, dass du Wörter ersetzen, Zeilen
löschen oder Zahlen zusammenzählen willst:

| Werkzeug | Arbeitet mit | Typische Aufgabe |
|---|---|---|
| `sed` | **Zeilen** | ein Wort ersetzen, Zeilen löschen |
| `awk` | **Spalten** (Feldern) | Spalten herausziehen, summieren, zählen |

Beide sind *Filter*: Sie lesen Text, machen etwas damit und schreiben das
Ergebnis nach stdout. Deshalb passen sie perfekt in Pipes. Und die
Originaldatei wird **nicht** verändert (mit einer Ausnahme, `sed -i`, zu der
wir noch kommen).

## Der Stream-Editor – `sed`

`sed` (*stream editor*) liest Text Zeile für Zeile und führt auf jeder Zeile
ein kleines *Skript* aus. Der häufigste Befehl ist `s` – *substitute*
(ersetzen).

### Text ersetzen – `s`

```sh
sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

Das Skript `s/ERROR/{{errorWord}}/` bedeutet: Ersetze `ERROR` durch
`{{errorWord}}`. Es hat die Form

```text
s/MUSTER/ERSETZUNG/FLAGS
```

Ohne Flags wird nur der **erste** Treffer in jeder Zeile ersetzt. Mit `g`
(*global*) werden alle ersetzt:

```sh
echo "Katze Katze Katze" | sed 's/Katze/Hund/'
echo "Katze Katze Katze" | sed 's/Katze/Hund/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
Ohne `g` wird nur das erste `a` in der Zeile ersetzt.
```

Das Flag `i` macht die Suche unabhängig von Groß- und Kleinschreibung, genau wie
`grep -i`:

```sh
sed 's/warn/WARNUNG/i' ~/{{documents}}/server.log
```

Das Muster ist ein *regulärer Ausdruck*, genau wie bei `grep`. Hier entfernen
wir das Datum am Anfang jeder Zeile (`^` = Zeilenanfang, `[0-9-]*` = Ziffern
und Bindestriche):

```sh
sed 's/^[0-9-]* //' ~/{{documents}}/server.log
```

In der Ersetzung bedeutet `&` „das, was gepasst hat“:

```sh
echo "Linux macht Spaß" | sed 's/Linux/**&**/'
```

**Ein anderes Trennzeichen.** Enthält der Text selbst Schrägstriche, wird es
unübersichtlich: `s/\/usr\/local/\/opt/`. Aber das Zeichen direkt nach `s`
legt das Trennzeichen fest, also kannst du genauso gut `|` oder `#` nehmen:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Gruppen.** Mit `-E` (erweiterte reguläre Ausdrücke) kannst du Teile des
Treffers mit Klammern einfangen und sie in der Ersetzung als `\1`, `\2` …
verwenden. Hier drehen wir das Datum um:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/{{documents}}/server.log
```

### Zeilen auswählen – Adressen

Vor einen Befehl kannst du eine *Adresse* schreiben, die auswählt, für welche
Zeilen er gilt. Der Befehl `d` (*delete*) löscht Zeilen und `p` (*print*) gibt
sie aus:

```sh
sed '/INFO/d' ~/{{documents}}/server.log
sed '1d' ~/{{documents}}/{{grades}}
```

Der erste löscht jede Zeile, die `INFO` enthält, der zweite löscht Zeile 1 –
die Kopfzeile.

`sed` gibt normalerweise *jede* Zeile aus. Mit `-n` lässt es das bleiben, und
dann wird nur ausgegeben, was `p` verlangt. So zeigst du die Zeilen 5 bis 8 an:

```sh
sed -n '5,8p' ~/{{documents}}/server.log
```

| Adresse | Bedeutet |
|---|---|
| `5` | Zeile 5 |
| `$` | die letzte Zeile |
| `/ERROR/` | Zeilen, auf die das Muster passt |
| `2,4` | Zeilen 2 bis 4 |
| `/WARN/,/ERROR/` | von einer Zeile mit WARN bis zur nächsten Zeile mit ERROR |
| `/INFO/!` | alle Zeilen **außer** denen, die passen |

Adressen funktionieren mit jedem Befehl, auch mit `s`. Hier werden nur die
Fehlerzeilen markiert:

```sh
sed '/ERROR/s/^/>>> /' ~/{{documents}}/server.log
```

Der Befehl `q` (*quit*) hört nach einer bestimmten Zeile auf – `sed 3q` macht
also dasselbe wie `head -n 3`. Mehrere Befehle trennst du mit `;` oder mit
mehreren `-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

### Die Datei direkt bearbeiten – `sed -i`

Bisher wurde alles nur *ausgegeben*. Die Datei selbst ist unverändert – prüf
es ruhig mit `cat`. Mit `-i` (*in-place*) schreibt `sed` das Ergebnis
stattdessen zurück in die Datei. Probier es an einer Kopie aus:

```sh
cp ~/{{documents}}/{{fruits}} ~/fruechte-kopie.txt
sed -i 's/Kiwi/Kiwifrucht/' ~/fruechte-kopie.txt
cat ~/fruechte-kopie.txt
```

Für `sed -i` gibt es kein Rückgängig. Eine gute Arbeitsweise ist, den Befehl
zuerst **ohne** `-i` auszuführen und dir das Ergebnis anzusehen und `-i` erst
hinzuzufügen, wenn es richtig aussieht. Schreibst du `-i.bak`, wird das
Original außerdem als `datei.bak` gespeichert.

```quiz
Du führst `sed 's/Kiwi/KIWI/' ~/{{documents}}/{{fruits}}` aus. Was passiert mit der Datei?
- [ ] Jedes `Kiwi` in der Datei wird zu `KIWI`
- [ ] Nur das erste `Kiwi` in der Datei wird zu `KIWI`
- [x] Nichts – das Ergebnis wird nur ausgegeben, die Datei bleibt unverändert
---
Ohne `-i` schreibt `sed` nur nach stdout. Die Datei bleibt, wie sie war.
```

Konfigurationsdateien in `/etc` gehören root, dort brauchst du also
`sudo sed -i ...`. Das ist ein gängiger Weg, eine Einstellung aus einem Skript
heraus zu ändern, ohne einen Texteditor zu öffnen.

## Spalten – `awk`

`awk` ist eigentlich eine ganze kleine Programmiersprache, wird aber meistens
für eine Sache benutzt: die Arbeit mit **Spalten**. awk zerlegt jede Zeile in
*Felder*:

| Feld | Bedeutet |
|---|---|
| `$1`, `$2` … | das erste, zweite … Feld |
| `$0` | die ganze Zeile |
| `NF` | die Anzahl der Felder in der Zeile (*number of fields*) |
| `$NF` | das letzte Feld |
| `NR` | die Zeilennummer (*number of record*) |

Standardmäßig werden Felder durch Leerzeichen getrennt (beliebig viele). In
`server.log` ist Feld 3 der Log-Level:

```sh
awk '{print $3}' ~/{{documents}}/server.log
```

Das Programm steht innerhalb von `{ }` und läuft für jede Zeile. Setze das
awk-Programm immer in **einfache** Anführungszeichen – sonst hält die Shell
`$3` für eine Shell-Variable und ersetzt sie, bevor awk überhaupt startet.

awk passt perfekt in eine Pipe. Wie viele Zeilen gibt es von jedem Level?

```sh
awk '{print $3}' ~/{{documents}}/server.log | sort | uniq -c
```

### Andere Trennzeichen – `-F`

Mit `-F` wählst du das Feldtrennzeichen. In `/etc/passwd` ist es ein
Doppelpunkt; Feld 1 ist der Benutzername und Feld 7 die Shell:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

Das Komma in `print` wird in der Ausgabe zu einem Leerzeichen. Ohne Komma
werden die Felder direkt aneinandergehängt, und dann kannst du eigenen Text
einfügen:

```sh
awk -F: '{print $1 " nutzt " $7}' /etc/passwd
```

Vergleiche mit `cut -d: -f1` aus dem Kapitel über das Lesen und Durchsuchen von Text. Der Unterschied ist,
dass awk die Felder umsortieren, Text einfügen und mit mehreren Leerzeichen
hintereinander umgehen kann.

```predict
$ echo "Alva,mathe,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` teilt die Zeile an den Kommas. awk gibt zuerst Feld 3 aus, dann Feld 1,
mit einem Leerzeichen dazwischen wegen des Kommas in `print`.
```

### Muster – Zeilen auswählen

Vor die `{ }` kannst du ein *Muster* schreiben. Das Programm läuft dann nur für
die Zeilen, die passen. Das Muster kann ein regulärer Ausdruck sein, wie bei
`grep`:

```sh
awk '/ERROR/ {print $2}' ~/{{documents}}/server.log
```

… oder eine Bedingung. Text steht in doppelten Anführungszeichen:

```sh
awk -F, '$2 == "mathe" {print $1, $3}' ~/{{documents}}/{{grades}}
```

Vergleiche schreibt man `==`, `!=`, `<`, `<=`, `>` und `>=`, und Bedingungen
verknüpft man mit `&&` (und), `||` (oder) und `!` (nicht). Hier sind alle
Schüler mit mindestens 90 Punkten (ohne `{ }` wird die ganze Zeile
ausgegeben):

```sh
awk -F, '$3 >= 90' ~/{{documents}}/{{grades}}
```

Hast du die Kopfzeile auch bekommen? Darin ist Feld 3 das Wort `punkte`, und
wenn ein Wert keine Zahl ist, vergleicht awk ihn als *Text* – und `"punkte"`
kommt alphabetisch nach `"90"`. Die Kopfzeile überspringst du mit `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/{{documents}}/{{grades}}
```

Probier ein eigenes Muster aus – die Namen aller, die Deutsch lernen:

```try
awk -F, '$2 == "deutsch" {print $1}' ~/{{documents}}/{{grades}}
```

### Zählen – Variablen und `END`

awk hat Variablen, die du nicht deklarieren musst – sie beginnen bei 0. Der
Block `END { }` läuft einmal, **nach** der letzten Zeile. Zusammen ergeben sie
eine einfache Möglichkeit, eine Spalte zu summieren:

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3} END {print {{sumVar}}}' ~/{{documents}}/{{grades}}
```

`{{sumVar}} += $3` bedeutet „addiere Feld 3 zu {{sumVar}}“. Zählst du
gleichzeitig die Zeilen (`anzahl++` erhöht `anzahl` um 1), kannst du den
Durchschnitt ausrechnen:

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3; anzahl++} END {print "Durchschnitt:", {{sumVar}} / anzahl}' ~/{{documents}}/{{grades}}
```

Es gibt auch `BEGIN { }`, das **vor** der ersten Zeile läuft – praktisch für
Überschriften. Und mit `printf` legst du genau fest, wie die Ausgabe aussieht:
`%-8s` ist Text, linksbündig in 8 Zeichen, und `%5d` eine ganze Zahl in 5
Zeichen.

```sh
awk -F, 'BEGIN {print "Schüler Punkte"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/{{documents}}/{{grades}}
```

awk hat auch Funktionen wie `length()`, `toupper()` und `tolower()`:

```sh
awk '{print toupper($0)}' ~/{{documents}}/{{fruits}}
echo "Grüße aus Köln" | awk '{print toupper($0)}'
```

Schau dir die zweite Zeile genau an. Unter Ubuntu, auf dem das Terminal hier
läuft, ist `awk` standardmäßig **mawk**, eine kleine und schnelle Variante. Bei
einfachen Programmen wie diesen merkst du keinen Unterschied – aber mawk
wandelt ä, ö und ü mit `toupper()` nicht um. **GNU awk** (das Paket `gawk`)
kann das, anders als `tr`. Distributionen unterscheiden sich darin, welches awk
sie verwenden und wie man Software installiert – das hast du im Teil über Distributionen gesehen.

Der Simulator kennt nur einen Teil der Sprache awk – das, was hier behandelt
wird, und ein bisschen mehr (`if`, Schleifen und Arrays). Siehe `man awk`.

## Welches Werkzeug soll ich nehmen?

| Du willst … | Nimm |
|---|---|
| Zeilen finden, die etwas enthalten | `grep` |
| einzelne Zeichen ersetzen oder löschen | `tr` |
| Wörter oder Muster ersetzen, Zeilen löschen | `sed` |
| Spalten herausziehen, Zahlen vergleichen, summieren | `awk` |

Die wahre Stärke liegt darin, sie zu kombinieren. Welche Level gibt es unter
den Zeilen, die *nicht* INFO sind – wenn wir Groß- und Kleinschreibung
ignorieren?

```sh
grep -v INFO ~/{{documents}}/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
