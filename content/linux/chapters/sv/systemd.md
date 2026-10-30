# Tjänster och loggar med systemd

En Linuxdator gör hela tiden saker som ingen sitter och startar för hand: den
tar emot SSH-anslutningar, synkar klockan, kör schemalagda jobb och skriver
loggar. Programmen som gör det kallas **tjänster** (*services*), och i nästan
alla moderna distributioner är det **systemd** som håller ordning på dem. I
det här kapitlet lär du dig starta och stoppa tjänster, få dem att starta vid
uppstart och – viktigast av allt – läsa loggarna när något går fel.

## init och systemd

När Linuxkärnan har startat kör den ett enda program: **init**, process
nummer 1. Init startar sedan allt annat. I dag är init nästan alltid
**systemd** – både i Debian, Ubuntu, Arch och Fedora. Titta själv:

```sh
ps -p 1
```

Processen heter `/sbin/init`, men det är bara en länk till programmet
`systemd`.

systemd gör mer än att starta tjänster. Den håller koll på att de lever,
startar om dem om de kraschar (om man vill), samlar allt de skriver i en
gemensam logg – **journalen** – och har verktyg för det mesta i systemet:

| Verktyg | Gör |
|---|---|
| `systemctl` | Styr tjänsterna: status, start, stopp, uppstart |
| `journalctl` | Läser journalen (loggen) |
| `hostnamectl` | Visar och ändrar datorns namn |
| `systemd-analyze` | Visar hur lång tid uppstarten tog |

## Units och tjänster

Allt som systemd håller reda på kallas en **unit**. Det finns flera sorter,
och sorten syns på ändelsen: `.service` (en tjänst), `.timer` (schemalagt
jobb), `.socket`, `.mount`, `.target` (en grupp units, ungefär som en
"nivå" i uppstarten) med flera. Det här kapitlet handlar om tjänsterna.

Varje unit beskrivs av en **unit-fil**, en liten textfil. De finns på två
ställen:

| Katalog | Innehåll |
|---|---|
| `/usr/lib/systemd/system/` | Unit-filer som följer med paketen. Ändra inte här! |
| `/etc/systemd/system/` | Administratörens egna unit-filer. Har företräde. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

:::debian
I äldre Debian- och Ubuntuversioner står det ofta `/lib/systemd/system` i
stället. Det är samma katalog – `/lib` är en länk till `/usr/lib`.
:::

Namnet på en tjänst är filnamnet, till exempel `minserver.service`. När du
skriver kommandon får du hoppa över `.service`: `systemctl status minserver`
fungerar lika bra.

## Hur mår tjänsten? – `systemctl status`

Det kommando du kommer att använda oftast är `systemctl status`:

:::debian
```sh
systemctl status ssh
```
:::

:::arch
```sh
systemctl status sshd
```
:::

:::redhat
```sh
systemctl status sshd
```
:::

Utskriften ser ut ungefär så här:

```text
● sshd.service - OpenSSH server daemon
     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: disabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 CET; 2h 13min ago
       Docs: man:sshd(8)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/sshd.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 fedora systemd[1]: Starting sshd.service - OpenSSH server daemon...
Oct 30 07:54:07 fedora sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 fedora systemd[1]: Started sshd.service - OpenSSH server daemon.
```

Rad för rad:

| Rad | Betyder |
|---|---|
| `●` | Grön prick = kör. Röd `×` = har misslyckats. Vit `○` = stoppad. |
| `Loaded` | Var unit-filen finns, om tjänsten startar vid uppstart (`enabled`/`disabled`/`static`) och distributionens standardval (`preset`) |
| `Active` | Det viktigaste: `active (running)`, `inactive (dead)` eller `failed` – och sedan när |
| `Docs` | Var du kan läsa mer (`man sshd`) |
| `Main PID` | Tjänstens huvudprocess – samma PID som i `ps aux` |
| `Memory`, `CGroup` | Hur mycket minne den använder och vilka processer som hör till den |
| Sista raderna | De senaste raderna från tjänstens logg i journalen |

`static` betyder att tjänsten inte kan aktiveras själv – den startas när en
annan unit behöver den.

> **Tips:** I en riktig terminal visas långa utskrifter i en bläddrare
> (`less`). Tryck `q` för att komma tillbaka. Lägg till `--no-pager` om du
> vill slippa den.

## Starta, stoppa och starta om

```text
sudo systemctl start minserver      # starta nu
sudo systemctl stop minserver       # stoppa nu
sudo systemctl restart minserver    # stoppa och starta igen
sudo systemctl reload minserver     # be den läsa om sina inställningar
```

Allt som **ändrar** något kräver root, så glöm inte `sudo`. Utan det svarar
systemctl:

```text
Failed to start minserver.service: Interactive authentication required.
```

`reload` fungerar bara för tjänster som har stöd för det. Fördelen är att
tjänsten fortsätter köra under tiden – ingen anslutning bryts. När du har
ändrat i en tjänsts konfigurationsfil är `reload` eller `restart` det sista
steget.

> **Prova!** I kapitlet om processer stoppade du övningsservern med `pkill`.
> Titta på `systemctl status minserver` – systemd märkte att processen
> försvann. Starta den igen med `systemctl` och jämför PID med `pgrep -l
> minserver`.

## Starta nu eller vid uppstart? `start` och `enable`

Det här är den vanligaste missuppfattningen om systemd: **`start` och
`enable` är två olika saker.**

| Kommando | Gör |
|---|---|
| `systemctl start X` | Startar tjänsten **nu**. Efter omstart är den borta igen. |
| `systemctl enable X` | Startar tjänsten automatiskt **vid uppstart** – men inte nu. |
| `systemctl enable --now X` | Båda på en gång. |
| `systemctl disable X` | Starta inte vid uppstart (`--now` stoppar den också). |

`enable` skapar en länk i en katalog som heter som målet i unit-filens
`[Install]`-del, oftast `multi-user.target.wants`:

```text
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

När datorn startar går systemd igenom katalogen och startar allt som finns
där. Du kan fråga om läget:

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` och `is-enabled` passar utmärkt i skript – de skriver ett ord och
avslutas med statuskod 0 om svaret är "ja". Med `-q` blir de helt tysta:

```text
if systemctl is-active -q minserver; then echo "servern kör"; fi
```

## Lista tjänster

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` visar tjänsterna som är igång (eller har misslyckats). Med
  `--all` kommer de stoppade också med.
- `--failed` visar bara de som har misslyckats. Bra första kommando när
  något känns fel!
- `list-unit-files` visar alla installerade unit-filer och om de är
  `enabled`, `disabled` eller `static`.

## Journalen – `journalctl`

Allt som tjänsterna, kärnan och systemd själv skriver hamnar i journalen.
Utan flaggor får du hela journalen, äldst först:

```sh
journalctl
```

Det blir snabbt mycket, så man filtrerar nästan alltid:

| Kommando | Visar |
|---|---|
| `journalctl -u ssh` | Bara en tjänst (`-u` som i *unit*) |
| `journalctl -n 20` | De 20 senaste raderna |
| `journalctl -f` | De senaste raderna, och sedan nya rader när de kommer (avsluta med Ctrl+C) |
| `journalctl -b` | Bara den här uppstarten (`-b -1` = förra) |
| `journalctl --since today` | Sedan midnatt. Även `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Bara fel och allvarligare |
| `journalctl -xe` | Hoppa till slutet och lägg till förklaringar |
| `journalctl -k` | Bara kärnans meddelanden (som `dmesg`) |

Flaggorna går att kombinera. Ett par klassiker:

```sh
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
```

### Prioriteter

Varje rad i journalen har en **prioritet**. `-p` visar den du väljer *och
allt som är allvarligare*:

| Nummer | Namn | Betyder |
|---|---|---|
| 0 | `emerg` | Systemet går inte att använda |
| 1 | `alert` | Måste åtgärdas genast |
| 2 | `crit` | Kritiskt fel |
| 3 | `err` | Fel – visas i rött |
| 4 | `warning` | Varning – visas i gult |
| 5 | `notice` | Normalt men värt att notera |
| 6 | `info` | Information |
| 7 | `debug` | Felsökningsinformation |

Bli inte orolig om `journalctl -p err` visar ett par fel från kärnan, som
`ACPI BIOS Error`. Sådant finns på nästan varje dator och brukar vara
ofarligt – det är fel i datorns firmware som kärnan klarar sig runt.

Journalen kräver normalt att du är root eller med i en grupp som får läsa
den (`adm` eller `systemd-journal` i Debian och Ubuntu, `wheel` i Arch och
Fedora). Din användare i simulatorn får läsa hela journalen.

## Felsök en tjänst som inte startar

Någon har satt upp tjänsten **rapportd** på den här datorn, men något är
fel. Så här brukar man gå till väga:

1. **Vad har gått fel?** Lista tjänsterna som misslyckats:

   ```sh
   systemctl --failed
   ```

2. **Titta på statusen.** De sista raderna är ofta tillräckliga:

   ```sh
   systemctl status rapportd
   ```

3. **Läs hela loggen** för tjänsten. Den berättar nästan alltid vad som är
   fel – läs den noga, ord för ord:

   ```sh
   journalctl -xeu rapportd
   ```

   `systemctl` föreslår själv precis det kommandot när en start misslyckas:
   `See "systemctl status rapportd.service" and "journalctl -xeu
   rapportd.service" for details.`

4. **Rätta felet**, till exempel en konfigurationsfil som saknas eller har
   ett stavfel.

5. **Starta om och kontrollera:**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

Raden `Main process exited, code=exited, status=1/FAILURE` betyder att
programmet avslutade sig självt med ett fel. Står det `status=203/EXEC`
hittade systemd inte programmet alls – kontrollera sökvägen i `ExecStart=`.

## Unit-filen – `systemctl cat`

Vill du veta exakt hur en tjänst startas läser du dess unit-fil:

```sh
systemctl cat minserver
```

```text
# /etc/systemd/system/minserver.service
[Unit]
Description=Minserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/minserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Del | Innehåll |
|---|---|
| `[Unit]` | Beskrivning och ordning: `After=network.target` = starta efter nätverket |
| `[Service]` | Hur programmet körs: `ExecStart=` (kommandot), `User=`, `Restart=on-failure` … |
| `[Install]` | Vad `enable` ska göra: `WantedBy=multi-user.target` |

Om du ändrar en unit-fil måste systemd läsa in den på nytt innan ändringen
gäller – annars får du en varning i `systemctl status`:

```text
sudo systemctl daemon-reload
```

Ändra aldrig filerna i `/usr/lib/systemd/system` – de skrivs över nästa gång
paketet uppdateras. Lägg din egen version i `/etc/systemd/system` i stället.

## Olika namn i olika familjer

systemd fungerar likadant överallt, men **tjänsterna heter inte alltid
samma sak**. Det beror på vad paketen heter och vilka program distributionen
har valt:

| Tjänst | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| SSH-server | `ssh` (alias `sshd`) | `sshd` | `sshd` |
| Schemalagda jobb (cron) | `cron` | `cronie` (installeras inte från början) | `crond` |
| Nätverk | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Brandvägg | `ufw` (om den installerats) | – | `firewalld` |
| Klocka | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
I {{distro}} heter SSH-tjänsten `ssh.service`. Den har aliaset
`sshd.service`, så `systemctl status sshd` fungerar också – men utskriften
visar det riktiga namnet.
:::

:::arch
Arch installerar nästan inga tjänster från början – du väljer själv. Ingen
cron-tjänst kör till exempel; Arch använder systemd-**timers** i stället. Vill
du ha cron installerar du paketet `cronie` och kör `sudo systemctl enable
--now cronie`. Tänk också på att Arch har `preset: disabled`: nya tjänster
aktiveras aldrig automatiskt när du installerar dem.
:::

:::redhat
Fedora har `firewalld` igång från början, och tidssynkningen sköts av
`chronyd`. Fedora använder också `preset: disabled` för de flesta tjänster:
när du installerar en ny tjänst (till exempel en webbserver) måste du själv
köra `sudo systemctl enable --now …`.
:::

Är du osäker på vad något heter, sök i listan:

```sh
systemctl list-unit-files | grep ssh
```

## Starta om datorn

`enable` märks först när datorn startar om. Det kan du prova i simulatorn –
den startar om på ett ögonblick:

```text
sudo systemctl reboot
```

Efter omstarten kör bara de tjänster som är aktiverade. Med `journalctl -b
-1` ser du loggen från förra uppstarten (och hur allt stängdes av), och
`journalctl --list-boots` visar alla uppstarter som finns i journalen.

## Mer från systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` visar datorns namn, operativsystem och kärna (och byter namn
med `sudo hostnamectl set-hostname NYTTNAMN`). `systemd-analyze` visar hur
lång tid uppstarten tog, och `blame` vilka tjänster som tog längst tid –
perfekt när datorn startar långsamt.
