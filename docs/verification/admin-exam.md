# Faktagranskning: admin-exam

Kapitel: Prov: Systemadministration (`content/linux/chapters/en/admin-exam.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Provet kräver 80 % rätt |  | ogranskad |  |
| `enable` gäller vid uppstart, `start` nu, `--now` båda |  | ogranskad |  |
| `systemctl is-active rapportd` ger `failed` i simulatorn; exit 0 bara för active |  | ogranskad |  |
| `journalctl -u minserver -f` följer en tjänsts logg |  | ogranskad |  |
| `systemctl cat` visar unit-filen; `ExecStart=` och `WantedBy=` |  | ogranskad |  |
| Att ändra en tjänst kräver root (*Interactive authentication required*) |  | ogranskad |  |
| UUID i fstab eftersom enhetsnamn kan ändras |  | ogranskad |  |
| `du` hittar vad som tar plats, `df` visar hur fullt filsystemet är |  | ogranskad |  |
| `df -h ~ \| awk 'NR > 1 {print $6}'` ger `/` i simulatorn |  | ogranskad |  |
| Testa fstab-ändringar med `sudo mount -a` före omstart |  | ogranskad |  |
| Kontroller före `mkfs` |  | ogranskad |  |
| Hasharna ligger i `/etc/shadow` eftersom `/etc/passwd` måste vara läsbar för alla |  | ogranskad |  |
| `grep ^sudo /etc/group \| cut -d: -f4` ger `elev` i simulatorn |  | ogranskad |  |
| `userdel` utan `-r` lämnar hemkatalogen |  | ogranskad |  |
| UID 33 med `nologin` är en systemanvändare |  | ogranskad |  |
| `getent group sudo` slår upp gruppen som systemet gör |  | ogranskad |  |
