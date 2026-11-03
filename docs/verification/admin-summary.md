# Faktagranskning: admin-summary

Kapitel: Sammanfattning: Systemadministration (`src/Linux/content/chapters/en/admin-summary.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| systemd är process 1 och startar allt annat |  | ogranskad |  |
| Paketens unit-filer i `/usr/lib/systemd/system`, egna i `/etc/systemd/system` som har företräde |  | ogranskad |  |
| `start` (nu) och `enable` (vid uppstart) är olika saker |  | ogranskad |  |
| Felsökningsordningen `systemctl --failed`, `systemctl status`, `journalctl -xeu` |  | ogranskad |  |
| I Ubuntu heter SSH-tjänsten `ssh` |  | ogranskad |  |
| Disk → partitioner → filsystem; diskar är filer i `/dev` |  | ogranskad |  |
| Ingen enhetsbokstav: allt monteras i ett träd från `/` |  | ogranskad |  |
| Avmontera före utdragning eftersom ändringar kan vänta i RAM |  | ogranskad |  |
| `/etc/fstab` helst med UUID, som aldrig ändras |  | ogranskad |  |
| UID 0 = root, systemanvändare låga nummer, personer från 1000 |  | ogranskad |  |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` (bara root kan läsa) |  | ogranskad |  |
| `usermod -aG` – glöm inte `-a` |  | ogranskad |  |
| I Ubuntu ger gruppen `sudo` sudo-rätt (andra familjer `wheel`) |  | ogranskad |  |
| `su -` kräver den andras lösenord, `sudo -u` ditt eget |  | ogranskad |  |
| Kommandotabellen (alla rader) |  | ogranskad |  |
