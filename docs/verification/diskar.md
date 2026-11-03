# Faktagranskning: diskar

Kapitel: Diskar och filsystem (`src/Linux/content/chapters/en/diskar.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Linux har inga enhetsbokstäver utan ett katalogträd från `/` |  | ogranskad |  |
| Disk, partition och filsystem; partitionstabellen är GPT eller MBR (som verktygen kallar `dos`) |  | ogranskad |  |
| En ny partition är oanvändbar tills den har ett filsystem – att formatera |  | ogranskad |  |
| Varje disk och partition har en enhetsfil i `/dev` (`sda`, `sda1`, `nvme0n1p1`, `vda`, `mmcblk0p1`) |  | ogranskad |  |
| Bokstäverna delas ut i den ordning diskarna hittas; en USB-sticka kan bli `sda` |  | ogranskad |  |
| Enhetsfilerna ägs av root och gruppen `disk` |  | ogranskad |  |
| `lsblk`-kolumnerna NAME, RM, SIZE, TYPE, MOUNTPOINTS |  | ogranskad |  |
| På den här datorn: `sda1` EFI på `/boot/efi`, `sda2` rot `/`, `sda3` swap |  | ogranskad |  |
| `lsblk -f` visar typ, etikett, UUID och ledigt utrymme; `sdb1` är `vfat` med etiketten `USBSTICK` |  | ogranskad |  |
| Tabellen över filsystem: ext4 (Debian/Ubuntu), btrfs (standard i Fedora och openSUSE), xfs (standard i RHEL), vfat (ingen Linux-behörighet, högst 4 GiB per fil, EFI-partitionen måste vara FAT), exfat, ntfs, swap, tmpfs |  | ogranskad |  |
| Montering hänger in ett filsystem på en monteringspunkt i trädet |  | ogranskad |  |
| `findmnt` och `mount` listar monteringar; `proc`, `sysfs` och `tmpfs` |  | ogranskad |  |
| Vanliga monteringspunkter: `/`, `/boot`, `/boot/efi`, `/mnt`, `/media/elev/…` eller `/run/media/elev/…` |  | ogranskad |  |
| `df -h`, kolumnerna, `-T` och `df -h SÖKVÄG` |  | ogranskad |  |
| ext4 reserverar 5 % åt root |  | ogranskad |  |
| `df` frågar filsystemet, `du` går igenom filerna; `du -h -d 1` |  | ogranskad |  |
| Både att skapa `/mnt/usb` och att montera kräver root; `mount` känner igen FAT själv, `-t vfat` |  | ogranskad |  |
| På FAT får alla filer samma ägare – den som monterade, root; `-o uid=1000,gid=1000` |  | ogranskad |  |
| Montering med `LABEL=USBSTICK`; skrivbordets filhanterare monterar automatiskt |  | ogranskad |  |
| Ändringar samlas i RAM (cache); `umount` skriver allt som väntar och kopplar loss; `sync` skriver utan att avmontera |  | ogranskad |  |
| `umount: /mnt/usb: target is busy.` när skalet står i katalogen |  | ogranskad |  |
| `/etc/fstab` och de sex kolumnerna (enhet, monteringspunkt, typ, flaggor, dump, pass) |  | ogranskad |  |
| `errors=remount-ro` gör rotfilsystemet skrivskyddat vid fel; installationsprogrammet skrev kommentarerna |  | ogranskad |  |
| Enhetsnamn kan ändras, UUID skapas med filsystemet och ändras aldrig |  | ogranskad |  |
| `findmnt`: `-o` väljer kolumner, `-n` tar bort rubriken |  | ogranskad |  |
| Kontrollfråga: `findmnt -n -o FSTYPE /boot/efi` ger `vfat` |  | ogranskad |  |
| fstab-raden för stickan: `noauto` och `user` |  | ogranskad |  |
| Ett fel i `/etc/fstab` kan hindra uppstart; testa med `sudo mount -a`; `nofail` för externa diskar |  | ogranskad |  |
| Swap används när RAM tar slut och är mycket långsammare än RAM |  | ogranskad |  |
| Här är swap en egen partition `sda3`; många installationer (t.ex. nyare Ubuntu) använder en swapfil |  | ogranskad |  |
| `sudo fdisk -l` visar partitionstabellerna och kräver root |  | ogranskad |  |
| `fdisk`, `parted`, `gparted`, `mkfs.vfat -n`, `mkfs.ext4 -L` |  | ogranskad |  |
| Kontroller före formatering: `lsblk -f` (storlek, RM, etikett), inte monterad, säkerhetskopia |  | ogranskad |  |
| Systemets partitioner skyddas eftersom de är monterade |  | ogranskad |  |
