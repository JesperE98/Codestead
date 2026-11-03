# Im Dateisystem navigieren

Linux kennt keine Laufwerksbuchstaben wie `C:`. Alles – Festplatten,
USB-Sticks, sogar Hardware – befindet sich in **einem einzigen Baum** aus
Verzeichnissen, der bei der **Wurzel** (*root*) beginnt, geschrieben `/`.

## Die wichtigsten Verzeichnisse

| Verzeichnis | Inhalt |
|---|---|
| `/` | Die Wurzel – die Spitze des Baums |
| `/home` | Die Home-Verzeichnisse der Benutzer, z. B. `/home/{{user}}` |
| `/root` | Das Home-Verzeichnis des Administrators root |
| `/etc` | Systemeinstellungen (Konfigurationsdateien) |
| `/usr/bin` | Programme (Befehle) wie `ls` und `cat` |
| `/var/log` | Logdateien |
| `/tmp` | Temporäre Dateien, in die jeder schreiben darf |
| `/dev` | Geräte, z. B. Festplatten |
| `/proc` | Informationen über Prozesse und den Kernel |
| `/boot` | Dateien, die zum Starten des Rechners nötig sind |

Diese Aufteilung heißt *Filesystem Hierarchy Standard* und ist auf allen
Distributionen fast identisch.

```quiz
Ein Programm schreibt eine Logdatei. In welchem Verzeichnis würdest du sie erwarten?
- [ ] `/etc`
- [ ] `/usr/bin`
- [x] `/var/log`
- [ ] `/home`
---
Logdateien landen in `/var/log`. Einstellungen liegen in `/etc` und Programme in `/usr/bin`.
```

## Wo bin ich? – `pwd`

`pwd` (*print working directory*) zeigt das Verzeichnis an, in dem du dich
gerade befindest:

```sh
pwd
```

## Was ist hier? – `ls`

`ls` listet den Inhalt eines Verzeichnisses auf. Ohne Argumente zeigt es das
Verzeichnis, in dem du bist, du kannst aber auch ein anderes angeben:

```sh
ls /etc
```

Die Option `-l` liefert ein langes Format mit mehr Informationen:

```sh
ls -l
```

Dateien, deren Name mit einem Punkt beginnt, sind **versteckt** und werden
standardmäßig nicht angezeigt. Oft sind das Einstellungsdateien wie `.bashrc`.
Die Option `-a` (*all*) zeigt sie an:

```sh
ls -a
```

Optionen lassen sich kombinieren: `ls -la` ist dasselbe wie `ls -l -a`.

```quiz
Warum zeigt ein einfaches `ls` in deinem Home-Verzeichnis die Datei `.bashrc` nicht an?
- [ ] Es ist eine Systemdatei, die nur root sehen kann
- [x] Ihr Name beginnt mit einem Punkt, also ist sie versteckt
- [ ] `ls` zeigt nur Verzeichnisse an
---
Dateien, deren Name mit einem Punkt beginnt, sind versteckt. `ls -a` zeigt sie auch an.
```

Probier das lange Format zusammen mit den versteckten Dateien aus:

```try
ls -la
```

## Verzeichnis wechseln – `cd`

`cd` (*change directory*) bringt dich in ein anderes Verzeichnis:

```sh
cd /var/log
```

Es gibt zwei Arten von Pfaden:

- Ein **absoluter** Pfad beginnt mit `/` und startet bei der Wurzel, z. B.
  `/var/log`. Er funktioniert, egal wo du gerade bist.
- Ein **relativer** Pfad geht von dem Verzeichnis aus, in dem du bist. Wenn du
  in `/` bist, erreichst du `/var/log` einfach mit `cd var/log`.

```quiz
Du bist in `/home`. Welche Befehle bringen dich nach `/home/{{user}}/{{documents}}`? (Wähle alle, die funktionieren.)
- [x] `cd {{user}}/{{documents}}`
- [x] `cd /home/{{user}}/{{documents}}`
- [ ] `cd /{{user}}/{{documents}}`
- [ ] `cd {{documents}}`
---
`{{user}}/{{documents}}` ist relativ zu `/home`, und `/home/{{user}}/{{documents}}` ist absolut,
funktioniert also von überall. `/{{user}}/{{documents}}` beginnt bei der Wurzel, und dort
gibt es kein `{{user}}`.
```

Ein paar besondere Namen solltest du kennen:

| Name | Bedeutet |
|---|---|
| `.` | Das Verzeichnis, in dem du bist |
| `..` | Das Verzeichnis darüber (das übergeordnete) |
| `~` | Dein Home-Verzeichnis |
| `-` | (nur bei `cd`) das Verzeichnis, in dem du zuletzt warst |

`cd` ohne Argumente bringt dich immer nach Hause.

```sh
cd ..
```

```predict
$ cd /usr/bin
$ cd ..
$ pwd
/usr
---
`..` ist das Verzeichnis darüber, also landest du von `/usr/bin` aus in `/usr`.
```

## Tab-Vervollständigung

Ganze Namen musst du selten ausschreiben. Tippe den Anfang, zum Beispiel
`cd /va`, und drücke **Tab** – die Shell ergänzt den Rest. Gibt es mehrere
Möglichkeiten, werden sie angezeigt, wenn du Tab drückst. Erfahrene
Linux-Nutzer drücken ständig Tab!
