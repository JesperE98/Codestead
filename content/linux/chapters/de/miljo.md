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

## Einfache und doppelte Anführungszeichen

Hier gibt es einen wichtigen Unterschied:

```sh
echo "Zuhause: $HOME"
echo 'Zuhause: $HOME'
```

In **doppelten** Anführungszeichen werden Variablen durch ihre Werte ersetzt.
In **einfachen** Anführungszeichen wird alles genau so ausgegeben, wie es
dasteht.

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

## Exit-Codes – `$?`

Jeder Befehl hinterlässt beim Beenden einen **Exit-Code**: `0` bedeutet, dass
alles gut gegangen ist, alles andere bedeutet einen Fehler. Der letzte
Exit-Code steht in `$?`:

```sh
ls /finnsinte
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

## Einstellungen speichern – `~/.bashrc`

Die Variablen und Aliase, die du anlegst, verschwinden, wenn du das Terminal
schließt. Um sie zu behalten, schreibst du sie in die Datei `~/.bashrc`, die
bash jedes Mal liest, wenn ein neues Terminal geöffnet wird. Nachdem du die
Datei geändert hast, kannst du sie sofort neu laden mit:

```sh
source ~/.bashrc
```
