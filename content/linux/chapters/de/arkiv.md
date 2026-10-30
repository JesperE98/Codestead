# Archive und Kompression

Früher oder später willst du jemandem ein ganzes Verzeichnis schicken, ein
Backup machen oder den Quellcode eines Programms herunterladen. Dann müssen
viele Dateien zu **einer** Datei werden – und am besten zu einer kleineren.
Unter Linux erledigen das meist zwei verschiedene Programme gemeinsam.

## Archivieren und Komprimieren – zwei verschiedene Dinge

- **Archivieren** bedeutet, viele Dateien und Verzeichnisse in einer einzigen
  Datei zu sammeln, einem *Archiv*. Rechte, Besitzer und Zeitstempel kommen
  mit. Das Programm heißt `tar` (von *tape archive* – es wurde in den
  1970er-Jahren für Bandlaufwerke geschrieben). Ein Archiv ist **nicht**
  kleiner als die Dateien darin – eher größer.
- **Komprimieren** bedeutet, eine Datei kleiner zu machen, indem
  Wiederholungen geschickter kodiert werden. Das gängigste Programm ist
  `gzip`. Es kümmert sich immer nur um eine Datei und weiß nichts von
  Verzeichnissen.

Deshalb benutzt man sie zusammen: zuerst `tar`, um eine einzige Datei zu
bekommen, dann `gzip`, um sie kleiner zu machen. Das Ergebnis heißt
`.tar.gz`, kurz `.tgz`. Das ist die Unix-Philosophie auf den Punkt gebracht – kleine
Programme, die jeweils eine Sache machen und sich kombinieren lassen.

```quiz
Warum werden `tar` und `gzip` meist zusammen verwendet?
- [ ] `gzip` kann keine Dateien lesen, die `tar` nicht angelegt hat
- [x] `tar` sammelt viele Dateien in einer, und `gzip` macht diese eine Datei kleiner
- [ ] `tar` macht die Dateien kleiner, und `gzip` gibt ihnen die richtigen Rechte
---
gzip kümmert sich immer nur um eine Datei und weiß nichts von Verzeichnissen,
und ein tar-Archiv allein ist nicht kleiner als die Dateien darin.
```

| Dateiendung | Was ist das? | Auspacken mit |
|---|---|---|
| `.tar` | Archiv, unkomprimiert | `tar -xf` |
| `.gz` | Eine einzelne komprimierte Datei | `gunzip` |
| `.tar.gz`, `.tgz` | Komprimiertes Archiv | `tar -xzf` |
| `.zip` | Archiv und Kompression in einem (verbreitet unter Windows) | `unzip` |

Dir werden auch `.tar.xz`, `.tar.bz2` und `.tar.zst` begegnen. Gleiche Idee,
nur mit anderen Kompressionsprogrammen (`xz`, `bzip2` und `zstd`).

## Packen mit `tar`

Wechsle in dein Home-Verzeichnis und pack das Verzeichnis `dokument` ein:

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/betyg.csv
dokument/frukter.txt
dokument/server.log
```

`-c` bedeutet *create* (ein Archiv anlegen), `-v` lässt tar anzeigen, was es
tut, und `-f` sagt, dass als Nächstes der Name der Archivdatei kommt. Alles
nach dem Archivnamen wird eingepackt – so viele Dateien und Verzeichnisse, wie
du willst.

> **Achtung!** Die Reihenfolge ist *zuerst das Archiv, dann die Dateien*.
> Vertauschst du sie, wie in `tar -cvf dokument dokument.tar`, versucht tar,
> das Verzeichnis zu überschreiben – oder schlimmer, eine Datei, die du
> behalten wolltest.

## Die Optionen, die du dir merken solltest

| Option | Steht für | Bedeutet |
|---|---|---|
| `c` | **c**reate | Ein neues Archiv anlegen |
| `x` | e**x**tract | Auspacken |
| `t` | lis**t** (*table of contents*) | Den Inhalt auflisten |
| `v` | **v**erbose | Die verarbeiteten Dateien anzeigen |
| `f` | **f**ile | Als Nächstes kommt der Name der Archivdatei |
| `z` | g**z**ip | Mit gzip komprimieren oder dekomprimieren |

Genau **eine** der Optionen `c`, `x` und `t` muss dabei sein – sie sagt tar,
*was* es tun soll. Die übrigen sind Modifikatoren. Eine beliebte Eselsbrücke
(auf Englisch):

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Setze `f` immer **zuletzt**, wenn du die Optionen zusammenschreibst, denn der
Dateiname muss direkt danach kommen. Aus historischen Gründen kannst du den
Bindestrich auch weglassen: `tar czvf` bedeutet dasselbe wie `tar -czvf`.

```quiz
Was macht `tar -xzvf backup.tar.gz`?
- [ ] Legt das komprimierte Archiv `backup.tar.gz` an
- [ ] Listet den Inhalt von `backup.tar.gz` auf, ohne auszupacken
- [x] Packt `backup.tar.gz` mit gzip aus und zeigt jede Datei an
---
`x` ist die Operation (extract), `z` bedeutet gzip, `v` zeigt die Dateien an,
und nach `f` kommt der Name des Archivs.
```

## Komprimieren mit `-z`

Füge `z` hinzu, und das Archiv wird unterwegs durch gzip geschickt:

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   837 Oct 30 12:00 dokument.tar.gz
```

Das unkomprimierte Archiv ist ganze 10 240 Bytes groß, obwohl die Dateien
zusammen gut 1 000 Bytes ausmachen. Das liegt daran, dass tar vor jede Datei
einen 512 Byte großen Header setzt und das Archiv auf ganze Blöcke auffüllt.
Den ganzen leeren Platz komprimiert gzip weg.

Der Befehl `du` (*disk usage*) zeigt, wie viel Platz etwas auf der Festplatte
belegt. Mit `-h` bekommst du menschenlesbare Größen, und mit `-s` eine Summe
für ein ganzes Verzeichnis:

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
16K	dokument
```

Die Festplatte ist in Blöcke von 4 KiB eingeteilt, deshalb zeigt `du` für eine
nicht leere Datei nie weniger als `4.0K` an. Die genaue Größe siehst du mit
`ls -l` (oder `ls -lh`).

## In ein Archiv hineinschauen, bevor du es auspackst

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev       146 2026-10-30 12:00 dokument/betyg.csv
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

Mit `v` wird der Inhalt wie bei `ls -l` angezeigt, mit Rechten, Besitzer und
Größe. Erst nachzusehen ist eine gute Angewohnheit: Manche Archive haben kein
gemeinsames oberstes Verzeichnis und verstreuen Hunderte von Dateien dort, wo
du dich beim Auspacken gerade befindest.

## Auspacken

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C` (großes C) wählt das Verzeichnis, in das tar auspackt (*uppackat*
bedeutet „ausgepackt“). Ohne diese Option landet alles im aktuellen
Verzeichnis. Moderne tar-Versionen erkennen beim Auspacken selbst, ob ein
Archiv komprimiert ist, also funktioniert auch `tar -xf dokument.tar.gz`.

> **Achtung!** tar fragt nicht, bevor es bereits vorhandene Dateien
> überschreibt. Liste zuerst den Inhalt auf, wenn du unsicher bist.

### Absolute Pfade

Packst du einen absoluten Pfad ein, wird der führende `/` entfernt, damit sich
das Archiv überall auspacken lässt:

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

Das Archiv enthält jetzt `home/elev/dokument/...`. Willst du nur `dokument/`
im Archiv haben, kannst du tar mit `-C` vorher das Verzeichnis wechseln
lassen:

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

```quiz
Du führst `tar -czf backup.tar.gz -C ~ dokument` aus. Was enthält das Archiv?
- [x] `dokument/` und die Dateien darin
- [ ] `home/elev/dokument/` und die Dateien darin
- [ ] `/home/elev/dokument/` und die Dateien darin
---
Mit `-C ~` wechselt tar zuerst in dein Home-Verzeichnis, also beginnen die
Namen im Archiv bei `dokument/`.
```

## Einzelne Dateien komprimieren mit `gzip`

`gzip` komprimiert eine Datei und **ersetzt** sie durch eine `.gz`-Datei.
Rechte und Zeitstempel bleiben erhalten:

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` zeigt die Größe vorher und nachher, und `gunzip` packt die Datei
wieder aus:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

Willst du das Original behalten, nimm `gzip -k` (*keep*). Probier es mit einer
richtig kleinen Datei aus – sie wird tatsächlich **größer**, weil gzip einen
Header hinzufügt, der unter anderem den Dateinamen enthält:

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

```predict
$ cp dokument/frukter.txt .
$ cp dokument/server.log .
$ gzip frukter.txt
$ gzip -k server.log
$ ls frukter* server*
frukter.txt.gz  server.log  server.log.gz
---
Ein einfaches `gzip` ersetzt die Datei durch eine `.gz`-Datei; `-k` behält das
Original.
```

### Komprimierte Dateien direkt lesen

Alte Logdateien in `/var/log` werden oft als `.gz` gespeichert, um Platz zu
sparen. Mit `zcat` kannst du sie lesen, ohne sie auszupacken – und das
Ergebnis wie gewohnt per Pipe weiterreichen:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` ist dasselbe wie `gzip -dc`: dekomprimieren (`d`) auf die
Standardausgabe (`c`). Auf einem echten System gibt es außerdem `zless` und
`zgrep`.

## zip – zum Austausch mit Windows

Das Format `.zip` erledigt beide Aufgaben auf einmal: Es sammelt Dateien *und*
komprimiert sie. Windows und macOS können zip-Dateien ohne zusätzliche
Software öffnen, daher ist es die naheliegende Wahl, wenn du Dateien an
jemanden schickst, der kein Linux benutzt. In der Linux-Welt ist `.tar.gz`
verbreiteter, weil es Besitzer und Rechte besser bewahrt.

Die Programme `zip` und `unzip` sind nicht immer vorinstalliert, und in diesem
Terminal musst du sie erst installieren. Das geht mit dem Paketmanager – alles
darüber lernst du im Teil über Distributionen und Pakete. Unter Ubuntu geht das
so:

```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` lädt die Liste der verfügbaren Pakete herunter. Ohne sie findet
apt überhaupt keine Pakete.

Dann pack das Verzeichnis ein. Vergiss `-r` (*recursive*) nicht – ohne diese
Option fügt zip nur das leere Verzeichnis hinzu, nicht die Dateien darin:

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/betyg.csv (deflated 17%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Die Reihenfolge ist dieselbe wie bei tar: zuerst das Archiv, dann die Dateien.
`unzip -l` listet den Inhalt auf, und `-d` wählt, wohin ausgepackt wird (das
Verzeichnis wird angelegt, falls es nicht existiert):

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

Gibt es die Dateien schon, überspringt unzip sie. Mit `unzip -o` werden sie
überschrieben.

```quiz
Du führst `zip dokument.zip dokument` ohne `-r` aus. Was landet in der zip-Datei?
- [ ] Alle Dateien in `dokument`
- [x] Nur das leere Verzeichnis `dokument/`
- [ ] Nichts – zip weigert sich zu laufen
---
Ohne `-r` (*recursive*) geht zip nicht in das Verzeichnis hinein.
```

## Zusammenfassung

| Wenn du ... willst | Befehl |
|---|---|
| ein Verzeichnis einpacken und komprimieren | `tar -czvf archive.tar.gz directory` |
| sehen, was ein Archiv enthält | `tar -tzvf archive.tar.gz` |
| ein Archiv auspacken | `tar -xzvf archive.tar.gz` (füge `-C directory` hinzu) |
| eine Datei komprimieren | `gzip file` (oder `gzip -k file`) |
| eine `.gz`-Datei auspacken | `gunzip file.gz` |
| eine `.gz`-Datei direkt lesen | `zcat file.gz` |
| eine zip-Datei anlegen oder auspacken | `zip -r archive.zip directory` · `unzip archive.zip` |
| sehen, wie groß etwas ist | `du -sh directory` · `ls -lh` |
