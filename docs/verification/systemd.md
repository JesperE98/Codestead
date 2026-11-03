# Faktagranskning: systemd

Kapitel: Tjänster och loggar med systemd (`src/Linux/content/chapters/en/systemd.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Init är process nummer 1 och startar allt annat; i Debian, Ubuntu, Arch och Fedora är init systemd |  | ogranskad |  |
| `ps -p 1` visar processen `/sbin/init`, som är en länk till programmet `systemd` |  | ogranskad |  |
| systemd håller koll på tjänster, kan starta om dem när de kraschar och samlar deras utskrifter i journalen |  | ogranskad |  |
| `systemctl` styr tjänster, `journalctl` läser journalen, `hostnamectl` visar/ändrar datorns namn, `systemd-analyze` visar uppstartens längd |  | ogranskad |  |
| Unit-sorter syns på ändelsen: `.service`, `.timer`, `.socket`, `.mount`, `.target` |  | ogranskad |  |
| Paketens unit-filer ligger i `/usr/lib/systemd/system/`, administratörens i `/etc/systemd/system/`, som har företräde |  | ogranskad |  |
| Äldre Debian- och Ubuntuversioner säger `/lib/systemd/system`; `/lib` är en länk till `/usr/lib` |  | ogranskad |  |
| `.service` kan utelämnas i systemctl-kommandon |  | ogranskad |  |
| I Ubuntu heter SSH-servern `ssh` (`ssh.service`) med aliaset `sshd.service` |  | ogranskad |  |
| Exempelutskriften av `systemctl status ssh` (Loaded/Active/Docs/Main PID/CGroup och loggrader) |  | ogranskad |  |
| Symbolerna ● (kör), × (misslyckad) och ○ (stoppad) i `systemctl status` |  | ogranskad |  |
| `static` betyder att tjänsten inte kan aktiveras själv utan startas när en annan unit behöver den |  | ogranskad |  |
| Långa utskrifter visas i `less`; `--no-pager` stänger av det |  | ogranskad |  |
| start/stop/restart/reload och att ändringar kräver root; utan sudo: `Interactive authentication required` |  | ogranskad |  |
| `reload` fungerar bara för tjänster som stöder det, och tjänsten fortsätter köra under tiden |  | ogranskad |  |
| `start` gäller nu, `enable` vid uppstart, `enable --now` båda, `disable --now` stoppar också |  | ogranskad |  |
| `enable` skapar en länk i katalogen för målet i `[Install]`, oftast `multi-user.target.wants` |  | ogranskad |  |
| `is-active`/`is-enabled` skriver ett ord och avslutas med 0 om svaret är ja; `-q` gör dem tysta |  | ogranskad |  |
| Kontrollfråga: i simulatorn är myserver `active` men `disabled` från början |  | ogranskad |  |
| `list-units` visar igångvarande/misslyckade tjänster, `--all` tar med stoppade, `--failed` bara misslyckade, `list-unit-files` alla unit-filer |  | ogranskad |  |
| Journalen samlar utskrifter från tjänster, kärnan och systemd; `journalctl` utan flaggor visar allt, äldst först |  | ogranskad |  |
| Flaggorna `-u`, `-n`, `-f`, `-b`, `-b -1`, `--since`, `-p`, `-xe`, `-k` och vad de visar |  | ogranskad |  |
| Prioriteterna 0–7 (emerg … debug), och att `-p` visar vald prioritet och allvarligare |  | ogranskad |  |
| Kontrollfråga: `-p warning` visar err, warning och crit men inte notice och info |  | ogranskad |  |
| `ACPI BIOS Error` i `journalctl -p err` är vanligt och brukar vara ofarligt |  | ogranskad |  |
| I Ubuntu får grupperna `adm` och `systemd-journal` läsa hela journalen; andra familjer använder andra grupper |  | ogranskad |  |
| `systemctl` föreslår `systemctl status` och `journalctl -xeu` när en start misslyckas |  | ogranskad |  |
| `status=1/FAILURE` = programmet avslutade sig med fel; `status=203/EXEC` = systemd hittade inte programmet (kontrollera `ExecStart=`) |  | ogranskad |  |
| Delarna `[Unit]`, `[Service]`, `[Install]` och nycklarna `After=`, `ExecStart=`, `User=`, `Restart=on-failure`, `WantedBy=` |  | ogranskad |  |
| Efter ändring i en unit-fil krävs `systemctl daemon-reload`, annars varning i `systemctl status` |  | ogranskad |  |
| Filer i `/usr/lib/systemd/system` skrivs över vid paketuppdatering |  | ogranskad |  |
| Tjänstnamn i Ubuntu: `ssh`, `cron`, `NetworkManager`, `ufw` (om installerad), `systemd-timesyncd` |  | ogranskad |  |
| I Arch och Fedora heter SSH-tjänsten `sshd` |  | ogranskad |  |
| `systemctl list-unit-files \| grep ssh` visar `ssh.service` och `sshd.service` som alias |  | ogranskad |  |
| `sudo systemctl reboot`; efter omstart kör bara aktiverade tjänster; `journalctl -b -1` och `--list-boots` |  | ogranskad |  |
| `hostnamectl set-hostname`, `systemd-analyze` och `systemd-analyze blame` |  | ogranskad |  |
