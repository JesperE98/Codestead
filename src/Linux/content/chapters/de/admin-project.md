# Projekt: Neu im Team ab Montag

Freitag, halb vier. Deine Chefin lehnt sich in die Tür:
„Ach ja – {{newUser}} fängt am Montag im Support-Team an. Kannst du alles
vorbereiten? Konto, Team-Ordner, die Lektüre für die erste Woche. Und sorg dafür,
dass das Intranet diesmal funktioniert – der letzte Neuzugang hat den ganzen
ersten Vormittag auf *Couldn't connect to server* gestarrt.“

Alles, was du brauchst, steckt in *Systemverwaltung* – Benutzer und Gruppen,
Festplatten und Dienste – mit etwas Hilfe aus den früheren Teilen. Nichts davon
ist neu; die Herausforderung ist, die Teile selbst zusammenzusetzen, damit der
Montagmorgen ohne Pannen abläuft.

## Der Auftrag

1. **Ein Konto.** Lege den Benutzer `{{newUser}}` mit Home-Verzeichnis und
   `/bin/bash` als Shell an und gib dem Konto ein Passwort.
2. **Das Team.** Lege die Gruppe `{{teamGroup}}` an und füge sowohl `{{newUser}}`
   als auch dich selbst hinzu. `{{newUser}}` bekommt keine sudo-Rechte – noch
   nicht, die gibt es nach der Probezeit.
3. **Der gemeinsame Ordner.** Lege `/srv/{{teamGroup}}` an, der der Gruppe
   `{{teamGroup}}` gehört. Die Gruppe darf den Ordner lesen, beschreiben und
   betreten; alle anderen dürfen gar nichts.
4. **Teste das Konto.** Werde zu `{{newUser}}`, lege eine Datei im gemeinsamen
   Ordner an, um zu zeigen, dass die Rechte stimmen, und kehre zu deinem eigenen
   Konto zurück.
5. **Das Willkommenspaket.** Die Lektüre für die erste Woche, `{{report}}`,
   liegt auf dem USB-Stick (`/dev/sdb1`). Lege eine Kopie ins Home-Verzeichnis
   von `{{newUser}}` – im Besitz von `{{newUser}}`, nicht von root – und hänge den
   Stick aus, wenn du fertig bist.
6. **Das Intranet.** Das Intranet des Teams ist der Dienst `myserver`. Sorge
   dafür, dass er jetzt läuft **und** bei jedem Booten von selbst startet.
7. **Generalprobe.** Starte den Rechner neu und zeige im Journal, dass das
   Intranet bei diesem Bootvorgang von selbst gestartet ist.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du deine
Befehle ausführst.

## Tipps für unterwegs

- Fast alles hier verändert das System, deshalb brauchen die meisten Befehle
  `sudo`.
- `usermod -aG` – vergiss das `-a` nicht, sonst fliegt der Benutzer aus allen
  anderen Gruppen. `id {{newUser}}` zeigt, in welchen Gruppen ein Konto ist.
- `ls -ld` zeigt Besitzer, Gruppe und Rechte eines Verzeichnisses. Zähle die
  Rechte oktal: *rwx* ist 7, nichts ist 0.
- Eine Datei, die du mit `sudo` kopierst, gehört root. Kopiere sie stattdessen
  *als* der Neuzugang – mit `su -` oder `sudo -u` –, dann gehört sie von Anfang
  an der richtigen Person.
- Liegt dort schon eine Kopie, die root gehört? `{{newUser}}` darf sie löschen –
  sie liegt im eigenen Home-Verzeichnis – und noch einmal kopieren.
- Sagt `umount` *target is busy*? Deine eigene Shell steht im Verzeichnis:
  zuerst `cd ~`.
- `start` und `enable` sind zwei verschiedene Dinge. `systemctl is-active` und
  `systemctl is-enabled` zeigen, wo du stehst.
- Nach einem Neustart zeigt `journalctl -b` nur den aktuellen Bootvorgang.

## Lust auf mehr?

Wenn die Etappen geschafft sind, kannst du weitermachen. Passen die Dateien des
Neuzugangs überhaupt drauf? `df -h` und `du -sh` wissen es. Sperre das Konto mit
`usermod -L` bis Montagmorgen, prüfe es mit `passwd -S` und entsperre es mit
`usermod -U`. Und schau dir deine Arbeit von der Seite des Systems an: die Zeilen
für `{{newUser}}` in `/etc/passwd` und `/etc/group` und `systemctl status myserver`.
