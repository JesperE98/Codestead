# Dateien über SSH kopieren

Im Netzwerkkapitel hast du mit `ssh` Befehle auf dem Server `192.168.1.10`
ausgeführt. Hier gibst du dem Server einen kurzen Namen, kopierst mit `scp`
Dateien zu ihm und von ihm und hältst mit `rsync` ganze Verzeichnisse
synchron.

## Kurze Namen – `~/.ssh/config`

Jedes Mal `ssh {{user}}@192.168.1.10` zu tippen, wird schnell lästig. In der
Datei `~/.ssh/config` kannst du einem Server einen kurzen Namen geben:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` ist der kurze Name, `HostName` die echte Adresse (oder der echte Name)
und `User` der Benutzername auf dem Server. Lauscht der Server auf einem
anderen Port als 22, füge eine Zeile wie `Port 2222` hinzu. Danach reicht das
hier:

```sh
ssh srv hostname
```

Der Simulator hat noch keinen Texteditor, also schreib die Datei mit `echo`.
Die Einrückung ist nur da, damit es sich leichter lesen lässt:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh ist bei dieser Datei streng. Dürfen andere hineinschreiben, verweigert ssh
den Dienst mit *Bad owner or permissions*, und ein falsch geschriebenes Wort
stoppt es sofort:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh liest die ganze Datei, bevor es eine Verbindung aufbaut. Ein einziges
falsches Wort stoppt also jede Verbindung – und die Fehlermeldung sagt dir, in
welcher Zeile es steht.
```

Die Namen funktionieren auch mit `scp` und `rsync`.

```quiz
Welche Zeile in `~/.ssh/config` sagt, wohin ssh sich wirklich verbinden soll?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` ist der kurze Name, den du selbst tippst, `HostName` die echte Adresse
und `User`, als wer du dich anmeldest.
```

## Kopieren – `scp`

`scp` (*secure copy*) funktioniert wie `cp`, aber eine Seite kann auf einem
anderen Rechner liegen. Du schreibst sie als `HOST:PATH`:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- Die Quelle steht zuerst und das Ziel zuletzt, genau wie bei `cp`.
- Ein Pfad nach dem Doppelpunkt zählt ab deinem Home-Verzeichnis auf dem
  Server, und `srv:` allein bedeutet das Home-Verzeichnis.
- Verzeichnisse brauchen `-r`.
- Den Port gibst du mit einem großen `-P` an (bei `ssh` ist es ein kleines
  `-p`).

Für jede Datei zeigt `scp` eine Zeile mit dem Namen, `100%`, der Größe und der
Geschwindigkeit.

```quiz
Du tippst `scp report.txt srv` – ohne Doppelpunkt. Was passiert?
- [ ] Die Datei wird in dein Home-Verzeichnis auf dem Server kopiert
- [x] Du bekommst eine lokale Kopie namens `srv`
- [ ] scp fragt, welchen Rechner du meinst
---
Ohne den Doppelpunkt ist `srv` einfach ein Dateiname, und `scp` kopiert lokal
wie `cp`. Den Doppelpunkt vergisst man leicht!
```

## Synchron halten – `rsync`

Für viele Dateien oder für etwas, das du immer wieder kopierst (Backups!), ist
`rsync` besser. Es kopiert nur, was fehlt oder sich geändert hat:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) kopiert Verzeichnisse rekursiv und behält Rechte und
Zeitstempel bei, und `-v` listet auf, was kopiert wird. Führst du denselben
Befehl noch einmal aus, ist die Liste leer – nichts hat sich geändert. rsync
vergleicht Größe und Änderungszeit jeder Datei; ohne `-a` bekommen die Kopien
neue Zeitstempel, und alles wird jedes Mal übertragen.

### Der Schrägstrich am Ende

Ein Schrägstrich am Ende der Quelle ist wichtig:

| Befehl | Ergibt |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – das Verzeichnis selbst |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – nur, was darin ist |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Ohne den Schrägstrich wurde das Verzeichnis selbst nach `/tmp/x` kopiert.
```

### Über SSH und `--delete`

Mit einem Server als Ziel läuft rsync über ssh:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` entfernt am Ziel außerdem Dateien, die es in der Quelle nicht mehr
gibt, sodass das Ziel eine exakte Kopie wird. Ein falscher Pfad kann dann viel
löschen, also probiere es zuerst mit `-n` (*dry run*). Dabei passiert nichts,
rsync zeigt nur, was es tun würde, und die letzte Zeile endet mit
`(DRY RUN)`:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
Was macht `-n` in `rsync -avn --delete a/ b/`?
- [ ] Kopiert nur neue Dateien
- [x] Zeigt, was passieren würde, ohne etwas zu tun
- [ ] Überspringt die Dateien, die gelöscht würden
---
`-n` ist ein Probelauf. Prüfe zuerst die Liste – und führe dann denselben
Befehl ohne `-n` aus.
```

## scp oder rsync?

| | `scp` | `rsync` |
|---|---|---|
| Gut für | Ein paar Dateien, einmalig | Backups und wiederholtes Kopieren |
| Überträgt | Alles, jedes Mal | Nur, was sich geändert hat |
| Auch lokal | Geht, aber `cp` ist einfacher | Ja |
| Spiegeln mit `--delete` | Nein | Ja |

`scp` gehört zum ssh-Client. `rsync` muss auf beiden Rechnern installiert
sein: Unter Ubuntu, Debian und Fedora ist es von Anfang an dabei, unter Arch
installierst du das Paket `rsync`.

Im Simulator vergisst der Server seine Dateien, wenn du die App schließt.
