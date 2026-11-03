# Faktagranskning: filoverforing (Copying files over SSH)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/filoverforing.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `~/.ssh/config` ger värdar korta namn med `Host`, `HostName`, `User` och `Port` | https://man.openbsd.org/ssh_config | ogranskad | |
| För varje parameter används det första värdet som hittas | https://man.openbsd.org/ssh_config – DESCRIPTION | ogranskad | |
| ssh vägrar använda filen om andra får skriva i den (*Bad owner or permissions*) | https://man.openbsd.org/ssh_config – FILES | ogranskad | |
| Ett okänt nyckelord ger *Bad configuration option* och ssh avslutar | | ogranskad | |
| `scp` kopierar över SSH; fjärrsidan skrivs `[användare@]värd:sökväg`, relativ till hemkatalogen | https://man.openbsd.org/scp | ogranskad | |
| `scp -r` kopierar kataloger, `scp -P` anger porten (stort P) | https://man.openbsd.org/scp | ogranskad | |
| Utan kolon är målet ett lokalt filnamn | https://man.openbsd.org/scp | ogranskad | |
| `rsync` skickar bara filer som saknas eller ändrats; standardjämförelsen är storlek och ändringstid | https://manpages.debian.org/rsync – "quick check" | ogranskad | |
| `-a` = rekursivt och behåll rättigheter, tider m.m.; `-v` listar filerna | https://manpages.debian.org/rsync | ogranskad | |
| Ett snedstreck sist i källan kopierar innehållet, utan det kopieras katalogen själv | https://manpages.debian.org/rsync – USAGE | ogranskad | |
| `--delete` tar bort filer i målet som inte finns i källan; `-n` är en provkörning som slutar med `(DRY RUN)` | https://manpages.debian.org/rsync | ogranskad | |
| rsync måste finnas på båda datorerna och går över ssh | https://manpages.debian.org/rsync | ogranskad | |
| rsync är förinstallerat i Ubuntu, Debian och Fedora men inte i Arch | | ogranskad | |
