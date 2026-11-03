# Links und Dateiinformationen

Unter Linux sind der Name einer Datei und ihr Inhalt zwei verschiedene Dinge.
In diesem Kapitel nutzt du das, um mit **Links** Abkürzungen anzulegen, du
lernst, Dateien mit `stat` und `file` zu untersuchen, und du bestimmst mit
`umask`, welche Rechte neue Dateien bekommen.

## Namen und Inodes

Der Inhalt einer Datei – zusammen mit Besitzer, Rechten und Zeitstempeln –
wird in einem **Inode** gespeichert. Ein Verzeichnis ist nur eine Liste von
Namen, und jeder Name zeigt auf einen Inode. `ls -i` zeigt die Inode-Nummer
vor jedem Namen:

```sh
ls -i
```

## Symbolische Links – `ln -s`

Ein **symbolischer Link** (*Symlink*) ist eine kleine Datei, die den Pfad zu
etwas anderem enthält – eine Verknüpfung. Das Ziel steht zuerst und der Name
des Links zuletzt, genau wie bei `cp`:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

Das `l` am Anfang der Zeile und der Pfeil `->` zeigen, dass es ein Link ist.
Seine Rechte sind immer `rwxrwxrwx` – sie spielen keine Rolle, entscheidend
sind die Rechte des Ziels.

Fast jeder Befehl folgt dem Link: `ls ~/log/`, `cat`, `cd` und so weiter.
`cd` merkt sich, auf welchem Weg du gekommen bist, und `pwd -P` zeigt, wo du
wirklich bist:

```sh
cd ~/log
pwd
pwd -P
```

### Relative Links

Ein relativer Pfad in einem Link zählt ab dem Verzeichnis, **in dem der Link
liegt** – nicht ab dem Verzeichnis, in dem du beim Anlegen stehst:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

Das funktioniert, weil der Link in deinem Home-Verzeichnis liegt und
`{{documents}}/{{fruits}}` dort zu finden ist. Ein Link `/tmp/f` mit demselben
Inhalt würde nach `/tmp/{{documents}}/{{fruits}}` suchen – und wäre kaputt.

`readlink` zeigt, was in einem Link steht, und `realpath` zeigt den
vollständigen Pfad, bei dem jeder Link aufgelöst ist:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Kaputte Links

Ein Link kann auf etwas zeigen, das es nicht gibt:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
Der Link existiert, aber nicht die Datei, auf die er zeigt. `ls -l` zeigt
einen kaputten Link in Rot, und `find ~ -type l` findet jeden Link in deinem
Home-Verzeichnis.
```

`rm` entfernt den Link selbst, niemals das, worauf er zeigt.

```quiz
Du hast den Link `~/log -> /var/log` und führst `rm ~/log` aus. Was passiert?
- [ ] `/var/log` und alles darin wird gelöscht
- [x] Nur der Link wird entfernt – `/var/log` bleibt unberührt
- [ ] `rm` weigert sich, weil `~/log` ein Verzeichnis ist
---
`rm` arbeitet mit dem Link selbst. Um das Ziel zu löschen, müsstest du das
Ziel angeben.
```

### Wo dir Links begegnen

Links gibt es überall in einem Linux-System. `python3` ist oft ein Link auf
eine bestimmte Version wie `python3.12`, und wenn du später mit
`systemctl enable` einen Dienst beim Booten starten lässt, legt systemd einen
Link auf seine Unit-Datei an. Sieh dir die Dienste an, die beim Booten
starten:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Harte Links – `ln`

Ohne `-s` legt `ln` einen **harten Link** an: einen weiteren Namen für
denselben Inode.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 194 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 194 Nov  3 10:20 {{todo}}
```

Beide Namen haben dieselbe Inode-Nummer, und die Zahl nach den Rechten – der
**Linkzähler** – ist jetzt 2. Es ist dieselbe Datei: Eine Änderung über den
einen Namen ist auch über den anderen zu sehen. Entfernst du einen der Namen,
lebt der Inhalt weiter, solange die Datei noch mindestens einen Namen hat.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` und `b.txt` waren dieselbe Datei. Die Zeile, die über `b.txt`
geschrieben wurde, ist noch da, nachdem `b.txt` entfernt wurde.
```

| | Symbolischer Link (`ln -s`) | Harter Link (`ln`) |
|---|---|---|
| Ist | Eine kleine Datei mit einem Pfad | Ein weiterer Name für denselben Inode |
| Auf ein Verzeichnis | Ja | Nein |
| Auf ein anderes Dateisystem | Ja | Nein – Inodes gehören zu einem Dateisystem |
| Wenn das Original entfernt wird | Der Link ist kaputt | Die Datei lebt weiter |
| In `ls -l` | `l` und `->` | Der Linkzähler steigt |

```quiz
Welche Art von Link kann auf ein Verzeichnis zeigen?
- [x] Nur ein symbolischer Link
- [ ] Nur ein harter Link
- [ ] Beide
---
Harte Links auf Verzeichnisse sind nicht erlaubt. Für eine Verknüpfung zu
einem Verzeichnis verwendest du `ln -s`.
```

## Alles über eine Datei – `stat`

`stat` zeigt alles, was der Inode weiß:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

Du bekommst die Größe, die Inode-Nummer, die Anzahl der Links, die Rechte
sowohl als Ziffern (`0644`) als auch als Buchstaben, den Besitzer und die
Gruppe und wann die Datei gelesen wurde, wann ihr Inhalt und wann ihre
Eigenschaften geändert wurden. Mit
`-c` wählst du genau aus, was angezeigt wird: `%a` sind die Rechte als
Ziffern, `%U` der Besitzer und `%n` der Name.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## Was steckt drin? – `file`

Linux kümmert sich nicht um Dateiendungen: Eine Datei namens `.jpg` kann
alles Mögliche enthalten. `file` schaut sich stattdessen den Inhalt an:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
Der Name endet auf `.jpg`, aber der Inhalt ist Text – und danach richtet sich
`file`.
```

## Rechte für neue Dateien – `umask`

Neue Dateien bekommen die Rechte `rw-rw-rw-` (666) und neue Verzeichnisse
`rwxrwxrwx` (777) – abzüglich der Bits in der **umask**. `umask` zeigt sie
an:

```sh
umask
```

Die übliche umask `0022` nimmt der Gruppe und allen anderen das Schreibrecht
weg. Deshalb bekommen deine Dateien `644` und deine Verzeichnisse `755`.

| umask | Neue Dateien | Neue Verzeichnisse | Bedeutet |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | Das Übliche |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | Die Gruppe darf lesen, andere nichts |
| `077` | `600` `rw-------` | `700` `rwx------` | Nur du |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 minus 027: Die Gruppe verliert `w`, und andere verlieren alles.
```

`umask` wirkt nur auf Dateien, die danach angelegt werden, und nur in der
Shell, in der du sie ausgeführt hast. Um eine umask dauerhaft zu behalten,
trag die Zeile in `~/.bashrc` ein.

```quiz
Deine umask ist `077`. Welche Rechte bekommt ein neues Verzeichnis?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Verzeichnisse starten bei 777. 777 minus 077 ergibt 700: alles für dich,
nichts für alle anderen.
```
