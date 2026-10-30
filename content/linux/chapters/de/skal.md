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
grep elev /etc/passwd
echo $SHELL
```

## zsh – bash mit Extras

### zsh installieren

zsh hat in jeder Familie denselben Paketnamen:

:::debian
```sh
sudo apt update
sudo apt install zsh
```
:::

:::arch
```sh
sudo pacman -S zsh
```
:::

:::redhat
```sh
sudo dnf install zsh
```
:::

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

Antworte `2`. Der Prompt ändert sich zu `elev@{{hostname}} ~ %` – in zsh ist
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
for f in ~/dokument/*.txt; do wc -l $f; done
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
dokument
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
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

bash gibt `[a.txt]` und `[b.txt]` aus – zsh gibt `[a.txt b.txt]` aus. Die
zsh-Variante ist meistens das, was du willst, aber es bedeutet, dass ein
bash-Skript in zsh nicht immer dasselbe tut. (Mit `setopt shwordsplit` verhält
sich zsh wie bash.)

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

:::debian
```sh
sudo apt update
sudo apt install fish
```
:::

:::arch
```sh
sudo pacman -S fish
```
:::

:::redhat
```sh
sudo dnf install fish
```
:::

```sh
fish
```

fish heißt dich willkommen, und der Prompt wird zu `elev@{{hostname}} ~>`.
Geh ein paar Verzeichnisse tiefer und sieh, wie fish den Pfad im Prompt
abkürzt:

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

Im Verzeichnis `~/dokument/projekt` zeigt der Prompt `~/d/projekt>` – jedes
Verzeichnis außer dem letzten wird auf einen Buchstaben gekürzt.

### fish hat seine eigene Syntax

Hier unterscheidet sich fish am stärksten von bash und zsh:

| Das hier | bash und zsh | fish |
|---|---|---|
| Eine Variable setzen | `frukt=äpple` | `set frukt äpple` |
| Umgebungsvariable | `export EDITOR=nano` | `set -x EDITOR nano` |
| Eine Variable entfernen | `unset frukt` | `set -e frukt` |
| Befehlsersetzung | `$(pwd)` | `(pwd)` |
| Letzter Exit-Status | `$?` | `$status` |
| Skript-Argumente | `$@`, `$1` | `$argv`, `$argv[1]` |
| Bedingung | `if …; then …; fi` | `if …; …; end` |
| Schleife | `for …; do …; done` | `for …; …; end` |
| Funktion | `hej() { …; }` | `function hej; …; end` |
| Arithmetik | `$((17 * 23))` | `math 17 x 23` |

### Variablen mit set

Versuche, eine Variable auf die bash-Art zu setzen (`frukt` ist Schwedisch für
Obst, `äpple` für Apfel):

```sh
frukt=äpple
```

fish weigert sich und sagt dir, wie man es schreibt:

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

So macht man es in fish:

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

`-x` (*export*) macht die Variable zu einer Umgebungsvariable, die Programme
sehen, die du startest, und `-e` (*erase*) entfernt sie.

In fish ist jede Variable eine **Liste**. Die Elemente sind ab 1 nummeriert:

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

### Befehlsersetzung und $status

In fish schreibt man Befehlsersetzung mit einfachen Klammern:

```sh
echo "Ich bin in" (pwd)
```

Innerhalb von Anführungszeichen sind Klammern normaler Text – deshalb steht
`(pwd)` außerhalb. Der Exit-Status des letzten Befehls heißt `$status`:

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
for f in ~/dokument/*.txt
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
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
name=Kim
echo "Hallo $name, ich werde von bash ausgeführt"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

Das Skript funktioniert in fish, obwohl `name=Kim` dort verboten ist – denn
bash führt es aus. Deshalb ist `#!/bin/bash` (oder `#!/usr/bin/env bash`) so
wichtig. Ein Skript, das überall funktionieren muss, auch dort, wo bash fehlt,
schreibt man mit `#!/bin/sh` und ausschließlich POSIX-Syntax.

## Die Standard-Shell mit chsh ändern

Jedes Mal `zsh` zu tippen, wenn du ein Terminal öffnest, wird schnell lästig.
Mit `chsh` (*change shell*) änderst du deine **Login-Shell** – die in
`/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- Die Shell muss mit ihrem vollständigen Pfad angegeben werden und in
  `/etc/shells` stehen.
- `chsh` fragt nach deinem Passwort (der Simulator überspringt das).
- Die Änderung wirkt beim **nächsten Login**. Das Terminal, das du offen hast,
  behält seine alte Shell, und `$SHELL` ändert sich erst, wenn du dich erneut
  angemeldet hast.
- root kann die Shell für andere ändern: `sudo chsh -s /usr/bin/fish kim`.

:::arch
Unter Arch listet `chsh -l` alle gültigen Shells auf.
:::

:::redhat
Unter Fedora listet `chsh -l` alle gültigen Shells auf.
:::

Um zu bash zurückzukehren, machst du dasselbe:

```sh
chsh -s /bin/bash
```

Ein verbreiteter Rat für fish ist, bash als Login-Shell zu behalten und
stattdessen das Terminalprogramm fish starten zu lassen – dann funktioniert
alles weiter, was beim Login eine POSIX-Shell erwartet.

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
| `set frukt äpple` | Eine Variable in fish setzen |
| `set -x NAME value` | Eine Umgebungsvariable in fish setzen |
| `chsh -s /usr/bin/zsh` | Deine Login-Shell ändern |

Die Konfigurationsdateien: `~/.bashrc` (bash), `~/.zshrc` (zsh) und
`~/.config/fish/config.fish` (fish).
