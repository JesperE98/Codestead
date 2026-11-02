# Datenträger und Dateisysteme

Wo landen die Dateien, die du speicherst, eigentlich? Unter Windows ist die
Antwort ein Buchstabe – `C:`, `D:`, `E:`. Linux hat überhaupt keine
Laufwerksbuchstaben, sondern nur **einen** Verzeichnisbaum, der bei `/`
beginnt. In diesem Kapitel schaust du unter die Haube: welche Datenträger der
Rechner hat, wie sie aufgeteilt sind, wie viel Platz noch frei ist – und wie
du einen USB-Stick einsteckst und wieder entfernst, ohne etwas zu verlieren.

## Datenträger, Partition und Dateisystem

Drei Wörter, die oft verwechselt werden, aber Verschiedenes bedeuten:

- Ein **Datenträger** (eine Disk) ist das Speichergerät selbst: eine SSD, eine
  Festplatte, eine SD-Karte oder ein USB-Stick.
- Eine **Partition** ist ein Stück des Datenträgers. Ein Datenträger kann in
  mehrere Partitionen aufgeteilt werden, die für verschiedene Dinge benutzt
  werden. Wo jede Partition beginnt und endet, steht in der
  **Partitionstabelle** des Datenträgers – bei neuen Rechnern vom Typ
  **GPT**, bei älteren Rechnern und den meisten USB-Sticks das alte **MBR**
  (das die Werkzeuge `dos` nennen).
- Ein **Dateisystem** ist die Ordnung *innerhalb* einer Partition: wie
  Dateinamen, Verzeichnisse, Rechte und die Inhalte selbst gespeichert werden.
  Eine neue Partition ist leer und unbrauchbar, bis du ein Dateisystem darauf
  anlegst – genau das bedeutet **Formatieren**.

Stell dir den Datenträger als leere Lagerhalle vor, die Partitionen als die
Wände, die sie in Räume aufteilen, und das Dateisystem als die Regale und
Etiketten in jedem Raum. Ohne Regale findest du nichts.

```quiz
Du hast gerade eine neue Partition auf einem Datenträger angelegt. Warum
kannst du noch keine Dateien darauf speichern?
- [ ] Sie muss zuerst in die Partitionstabelle eingetragen werden
- [x] Sie hat noch kein Dateisystem – sie muss zuerst formatiert werden
- [ ] Partitionen können keine Dateien enthalten, nur Datenträger
- [ ] Sie braucht zuerst einen Laufwerksbuchstaben
---
Eine neue Partition ist leer und unbrauchbar, bis du ein Dateisystem darauf
anlegst. Genau das bedeutet Formatieren.
```

## Datenträger sind Dateien in `/dev`

Unter Linux ist fast alles eine Datei – Datenträger eingeschlossen. Jeder
Datenträger und jede Partition hat eine **Gerätedatei** in `/dev`:

```sh
ls -l /dev/sd*
```

| Gerätedatei | Ist |
|---|---|
| `/dev/sda` | Der erste Datenträger (SATA, USB oder eine virtuelle Disk) |
| `/dev/sda1`, `/dev/sda2` | Partition 1 und 2 auf `sda` |
| `/dev/sdb` | Der zweite Datenträger – der USB-Stick in diesem Rechner |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | Eine NVMe-SSD und ihre erste Partition |
| `/dev/vda` | Ein Datenträger in einer virtuellen Maschine |
| `/dev/mmcblk0p1` | Die erste Partition auf einer SD-Karte (z. B. in einem Raspberry Pi) |

Die Buchstaben werden in der Reihenfolge vergeben, in der die Datenträger
gefunden werden. Hat der Rechner eine NVMe-SSD, kann ein USB-Stick durchaus
`sda` werden – also **niemals raten**, immer nachsehen. Die Gerätedateien
gehören root und der Gruppe `disk`, als normaler Benutzer kannst du die
Datenträger also nicht direkt lesen.

## Welche Datenträger gibt es? – `lsblk`

`lsblk` (*list block devices*) zeichnet die Datenträger als Baum, mit den
Partitionen unter dem jeweiligen Datenträger:

```sh
lsblk
```

| Spalte | Bedeutet |
|---|---|
| `NAME` | Der Name in `/dev` |
| `RM` | 1 = entfernbar (*removable*), z. B. ein USB-Stick |
| `SIZE` | Die Größe |
| `TYPE` | `disk` oder `part` (Partition) |
| `MOUNTPOINTS` | Wo das Dateisystem im Verzeichnisbaum auftaucht, `[SWAP]` für Swap |

Auf diesem Rechner ist `sda1` die **EFI-Partition** (von der die Firmware des
Rechners bootet) auf `/boot/efi`, `sda2` ist das **Root-Dateisystem** `/` und
`sda3` ist **Swap**. Andere Distributionen – und andere Installationen – können
den Datenträger anders aufteilen, also immer nachsehen statt annehmen.

Mit `-f` zeigt `lsblk` auch die Dateisysteme – Typ, Label, UUID und wie viel
frei ist:

```sh
lsblk -f
```

Achte auf `sdb1`: ein `vfat`-Dateisystem mit dem Label `USBSTICK`, das
nirgends eingehängt ist. Das ist der USB-Stick, den wir gleich einstecken.

## Verschiedene Dateisysteme

Es gibt viele Dateisysteme mit unterschiedlichen Stärken:

| Dateisystem | Wird benutzt für |
|---|---|
| `ext4` | Der klassische Linux-Standard. Stabil und schnell – Debian und Ubuntu benutzen es |
| `btrfs` | Snapshots, Komprimierung und Subvolumes. Standard in Fedora und openSUSE |
| `xfs` | Gut für große Dateien und Server. Standard in Red Hat Enterprise Linux |
| `vfat` (FAT32) | Funktioniert überall: Windows, macOS, Kameras, Autoradios. Keine Linux-Rechte und höchstens 4 GiB pro Datei. Die EFI-Partition muss FAT sein |
| `exfat` | Wie FAT, aber ohne die 4-GiB-Grenze. Verbreitet auf neuen USB-Sticks und SD-Karten |
| `ntfs` | Das Windows-Dateisystem. Linux kann es lesen und schreiben |
| `swap` | Kein Dateisystem für Dateien – zusätzlicher „Arbeitsspeicher“ auf dem Datenträger |
| `tmpfs` | Ein Dateisystem, das nur im RAM existiert und beim Neustart verschwindet |

## Alles ist ein Baum – Einhängen

Ein Dateisystem **einhängen** (*mounten*) bedeutet, es an einem bestimmten
Verzeichnis, einem **Mountpunkt** (*mount point*), in den Verzeichnisbaum
einzufügen. Das Root-Dateisystem ist auf `/` eingehängt, und alles andere wird
irgendwo darunter eingehängt. Deshalb kommt Linux ohne Laufwerksbuchstaben
aus: Ein weiterer Datenträger ist einfach ein weiteres Verzeichnis.

`findmnt` zeigt alle Einhängungen als Baum:

```sh
findmnt
```

Und `mount` ohne Argumente listet dasselbe auf, eine Zeile pro Dateisystem:

```sh
mount
```

Du siehst auch Dinge, die keine Datenträger sind: `proc` auf `/proc` und
`sysfs` auf `/sys` sind Informationen des Kernels, als Dateien verkleidet, und
`tmpfs` sind Dateisysteme im RAM. Übliche Mountpunkte:

| Verzeichnis | Wird benutzt für |
|---|---|
| `/` | Das Root-Dateisystem |
| `/boot`, `/boot/efi` | Den Kernel und die EFI-Partition |
| `/mnt` | Vorübergehende Einhängungen, die du von Hand machst |
| `/media/{{user}}/…` oder `/run/media/{{user}}/…` | Wo der Desktop USB-Sticks automatisch einhängt |

## Wie viel Platz ist noch frei? – `df`

`df` (*disk free*) zeigt, wie voll jedes eingehängte Dateisystem ist. Mit `-h`
bekommst du menschenlesbare Größen:

```sh
df -h
```

| Spalte | Bedeutet |
|---|---|
| `Filesystem` | Wo das Dateisystem liegt, z. B. eine Partition oder `tmpfs` |
| `Size`, `Used`, `Avail` | Größe, belegt und verfügbar |
| `Use%` | Wie voll es ist |
| `Mounted on` | Der Mountpunkt |

`-T` fügt den Typ des Dateisystems hinzu, und wenn du einen Pfad angibst, wird
nur das Dateisystem gezeigt, auf dem er liegt:

```sh
df -hT
df -h ~
```

Ist dir aufgefallen, dass `Used` und `Avail` zusammen nicht ganz `Size`
ergeben? ext4 reserviert 5 % für root, damit das System weiterläuft, auch wenn
ein normaler Benutzer den Datenträger vollgeschrieben hat.

```try
df -hT
---
Die Spalte `Type` zeigt, dass `/` `ext4` ist und `/boot/efi` `vfat`.
```

## `df` oder `du`?

Zwei Befehle mit fast demselben Namen, aber sie beantworten verschiedene
Fragen:

| Frage | Befehl |
|---|---|
| Wie voll ist der **Datenträger**? | `df -h` – fragt das Dateisystem |
| Wie viel Platz brauchen diese **Dateien**? | `du -sh directory` – geht die Dateien durch und zählt sie zusammen |

Wenn ein Datenträger vollläuft, benutzt du beide: zuerst `df -h`, um zu sehen,
*welches* Dateisystem voll ist, dann `du`, um herauszufinden, *was* den Platz
belegt:

```sh
du -h -d 1 ~
```

## Einen USB-Stick einhängen

Jetzt stecken wir den USB-Stick ein. Zuerst: Welches Gerät ist es? `lsblk -f`
hat einen entfernbaren Datenträger gezeigt, `sdb`, mit der Partition `sdb1`
und dem Label `USBSTICK`. Eingehängt wird die **Partition**, nicht der ganze
Datenträger.

Dann brauchst du einen Mountpunkt – ein ganz normales, leeres Verzeichnis.
Sowohl das Anlegen als auch das Einhängen erfordern root:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` erkennt das FAT-Dateisystem von selbst; wenn du es ausdrücklich
angeben willst, kannst du `-t vfat` hinzufügen. Jetzt tauchen die Dateien des
Sticks im Verzeichnis auf:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

Ab jetzt funktioniert der Stick wie jedes andere Verzeichnis. Kopiere eine
Datei in dein Home-Verzeichnis:

```sh
cp /mnt/usb/{{todo}} ~
```

> **Warum gehört alles root?** FAT hat keine Linux-Rechte. Wenn ein FAT-Stick
> eingehängt wird, bekommen deshalb *alle* Dateien denselben Besitzer und
> dieselben Rechte – Besitzer ist, wer ihn eingehängt hat, also root. Um auf
> den Stick zu schreiben, brauchst du entweder `sudo`, oder du hängst ihn so
> ein, dass du der Besitzer wirst:
> `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 ist deine
> Benutzer-ID – siehe `id`).

Du kannst auch über das Label statt über den Gerätenamen einhängen:
`sudo mount LABEL=USBSTICK /mnt/usb`. Auf einem Rechner mit Desktop erledigt
der Dateimanager das alles automatisch, wenn du den Stick einsteckst.

```quiz
Nach `sudo mount /dev/sdb1 /mnt/usb` gehört jede Datei auf dem FAT-Stick root.
Warum?
- [ ] Die Dateien wurden auf einem anderen Rechner von root angelegt
- [x] FAT hat keine Linux-Rechte, also bekommen alle Dateien den Besitzer dessen, der eingehängt hat – root
- [ ] Alles in `/mnt` gehört immer root
- [ ] USB-Sticks können nur von root benutzt werden
---
Mit `-o uid=1000,gid=1000` kannst du den Besitzer beim Einhängen selbst wählen.
```

## Aushängen – bevor du den Stick herausziehst!

Linux schreibt nicht immer sofort auf den Datenträger. Änderungen werden im
RAM gesammelt (*Cache*) und etwas später geschrieben, weil das viel schneller
ist. Ziehst du einen Stick heraus, der noch eingehängt ist, können Dateien,
die du „gespeichert“ hast, fehlen oder kaputt sein. Deshalb **hängst** du ihn
zuerst **aus** – geschrieben `umount`, ohne n:

```text
sudo umount /mnt/usb
```

`umount` schreibt alles, was noch wartet, und löst dann das Dateisystem. Wenn
der Prompt zurückkommt, kannst du den Stick gefahrlos herausziehen. (`sync`
schreibt ebenfalls alles, was noch wartet, aber ohne auszuhängen.)

Wenn etwas das Dateisystem benutzt, weigert sich `umount`:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Hier ist es deine eigene Shell, die im Verzeichnis steht. Verlasse es mit
`cd ~` und versuche es noch einmal. Nach dem Aushängen ist `/mnt/usb` wieder
ein leeres Verzeichnis – aber die Dateien und die Änderungen, die du gemacht
hast, sind beim nächsten Einhängen immer noch auf dem Stick.

```quiz
Warum solltest du einen USB-Stick aushängen, bevor du ihn herausziehst?
- [ ] Sonst werden die Dateien auf dem Stick gelöscht
- [x] Änderungen warten vielleicht noch im RAM – `umount` schreibt sie, bevor es das Dateisystem abkoppelt
- [ ] Sonst bekommt der Stick beim nächsten Mal einen neuen Gerätenamen
- [ ] Der Stick lässt sich erst wieder einhängen, wenn er auf demselben Rechner ausgehängt wurde
---
Linux sammelt Änderungen im RAM (*Cache*) und schreibt sie etwas später. Ein
Stick, der noch eingehängt herausgezogen wird, kann Dateien verlieren, die du
„gespeichert“ hast.
```

## `/etc/fstab` – was beim Booten eingehängt wird

Das Root-Dateisystem, `/boot` und Swap werden bei jedem Start des Rechners
automatisch eingehängt. Was eingehängt werden soll, steht in der Datei
`/etc/fstab` (*file system table*):

```sh
cat /etc/fstab
```

Jede Zeile hat sechs Spalten:

| Spalte | Beispiel | Bedeutet |
|---|---|---|
| Gerät | `UUID=3f1c…` | Welches Dateisystem |
| Mountpunkt | `/` | Wo im Baum (`none` für Swap) |
| Typ | `ext4` | Der Typ des Dateisystems |
| Optionen | `defaults`, `errors=remount-ro` | Mount-Optionen, durch Kommas getrennt |
| dump | `0` | Altes Backup-Flag, fast immer 0 |
| pass | `1` | Die Reihenfolge, in der `fsck` sie beim Booten prüft (1 = Root, 2 = andere, 0 = nie) |

Die Option `errors=remount-ro` bedeutet, dass das Root-Dateisystem nur noch
lesbar gemacht wird, wenn ein Fehler entdeckt wird – besser das, als noch mehr
zu zerstören. Kommentare wie `# / was on /dev/sda2 during installation` hat
der Installer geschrieben.

Warum `UUID=…` und nicht einfach `/dev/sda2`? Gerätenamen können sich ändern –
steck einen neuen Datenträger ein, und der alte bekommt vielleicht einen neuen
Buchstaben. Eine UUID wird zusammen mit dem Dateisystem erzeugt und ändert
sich nie. Du findest sie mit `lsblk -f`, `blkid` oder `findmnt`:

```sh
sudo blkid
findmnt -n -o UUID /
```

Bei `findmnt` wählt `-o` die Spalten, die angezeigt werden, und `-n` lässt die
Überschrift weg – praktisch, wenn du nur den Wert selbst willst.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` ist die EFI-Partition, und die EFI-Partition muss FAT sein.
```

Wenn sich der Stick immer auf `/mnt/usb` einhängen lassen soll, kannst du eine
Zeile wie diese hinzufügen:

```text
LABEL=USBSTICK  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` bedeutet, dass er beim Booten nicht eingehängt wird (der Stick steckt
vielleicht gar nicht), und `user`, dass normale Benutzer ihn einhängen dürfen –
dann reicht `mount /mnt/usb`, ohne `sudo`.

> **Warnung:** Ein Fehler in `/etc/fstab` kann verhindern, dass der Rechner
> richtig bootet. Teste Änderungen immer mit `sudo mount -a`, das alles aus der
> Datei einhängt, was noch nicht eingehängt ist, *bevor* du neu startest. Für
> externe Datenträger, die nicht immer angeschlossen sind, füge die Option
> `nofail` hinzu.

## Swap

**Swap** ist Platz, der benutzt wird, wenn der RAM ausgeht: Teile des
Arbeitsspeichers, die gerade nicht gebraucht werden, werden dorthin
ausgelagert, damit die Programme Platz haben. Swap ist viel langsamer als RAM,
ein Rechner, der viel swappt, wird also träge – aber das ist besser, als wenn
Programme abstürzen.

```sh
swapon --show
free -h
```

Hier ist Swap eine eigene Partition, `sda3`. Viele Installationen (zum
Beispiel neuere Ubuntu-Versionen) benutzen stattdessen eine *Swap-Datei* auf
dem Root-Dateisystem.

## Partitionieren und Formatieren – mit größter Vorsicht

`fdisk -l` zeigt die Partitionstabellen aller Datenträger, mit Anfang und Ende
jeder Partition und ihrem Typ. Es erfordert root:

```sh
sudo fdisk -l
```

Mit `fdisk` (ohne `-l`), `parted` oder dem grafischen `gparted` kannst du die
Partitionstabelle ändern, und mit `mkfs` legst du ein neues Dateisystem an –
du formatierst:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBSTICK /dev/sdb1    # FAT32 – funktioniert überall
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – Linux-Rechte, aber nur für Linux
```

> **Warnung!** `fdisk` und `mkfs` gehören zu den gefährlichsten Befehlen, die
> es gibt. Ein einziger vertippter Buchstabe – `sda` statt `sdb` – und die
> ganze Systemplatte ist weg. Bevor du auf einem echten Rechner irgendetwas
> formatierst: Prüfe mit `lsblk -f`, dass Größe, die Spalte `RM` und das Label
> stimmen, stelle sicher, dass die Partition nicht eingehängt ist, und habe ein
> Backup von allem Wichtigen.

Im Simulator kannst du `mkfs.ext4` und `mkfs.vfat` auf dem USB-Stick
ausprobieren – aber erledige zuerst die Aufgaben, denn die Dateien auf dem
Stick verschwinden dabei. Die eigenen Partitionen des Systems sind geschützt,
weil sie eingehängt sind, genau wie auf einem echten System.

## Zusammenfassung

| Befehl | Macht |
|---|---|
| `lsblk`, `lsblk -f` | Datenträger, Partitionen und Dateisysteme anzeigen |
| `blkid` | Typ, Label und UUID anzeigen |
| `df -h` | Wie voll sind die Dateisysteme? |
| `du -sh directory` | Wie viel Platz brauchen die Dateien? |
| `findmnt`, `mount` | Was ist wo eingehängt? |
| `sudo mount /dev/sdb1 /mnt/usb` | Ein Dateisystem einhängen |
| `sudo umount /mnt/usb` | Aushängen – bevor du den Stick herausziehst |
| `cat /etc/fstab` | Was wird beim Booten eingehängt? |
| `swapon --show` | Swap anzeigen |
| `sudo fdisk -l` | Die Partitionstabellen anzeigen |
