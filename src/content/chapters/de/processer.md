# Prozesse und Jobs

Jedes Programm, das läuft, ist ein **Prozess**. Gerade laufen auf dem
simulierten Rechner ein gutes Dutzend: die Dienste des Systems, deine Shell –
und noch etwas anderes, das du dir gleich ansehen wirst. In diesem Kapitel
lernst du, wie du siehst, was läuft, wie du Programme stoppst, die sich
danebenbenehmen, und wie du Dinge im Hintergrund laufen lässt.

## Was ist ein Prozess?

Ein Prozess ist ein laufendes Programm samt allem, was es braucht: Speicher,
offene Dateien und den Benutzer, unter dem es läuft. Jeder Prozess hat eine
**PID** (*process ID*) – eine Nummer, die ihn identifiziert – und einen
Elternprozess, die **PPID**, der ihn gestartet hat. Alles beginnt mit Prozess
Nummer 1, `init` (auf fast jeder Distribution ist das `systemd`), der alle
anderen startet.

## Meine Prozesse – `ps`

`ps` (*process status*) ohne Optionen zeigt die Prozesse in deinem eigenen
Terminal:

```sh
ps
```

Du siehst deine Shell, `bash`, und `ps` selbst – das nur so lange lebt, wie es
läuft.

## Alle Prozesse – `ps aux`

Um alles zu sehen, was auf dem Rechner läuft, nimmt man üblicherweise
`ps aux`:

```sh
ps aux
```

| Spalte | Bedeutet |
|---|---|
| `USER` | Der Benutzer, unter dem der Prozess läuft |
| `PID` | Die ID-Nummer des Prozesses |
| `%CPU` / `%MEM` | Wie viel Prozessor und Speicher er verbraucht |
| `STAT` | Zustand: `R` läuft, `S` schläft, `s` Session-Leader |
| `COMMAND` | Der Befehl, der den Prozess gestartet hat |

Die Liste wird lang, deshalb kombiniert man sie oft mit `grep` oder `sort`:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

Die Variante `ps -ef` zeigt dieselben Prozesse, aber mit der PID des
Elternprozesses in einer eigenen Spalte. Willst du nur die PID eines Prozesses,
dessen Namen du kennst, gibt es `pgrep`:

```sh
pgrep -l sshd
```

## Eine Live-Ansicht – `top` und `htop`

`top` zeigt die Prozesse sortiert danach, wie viel Prozessorzeit sie
verbrauchen, und aktualisiert sich jede Sekunde – perfekt, um herauszufinden,
was den Rechner ausbremst. Ganz oben siehst du die Last (*load average*), die
Anzahl der Prozesse und den Speicher.

```sh
top
```

In einem echten Terminal beendest du `top` mit `q`. Viele bevorzugen `htop`,
das Farben hat und sich mit der Maus bedienen lässt, aber meist erst
installiert werden muss.

## Prozesse stoppen – `kill`

Der Name klingt dramatisch, aber eigentlich schickt `kill` ein **Signal** an
einen Prozess. Das Standardsignal, `SIGTERM` (15), bittet den Prozess, sich
ordentlich zu beenden. Hört er nicht darauf, kannst du `SIGKILL` (9) schicken,
das ihn zwingt, sofort aufzuhören – dann hat er aber keine Chance mehr, etwas
zu speichern oder aufzuräumen.

```text
kill 1234        # Prozess 1234 bitten, sich zu beenden (SIGTERM)
kill -9 1234     # ihn zwingen (SIGKILL) – das letzte Mittel
```

Kennst du den Namen, aber nicht die PID, kannst du `pkill` (passt auf ein
Muster) oder `killall` (exakter Name) verwenden:

```text
pkill firefox
killall firefox
```

Signale darfst du nur an deine **eigenen** Prozesse schicken. Für Prozesse,
die root oder anderen Benutzern gehören, brauchst du `sudo`.

> **Finde ihn und stopp ihn!** Irgendein Prozess auf diesem Rechner
> verbraucht fast 100 % des Prozessors. Finde mit `top` oder
> `ps aux --sort=-%cpu` heraus, wie er heißt und welche PID er hat – und
> stopp ihn dann.

## Vordergrund und Hintergrund

Wenn du einen Befehl ausführst, wartet die Shell, bis er fertig ist; er läuft
im **Vordergrund**. Setzt du ein `&` ans Ende, läuft er stattdessen im
**Hintergrund**, und du bekommst deinen Prompt sofort zurück:

```sh
sleep 300 &
```

Die Shell antwortet mit der Jobnummer in eckigen Klammern und der PID des
Prozesses, zum Beispiel `[1] 4200`. Programme, die aus dem Terminal gestartet
wurden, heißen **Jobs**:

```sh
jobs
```

| Befehl | Macht |
|---|---|
| `jobs` | Die Jobs in diesem Terminal auflisten |
| `fg %1` | Job 1 in den Vordergrund holen |
| `bg %1` | Einen angehaltenen Job im Hintergrund weiterlaufen lassen |
| `kill %1` | Job 1 beenden |
| `Ctrl+C` | Das Programm im Vordergrund abbrechen |
| `Ctrl+Z` | Das Programm im Vordergrund anhalten (weiter mit `fg` oder `bg`) |

Die Variable `$!` enthält die PID des zuletzt gestarteten Hintergrundjobs.
Wenn ein Job fertig ist, sagt dir die Shell das mit einer Zeile wie
`[1]+  Done   sleep 300`.

## Wie geht es dem Rechner?

Zwei kleine Befehle geben dir einen schnellen Überblick:

```sh
uptime
free -h
```

`uptime` zeigt, wie lange der Rechner schon läuft, und die Last der letzten
1, 5 und 15 Minuten. `free -h` zeigt, wie viel Speicher belegt ist. Achte auf
die Spalte *available*: Linux nutzt freien Speicher als Cache für Dateien,
deshalb sieht *free* oft niedrig aus, obwohl reichlich Speicher da ist.

## Überall gleich

Prozesse funktionieren auf jeder Distribution gleich. Die Werkzeuge stammen aus
dem Paket **procps** (unter Arch und Fedora heißt es `procps-ng`) und `killall`
aus **psmisc**. Unterschiedlich ist, welche Dienste von Anfang an laufen –
vergleiche doch mal `ps aux` unter {{distro}} mit einer anderen Distribution!
