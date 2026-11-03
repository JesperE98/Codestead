# Prüfung: Systemverwaltung

Zeig, was du über Dienste, Festplatten und Benutzer gelernt hast. Die Fragen
decken den ganzen Teil ab, und zum Bestehen brauchst du 80 % richtig.

```quiz
`myserver` soll jedes Mal automatisch starten, wenn der Rechner bootet, darf
aber **nicht** jetzt gleich gestartet werden. Welcher Befehl macht genau das?
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
`enable` gilt beim Booten, `start` gilt jetzt, und `--now` macht beides.
```

Der Dienst `reportd` auf diesem Rechner konnte nicht starten. Was gibt
dieser Befehl aus?

```predict
$ systemctl is-active reportd
failed
---
`is-active` gibt nur ein einziges Wort aus – hier denselben Zustand, den
`systemctl --failed` auflistet. Der Exit-Status ist nur dann 0, wenn die
Antwort `active` lautet.
```

```quiz
Du willst das Log von `myserver` beobachten, während du ihn testest, und
neue Zeilen sollen erscheinen, sobald sie ankommen. Welchen Befehl nimmst du?
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
`-u` wählt eine Unit aus, und `-f` zeigt weiter neue Zeilen an, bis du
Strg+C drückst.
```

```try
systemctl cat myserver
---
`ExecStart=` ist der Befehl, der den Dienst startet, und `WantedBy=` ist das,
was `enable` verwendet.
```

```quiz
Du führst `systemctl stop myserver` ohne `sudo` aus und bekommst
*Interactive authentication required*. Warum?
- [ ] myserver läuft nicht
- [x] Alles, was einen Dienst verändert, braucht root-Rechte
- [ ] Du musst zuerst `daemon-reload` ausführen
- [ ] `stop` funktioniert nur bei aktivierten Diensten
```

```quiz
Warum steht in `/etc/fstab` meist `UUID=…` statt `/dev/sda2`?
- [ ] UUIDs sind kürzer zu tippen
- [x] Gerätenamen können sich ändern, wenn Festplatten hinzukommen, aber eine UUID ändert sich nie
- [ ] `mount` versteht keine Gerätenamen
- [ ] Die UUID zeigt, wie voll das Dateisystem ist
---
Die UUID wird zusammen mit dem Dateisystem erzeugt. Du findest sie mit
`lsblk -f`, `blkid` oder `findmnt`.
```

```quiz
`df -h` zeigt, dass `/` zu 98 % voll ist. Welcher Befehl hilft dir
herauszufinden, **welche Verzeichnisse** den Platz belegen?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
`df` fragt das Dateisystem, wie voll es ist; `du` geht durch die Dateien und
zählt sie zusammen.
```

Dein Home-Verzeichnis liegt auf diesem Rechner nicht auf einem eigenen
Dateisystem. Was gibt das hier aus?

```predict
$ df -h ~ | awk 'NR > 1 {print $6}'
/
---
Mit einem Pfad zeigt `df` nur das Dateisystem, auf dem er liegt. Die sechste
Spalte ist `Mounted on` – das Wurzeldateisystem.
```

```quiz
Du hast eine Zeile zu `/etc/fstab` hinzugefügt. Was solltest du tun,
**bevor** du neu startest?
- [ ] Nichts – die Datei wird nur beim Booten gelesen
- [x] Sie mit `sudo mount -a` testen
- [ ] `sudo systemctl daemon-reload` ausführen
- [ ] Die Partition mit `mkfs` formatieren
---
Ein Fehler in `/etc/fstab` kann verhindern, dass der Rechner richtig bootet.
`mount -a` hängt alles aus der Datei ein, was noch nicht eingehängt ist,
sodass du die Fehler jetzt siehst.
```

```quiz
Du bist dabei, auf einem echten Rechner eine Partition mit `mkfs` zu
formatieren. Was solltest du zuerst prüfen? (Wähle alle passenden aus.)
- [x] Mit `lsblk -f`, dass die Größe, die Spalte `RM` und die Bezeichnung stimmen
- [x] Dass die Partition nicht eingehängt ist
- [x] Dass du eine Sicherung von allem Wichtigen hast
- [ ] Dass die Partition in `/etc/fstab` steht
```

```quiz
Warum stehen die Passwort-Hashes in `/etc/shadow` und nicht in `/etc/passwd`?
- [ ] `/etc/passwd` ist zu klein
- [x] `/etc/passwd` muss für alle lesbar sein, `/etc/shadow` aber nur für root
- [ ] Die Hashes lassen sich umkehren, deshalb müssen sie versteckt werden
- [ ] `/etc/passwd` wird nur beim Booten gelesen
---
Sonst könnte jeder die Hashes kopieren und in aller Ruhe versuchen, sie zu
knacken. `ls -l` braucht `/etc/passwd`, um die Namen der Besitzer anzuzeigen.
```

Die Felder in `/etc/group` sind der Gruppenname, `x`, die GID und die
Mitglieder. Wer ist in der Gruppe `sudo`?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
{{user}}
```

```quiz
Was passiert bei `sudo userdel kim` – ohne `-r`?
- [x] Der Benutzer wird gelöscht, aber das Home-Verzeichnis `/home/kim` bleibt zurück
- [ ] Nichts – `userdel` braucht immer `-r`
- [ ] Der Benutzer und das Home-Verzeichnis werden gelöscht
- [ ] Das Konto wird nur gesperrt
```

```quiz
Ein Benutzer hat die UID 33 und die Shell `/usr/sbin/nologin`. Was ist er am
wahrscheinlichsten?
- [ ] root
- [ ] Ein normaler Benutzer – ein Mensch
- [x] Ein Systembenutzer, unter dem ein Dienst läuft
- [ ] Ein gelöschter Benutzer
---
Die UIDs 1–999 sind für Systembenutzer, und `nologin` bedeutet, dass sich
niemand als sie anmelden kann.
```

```try
getent group sudo
---
`getent` schlägt die Gruppe genauso nach wie das System.
```
