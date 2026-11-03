# Faktagranskning: schemalaggning (Scheduled jobs with cron)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/schemalaggning.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| cron vaknar varje minut och kör jobben vars tid har kommit | https://manpages.debian.org/cron.8 | ogranskad | |
| Varje användare har en egen crontab; `crontab -l` visar den, `-r` tar bort den, `-e` öppnar en editor | https://manpages.debian.org/crontab.1 | ogranskad | |
| `crontab FIL` och `crontab -` ersätter hela crontab | https://manpages.debian.org/crontab.1 | ogranskad | |
| Fälten är minut, timme, dag i månaden, månad och veckodag (0–7, söndag 0 eller 7) | https://manpages.debian.org/crontab.5 | ogranskad | |
| `*`, intervall `1-5`, listor `1,15` och steg `*/10` | https://manpages.debian.org/crontab.5 | ogranskad | |
| `@reboot`, `@hourly`, `@daily`, `@weekly`, `@monthly` | https://manpages.debian.org/crontab.5 | ogranskad | |
| Anges både dag i månaden och veckodag räcker det att en av dem stämmer | https://manpages.debian.org/crontab.5 | ogranskad | |
| crontab kontrollerar raderna och skriver *errors in crontab file, can't install* (kontrollfråga) | | ogranskad | |
| Jobben körs med `/bin/sh`, en kort `PATH` och i hemkatalogen | https://manpages.debian.org/crontab.5 – environment | ogranskad | |
| Utdata skickas som e-post; utan e-post försvinner den | https://manpages.debian.org/cron.8 | ogranskad | |
| `/etc/crontab` har ett användarfält; `/etc/cron.daily` m.fl. körs med run-parts | https://manpages.debian.org/cron.8 | ogranskad | |
| systemd-timers: en `.timer` startar en `.service`; `systemctl list-timers`; `Persistent=` tar igen missade körningar | https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html | ogranskad | |
| Paket och tjänst: Ubuntu/Debian `cron`, Fedora `cronie`/`crond`, Arch `cronie` (inte förinstallerat) | https://wiki.archlinux.org/title/Cron, https://docs.fedoraproject.org/ | ogranskad | |
