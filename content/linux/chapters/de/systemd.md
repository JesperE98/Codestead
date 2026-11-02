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

Ältere Debian- und Ubuntu-Versionen schreiben oft stattdessen
`/lib/systemd/system`. Das ist dasselbe Verzeichnis – `/lib` ist ein Link auf
`/usr/lib`.

Der Name eines Dienstes ist der Dateiname, zum Beispiel `myserver.service`.
Wenn du Befehle tippst, darfst du `.service` weglassen: `systemctl status
myserver` funktioniert genauso gut.

## Wie geht es dem Dienst? – `systemctl status`

Der Befehl, den du am häufigsten benutzen wirst, ist `systemctl status`:

```sh
systemctl status ssh
```

Unter Ubuntu heißt der SSH-Server `ssh`. Die Ausgabe sieht ungefähr so aus:

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
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
sudo systemctl start myserver      # jetzt starten
sudo systemctl stop myserver       # jetzt stoppen
sudo systemctl restart myserver    # stoppen und wieder starten
sudo systemctl reload myserver     # ihn bitten, seine Konfiguration neu einzulesen
```

Alles, was etwas **ändert**, erfordert root, also vergiss `sudo` nicht. Ohne
antwortet systemctl:

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` funktioniert nur bei Diensten, die es unterstützen. Der Vorteil ist,
dass der Dienst währenddessen weiterläuft – keine Verbindung wird getrennt.
Wenn du die Konfigurationsdatei eines Dienstes geändert hast, ist `reload`
oder `restart` der letzte Schritt.

> **Probiere es aus!** Im Kapitel über Prozesse hast du den Übungsserver mit
> `pkill` beendet. Sieh dir `systemctl status myserver` an – systemd hat
> bemerkt, dass der Prozess verschwunden ist. Starte ihn mit `systemctl` neu
> und vergleiche die PID mit `pgrep -l myserver`.

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
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

Wenn der Rechner bootet, geht systemd dieses Verzeichnis durch und startet
alles, was darin liegt. Du kannst den Zustand abfragen:

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` und `is-enabled` sind prima in Skripten – sie geben ein Wort aus
und beenden sich mit Status 0, wenn die Antwort „ja“ lautet. Mit `-q` sind sie
völlig still:

```text
if systemctl is-active -q myserver; then echo "der Server läuft"; fi
```

Auf einem frisch gestarteten Rechner im Simulator läuft `myserver`, aber
niemand hat ihn aktiviert. Was geben diese beiden Befehle aus?

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver läuft **jetzt**, aber niemand hat `enable` ausgeführt – nach einem
Neustart würde er nicht gestartet. `start` und `enable` sind wirklich zwei
verschiedene Dinge.
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
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
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
lesen darf (`adm` oder `systemd-journal` unter Ubuntu – andere Familien
verwenden andere Gruppen), um alles zu sehen. Dein Benutzer im Simulator darf
das ganze Journal lesen.

```quiz
Welche Prioritäten zeigt `journalctl -p warning` an?
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` zeigt die Priorität, die du wählst, *und alles Schwerwiegendere* – also
alles mit derselben oder einer niedrigeren Nummer (`warning` ist 4).
```

## Fehlersuche bei einem Dienst, der nicht startet

Jemand hat auf diesem Rechner den Dienst **reportd** eingerichtet, aber
irgendetwas stimmt nicht. So geht man üblicherweise vor:

1. **Was ist fehlgeschlagen?** Liste die fehlgeschlagenen Dienste auf:

   ```sh
   systemctl --failed
   ```

2. **Sieh dir den Status an.** Die letzten Zeilen reichen oft schon:

   ```sh
   systemctl status reportd
   ```

3. **Lies das ganze Log** des Dienstes. Es sagt dir fast immer, was falsch ist
   – lies es sorgfältig, Wort für Wort:

   ```sh
   journalctl -xeu reportd
   ```

   `systemctl` schlägt selbst genau diesen Befehl vor, wenn ein Start
   fehlschlägt: `See "systemctl status reportd.service" and "journalctl -xeu
   reportd.service" for details.`

4. **Behebe das Problem**, zum Beispiel eine Konfigurationsdatei, die fehlt
   oder einen Tippfehler enthält.

5. **Neu starten und prüfen:**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

Die Zeile `Main process exited, code=exited, status=1/FAILURE` bedeutet, dass
sich das Programm von selbst mit einem Fehler beendet hat. Steht dort
`status=203/EXEC`, konnte systemd das Programm gar nicht finden – prüfe den
Pfad in `ExecStart=`.

```quiz
Ein Dienst startet nicht, und im Journal steht `status=203/EXEC`. Wo schaust
du zuerst nach?
- [ ] In `/etc/fstab`
- [x] Beim Pfad in `ExecStart=` in der Unit-Datei
- [ ] Bei der Priorität mit `journalctl -p err`
- [ ] Nirgends – es bedeutet, dass sich das Programm von selbst mit einem Fehler beendet hat
---
203/EXEC bedeutet, dass systemd das Programm gar nicht finden konnte. Ein
Programm, das startet und sich dann mit einem Fehler beendet, ergibt
stattdessen `status=1/FAILURE`.
```

## Die Unit-Datei – `systemctl cat`

Um genau zu sehen, wie ein Dienst gestartet wird, lies seine Unit-Datei:

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
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

```quiz
Du willst ändern, wie ein Dienst gestartet wird, der mit einem Paket gekommen
ist. Was ist der richtige Weg?
- [ ] Seine Datei in `/usr/lib/systemd/system` bearbeiten und den Dienst neu starten
- [x] Eine eigene Version in `/etc/systemd/system` ablegen, `sudo systemctl daemon-reload` ausführen und den Dienst neu starten
- [ ] Eine eigene Version in `/etc/systemd/system` ablegen – systemd bemerkt die Änderung von selbst
- [ ] Die Datei in `/usr/lib/systemd/system` bearbeiten und `sudo systemctl enable` darauf ausführen
---
Dateien in `/etc/systemd/system` haben Vorrang und werden nicht überschrieben,
wenn das Paket aktualisiert wird. `daemon-reload` lässt systemd die geänderte
Unit-Datei neu laden.
```

## Wie heißen die Dienste?

systemd funktioniert überall gleich, aber **die Dienste heißen nicht immer
gleich** – das hängt davon ab, wie die Pakete heißen und welche Programme die
Distribution gewählt hat. Unter Ubuntu:

| Dienst | Name unter Ubuntu |
|---|---|
| SSH-Server | `ssh` (Alias `sshd`) |
| Geplante Jobs (cron) | `cron` |
| Netzwerk | `NetworkManager` |
| Firewall | `ufw` (falls installiert) |
| Uhr | `systemd-timesyncd` |

Der SSH-Dienst heißt eigentlich `ssh.service`. Er hat den Alias
`sshd.service`, also funktioniert auch `systemctl status sshd` – aber die
Ausgabe zeigt den echten Namen. Andere Familien können dieselben Dienste anders
nennen (unter Arch und Fedora heißt der SSH-Dienst `sshd`) – um solche
Unterschiede geht es im Teil über Distributionen und Pakete.

Nicht sicher, wie etwas heißt? Durchsuche die Liste:

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` ist die echte Unit-Datei, und `sshd.service` wird als `alias`
dafür aufgeführt.
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
