# Diskar och filsystem

Var hamnar egentligen filerna du sparar? I Windows är svaret en bokstav –
`C:`, `D:`, `E:`. I Linux finns inga bokstäver alls, bara **ett** katalogträd
som börjar i `/`. I det här kapitlet tittar du under huven: vilka diskar
datorn har, hur de är indelade, hur mycket plats som finns kvar – och hur du
kopplar in en USB-sticka och tar ut den igen utan att förlora något.

## Disk, partition och filsystem

Tre ord som ofta blandas ihop, men som betyder olika saker:

- En **disk** är själva lagringsenheten: en SSD, en hårddisk, ett SD-kort
  eller en USB-sticka.
- En **partition** är en bit av disken. En disk kan delas i flera
  partitioner som används till olika saker. Var varje partition börjar och
  slutar står i disken **partitionstabell** – på nya datorer av typen
  **GPT**, på äldre datorer och de flesta USB-stickor den gamla
  **MBR** (som verktygen kallar `dos`).
- Ett **filsystem** är ordningen *inuti* en partition: hur filnamn,
  kataloger, rättigheter och själva innehållet lagras. En ny partition är
  tom och oanvändbar tills man skapar ett filsystem på den – det är det som
  kallas att **formatera**.

Tänk på disken som ett tomt lagerhus, partitionerna som väggarna som delar
upp det i rum och filsystemet som hyllorna och etiketterna i varje rum. Utan
hyllor går det inte att hitta något.

```quiz
Du har just skapat en ny partition på en disk. Varför kan du inte spara filer
på den än?
- [ ] Den måste först läggas till i partitionstabellen
- [x] Den har inget filsystem än – den måste formateras först
- [ ] Partitioner kan inte innehålla filer, det kan bara diskar
- [ ] Den måste först få en enhetsbokstav
---
En ny partition är tom och oanvändbar tills du skapar ett filsystem på den.
Det är det som kallas att formatera.
```

## Diskarna är filer i `/dev`

I Linux är nästan allt en fil – även diskarna. Varje disk och partition har
en **enhetsfil** i `/dev`:

```sh
ls -l /dev/sd*
```

| Enhetsfil | Är |
|---|---|
| `/dev/sda` | Första disken (SATA, USB eller en virtuell disk) |
| `/dev/sda1`, `/dev/sda2` | Partition 1 och 2 på `sda` |
| `/dev/sdb` | Andra disken – i den här datorn USB-stickan |
| `/dev/nvme0n1`, `/dev/nvme0n1p1` | En NVMe-SSD och dess första partition |
| `/dev/vda` | En disk i en virtuell maskin |
| `/dev/mmcblk0p1` | Första partitionen på ett SD-kort (t.ex. i en Raspberry Pi) |

Bokstäverna delas ut i den ordning diskarna hittas. Har datorn en NVMe-SSD
kan en USB-sticka mycket väl bli `sda` – så **gissa aldrig**, kontrollera
alltid. Enhetsfilerna ägs av root och gruppen `disk`, så som vanlig
användare kan du inte läsa diskarna direkt.

## Vilka diskar finns? – `lsblk`

`lsblk` (*list block devices*) ritar diskarna som ett träd, med
partitionerna under varje disk:

```sh
lsblk
```

| Kolumn | Betyder |
|---|---|
| `NAME` | Namnet i `/dev` |
| `RM` | 1 = löstagbar (*removable*), t.ex. en USB-sticka |
| `SIZE` | Storleken |
| `TYPE` | `disk` eller `part` (partition) |
| `MOUNTPOINTS` | Var filsystemet syns i katalogträdet, `[SWAP]` för swap |

På den här datorn är `sda1` **EFI-partitionen** (som datorns firmware
startar från) på `/boot/efi`, `sda2` är **rotfilsystemet** `/` och `sda3` är
**swap**. Andra distributioner – och andra installationer – kan dela in
disken på andra sätt, så titta alltid i stället för att gissa.

Med `-f` visar `lsblk` även filsystemen – typ, etikett (*label*), UUID och
hur mycket som är ledigt:

```sh
lsblk -f
```

Lägg märke till `sdb1`: ett `vfat`-filsystem med etiketten `USBMINNE` som
inte är monterat någonstans. Det är USB-stickan vi ska koppla in.

## Olika filsystem

Det finns många filsystem, med olika styrkor:

| Filsystem | Används till |
|---|---|
| `ext4` | Linux klassiska standard. Stabilt och snabbt – Debian och Ubuntu använder det |
| `btrfs` | Ögonblicksbilder (*snapshots*), komprimering och subvolymer. Standard i Fedora och openSUSE |
| `xfs` | Bra på stora filer och servrar. Standard i Red Hat Enterprise Linux |
| `vfat` (FAT32) | Fungerar överallt: Windows, macOS, kameror, bilstereon. Inga Linux-rättigheter och högst 4 GiB per fil. EFI-partitionen måste vara FAT |
| `exfat` | Som FAT, men utan 4 GiB-gränsen. Vanligt på nya USB-stickor och SD-kort |
| `ntfs` | Windows filsystem. Linux kan läsa och skriva det |
| `swap` | Inget filsystem för filer – extra "minne" på disken |
| `tmpfs` | Ett filsystem som bara finns i RAM-minnet och försvinner vid omstart |

## Allt är ett träd – montering

Att **montera** ett filsystem betyder att koppla in det i katalogträdet på en
viss katalog, en **monteringspunkt**. Rotfilsystemet monteras på `/`, och
allt annat hängs in någonstans under det. Det är därför Linux klarar sig utan
enhetsbokstäver: en annan disk är bara en katalog till.

`findmnt` visar alla monteringar som ett träd:

```sh
findmnt
```

Och `mount` utan argument listar samma sak, en rad per filsystem:

```sh
mount
```

Du ser också sådant som inte är diskar: `proc` på `/proc` och `sysfs` på
`/sys` är kärnans information förklädd till filer, och `tmpfs` är filsystem
i RAM-minnet. Vanliga monteringspunkter:

| Katalog | Används till |
|---|---|
| `/` | Rotfilsystemet |
| `/boot`, `/boot/efi` | Kärnan och EFI-partitionen |
| `/mnt` | Tillfälliga monteringar som du gör för hand |
| `/media/elev/…` eller `/run/media/elev/…` | Där skrivbordsmiljön automatiskt monterar USB-stickor |

## Hur mycket plats finns kvar? – `df`

`df` (*disk free*) visar hur fullt varje monterat filsystem är. Med `-h` får
du läsbara storlekar:

```sh
df -h
```

| Kolumn | Betyder |
|---|---|
| `Filesystem` | Var filsystemet ligger, t.ex. en partition eller `tmpfs` |
| `Size`, `Used`, `Avail` | Storlek, använt och ledigt |
| `Use%` | Hur fullt det är |
| `Mounted on` | Monteringspunkten |

`-T` lägger till filsystemets typ, och skriver du en sökväg visas bara
filsystemet som den ligger på:

```sh
df -hT
df -h ~
```

Ser du att `Used` och `Avail` inte riktigt blir `Size` tillsammans? På ext4
reserveras 5 % åt root, så att systemet kan fortsätta fungera även när en
vanlig användare fyllt disken.

```try
df -hT
---
Kolumnen `Type` visar att `/` är `ext4` och `/boot/efi` är `vfat`.
```

## `df` eller `du`?

Två kommandon med nästan samma namn, men som svarar på olika frågor:

| Fråga | Kommando |
|---|---|
| Hur full är **disken**? | `df -h` – frågar filsystemet |
| Hur mycket tar de här **filerna**? | `du -sh katalog` – går igenom filerna och räknar ihop |

När en disk blir full använder man båda: först `df -h` för att se *vilket*
filsystem som är fullt, sedan `du` för att hitta *vad* som tar plats:

```sh
du -h -d 1 ~
```

## Montera en USB-sticka

Nu ska vi koppla in USB-stickan. Först: vilken enhet är den? `lsblk -f`
visade en löstagbar disk, `sdb`, med partitionen `sdb1` och etiketten
`USBMINNE`. Det är **partitionen** man monterar, inte hela disken.

Sedan behövs en monteringspunkt – en vanlig, tom katalog. Både den och
själva monteringen kräver root:

```sh
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

`mount` känner själv igen att det är ett FAT-filsystem; vill du vara tydlig
kan du skriva `-t vfat`. Nu syns stickans filer i katalogen:

```sh
ls -l /mnt/usb
df -h /mnt/usb
```

Härifrån fungerar stickan som vilken katalog som helst. Kopiera en fil till
hemkatalogen:

```sh
cp /mnt/usb/att-gora.txt ~
```

> **Varför ägs allt av root?** FAT har inga Linux-rättigheter. När en
> FAT-sticka monteras får därför *alla* filer samma ägare och rättigheter –
> ägaren blir den som monterade, alltså root. För att skriva till stickan
> behöver du antingen `sudo`, eller montera den så att du själv blir ägare:
> `sudo mount -o uid=1000,gid=1000 /dev/sdb1 /mnt/usb` (1000 är ditt
> användar-id – se `id`).

Du kan också montera med etiketten i stället för enhetsnamnet:
`sudo mount LABEL=USBMINNE /mnt/usb`. På en dator med skrivbordsmiljö gör
filhanteraren allt detta automatiskt när du sätter i stickan.

```quiz
Efter `sudo mount /dev/sdb1 /mnt/usb` ägs alla filer på FAT-stickan av root.
Varför?
- [ ] Filerna skapades av root på en annan dator
- [x] FAT har inga Linux-rättigheter, så alla filer får samma ägare som den som monterade – root
- [ ] Allt i `/mnt` ägs alltid av root
- [ ] USB-stickor kan bara användas av root
---
Med `-o uid=1000,gid=1000` kan du själv välja ägaren när du monterar.
```

## Avmontera – innan du drar ut stickan!

Linux skriver inte alltid till disken direkt. Ändringar samlas i RAM-minnet
(*cache*) och skrivs lite senare, eftersom det går mycket snabbare. Drar du
ut en sticka som fortfarande är monterad kan filer du "sparat" saknas eller
vara trasiga. Därför **avmonterar** man först – stavat `umount`, utan n:

```text
sudo umount /mnt/usb
```

`umount` skriver allt som väntar och kopplar sedan bort filsystemet. När
prompten kommer tillbaka är det säkert att dra ut stickan. (`sync` skriver
också allt som väntar, men utan att avmontera.)

Om något använder filsystemet vägrar `umount`:

```text
$ cd /mnt/usb
$ sudo umount /mnt/usb
umount: /mnt/usb: target is busy.
```

Här är det ditt eget skal som står i katalogen. Gå därifrån med `cd ~` och
försök igen. Efter avmonteringen är `/mnt/usb` en tom katalog igen – men
filerna, och ändringarna du gjort, finns kvar på stickan nästa gång du
monterar den.

```quiz
Varför ska du avmontera en USB-sticka innan du drar ut den?
- [ ] Annars raderas filerna på stickan
- [x] Ändringar kan fortfarande vänta i RAM-minnet – `umount` skriver dem innan filsystemet kopplas bort
- [ ] Annars får stickan ett nytt enhetsnamn nästa gång
- [ ] Stickan kan inte monteras igen förrän den har avmonterats på samma dator
---
Linux samlar ändringar i RAM-minnet (*cache*) och skriver dem lite senare. En
sticka som dras ut medan den fortfarande är monterad kan förlora filer du
"sparat".
```

## `/etc/fstab` – det som monteras vid start

Rotfilsystemet, `/boot` och swap monteras automatiskt varje gång datorn
startar. Vad som ska monteras står i filen `/etc/fstab` (*file system table*):

```sh
cat /etc/fstab
```

Varje rad har sex kolumner:

| Kolumn | Exempel | Betyder |
|---|---|---|
| Enhet | `UUID=3f1c…` | Vilket filsystem |
| Monteringspunkt | `/` | Var i trädet (`none` för swap) |
| Typ | `ext4` | Filsystemets typ |
| Flaggor | `defaults`, `errors=remount-ro` | Monteringsflaggor, kommaseparerade |
| dump | `0` | Gammal backupflagga, nästan alltid 0 |
| pass | `1` | I vilken ordning `fsck` kontrollerar vid start (1 = rot, 2 = övriga, 0 = aldrig) |

Raden `errors=remount-ro` betyder att rotfilsystemet görs skrivskyddat om
ett fel upptäcks – hellre det än att förstöra mer. Kommentarerna som
`# / was on /dev/sda2 during installation` skrev installationsprogrammet.

Varför `UUID=…` och inte bara `/dev/sda2`? Enhetsnamnen kan ändras – sätter
du i en ny disk kan den gamla byta bokstav. Ett UUID skapas tillsammans med
filsystemet och ändras aldrig. Du hittar det med `lsblk -f`, `blkid` eller
`findmnt`:

```sh
sudo blkid
findmnt -n -o UUID /
```

Med `findmnt` väljer `-o` vilka kolumner som ska visas och `-n` hoppar över
rubriken – praktiskt när du bara vill ha själva värdet.

```predict
$ findmnt -n -o FSTYPE /boot/efi
vfat
---
`/boot/efi` är EFI-partitionen, och EFI-partitionen måste vara FAT.
```

Vill du att stickan alltid ska kunna monteras på `/mnt/usb` kan du lägga
till en rad som den här:

```text
LABEL=USBMINNE  /mnt/usb  vfat  noauto,user,uid=1000,gid=1000  0  0
```

`noauto` betyder att den inte monteras vid start (stickan sitter kanske inte
i), och `user` att vanliga användare får montera den – då räcker
`mount /mnt/usb`, utan `sudo`.

> **Varning:** ett fel i `/etc/fstab` kan göra att datorn inte startar
> ordentligt. Testa alltid ändringar med `sudo mount -a`, som monterar allt
> i filen som inte redan är monterat, *innan* du startar om. För externa
> diskar som inte alltid sitter i, lägg till flaggan `nofail`.

## Swap

**Swap** är plats som används när RAM-minnet tar slut: delar av minnet som
inte används just nu flyttas dit, så att programmen får plats. Swap är
mycket långsammare än RAM, så en dator som swappar mycket blir seg – men det
är bättre än att program kraschar.

```sh
swapon --show
free -h
```

Här är swap en egen partition, `sda3`. Många installationer (till exempel
nyare Ubuntu) använder i stället en *swapfil* på rotfilsystemet.

## Partitionera och formatera – med största försiktighet

`fdisk -l` visar partitionstabellerna på alla diskar, med var varje
partition börjar och slutar och vilken typ den har. Det kräver root:

```sh
sudo fdisk -l
```

Med `fdisk` (utan `-l`), `parted` eller grafiska `gparted` kan man ändra
partitionstabellen, och med `mkfs` skapar man ett nytt filsystem – formaterar:

```text
sudo umount /mnt/usb
sudo mkfs.vfat -n USBMINNE /dev/sdb1    # FAT32 – fungerar överallt
sudo mkfs.ext4 -L BACKUP /dev/sdb1      # ext4 – Linux-rättigheter, men bara för Linux
```

> **Varning!** `fdisk` och `mkfs` är bland de farligaste kommandona som finns.
> En felskriven bokstav – `sda` i stället för `sdb` – och hela systemdisken
> är borta. Innan du formaterar något på en riktig dator: kontrollera med
> `lsblk -f` att storleken, `RM`-kolumnen och etiketten stämmer, se till att
> partitionen inte är monterad och ha en backup av allt viktigt.

I simulatorn går det att prova `mkfs.ext4` och `mkfs.vfat` på USB-stickan –
men gör uppgifterna först, för filerna på stickan försvinner. Systemets egna
partitioner är skyddade eftersom de är monterade, precis som på riktigt.

## Sammanfattning

| Kommando | Gör |
|---|---|
| `lsblk`, `lsblk -f` | Visa diskar, partitioner och filsystem |
| `blkid` | Visa typ, etikett och UUID |
| `df -h` | Hur fulla är filsystemen? |
| `du -sh katalog` | Hur mycket tar filerna? |
| `findmnt`, `mount` | Vad är monterat, och var? |
| `sudo mount /dev/sdb1 /mnt/usb` | Montera ett filsystem |
| `sudo umount /mnt/usb` | Avmontera – innan du drar ut stickan |
| `cat /etc/fstab` | Vad monteras vid start? |
| `swapon --show` | Visa swap |
| `sudo fdisk -l` | Visa partitionstabellerna |
