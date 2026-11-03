# Prov: Nätverk

Visa vad du har lärt dig om adresser, namn, portar, webben och SSH. Frågorna
täcker hela delen, och du behöver 80 % rätt för godkänt.

```quiz
Vilka av de här adresserna är **privata** – används bara inne i lokala nät?
(Välj alla som stämmer.)
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
En webbserver som du utvecklar körs på din egen dator. Vart tar trafiken
vägen när du testar den på `http://localhost:8080`?
- [ ] Ut till routern och tillbaka
- [x] Ingenstans – trafik till localhost lämnar aldrig datorn
- [ ] Till DNS-servern, som skickar tillbaka den
- [ ] Till `192.168.1.1`
```

```try
ip route
---
Raden `default` visar gatewayen som allt annat skickas till.
```

Raden för `localhost` i `/etc/hosts` är det som systemet hittar. Vad skriver
det här ut?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

Vilken DNS-server frågar Ubuntu, enligt `/etc/resolv.conf`?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` är systemd-resolved, en lokal mellanhand på din egen dator som i
sin tur frågar routern.
```

```quiz
Du kör `ping 192.168.1.1` utan några flaggor. När slutar det?
- [ ] Efter 3 paket
- [ ] Efter ett paket
- [x] När du trycker Ctrl+C
- [ ] När det första svaret kommer
---
Med `-c` väljer du hur många paket som ska skickas.
```

I vilken ordning systemet slår upp namn bestäms i `/etc/nsswitch.conf`. Vad
skriver det här ut?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
Först filen (`/etc/hosts`), sedan DNS.
```

```quiz
Du har lagt till `server.lan` i `/etc/hosts`. `ping server.lan` fungerar, men
`dig +short server.lan` skriver inte ut något. Varför?
- [ ] Raden i `/etc/hosts` är fel
- [x] `dig` frågar DNS direkt och struntar i `/etc/hosts`
- [ ] `dig` behöver `sudo`
- [ ] `ping` använder inte namn
---
För att se vad *systemet* slår upp använder du `getent hosts server.lan`.
```

```quiz
`myserver` lyssnar på port 8080 och körs som en vanlig användare. Vad skulle
vara annorlunda om den lyssnade på port 80?
- [ ] Ingenting
- [x] Bara root får öppna portar under 1024
- [ ] Port 80 är bara till för SSH
- [ ] Port 80 går inte att använda på localhost
```

```quiz
`curl -I http://linux.org` svarar `301 Moved Permanently`. Hur får du den
egentliga sidan?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org` – följ omdirigeringen
- [ ] `curl -o http://linux.org`
- [ ] Det går inte – 301 betyder att sidan är borta
```

```quiz
Du ansluter till `server.lan` med ssh, och ssh varnar högljutt för att
serverns värdnyckel har ändrats. Vad kan det betyda?
- [ ] Ditt lösenord har gått ut
- [x] Någon kan låtsas vara servern
- [ ] Servern har fått en ny användare
- [ ] Ditt nyckelpar är trasigt
---
Värdnyckeln sparades i `~/.ssh/known_hosts` första gången du anslöt.
```

```quiz
Du vill logga in på servern med ett nyckelpar i stället för ett lösenord.
Vilken nyckel läggs på servern?
- [x] Den publika nyckeln, `id_ed25519.pub`
- [ ] Den privata nyckeln, `id_ed25519`
- [ ] Båda
- [ ] Ingen – servern skapar en egen
---
`ssh-copy-id` lägger till den publika nyckeln i `~/.ssh/authorized_keys` på
servern. Visa aldrig den privata nyckeln för någon!
```

```quiz
`ip a` visar en adress, och du kan pinga andra datorer i `192.168.1.0/24`,
men ingenting ute på internet. `ip route` har ingen rad `default`. Vad är
fel?
- [ ] DNS
- [x] Det finns ingen gateway – ingenting vet vart trafik utanför det lokala nätet ska skickas
- [ ] Nätverkskortet är avstängt
- [ ] `/etc/hosts` saknas
```

```quiz
Du vill att `/tmp/x` ska innehålla filerna som finns i `{{documents}}`, inte en katalog `{{documents}}`. Vilket kommando är rätt?
- [ ] `rsync -a {{documents}} /tmp/x`
- [x] `rsync -a {{documents}}/ /tmp/x`
- [ ] `scp {{documents}} /tmp/x`
---
Snedstrecket sist i källan betyder "det som finns i katalogen".
```
