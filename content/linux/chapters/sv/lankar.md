# Länkar och filinformation

En fils namn och dess innehåll är två olika saker i Linux. I det här kapitlet
använder du det för att göra genvägar med **länkar**, du lär dig undersöka
filer med `stat` och `file`, och du bestämmer vilka rättigheter nya filer får
med `umask`.

## Namn och inoder

En fils innehåll – tillsammans med ägare, rättigheter och tider – lagras i en
**inod**. En katalog är bara en lista med namn, och varje namn pekar på en
inod. `ls -i` visar inodnumret framför varje namn:

```sh
ls -i
```

## Symboliska länkar – `ln -s`

En **symbolisk länk** (*symlänk*) är en liten fil som innehåller sökvägen till
något annat – en genväg. Målet kommer först och länkens namn sist, precis som
med `cp`:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

`l` först på raden och pilen `->` visar att det är en länk. Länkens
rättigheter är alltid `rwxrwxrwx` – de spelar ingen roll, det är målets
rättigheter som gäller.

Nästan alla kommandon följer länken: `ls ~/log/`, `cat`, `cd` och så vidare.
`cd` kommer ihåg vägen du gick, och `pwd -P` visar var du egentligen är:

```sh
cd ~/log
pwd
pwd -P
```

### Relativa länkar

En relativ sökväg i en länk räknas från katalogen **där länken ligger** –
inte från där du står när du skapar den:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

Det fungerar, eftersom länken ligger i hemkatalogen och
`{{documents}}/{{fruits}}` finns där. En länk `/tmp/f` med samma innehåll
skulle leta efter `/tmp/{{documents}}/{{fruits}}` – och vara trasig.

`readlink` visar vad som står i en länk, och `realpath` visar hela sökvägen
med alla länkar följda:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Trasiga länkar

En länk kan peka på något som inte finns:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
Länken finns, men inte filen den pekar på. `ls -l` visar en trasig länk i
rött, och `find ~ -type l` hittar alla länkar i hemkatalogen.
```

`rm` tar bort själva länken, aldrig det den pekar på.

```quiz
Du har länken `~/log -> /var/log` och kör `rm ~/log`. Vad händer?
- [ ] `/var/log` och allt i den tas bort
- [x] Bara länken tas bort – `/var/log` lämnas i fred
- [ ] `rm` vägrar, eftersom `~/log` är en katalog
---
`rm` arbetar med själva länken. För att ta bort målet hade du behövt skriva
målet.
```

### Här möter du länkar

Länkar finns överallt i ett Linuxsystem. `python3` är ofta en länk till en
viss version, som `python3.12`, och när du senare gör så att en tjänst startar
vid uppstart med `systemctl enable` skapar systemd en länk till tjänstens
unit-fil. Titta på tjänsterna som startar vid uppstart:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Hårda länkar – `ln`

Utan `-s` skapar `ln` en **hård länk**: ett namn till för samma inod.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{todo}}
```

Båda namnen har samma inodnummer, och siffran efter rättigheterna –
**antalet länkar** – är nu 2. Det är samma fil: en ändring genom det ena namnet
syns genom det andra. Tar du bort ett av namnen lever innehållet kvar så länge
filen har minst ett namn kvar.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` och `b.txt` var samma fil. Raden som skrevs genom `b.txt` finns kvar
efter att `b.txt` togs bort.
```

| | Symbolisk länk (`ln -s`) | Hård länk (`ln`) |
|---|---|---|
| Är | En liten fil med en sökväg | Ett namn till för samma inod |
| Till en katalog | Ja | Nej |
| Till ett annat filsystem | Ja | Nej – inoder hör till ett filsystem |
| Om originalet tas bort | Länken går sönder | Filen lever kvar |
| I `ls -l` | `l` och `->` | Antalet länkar ökar |

```quiz
Vilken sorts länk kan peka på en katalog?
- [x] Bara en symbolisk länk
- [ ] Bara en hård länk
- [ ] Båda
---
Hårda länkar till kataloger är inte tillåtna. För en genväg till en katalog
använder du `ln -s`.
```

## Allt om en fil – `stat`

`stat` visar allt som inoden vet:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

Du får storleken, inodnumret, antalet länkar, rättigheterna både som siffror
(`0644`) och som bokstäver, ägaren och gruppen, och när filen lästes, ändrades
och fick nya egenskaper. Med `-c` väljer du exakt vad som visas: `%a` är
rättigheterna som siffror, `%U` ägaren och `%n` namnet.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## Vad finns i den? – `file`

Linux bryr sig inte om filändelser: en fil som heter `.jpg` kan innehålla vad
som helst. `file` tittar på innehållet i stället:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
Namnet slutar på `.jpg`, men innehållet är text – och det är innehållet som
`file` går efter.
```

## Rättigheter för nya filer – `umask`

Nya filer får rättigheterna `rw-rw-rw-` (666) och nya kataloger `rwxrwxrwx`
(777) – minus bitarna i **umask**. `umask` visar den:

```sh
umask
```

Den vanliga umasken `0022` tar bort skrivrätten för gruppen och övriga, och
därför får dina filer `644` och dina kataloger `755`.

| umask | Nya filer | Nya kataloger | Betyder |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | Det vanliga |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | Gruppen får läsa, övriga ingenting |
| `077` | `600` `rw-------` | `700` `rwx------` | Bara du |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 minus 027: gruppen förlorar `w`, och övriga förlorar allt.
```

`umask` påverkar bara filer som skapas efteråt, och bara i skalet där du körde
den. Vill du behålla en umask lägger du raden i `~/.bashrc`.

```quiz
Din umask är `077`. Vilka rättigheter får en ny katalog?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Kataloger utgår från 777. 777 minus 077 blir 700: allt för dig, ingenting
för någon annan.
```
