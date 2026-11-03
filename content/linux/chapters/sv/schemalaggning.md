# Schemalagda jobb med cron

En säkerhetskopia varje natt, städa bort gamla loggar varje vecka, hämta data
var femte minut – datorn kan köra kommandon på egen hand på bestämda tider. Det
klassiska verktyget för det är **cron**, och systemd har sina egna **timers**.

## cron och crontab

Tjänsten cron vaknar varje minut och kör de jobb vars tid har kommit. Varje
användare har sin egen lista med jobb, en **crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* betyder att du inte har några jobb än.

## De fem tidsfälten

Varje rad i en crontab har fem tidsfält och sedan kommandot:

```text
┌───────────── minut (0–59)
│ ┌─────────── timme (0–23)
│ │ ┌───────── dag i månaden (1–31)
│ │ │ ┌─────── månad (1–12)
│ │ │ │ ┌───── veckodag (0–7, söndag är 0 eller 7)
│ │ │ │ │
* * * * *  kommando
```

| Du skriver | Betyder |
|---|---|
| `*` | Varje |
| `5` | Exakt 5 |
| `1-5` | 1 till 5 |
| `1,15` | 1 och 15 |
| `*/10` | Var tionde: 0, 10, 20 … |

| Rad | Körs |
|---|---|
| `* * * * * kommando` | Varje minut |
| `*/5 * * * * kommando` | Var femte minut |
| `30 2 * * * kommando` | Klockan 02.30 varje natt |
| `0 7 * * 1-5 kommando` | Klockan 07.00 måndag till fredag |
| `0 0 1 * * kommando` | Vid midnatt den första varje månad |
| `@reboot kommando` | En gång, när datorn startar |

`@hourly`, `@daily`, `@weekly` och `@monthly` finns också som genvägar.

```quiz
När körs jobbet `15 8 * * 6 ~/backup.sh`?
- [ ] Klockan 15.08 varje dag
- [x] Klockan 08.15 varje lördag
- [ ] Den 15:e varje månad klockan 08.00
---
Ordningen är minut, timme, dag i månaden, månad och veckodag: minut 15,
timme 8, vilket datum som helst, vilken månad som helst, dag 6 – lördag.
```

```quiz
Hur ofta körs `0 */2 * * * kommando`?
- [ ] Varannan minut
- [x] Varannan timme, på hela timmen
- [ ] Två gånger om dagen
---
Minut 0 och var andra timme: 00.00, 02.00, 04.00 …
```

## Installera jobb

`crontab -e` öppnar din crontab i en texteditor och installerar den när du
sparar. Simulatorn har ingen editor än, så här ger du `crontab` jobben på dess
indata – `-` betyder "läs från indata":

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Se upp: `crontab -` och `crontab FIL` **ersätter** hela crontab. Vill du lägga
till ett jobb kombinerar du de gamla jobben med det nya:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

För att ta bort en rad filtrerar du bort den med `grep -v` och installerar
resten – eller tar bort allt med `crontab -r`:

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` kontrollerar raderna innan den installerar något:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
Det finns ingen timme 25 – timmarna går från 0 till 23. Inget installerades.
```

## Se den köra

När du har installerat jobbet som körs varje minut väntar du en minut och
tittar:

```sh
cat ~/cron.log
journalctl -u cron
```

Varje körning skrivs i journalen, som
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. I simulatorn kör cron bara
medan appen är öppen – precis som en riktig dator tar den inte igen jobben den
missade medan den var avstängd.

## Cron-fällan: en annan miljö

Jobben körs inte i din terminal, och det överraskar nästan alla:

- De körs med `/bin/sh`, utan dina alias och din `~/.bashrc`.
- `PATH` är kort (`/usr/bin:/bin`), så program på andra ställen behöver hela
  sökvägen.
- De startar i din hemkatalog.
- Utdata som inte skickas till en fil försvinner. Avsluta alltid raden med
  till exempel `>> ~/jobb.log 2>&1`.

Kör kommandot för hand först. När det fungerar där lägger du det i crontab.

```quiz
Jobbet `* * * * * echo hi` körs varje minut, men du ser aldrig `hi` någonstans.
Varför?
- [ ] cron tillåter inte `echo`
- [x] Utdata har ingenstans att ta vägen – skicka den till en fil med `>>`
- [ ] Jobb körs bara som root
---
Utdata från cron-jobb visas inte i någon terminal. Riktig cron försöker
skicka den som e-post, och de flesta datorer har ingen e-post – så den
försvinner.
```

## Systemets egna jobb

Förutom användarnas crontab finns `/etc/crontab` och kataloger som
`/etc/cron.daily` och `/etc/cron.weekly`. Skripten i dem körs en gång om dagen
eller en gång i veckan:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

Raderna i `/etc/crontab` har ett fält till före kommandot: användaren som
jobbet körs som.

## systemd-timers

I moderna distributioner sköts mycket av det här av systemd-**timers** i
stället: en `.timer`-enhet som startar en `.service`-enhet på bestämda tider.
De loggar i journalen och kan ta igen körningar de missat, men varje jobb
behöver två unit-filer. För dina egna små jobb är cron snabbast. Lista
datorns timers, med nästa och föregående körning:

```try
systemctl list-timers
```

## I andra distributioner

| | Ubuntu och Debian | Fedora | Arch |
|---|---|---|---|
| Paket | `cron` | `cronie` | `cronie` |
| Tjänst | `cron` | `crond` | `cronie` |
| Installerat från början | Ja | Ja | Nej |

I Arch börjar du med `sudo pacman -S cronie` och
`sudo systemctl enable --now cronie`.
