# Filöverföring och SSH-inställningar

I nätverkskapitlet körde du kommandon på servern `192.168.1.10` med `ssh`. Här
ger du servern ett kort namn, kopierar filer till och från den med `scp` och
håller hela kataloger i synk med `rsync`.

## Korta namn – `~/.ssh/config`

Att skriva `ssh {{user}}@192.168.1.10` varje gång blir tjatigt. I filen
`~/.ssh/config` kan du ge en server ett kort namn:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` är det korta namnet, `HostName` den riktiga adressen (eller namnet) och
`User` användarnamnet på servern. Lyssnar servern på en annan port än 22
lägger du till en rad som `Port 2222`. Sedan räcker det med:

```sh
ssh srv hostname
```

Simulatorn har ingen texteditor än, så skriv filen med `echo`. Indraget finns
bara för att göra filen lättare att läsa:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh är noga med filen. Får andra skriva i den vägrar ssh med *Bad owner or
permissions*, och ett felstavat ord stoppar den direkt:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh läser hela filen innan den ansluter, så ett enda fel ord stoppar alla
anslutningar – och felmeddelandet säger vilken rad det står på.
```

Namnen fungerar för `scp` och `rsync` också.

```quiz
Vilken rad i `~/.ssh/config` säger vart ssh egentligen ska ansluta?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` är det korta namnet du själv skriver, `HostName` den riktiga adressen
och `User` vem du loggar in som.
```

## Kopiera – `scp`

`scp` (*secure copy*) fungerar som `cp`, men ena sidan kan ligga på en annan
dator. Du skriver den `VÄRD:SÖKVÄG`:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- Källan kommer först och målet sist, precis som med `cp`.
- En sökväg efter kolonet räknas från din hemkatalog på servern, och `srv:`
  ensamt betyder hemkatalogen.
- Kataloger kräver `-r`.
- Porten anges med stort `-P` (med `ssh` är det litet `-p`).

För varje fil visar `scp` en rad med namnet, `100%`, storleken och hastigheten.

```quiz
Du skriver `scp rapport.txt srv` – utan kolon. Vad händer?
- [ ] Filen kopieras till din hemkatalog på servern
- [x] Du får en lokal kopia som heter `srv`
- [ ] scp frågar vilken dator du menar
---
Utan kolon är `srv` bara ett filnamn, och `scp` kopierar lokalt som `cp`. Det
är lätt att glömma kolonet!
```

## Hålla i synk – `rsync`

För många filer, eller något du kopierar om och om igen (säkerhetskopior!), är
`rsync` bättre. Den kopierar bara det som saknas eller har ändrats:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{grades}}
{{fruits}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) kopierar kataloger rekursivt och behåller rättigheter och
tider, och `-v` listar det som kopieras. Kör samma kommando igen så är listan
tom – inget har ändrats. rsync jämför varje fils storlek och ändringstid; utan
`-a` får kopiorna nya tider, och allt skickas varje gång.

### Snedstrecket sist

Ett snedstreck sist i källan är viktigt:

| Kommando | Ger |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – själva katalogen |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – bara det som finns i den |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Utan snedstreck kopierades själva katalogen in i `/tmp/x`.
```

### Över SSH och `--delete`

Med en server som mål går rsync över ssh:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` tar också bort filer i målet som inte längre finns i källan, så att
målet blir en exakt kopia. En felskriven sökväg kan då ta bort mycket, så prova
först med `-n` (*dry run*). Inget händer, rsync visar bara vad den skulle göra,
och sista raden slutar med `(DRY RUN)`:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
Vad gör `-n` i `rsync -avn --delete a/ b/`?
- [ ] Kopierar bara nya filer
- [x] Visar vad som skulle hända utan att göra något
- [ ] Hoppar över filerna som skulle tas bort
---
`-n` är en provkörning. Kontrollera listan först – och kör sedan samma kommando
utan `-n`.
```

## scp eller rsync?

| | `scp` | `rsync` |
|---|---|---|
| Bra för | Några filer, en gång | Säkerhetskopior och att kopiera om och om igen |
| Skickar | Allt, varje gång | Bara det som ändrats |
| Lokalt också | Fungerar, men `cp` är enklare | Ja |
| Spegla med `--delete` | Nej | Ja |

`scp` följer med ssh-klienten. `rsync` måste finnas på båda datorerna: den
finns från början i Ubuntu, Debian och Fedora, medan du i Arch installerar
paketet `rsync`.

I simulatorn glömmer servern sina filer när du stänger appen.
