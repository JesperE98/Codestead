# Andere Shells: zsh und fish

Bisher hast du jeden Befehl in **bash** getippt. Aber bash ist nur eine von
mehreren Shells – und viele Leute bevorzugen etwas anderes. In diesem Kapitel
installierst du zwei beliebte Alternativen, **zsh** und **fish**, probierst
sie aus und siehst, wie sie sich von bash unterscheiden. Außerdem erfährst du,
warum Skripte trotzdem fast immer für bash geschrieben werden.

## Was war noch mal eine Shell?

Die **Shell** ist das Programm, das liest, was du tippst, es interpretiert und
andere Programme startet. Die Shell ist es, die `|`, `>`, `$VARIABLES`,
Wildcards wie `*.txt` und Schleifen versteht. Das Terminal ist nur das
Fenster, in dem die Shell läuft.

Programme wie `ls`, `grep` und `cat` sind eigenständige Programme in
`/usr/bin` – sie funktionieren gleich, egal welche Shell du benutzt. Was sich
zwischen den Shells unterscheidet, ist **die Sprache drumherum**: wie
Variablen gesetzt werden, wie Schleifen und Bedingungen geschrieben werden,
wie der Prompt aussieht und welche Annehmlichkeiten es gibt.

```quiz
Du wechselst von bash zu einer anderen Shell. Was davon bleibt genau gleich?
- [ ] Wie du eine Variable setzt
- [ ] Wie du eine Schleife schreibst
- [x] Was `grep` mit seinen Optionen macht
- [ ] Wie der Prompt aussieht
---
`grep` ist ein eigenständiges Programm in `/usr/bin`. Die Shell startet es nur –
was sich zwischen Shells unterscheidet, ist die Sprache drumherum.
```

## Der Stammbaum: sh, bash, zsh und fish

| Shell | Seit | Merkmale |
|---|---|---|
| `sh` | 1979 | Die Bourne-Shell. Das heutige `sh` folgt dem **POSIX**-Standard und ist der kleinste gemeinsame Nenner. |
| `bash` | 1989 | *Bourne Again SHell*. Der Standard in fast jeder Linux-Distribution. |
| `zsh` | 1990 | Weitgehend bash-kompatibel, aber mit mehr Funktionen. Der Standard unter macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Leicht zu benutzen, aber mit **eigener Syntax**. |

**POSIX** ist ein Standard, der beschreibt, wie sich eine `sh`-Shell verhalten
soll. Ein Skript, das nur POSIX-Funktionen benutzt, läuft in jeder
`sh`-kompatiblen Shell: bash, zsh, `dash` (das unter Debian und Ubuntu
`/bin/sh` ist) und `ash` (auf kleinen Systemen wie Alpine). fish ist bewusst
**nicht** POSIX-kompatibel – genau das macht es einfacher, aber auch anders.

## Welche Shells sind installiert?

Die Datei `/etc/shells` listet die Shells auf, die als Login-Shell benutzt
werden dürfen:

```sh
cat /etc/shells
```

Welche Shell du beim Anmelden bekommst, steht im letzten Feld deiner Zeile in
`/etc/passwd`, und sie steht auch in der Variable `$SHELL`:

```sh
grep {{user}} /etc/passwd
echo $SHELL
```

## zsh – bash mit Extras

### zsh installieren

Im Ubuntu-Terminal installierst du zsh mit apt:

```sh
sudo apt update
sudo apt install zsh
```

Andere Distributionen verwenden ihren eigenen Paketmanager, wie du im Teil über
Distributionen und Pakete gelernt hast. Auch dort heißt das Paket `zsh`.

Sieh dir `/etc/shells` noch einmal an – das Paket hat `/usr/bin/zsh` (und
`/bin/zsh`) hinzugefügt:

```sh
cat /etc/shells
```

### zsh starten

Eine Shell ist ein Programm wie jedes andere, also startest du zsh, indem du
seinen Namen tippst:

```sh
zsh
```

Beim ersten Mal begrüßt dich **zsh-newuser-install**, weil du noch keine
Konfigurationsdatei für zsh hast. Das ist ein Menü, das dir beim Einstieg
hilft:

| Taste | Macht |
|---|---|
| `q` | Beenden, ohne etwas zu tun (beim nächsten Mal wirst du wieder gefragt) |
| `0` | Eine fast leere `~/.zshrc` anlegen |
| `1` | Das Hauptmenü mit allen Einstellungen (im Simulator nicht verfügbar) |
| `2` | `~/.zshrc` mit den empfohlenen Einstellungen anlegen |

Antworte `2`. Der Prompt ändert sich zu `{{user}}@ubuntu ~ %` – in zsh ist
`%` das übliche Zeichen für einen normalen Benutzer (root bekommt `#`, genau wie
in bash).

Welche Shell läuft gerade? Die Variable `$0` enthält den Namen der Shell:

```sh
echo $0
ps
```

`ps` zeigt, dass zsh **innerhalb** von bash läuft: bash hat zsh als neuen
Prozess gestartet. Achte auch darauf, dass `$SHELL` immer noch `/bin/bash` ist
– diese Variable verrät dir deine *Login-Shell*, nicht welche Shell du gerade
zufällig ausführst.

```sh
echo $SHELL
```

### Das meiste funktioniert wie in bash

zsh versteht fast die gesamte bash-Syntax. Pipes, Umleitungen, Variablen,
`if`, `for` und Funktionen funktionieren so, wie du es gewohnt bist:

```sh
for f in ~/{{documents}}/*.txt; do wc -l $f; done
```

### Funktion 1: `**` durchsucht alle Unterverzeichnisse

In zsh bedeutet `**/` „alle Verzeichnisse, auf jeder Ebene“. Das hier listet
jede `.txt`-Datei in deinem Home-Verzeichnis und allem darunter auf:

```sh
ls ~/**/*.txt
```

In bash funktioniert `**` wie ein einfaches `*` – es sei denn, du schaltest es
zuerst mit `shopt -s globstar` ein.

### Funktion 2: autocd

Mit der Option `autocd` (Teil der empfohlenen Einstellungen) musst du nur den
Namen eines Verzeichnisses tippen, um dorthin zu wechseln – ohne `cd`:

```sh
{{documents}}
..
```

Optionen schaltest du mit `setopt` und `unsetopt` ein und aus:

```sh
setopt
unsetopt autocd
setopt autocd
```

### Ein Unterschied, auf den du achten musst: Variablen werden nicht aufgeteilt

In bash wird eine Variable ohne Anführungszeichen an Leerzeichen aufgeteilt.
In zsh nicht:

```sh
dateien="a.txt b.txt"
for f in $dateien; do echo "[$f]"; done
```

bash gibt `[a.txt]` und `[b.txt]` aus – zsh gibt `[a.txt b.txt]` aus. Die
zsh-Variante ist meistens das, was du willst, aber es bedeutet, dass ein
bash-Skript in zsh nicht immer dasselbe tut. (Mit `setopt shwordsplit` verhält
sich zsh wie bash.)

Du musst eine Shell nicht starten, um einen einzelnen Befehl darin
auszuprobieren. Mit `-c` führt die Shell den Befehl aus und beendet sich
sofort – `zsh -c 'echo $0'` gibt `zsh` aus, und danach bist du immer noch in
bash.

Die Frage unten beginnt in einem frischen Terminal, deshalb installiert sie
zuerst zsh. `> /dev/null 2>&1` wirft die Ausgabe dieser Zeile weg. Was gibt der
letzte Befehl aus?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'dateien="x.txt y.txt z.txt"; for f in $dateien; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
zsh teilt die Variable nicht an Leerzeichen auf, also läuft die Schleife einmal
mit dem ganzen Wert. In bash würde dieselbe Schleife drei Zeilen ausgeben:
`<x.txt>`, `<y.txt>` und `<z.txt>`.
```

### ~/.zshrc und der Prompt

bash liest beim Start `~/.bashrc` – zsh liest `~/.zshrc`. Sieh dir die Datei
an, die zsh-newuser-install angelegt hat:

```sh
cat ~/.zshrc
```

Der Prompt wird über die Variable `PROMPT` festgelegt und benutzt
`%`-Codes:

| Code | Bedeutet |
|---|---|
| `%n` | Der Benutzername |
| `%m` | Der Name des Rechners |
| `%~` | Das ganze Verzeichnis (mit `~` für dein Home-Verzeichnis) |
| `%1~` | Nur der letzte Teil des Verzeichnisses |
| `%#` | `%` für normale Benutzer, `#` für root |
| `%F{green}` … `%f` | Farbe (red, green, blue, yellow …) |

Probiere es aus:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

Die Änderung gilt nur, bis du zsh verlässt. Wenn du sie jedes Mal haben
willst, schreib die Zeile in `~/.zshrc`.

### Oh My Zsh

Viele zsh-Benutzer installieren **Oh My Zsh**, eine Sammlung von Themes und
Plugins – zum Beispiel Git-Informationen im Prompt, bessere Tab-Vervollständigung
und Vorschläge während des Tippens. Es wird mit einem Skript von der Website
des Projekts installiert und in `~/.zshrc` konfiguriert. Im Simulator gibt es
das nicht, aber jetzt weißt du, was gemeint ist, wenn die Leute davon reden.

### Zurück zu bash

zsh ist ein Prozess, der innerhalb von bash läuft. Verlasse es mit `exit`, und
du bist wieder in bash – wo Variablen, Aliase und Verzeichniswechsel aus zsh
verschwunden sind:

```sh
exit
echo $0
```

## fish – die freundliche interaktive Shell

fish will sofort leicht zu benutzen sein, ganz ohne Konfiguration: Farben,
Tab-Vervollständigung und **Autosuggestions** – fish schlägt den Rest des
Befehls in grauer Schrift vor, basierend auf deiner History, und du nimmst den
Vorschlag mit der Pfeiltaste nach rechts an. (Der Simulator zeigt keine
Vorschläge, aber die Syntax funktioniert.)

### fish installieren und starten

fish installierst du genauso mit apt – auf anderen Distributionen mit deren
eigenem Paketmanager:

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

fish heißt dich willkommen, und der Prompt wird zu `{{user}}@ubuntu ~>`.
Geh ein paar Verzeichnisse tiefer und sieh, wie fish den Pfad im Prompt
abkürzt:

```sh
mkdir -p ~/{{documents}}/{{project}}
cd ~/{{documents}}/{{project}}
cd ~
```

Im Verzeichnis `~/{{documents}}/{{project}}` zeigt der Prompt `~/d/{{project}}>` – jedes
Verzeichnis außer dem letzten wird auf einen Buchstaben gekürzt.

### fish hat seine eigene Syntax

Hier unterscheidet sich fish am stärksten von bash und zsh:

| Das hier | bash und zsh | fish |
|---|---|---|
| Eine Variable setzen | `{{fruitVar}}={{fruitWord}}` | `set {{fruitVar}} {{fruitWord}}` |
| Umgebungsvariable | `export EDITOR=nano` | `set -x EDITOR nano` |
| Eine Variable entfernen | `unset {{fruitVar}}` | `set -e {{fruitVar}}` |
| Befehlsersetzung | `$(pwd)` | `(pwd)` |
| Letzter Exit-Status | `$?` | `$status` |
| Skript-Argumente | `$@`, `$1` | `$argv`, `$argv[1]` |
| Bedingung | `if …; then …; fi` | `if …; …; end` |
| Schleife | `for …; do …; done` | `for …; …; end` |
| Funktion | `hallo() { …; }` | `function hallo; …; end` |
| Arithmetik | `$((17 * 23))` | `math 17 x 23` |

### Variablen mit set

Versuche, eine Variable auf die bash-Art zu setzen:

```sh
{{fruitVar}}={{fruitWord}}
```

fish weigert sich und sagt dir, wie man es schreibt:

```text
fish: Unsupported use of '='. In fish, please use 'set {{fruitVar}} {{fruitWord}}'.
```

So macht man es in fish:

```sh
set {{fruitVar}} {{fruitWord}}
echo ${{fruitVar}}
set -x EDITOR nano
set -e {{fruitVar}}
```

`-x` (*export*) macht die Variable zu einer Umgebungsvariable, die Programme
sehen, die du startest, und `-e` (*erase*) entfernt sie.

In fish ist jede Variable eine **Liste**. Die Elemente sind ab 1 nummeriert:

```sh
set fruechte Apfel Birne Banane
echo $fruechte[2]
count $fruechte
```

`-c` funktioniert auch in fish. Was gibt der letzte Befehl aus?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set fruechte Apfel Birne Banane; echo $fruechte[3]'
Banane
---
Die Elemente einer fish-Liste werden ab 1 nummeriert, also ist `[3]` das dritte
und letzte Element.
```

### Befehlsersetzung und $status

In fish schreibt man Befehlsersetzung mit einfachen Klammern:

```sh
echo "Ich bin in" (pwd)
```

Innerhalb von Anführungszeichen sind Klammern normaler Text – deshalb steht
`(pwd)` außerhalb. Der Exit-Status des letzten Befehls heißt `$status`. `false`
ist ein winziger Befehl, der nichts tut außer fehlzuschlagen – sein Exit-Status
ist immer 1:

```sh
false
echo $status
```

### and, or und not

fish hat eigene Befehle zum Verketten von Bedingungen:

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

Neuere fish-Versionen (ab 3.0) verstehen auch `&&` und `||`, und ab 3.4
funktioniert auch `$(...)`. Aber `X=1`, `$?` und `$((...))` funktionieren nach
wie vor nicht – sie geben Fehlermeldungen, die dir die fish-Schreibweise
verraten.

### Blöcke enden mit end

In fish endet jeder Block – `if`, `for`, `while`, `switch` und `function` –
mit `end`. Es gibt kein `then`, `do`, `done` oder `fi`:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

Du kannst den Block auch über mehrere Zeilen schreiben. Die Shell wartet auf
`end`, bevor sie die Schleife ausführt:

```sh
for f in ~/{{documents}}/*.txt
echo (basename $f)
end
```

Funktionen bekommen ihre Argumente in der Liste `$argv`:

```sh
function hello; echo "Hallo $argv!"; end
hello Kim
```

### Arithmetik mit math

fish hat kein `$((...))`. Stattdessen gibt es den Befehl `math`, der auch mit
Dezimalzahlen umgehen kann:

```sh
math 17 x 23
math 10 / 4
```

Schreib `x` (oder `"17 * 23"` in Anführungszeichen) für die Multiplikation –
ein einzelnes `*` ist in fish eine Wildcard, genau wie in bash.

### fish-Einstellungen

fish liest beim Start `~/.config/fish/config.fish`. Wenn du die
Begrüßungsnachricht loswerden willst, leere die Variable `fish_greeting`. Mit
`-U` wird die Variable **universell**: Sie wird in
`~/.config/fish/fish_variables` gespeichert und gilt in jeder fish-Shell, auch
nach einem Neustart.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Verlasse fish mit `exit`:

```sh
exit
```

## Warum Skripte trotzdem für bash geschrieben werden

Welche Shell du im Terminal benutzt, ist Geschmackssache. Aber **Skripte**
werden fast immer für bash (oder für POSIX-`sh`) geschrieben:

- bash ist auf praktisch jedem Linux-System installiert – zsh und fish nicht.
- fish-Syntax funktioniert nicht in bash, und umgekehrt.
- Die `#!`-Zeile ganz oben im Skript entscheidet, welche Shell es ausführt –
  **unabhängig** davon, in welcher Shell du gerade sitzt.

Schreib zum Ausprobieren ein bash-Skript und führe es aus fish heraus aus:

```sh
cat > ~/{{helloScript}} << '{{heredocEnd}}'
#!/bin/bash
name=Kim
echo "Hallo $name, ich werde von bash ausgeführt"
{{heredocEnd}}
chmod +x ~/{{helloScript}}
fish
~/{{helloScript}}
exit
```

Das Skript funktioniert in fish, obwohl `name=Kim` dort verboten ist – denn
bash führt es aus. Deshalb ist `#!/bin/bash` (oder `#!/usr/bin/env bash`) so
wichtig. Ein Skript, das überall funktionieren muss, auch dort, wo bash fehlt,
schreibt man mit `#!/bin/sh` und ausschließlich POSIX-Syntax.

```quiz
Du sitzt in fish und führst ein Skript aus, das mit `#!/bin/bash` beginnt und
die Zeile `count=3` enthält. Was passiert?
- [ ] fish weigert sich, weil `count=3` in fish nicht erlaubt ist
- [x] Es funktioniert – bash führt das Skript aus, egal in welcher Shell du sitzt
- [ ] Es funktioniert nur, wenn du vorher mit `chsh` deine Login-Shell auf bash änderst
---
Die `#!`-Zeile entscheidet, welche Shell das Skript ausführt. fish startet es
nur.
```

## Die Standard-Shell mit chsh ändern

Jedes Mal `zsh` zu tippen, wenn du ein Terminal öffnest, wird schnell lästig.
Mit `chsh` (*change shell*) änderst du deine **Login-Shell** – die in
`/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep {{user}} /etc/passwd
```

- Die Shell muss mit ihrem vollständigen Pfad angegeben werden und in
  `/etc/shells` stehen.
- `chsh` fragt nach deinem Passwort (der Simulator überspringt das).
- Die Änderung wirkt beim **nächsten Login**. Das Terminal, das du offen hast,
  behält seine alte Shell, und `$SHELL` ändert sich erst, wenn du dich erneut
  angemeldet hast.
- root kann die Shell für andere ändern: `sudo chsh -s /usr/bin/fish kim`.

Um zu bash zurückzukehren, machst du dasselbe:

```sh
chsh -s /bin/bash
```

Ein verbreiteter Rat für fish ist, bash als Login-Shell zu behalten und
stattdessen das Terminalprogramm fish starten zu lassen – dann funktioniert
alles weiter, was beim Login eine POSIX-Shell erwartet.

Die Frage beginnt in einem frischen Terminal, installiert zsh und macht es zur
Login-Shell. Was gibt der letzte Befehl aus?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
`chsh` hat deine Zeile in `/etc/passwd` geändert, aber die Änderung wirkt erst
beim nächsten Login. Das Terminal, das du offen hast, behält bash, und `$SHELL`
ebenso.
```

## Welche Shell solltest du wählen?

- **bash** – überall der Standard. Was du hier lernst, funktioniert auf jedem
  Server, auf dem du dich jemals anmelden wirst. Schreib deine Skripte für
  bash.
- **zsh** – für alle, die mehr Komfort wollen, aber die bash-Syntax behalten
  möchten. Oh My Zsh bringt Themes und Plugins.
- **fish** – das beste Erlebnis direkt nach der Installation, aber mit anderer
  Syntax. Befehle, die du aus dem Web kopierst, funktionieren nicht immer.
- **sh/dash** – für Skripte, die überall funktionieren müssen, und auf kleinen
  Systemen.

## Zusammenfassung

| Befehl | Macht |
|---|---|
| `cat /etc/shells` | Die Shells auflisten, die benutzt werden dürfen |
| `echo $0` / `ps` | Sehen, welche Shell gerade läuft |
| `echo $SHELL` | Deine Login-Shell sehen |
| `zsh` / `fish` / `exit` | Eine andere Shell starten / zurückgehen |
| `ls ~/**/*.txt` | Alle Unterverzeichnisse durchsuchen (zsh, fish) |
| `setopt autocd` | Eine zsh-Option einschalten |
| `set {{fruitVar}} {{fruitWord}}` | Eine Variable in fish setzen |
| `set -x NAME value` | Eine Umgebungsvariable in fish setzen |
| `chsh -s /usr/bin/zsh` | Deine Login-Shell ändern |

Die Konfigurationsdateien: `~/.bashrc` (bash), `~/.zshrc` (zsh) und
`~/.config/fish/config.fish` (fish).
