# Dienste und Logs mit systemd

Ein Linux-Rechner tut ständig Dinge, die niemand von Hand startet: Er nimmt
SSH-Verbindungen an, hält die Uhr synchron, führt geplante Jobs aus und
schreibt Logs. Die Programme, die das erledigen, heißen **Dienste**
(*Services*), und in fast jeder modernen Distribution hält **systemd** sie in
Ordnung. In diesem Kapitel lernst du, Dienste zu starten und zu stoppen, sie
beim Booten starten zu lassen und – am allerwichtigsten – die Logs zu lesen,
wenn etwas schiefgeht.

## init und systemd

Wenn der Linux-Kernel gestartet ist, führt er ein einziges Programm aus:
**init**, Prozess Nummer 1. Init startet dann alles andere. Heute ist init
fast immer **systemd** – in Debian, Ubuntu, Arch und Fedora gleichermaßen.
Sieh selbst nach:

```sh
ps -p 1
```

Der Prozess heißt `/sbin/init`, aber das ist nur ein Link auf das Programm
`systemd`.

systemd tut mehr, als Dienste zu starten. Es behält im Blick, ob sie noch
leben, startet sie neu, wenn sie abstürzen (wenn du das möchtest), sammelt
alles, was sie ausgeben, in einem gemeinsamen Log – dem **Journal** – und hat
Werkzeuge für die meisten Teile des Systems:

| Werkzeug | Macht |
|---|---|
| `systemctl` | Steuert die Dienste: Status, Start, Stopp, Boot |
| `journalctl` | Liest das Journal (das Log) |
| `hostnamectl` | Zeigt und ändert den Namen des Rechners |
| `systemd-analyze` | Zeigt, wie lange der Bootvorgang gedauert hat |

## Units und Dienste

Alles, was systemd im Blick behält, heißt **Unit**. Es gibt mehrere Arten, und
die Art erkennt man an der Endung: `.service` (ein Dienst), `.timer` (ein
geplanter Job), `.socket`, `.mount`, `.target` (eine Gruppe von Units, ein
bisschen wie eine „Stufe“ des Bootvorgangs) und mehr. In diesem Kapitel geht
es um Dienste.

Jede Unit wird durch eine **Unit-Datei** beschrieben, eine kleine Textdatei.
Sie liegen an zwei Orten:

| Verzeichnis | Inhalt |
|---|---|
| `/usr/lib/systemd/system/` | Unit-Dateien, die mit den Paketen kommen. Hier nichts ändern! |
| `/etc/systemd/system/` | Die eigenen Unit-Dateien des Administrators. Sie haben Vorrang. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

:::debian
Ältere Debian- und Ubuntu-Versionen schreiben oft stattdessen
`/lib/systemd/system`. Das ist dasselbe Verzeichnis – `/lib` ist ein Link auf
`/usr/lib`.
:::

Der Name eines Dienstes ist der Dateiname, zum Beispiel `minserver.service`.
Wenn du Befehle tippst, darfst du `.service` weglassen: `systemctl status
minserver` funktioniert genauso gut.

## Wie geht es dem Dienst? – `systemctl status`

Der Befehl, den du am häufigsten benutzen wirst, ist `systemctl status`:

:::debian
```sh
systemctl status ssh
```
:::

:::arch
```sh
systemctl status sshd
```
:::

:::redhat
```sh
systemctl status sshd
```
:::

Die Ausgabe sieht ungefähr so aus:

```text
● sshd.service - OpenSSH server daemon
     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: disabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 CET; 2h 13min ago
       Docs: man:sshd(8)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/sshd.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 fedora systemd[1]: Starting sshd.service - OpenSSH server daemon...
Oct 30 07:54:07 fedora sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 fedora systemd[1]: Started sshd.service - OpenSSH server daemon.
```

Zeile für Zeile:

| Zeile | Bedeutet |
|---|---|
| `●` | Grüner Punkt = läuft. Rotes `×` = ist fehlgeschlagen. Weißes `○` = gestoppt. |
| `Loaded` | Wo die Unit-Datei liegt, ob der Dienst beim Booten startet (`enabled`/`disabled`/`static`) und die Voreinstellung der Distribution (`preset`) |
| `Active` | Die wichtigste Zeile: `active (running)`, `inactive (dead)` oder `failed` – und seit wann |
| `Docs` | Wo man mehr lesen kann (`man sshd`) |
| `Main PID` | Der Hauptprozess des Dienstes – dieselbe PID wie in `ps aux` |
| `Memory`, `CGroup` | Wie viel Speicher er braucht und welche Prozesse zu ihm gehören |
| Letzte Zeilen | Die neuesten Zeilen aus dem Log des Dienstes im Journal |

`static` bedeutet, dass der Dienst nicht für sich allein aktiviert werden kann
– er wird gestartet, wenn eine andere Unit ihn braucht.

> **Tipp:** In einem echten Terminal wird lange Ausgabe in einem Pager
> (`less`) angezeigt. Drücke `q`, um zurückzukommen. Füge `--no-pager` hinzu,
> wenn du lieber darauf verzichtest.

## Starten, stoppen und neu starten

```text
sudo systemctl start minserver      # jetzt starten
sudo systemctl stop minserver       # jetzt stoppen
sudo systemctl restart minserver    # stoppen und wieder starten
sudo systemctl reload minserver     # ihn bitten, seine Konfiguration neu einzulesen
```

Alles, was etwas **ändert**, erfordert root, also vergiss `sudo` nicht. Ohne
antwortet systemctl:

```text
Failed to start minserver.service: Interactive authentication required.
```

`reload` funktioniert nur bei Diensten, die es unterstützen. Der Vorteil ist,
dass der Dienst währenddessen weiterläuft – keine Verbindung wird getrennt.
Wenn du die Konfigurationsdatei eines Dienstes geändert hast, ist `reload`
oder `restart` der letzte Schritt.

> **Probiere es aus!** Im Kapitel über Prozesse hast du den Übungsserver mit
> `pkill` beendet. Sieh dir `systemctl status minserver` an – systemd hat
> bemerkt, dass der Prozess verschwunden ist. Starte ihn mit `systemctl` neu
> und vergleiche die PID mit `pgrep -l minserver`.

## Jetzt oder beim Booten? `start` und `enable`

Das ist das häufigste Missverständnis bei systemd: **`start` und `enable` sind
zwei verschiedene Dinge.**

| Befehl | Macht |
|---|---|
| `systemctl start X` | Startet den Dienst **jetzt**. Nach einem Neustart ist er wieder weg. |
| `systemctl enable X` | Startet den Dienst automatisch **beim Booten** – aber nicht jetzt. |
| `systemctl enable --now X` | Beides auf einmal. |
| `systemctl disable X` | Beim Booten nicht starten (`--now` stoppt ihn auch). |

`enable` legt einen Link in einem Verzeichnis an, das nach dem Target im
Abschnitt `[Install]` der Unit-Datei benannt ist, meistens
`multi-user.target.wants`:

```text
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

Wenn der Rechner bootet, geht systemd dieses Verzeichnis durch und startet
alles, was darin liegt. Du kannst den Zustand abfragen:

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` und `is-enabled` sind prima in Skripten – sie geben ein Wort aus
und beenden sich mit Status 0, wenn die Antwort „ja“ lautet. Mit `-q` sind sie
völlig still:

```text
if systemctl is-active -q minserver; then echo "the server is running"; fi
```

## Dienste auflisten

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` zeigt die Dienste, die laufen (oder fehlgeschlagen sind). Mit
  `--all` kommen auch die gestoppten dazu.
- `--failed` zeigt nur die fehlgeschlagenen. Ein guter erster Befehl, wenn
  sich etwas falsch anfühlt!
- `list-unit-files` zeigt alle installierten Unit-Dateien und ob sie
  `enabled`, `disabled` oder `static` sind.

## Das Journal – `journalctl`

Alles, was die Dienste, der Kernel und systemd selbst ausgeben, landet im
Journal. Ohne Optionen bekommst du das ganze Journal, das Älteste zuerst:

```sh
journalctl
```

Das wird schnell sehr viel, deshalb filterst du fast immer:

| Befehl | Zeigt |
|---|---|
| `journalctl -u ssh` | Nur einen Dienst (`-u` wie *unit*) |
| `journalctl -n 20` | Die 20 neuesten Zeilen |
| `journalctl -f` | Die neuesten Zeilen und dann neue Zeilen, sobald sie kommen (beenden mit Strg+C) |
| `journalctl -b` | Nur diesen Bootvorgang (`-b -1` = den vorherigen) |
| `journalctl --since today` | Seit Mitternacht. Auch `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Nur Fehler und Schlimmeres |
| `journalctl -xe` | Ans Ende springen und Erklärungen hinzufügen |
| `journalctl -k` | Nur Kernel-Meldungen (wie `dmesg`) |

Die Optionen lassen sich kombinieren. Ein paar Klassiker:

```sh
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
```

### Prioritäten

Jede Zeile im Journal hat eine **Priorität**. `-p` zeigt die, die du wählst,
*und alles Schwerwiegendere*:

| Nummer | Name | Bedeutet |
|---|---|---|
| 0 | `emerg` | Das System ist unbenutzbar |
| 1 | `alert` | Muss sofort behoben werden |
| 2 | `crit` | Kritischer Fehler |
| 3 | `err` | Fehler – wird rot angezeigt |
| 4 | `warning` | Warnung – wird gelb angezeigt |
| 5 | `notice` | Normal, aber erwähnenswert |
| 6 | `info` | Information |
| 7 | `debug` | Debugging-Information |

Keine Sorge, wenn `journalctl -p err` ein paar Kernel-Fehler wie
`ACPI BIOS Error` zeigt. Die gibt es auf fast jedem Rechner, und sie sind
meistens harmlos – Fehler in der Firmware des Rechners, die der Kernel umgeht.

Normalerweise musst du root sein oder Mitglied einer Gruppe, die das Journal
lesen darf (`adm` oder `systemd-journal` in Debian und Ubuntu, `wheel` in Arch
und Fedora), um alles zu sehen. Dein Benutzer im Simulator darf das ganze
Journal lesen.

## Fehlersuche bei einem Dienst, der nicht startet

Jemand hat auf diesem Rechner den Dienst **rapportd** eingerichtet, aber
irgendetwas stimmt nicht. So geht man üblicherweise vor:

1. **Was ist fehlgeschlagen?** Liste die fehlgeschlagenen Dienste auf:

   ```sh
   systemctl --failed
   ```

2. **Sieh dir den Status an.** Die letzten Zeilen reichen oft schon:

   ```sh
   systemctl status rapportd
   ```

3. **Lies das ganze Log** des Dienstes. Es sagt dir fast immer, was falsch ist
   – lies es sorgfältig, Wort für Wort:

   ```sh
   journalctl -xeu rapportd
   ```

   `systemctl` schlägt selbst genau diesen Befehl vor, wenn ein Start
   fehlschlägt: `See "systemctl status rapportd.service" and "journalctl -xeu
   rapportd.service" for details.`

4. **Behebe das Problem**, zum Beispiel eine Konfigurationsdatei, die fehlt
   oder einen Tippfehler enthält.

5. **Neu starten und prüfen:**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

Die Zeile `Main process exited, code=exited, status=1/FAILURE` bedeutet, dass
sich das Programm von selbst mit einem Fehler beendet hat. Steht dort
`status=203/EXEC`, konnte systemd das Programm gar nicht finden – prüfe den
Pfad in `ExecStart=`.

## Die Unit-Datei – `systemctl cat`

Um genau zu sehen, wie ein Dienst gestartet wird, lies seine Unit-Datei:

```sh
systemctl cat minserver
```

```text
# /etc/systemd/system/minserver.service
[Unit]
Description=Minserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/minserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Abschnitt | Inhalt |
|---|---|
| `[Unit]` | Beschreibung und Reihenfolge: `After=network.target` = nach dem Netzwerk starten |
| `[Service]` | Wie das Programm läuft: `ExecStart=` (der Befehl), `User=`, `Restart=on-failure` … |
| `[Install]` | Was `enable` tun soll: `WantedBy=multi-user.target` |

Wenn du eine Unit-Datei änderst, muss systemd sie neu laden, bevor die
Änderung wirkt – sonst bekommst du eine Warnung in `systemctl status`:

```text
sudo systemctl daemon-reload
```

Ändere niemals die Dateien in `/usr/lib/systemd/system` – sie werden beim
nächsten Update des Pakets überschrieben. Lege stattdessen deine eigene
Version in `/etc/systemd/system` ab.

## Verschiedene Namen in verschiedenen Familien

systemd funktioniert überall gleich, aber **die Dienste heißen nicht immer
gleich**. Das hängt davon ab, wie die Pakete heißen und welche Programme die
Distribution gewählt hat:

| Dienst | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| SSH-Server | `ssh` (Alias `sshd`) | `sshd` | `sshd` |
| Geplante Jobs (cron) | `cron` | `cronie` (standardmäßig nicht installiert) | `crond` |
| Netzwerk | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Firewall | `ufw` (falls installiert) | – | `firewalld` |
| Uhr | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
In {{distro}} heißt der SSH-Dienst `ssh.service`. Er hat den Alias
`sshd.service`, also funktioniert auch `systemctl status sshd` – aber die
Ausgabe zeigt den echten Namen.
:::

:::arch
Arch installiert standardmäßig fast keine Dienste – du wählst selbst. Es läuft
zum Beispiel kein cron-Dienst; Arch benutzt stattdessen systemd-**Timer**.
Wenn du cron möchtest, installiere das Paket `cronie` und führe `sudo
systemctl enable --now cronie` aus. Denk außerdem daran, dass Arch
`preset: disabled` hat: Neue Dienste werden bei der Installation nie
automatisch aktiviert.
:::

:::redhat
Fedora hat `firewalld` von Anfang an laufen, und die Zeitsynchronisation
übernimmt `chronyd`. Fedora benutzt außerdem für die meisten Dienste
`preset: disabled`: Wenn du einen neuen Dienst installierst (zum Beispiel
einen Webserver), musst du selbst `sudo systemctl enable --now …` ausführen.
:::

Nicht sicher, wie etwas heißt? Durchsuche die Liste:

```sh
systemctl list-unit-files | grep ssh
```

## Den Rechner neu starten

`enable` zeigt seine Wirkung erst, wenn der Rechner neu startet. Das kannst du
im Simulator ausprobieren – er startet im Handumdrehen neu:

```text
sudo systemctl reboot
```

Nach dem Neustart laufen nur die aktivierten Dienste. Mit `journalctl -b
-1` siehst du das Log des vorherigen Bootvorgangs (und wie alles
heruntergefahren wurde), und `journalctl --list-boots` zeigt alle
Bootvorgänge im Journal.

## Mehr von systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` zeigt den Namen des Rechners, das Betriebssystem und den Kernel
(und benennt ihn mit `sudo hostnamectl set-hostname NEWNAME` um).
`systemd-analyze` zeigt, wie lange der Bootvorgang gedauert hat, und `blame`,
welche Dienste am längsten gebraucht haben – perfekt, wenn der Rechner langsam
bootet.
