# Zusammenfassung: Systemverwaltung

In diesem Teil hast du dich als Administrator um den Rechner gekümmert: um die
Dienste, die im Hintergrund laufen, um die Festplatten, auf denen die Dateien
landen, und um die Benutzer, die sich den Rechner teilen. Fast alles, was hier
etwas **verändert**, braucht root-Rechte – deshalb kam `sudo` oft vor.

## Dienste und Logs mit systemd

**systemd** ist Prozess Nummer 1 und startet alles andere. Alles, worüber es
den Überblick behält, ist eine **Unit**, beschrieben durch eine Unit-Datei –
die, die mit den Paketen kommen, liegen in `/usr/lib/systemd/system`, deine
eigenen in `/etc/systemd/system`, die Vorrang haben. `systemctl` steuert die
Dienste, und **`start` (jetzt) und `enable` (beim Booten) sind zwei
verschiedene Dinge**. Alles, was die Dienste ausgeben, landet im **Journal**,
das du mit `journalctl` liest und filterst. Wenn ein Dienst nicht starten
will: `systemctl --failed`, `systemctl status`, dann `journalctl -xeu` – und
lies das Log Wort für Wort. Unter Ubuntu heißt der SSH-Dienst `ssh`; andere
Familien benennen Dienste manchmal anders.

## Festplatten und Dateisysteme

Eine **Festplatte** wird in **Partitionen** aufgeteilt, und jede Partition
braucht ein **Dateisystem**, bevor sie Dateien aufnehmen kann. Festplatten
sind Dateien in `/dev` (`/dev/sda`, `/dev/sda1`, …). Linux hat keine
Laufwerksbuchstaben: Jedes Dateisystem wird irgendwo in dem einen
Verzeichnisbaum **eingehängt**, der bei `/` beginnt. `lsblk` zeigt die
Festplatten, `df`, wie voll die Dateisysteme sind, und `du`, wie viel Platz
die Dateien belegen. **Hänge** einen USB-Stick immer **aus**, bevor du ihn
herausziehst, denn Änderungen können noch im Arbeitsspeicher warten. Was beim
Booten eingehängt wird, steht in `/etc/fstab`, am besten per **UUID**, die
sich nie ändert. `fdisk` und `mkfs` gehören zu den gefährlichsten Befehlen,
die es gibt – prüfe zweimal.

## Benutzer und Gruppen

Jeder Benutzer hat eine **UID** – root hat 0, Systembenutzer bekommen
niedrige Nummern, und Menschen beginnen bei 1000. Die Benutzer stehen in
`/etc/passwd`, die Gruppen in `/etc/group` und die Passwort-Hashes in
`/etc/shadow`, das nur root lesen kann. Jeder Benutzer hat genau eine
**primäre Gruppe** und beliebig viele **zusätzliche Gruppen**.
`useradd -m -s /bin/bash` legt einen Benutzer an, `passwd` setzt das Passwort,
und `usermod -aG` fügt zu einer Gruppe hinzu – **vergiss das `-a` nicht**.
Unter Ubuntu kommen die sudo-Rechte von der Gruppe `sudo` (andere Familien
verwenden `wheel`). `su -` wechselt den Benutzer mit dessen Passwort,
`sudo -u` führt mit deinem eigenen Passwort einen Befehl als jemand anderes
aus.

## Befehle

| Befehl | Tut |
|---|---|
| `systemctl status NAME` | Wie geht es dem Dienst? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | Starten, stoppen, neu starten, die Konfiguration neu einlesen |
| `sudo systemctl enable --now NAME` | Beim Booten starten – und jetzt |
| `systemctl is-active` / `is-enabled NAME` | Ein Wort, Exit-Status 0 für „ja“ |
| `systemctl --failed` | Dienste, die fehlgeschlagen sind |
| `systemctl cat NAME` | Die Unit-Datei anzeigen |
| `sudo systemctl daemon-reload` | Geänderte Unit-Dateien neu laden |
| `journalctl -u NAME` | Das Log eines Dienstes |
| `journalctl -p err -b` | Fehler und Schlimmeres seit diesem Bootvorgang |
| `journalctl -n 20`, `-f`, `--since today` | Die neuesten Zeilen, verfolgen, seit Mitternacht |
| `lsblk -f` | Festplatten, Partitionen und Dateisysteme |
| `blkid`, `findmnt -n -o UUID /` | Typ, Bezeichnung und UUID |
| `df -h`, `du -sh DIR` | Wie voll ist die Festplatte, wie viel belegen die Dateien |
| `sudo mount /dev/sdb1 /mnt/usb` | Ein Dateisystem einhängen |
| `sudo umount /mnt/usb` | Aushängen |
| `cat /etc/fstab`, `sudo mount -a` | Was beim Booten eingehängt wird – und Änderungen testen |
| `swapon --show`, `free -h` | Swap und Arbeitsspeicher |
| `id`, `groups` | UID, GID und Gruppen |
| `sudo useradd -m -s /bin/bash NAME` | Einen Benutzer anlegen |
| `sudo passwd NAME` | Ein Passwort setzen |
| `sudo groupadd GROUP` | Eine Gruppe anlegen |
| `sudo usermod -aG GROUP NAME` | Zu einer Gruppe hinzufügen |
| `sudo usermod -L` / `-U NAME` | Ein Konto sperren / entsperren |
| `sudo userdel -r NAME` | Einen Benutzer samt Home-Verzeichnis löschen |
| `su - NAME`, `sudo -u NAME COMMAND` | Benutzer wechseln, als anderer Benutzer ausführen |
