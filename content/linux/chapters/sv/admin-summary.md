# Sammanfattning: Systemadministration

I den här delen tog du hand om datorn som administratör: tjänsterna som körs i
bakgrunden, diskarna som filerna hamnar på och användarna som delar på
datorn. Nästan allt som **ändrar** något här kräver root – så `sudo` dök upp
ofta.

## Tjänster och loggar med systemd

**systemd** är process nummer 1 och startar allt annat. Allt den håller reda
på är en **unit**, som beskrivs av en unit-fil – de som följer med paketen
finns i `/usr/lib/systemd/system`, dina egna i `/etc/systemd/system`, och de
går före. `systemctl` styr tjänsterna, och **`start` (nu) och `enable` (vid
uppstart) är två olika saker**. Allt som tjänsterna skriver ut hamnar i
**journalen**, som du läser och filtrerar med `journalctl`. När en tjänst inte
vill starta: `systemctl --failed`, `systemctl status` och sedan `journalctl
-xeu` – och läs loggen ord för ord. I Ubuntu heter SSH-tjänsten `ssh`; andra
familjer ger ibland tjänsterna andra namn.

## Diskar och filsystem

En **disk** delas in i **partitioner**, och varje partition behöver ett
**filsystem** innan den kan lagra filer. Diskarna är filer i `/dev`
(`/dev/sda`, `/dev/sda1`, …). Linux har inga enhetsbokstäver: varje filsystem
**monteras** någonstans i det enda katalogträdet som börjar i `/`. `lsblk`
visar diskarna, `df` hur fulla filsystemen är och `du` hur mycket filerna tar.
**Avmontera** alltid en USB-sticka innan du drar ut den, eftersom ändringar
kan ligga och vänta i RAM. Det som monteras vid uppstart står i `/etc/fstab`,
helst med **UUID**, som aldrig ändras. `fdisk` och `mkfs` hör till de
farligaste kommandona som finns – kontrollera två gånger.

## Användare och grupper

Varje användare har ett **UID** – root har 0, systemanvändare får låga nummer
och människor börjar på 1000. Användarna står i `/etc/passwd`, grupperna i
`/etc/group` och lösenordshasharna i `/etc/shadow`, som bara root kan läsa.
Varje användare har en **primär grupp** och hur många **extragrupper** som
helst. `useradd -m -s /bin/bash` skapar en användare, `passwd` sätter
lösenordet och `usermod -aG` lägger till i en grupp – **glöm inte `-a`**. I
Ubuntu kommer sudo-rätten från gruppen `sudo` (andra familjer använder
`wheel`). `su -` byter användare med den användarens lösenord, `sudo -u` kör
ett kommando som någon annan med ditt eget.

## Kommandon

| Kommando | Gör |
|---|---|
| `systemctl status NAMN` | Hur mår tjänsten? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAMN` | Starta, stoppa, starta om, läs om konfigurationen |
| `sudo systemctl enable --now NAMN` | Starta vid uppstart – och nu |
| `systemctl is-active` / `is-enabled NAMN` | Ett ord, slutkod 0 för "ja" |
| `systemctl --failed` | Tjänster som har misslyckats |
| `systemctl cat NAMN` | Visa unit-filen |
| `sudo systemctl daemon-reload` | Läs in ändrade unit-filer igen |
| `journalctl -u NAMN` | Loggen för en tjänst |
| `journalctl -p err -b` | Fel och värre sedan den här uppstarten |
| `journalctl -n 20`, `-f`, `--since today` | De senaste raderna, följ, sedan midnatt |
| `lsblk -f` | Diskar, partitioner och filsystem |
| `blkid`, `findmnt -n -o UUID /` | Typ, etikett och UUID |
| `df -h`, `du -sh KATALOG` | Hur full är disken, hur mycket tar filerna |
| `sudo mount /dev/sdb1 /mnt/usb` | Montera ett filsystem |
| `sudo umount /mnt/usb` | Avmontera |
| `cat /etc/fstab`, `sudo mount -a` | Vad som monteras vid uppstart – och testa ändringar |
| `swapon --show`, `free -h` | Swap och minne |
| `id`, `groups` | UID, GID och grupper |
| `sudo useradd -m -s /bin/bash NAMN` | Skapa en användare |
| `sudo passwd NAMN` | Sätt ett lösenord |
| `sudo groupadd GRUPP` | Skapa en grupp |
| `sudo usermod -aG GRUPP NAMN` | Lägg till i en grupp |
| `sudo usermod -L` / `-U NAMN` | Lås / lås upp ett konto |
| `sudo userdel -r NAMN` | Ta bort en användare och hemkatalogen |
| `su - NAMN`, `sudo -u NAMN KOMMANDO` | Byt användare, kör som en annan användare |
