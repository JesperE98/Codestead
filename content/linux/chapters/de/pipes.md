# Umleitungen und Pipes

In diesem Kapitel geht es um das, was die Kommandozeile so mächtig macht:
kleine Programme miteinander zu *verbinden*.

## Drei Datenströme

Jedes Programm hat drei Standard-Datenströme:

| Nummer | Name | Was |
|---|---|---|
| 0 | stdin | Eingabe, normalerweise von der Tastatur |
| 1 | stdout | Normale Ausgabe, normalerweise auf den Bildschirm |
| 2 | stderr | Fehlermeldungen, ebenfalls auf den Bildschirm |

Mit *Umleitungen* (*Redirection*) und *Pipes* kannst du diese Ströme woandershin
schicken.

## In eine Datei – `>` und `>>`

`>` schickt stdout in eine Datei statt auf den Bildschirm. Die Datei wird
angelegt, falls es sie nicht gibt – und **überschrieben**, falls es sie gibt!

```sh
echo "erste Zeile" > test.txt
```

`>>` hängt stattdessen ans Ende der Datei an:

```sh
echo "zweite Zeile" >> test.txt
cat test.txt
```

```predict
$ echo eins > t.txt
$ echo zwei > t.txt
$ cat t.txt
zwei
---
Das zweite `>` hat die Datei überschrieben. Mit `>>` stünden beide Zeilen darin.
```

## Aus einer Datei – `<`

`{{fruits}}` hat zehn Zeilen, eine Frucht pro Zeile. Gibst du `wc -l` einen
Dateinamen, gibt es die Zahl der Zeilen gefolgt vom Namen aus – hier für
`{{grades}}`, das neun Zeilen hat:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

Mit `<` liest ein Programm sein stdin aus einer Datei:

```sh
wc -l < {{documents}}/{{fruits}}
```

Jetzt bekommt `wc` den Dateinamen nie zu sehen – es bekommt nur den Text über
stdin – und gibt deshalb nur die Zahl aus.

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
Mit einem Dateinamen als Argument gibt `wc` auch den Namen aus. Mit `<` bekommt
es nur den Text.
```

## Fehlermeldungen – `2>`

Fehlermeldungen gehen nach stderr und sind von `>` nicht betroffen. Um sie
umzuleiten, schreibst du die Nummer des Stroms davor:

```sh
ls /{{missing}} 2> fehler.txt
```

```quiz
Du führst `ls /{{missing}} > fehler.txt` aus. Wo landet die Fehlermeldung?
- [ ] In `fehler.txt`
- [x] Auf dem Bildschirm – `fehler.txt` bleibt leer
- [ ] Nirgends, sie verschwindet
---
`>` leitet nur stdout (Strom 1) um. Die Fehlermeldung geht nach stderr
(Strom 2), und das landet weiterhin auf dem Bildschirm. Du bräuchtest `2>`.
```

Die Datei `/dev/null` ist ein „schwarzes Loch“ – alles, was hineingeschrieben
wird, verschwindet. Das ist praktisch, um Fehler stummzuschalten. Mit `2>&1`
wird stderr denselben Weg geschickt wie stdout.

## Pipes – `|`

Eine **Pipe** leitet das stdout eines Befehls direkt in das stdin des nächsten.
Das ist das Herz der Unix-Philosophie: *Mach eine Sache und mach sie gut, und
lass Programme zusammenarbeiten*.

```sh
grep INFO {{documents}}/server.log | wc -l
```

`grep` findet die Zeilen und `wc -l` zählt sie. Du kannst so viele
hintereinanderschalten, wie du willst:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

Lies es Schritt für Schritt: Sortiere die Früchte, zähle, wie viele es von
jeder gibt (`uniq -c`), und sortiere dann numerisch mit der größten Zahl zuerst
(`sort -rn`).

Wie viele Dateien und Verzeichnisse gibt es in `/etc`? Zähl sie mit einer Pipe:

```try
ls /etc | wc -l
```

## Von der Eingabe zu Argumenten – `xargs`

Manche Befehle lesen überhaupt nicht aus einer Pipe – sie wollen Namen als
**Argumente**: `rm`, `mkdir`, `touch` und `wc`, wenn es in Dateien zählen
soll. `xargs` schließt diese Lücke: Es liest die Wörter in seiner Eingabe und
setzt sie hinter einen Befehl.

```sh
find {{documents}} -type f | xargs wc -l
```

Das ist dasselbe, als würdest du jeden Dateinamen selbst hinter `wc -l`
schreiben. Mit `-n 1` führt `xargs` den Befehl für jedes Wort einmal aus, und
mit `-I {}` für jede Zeile einmal, wobei `{}` durch die Zeile ersetzt wird:

```sh
ls {{documents}} | xargs -I {} echo "File: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
`xargs` hat die drei Zeilen gesammelt und `echo a b c` ausgeführt – einmal.
```

## Bildschirm und Datei zugleich – `tee`

`tee` reicht seine Eingabe weiter *und* speichert eine Kopie in einer Datei:

```sh
ls /etc | tee etc-liste.txt | wc -l
```

## Verkettungen – `;`, `&&` und `||`

Mehrere Befehle können in derselben Zeile stehen:

| Syntax | Bedeutet |
|---|---|
| `a ; b` | Führe a aus, dann b |
| `a && b` | Führe b nur aus, wenn a erfolgreich war |
| `a \|\| b` | Führe b nur aus, wenn a fehlgeschlagen ist |

```sh
mkdir -p neu && cd neu
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo angelegt || echo fehlgeschlagen
fehlgeschlagen
---
`{{documents}}` existiert schon, also schlägt `mkdir` fehl (seine Fehlermeldung
verschwindet in `/dev/null`). `echo angelegt` wird übersprungen, und
`echo fehlgeschlagen` läuft.
```
