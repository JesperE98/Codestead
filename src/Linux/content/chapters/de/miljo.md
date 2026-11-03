# Variablen, PATH und Aliase

Die Shell hat ein eigenes Gedächtnis in Form von **Variablen**. In diesem
Kapitel lernst du, wie du sie liest und setzt, wie die Shell Programme findet
und wie du dir eigene Abkürzungen baust.

## Umgebungsvariablen

Eine Variable liest du, indem du ein `$` vor ihren Namen setzt:

```sh
echo $HOME
echo "Ich heiße $USER"
```

`env` listet alle *Umgebungsvariablen* auf – Variablen, die auch die Programme
lesen können, die du startest:

```sh
env
```

Eine Variable legst du mit `NAME=value` an (keine Leerzeichen um das `=`!). Mit
`export` wird sie zur Umgebungsvariable:

```sh
export EDITOR=nano
```

```quiz
Welche Zeile legt die Variable `FARBE` mit dem Wert `blau` an?
- [ ] `FARBE = blau`
- [x] `FARBE=blau`
- [ ] `$FARBE=blau`
---
Um das `=` dürfen keine Leerzeichen stehen. Mit Leerzeichen hält die Shell
`FARBE` für einen Befehl. Das `$` brauchst du nur, wenn du eine Variable *liest*.
```

## Einfache und doppelte Anführungszeichen

Hier gibt es einen wichtigen Unterschied:

```sh
echo "Zuhause: $HOME"
echo 'Zuhause: $HOME'
```

In **doppelten** Anführungszeichen werden Variablen durch ihre Werte ersetzt.
In **einfachen** Anführungszeichen wird alles genau so ausgegeben, wie es
dasteht.

```predict
$ x=linux
$ echo "Ich mag $x"
$ echo 'Ich mag $x'
Ich mag linux
Ich mag $x
```

## PATH – wo werden Befehle gefunden?

Wenn du `ls` tippst, sucht die Shell nacheinander in den Verzeichnissen, die in
der Variable `PATH` stehen, nach einer Datei namens `ls`:

```sh
echo $PATH
```

`which` zeigt, wo ein Programm gefunden wurde. Manche Befehle wie `cd` sind gar
keine Dateien, sondern in die Shell *eingebaut* (*Builtins*) – `type` verrät
dir, was ein Name ist:

```sh
which ls
type cd
```

Willst du ein Programm ausführen, das nicht im `PATH` liegt, musst du seinen
Pfad angeben, zum Beispiel `./myprogram` für eine Datei im aktuellen
Verzeichnis.

```quiz
Du hast ein Programm namens `hallo` in dem Verzeichnis, in dem du bist, und
dieses Verzeichnis liegt nicht im `PATH`. Wie führst du es aus?
- [ ] `hallo`
- [x] `./hallo`
- [ ] `type hallo`
---
Ohne Pfad sucht die Shell nur in den Verzeichnissen aus `PATH`. `./hallo` sagt
genau, wo die Datei liegt: im aktuellen Verzeichnis.
```

## Exit-Codes – `$?`

Jeder Befehl hinterlässt beim Beenden einen **Exit-Code**: `0` bedeutet, dass
alles gut gegangen ist, alles andere bedeutet einen Fehler. Der letzte
Exit-Code steht in `$?`:

```sh
ls /{{missing}}
echo $?
```

Genau auf den Exit-Code schauen `&&` und `||`.

## Aliase

Ein **Alias** ist eine eigene Abkürzung:

```sh
alias ll='ls -la'
ll
```

`alias` ohne Argumente listet alle Aliase auf, und `unalias ll` entfernt einen.

```predict
$ alias hallo='echo Hallo'
$ hallo
Hallo
```

## Einstellungen speichern – `~/.bashrc`

Die Variablen und Aliase, die du anlegst, verschwinden, wenn du das Terminal
schließt. Um sie zu behalten, schreibst du sie in die Datei `~/.bashrc`, die
bash jedes Mal liest, wenn ein neues Terminal geöffnet wird. Nachdem du die
Datei geändert hast, kannst du sie sofort neu laden mit:

```sh
source ~/.bashrc
```

```quiz
Du legst einen Alias an, schließt das Terminal und öffnest ein neues. Der Alias
ist weg. Was hättest du tun sollen?
- [ ] `alias` ohne Argumente ausführen
- [x] Den Alias in `~/.bashrc` schreiben
- [ ] Ihn mit `export` anlegen
---
Alles, was in `~/.bashrc` steht, wird jedes Mal neu gelesen, wenn ein neues
Terminal geöffnet wird.
```
