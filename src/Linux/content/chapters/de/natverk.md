# Netzwerk

Fast alles, was ein Linux-Rechner tut, hat damit zu tun, mit anderen Rechnern
zu sprechen: Updates holen, Webseiten anzeigen, sich auf Servern anmelden. Wenn
etwas schiefgeht, hat das Terminal die besten Werkzeuge, um herauszufinden,
warum. In diesem Kapitel lernst du, deine eigene Adresse zu finden,
Verbindungen zu testen, Namen nachzuschlagen, laufende Dienste anzuzeigen,
Dinge aus dem Web zu holen und dich mit SSH auf einem anderen Rechner
anzumelden.

Der simulierte Rechner steht in einem kleinen Heimnetz:

| Rechner | Adresse | Was |
|---|---|---|
| Dein Rechner (`ubuntu`) | `192.168.1.42` | Hier bist du gerade |
| Der Router (Gateway) | `192.168.1.1` | Die Verbindung hinaus ins Internet |
| Der Server | `192.168.1.10` | Ein anderer Linux-Rechner, auf dem du dich anmelden kannst |

Hinter dem Router gibt es ein „Internet“ mit unter anderem `example.com`,
`linux.org` und `archlinux.org`.

## IP-Adressen

Jeder Rechner in einem Netzwerk hat eine **IP-Adresse**. Eine IPv4-Adresse
besteht aus vier Zahlen zwischen 0 und 255, zum Beispiel `192.168.1.42`.
Adressen, die mit `192.168.`, `10.` oder `172.16.`–`172.31.` beginnen, sind
**privat** – sie werden nur in lokalen Netzwerken verwendet und tauchen nie
draußen im Internet auf.

Der Befehl zum Anzeigen der Adressen des Rechners heißt `ip` (aus dem Paket
*iproute2*). `ip addr` lässt sich zu `ip a` abkürzen:

```sh
ip a
```

Du siehst zwei **Interfaces** (Netzwerkkarten):

- `lo` – *Loopback*, eine Schein-Karte, über die der Rechner mit sich selbst
  spricht.
- `enp0s3` – die echte Netzwerkkarte. Früher hießen Karten `eth0`, und
  WLAN-Karten heißen oft so etwas wie `wlan0` oder `wlp2s0`.

Die Zeile `inet 192.168.1.42/24` ist deine IPv4-Adresse. `link/ether` ist die
**MAC-Adresse** der Karte, die fest in der Hardware steckt, und `state UP`
bedeutet, dass die Karte läuft. Für eine kürzere Übersicht gibt es `-br`
(*brief*), und `hostname -I` zeigt nur die Adressen:

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
Eine Zeile pro Schnittstelle: der Name, der Zustand (`UP`) und die Adressen.
```

In vielen Anleitungen siehst du noch den älteren Befehl `ifconfig` (aus dem
Paket *net-tools*), aber in modernen Distributionen ist er standardmäßig nicht
installiert. `ip` kann alles, was er konnte, und mehr.

## localhost – der Rechner selbst

Die Adresse `127.0.0.1` hat den Namen **localhost** und bedeutet immer „dieser
Rechner“. Programme auf demselben Rechner sprechen oft über localhost
miteinander – zum Beispiel ein Webserver, den du gerade entwickelst, und der
Browser, mit dem du ihn testest. Verkehr an localhost verlässt den Rechner nie.

## Netzmaske und Gateway

Das `/24` nach der Adresse ist die **Netzmaske**. Sie besagt, dass die ersten
24 Bit (die ersten drei Zahlen, `192.168.1`) die Adresse des Netzwerks sind.
Alle Rechner, deren Adresse mit `192.168.1.` beginnt, sind im selben lokalen
Netzwerk und direkt erreichbar. Alles andere wird an das **Gateway** geschickt
– den Router –, der es ins Internet weiterleitet. Das siehst du in der
Routing-Tabelle:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

Die erste Zeile, **default**, ist die Standardroute: „Alles, was nirgendwo
sonst aufgeführt ist, geht an 192.168.1.1.“ Die zweite Zeile besagt, dass das
ganze Netzwerk `192.168.1.0/24` direkt über `enp0s3` erreicht wird.
`proto dhcp` bedeutet, dass der Rechner seine Einstellungen automatisch per
**DHCP** vom Router bekommen hat.

```quiz
Dein Rechner hat die Adresse `192.168.1.42/24`. Welche Adressen kann er direkt
erreichen, ohne über das Gateway zu gehen?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
Bei `/24` sind die ersten drei Zahlen die Adresse des Netzwerks. Alles, was mit
`192.168.1.` beginnt, liegt im selben lokalen Netzwerk – alles andere geht über
die Default-Route zum Gateway.
```

```predict
$ ip route | grep default | cut -d' ' -f3
192.168.1.1
---
Das dritte Wort in der `default`-Zeile ist die Adresse des Gateways.
```

## ping – ist er erreichbar?

`ping` schickt kleine Testpakete und misst, wie lange die Antworten brauchen.
Mit `-c` (*count*) legst du fest, wie viele Pakete – sonst macht ping weiter,
bis du **Strg+C** drückst:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` ist die Antwortzeit. Im Heimnetz weniger als eine Millisekunde,
  hinaus ins Internet oft 10–50 ms.
- `0% packet loss` – kein Paket ist verloren gegangen. Verlorene Pakete deuten
  auf ein schlechtes Netzwerk hin (oder eine schlechte WLAN-Verbindung).
- `Destination Host Unreachable` bedeutet, dass kein Rechner im lokalen
  Netzwerk diese Adresse hat.

Versuche auch, den Rechner selbst und einen Rechner draußen im Internet
anzupingen:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

Achtung! Viele Server und Firewalls antworten absichtlich nicht auf ping.
Keine Antwort heißt also nicht immer, dass der Rechner aus ist.

## Namen und DNS

Menschen merken sich Namen, Rechner benutzen Adressen. **DNS** (*Domain Name
System*) ist das Telefonbuch des Internets, das `example.com` in eine
IP-Adresse übersetzt. Welchen DNS-Server der Rechner fragt, steht in
`/etc/resolv.conf`:

```sh
cat /etc/resolv.conf
```

Unter Ubuntu ist die wichtige Zeile `nameserver 127.0.0.53` – das ist
**systemd-resolved**, ein lokaler Vermittler auf deinem eigenen Rechner, der
seinerseits den Router fragt. Manche andere Distributionen tragen den Router,
`192.168.1.1`, direkt ein.

Um DNS selbst zu fragen, benutzt du `dig`, `host` oder `nslookup`. Sie sind
nicht von Anfang an installiert. Unter Ubuntu kommen sie im Paket `dnsutils`
(andere Familien nennen das Paket anders):

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` zeigt die ganze Antwort des DNS-Servers. Der wichtige Teil steht unter
`ANSWER SECTION`. Mit `+short` bekommst du nur die Adresse:

```sh
dig example.com
dig +short example.com
```

`host` und `nslookup` tun dasselbe mit kürzerer Ausgabe. `nslookup` gibt es
auch unter Windows und macOS. `host` kann außerdem einen **Reverse Lookup** –
von der Adresse zum Namen:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

Mit `@` kannst du einen bestimmten DNS-Server fragen, zum Beispiel `1.1.1.1`
von Cloudflare oder `8.8.8.8` von Google:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – die eigene Namensliste des Rechners

Bevor der Rechner DNS fragt, schaut er in die Datei `/etc/hosts`. Dort steht
unter anderem, dass `localhost` `127.0.0.1` ist:

```sh
cat /etc/hosts
```

Der Server im Heimnetz hat die Adresse `192.168.1.10`, aber der Name
`server.lan` steht in keinem DNS:

```sh
ping -c 1 server.lan
```

Die Lösung ist, eine Zeile in `/etc/hosts` einzufügen. Die Datei gehört root,
also brauchst du `sudo`. Aber Vorsicht – so funktioniert es **nicht**:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` gilt nur für `echo`. Es ist deine eigene Shell (die als du läuft, nicht
als root), die die Datei für `>>` öffnet. Der Trick ist `tee -a`, das hinten an
eine Datei anhängt, was es aus der Pipe bekommt – und `tee` lässt sich mit sudo
ausführen:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Jetzt funktioniert der Name für jedes Programm auf dem Rechner. Aber `dig`
fragt direkt das DNS und ignoriert `/etc/hosts`, findet also immer noch nichts.
Um zu sehen, was das *System* auflöst, nimmst du `getent`:

```sh
dig +short server.lan
getent hosts server.lan
```

`dig` gibt nichts aus, aber `getent` antwortet mit der Adresse, gefolgt vom
Namen:

```text
192.168.1.10    server.lan
```

Die Reihenfolge (zuerst die Datei, dann DNS) legt die Zeile `hosts: files dns`
in `/etc/nsswitch.conf` fest.

```quiz
Warum ergibt `sudo echo '192.168.1.10 server.lan' >> /etc/hosts`
*Permission denied*?
- [ ] `echo` kann nicht mit sudo ausgeführt werden
- [x] Deine eigene Shell, nicht root, öffnet die Datei für `>>` – sudo gilt nur für `echo`
- [ ] `/etc/hosts` kann nicht geändert werden, nicht einmal von root
- [ ] `>>` funktioniert nur mit Dateien in deinem Home-Verzeichnis
---
Deshalb nimmst du `echo ... | sudo tee -a /etc/hosts`: Dann ist es `tee`, das
als root läuft und die Datei öffnet.
```

## Ports und Dienste

Eine IP-Adresse bezeichnet einen Rechner. Ein **Port** (eine Zahl zwischen 1
und 65535) bezeichnet ein Programm auf diesem Rechner – wie Straßenadresse und
Wohnungsnummer. Von einem Programm, das auf Verbindungen wartet, sagt man, es
**lauscht** (*listen*) auf einem Port. Einige bekannte:

| Port | Dienst |
|---|---|
| 22 | SSH – auf anderen Rechnern anmelden |
| 53 | DNS |
| 80 | HTTP – Web |
| 443 | HTTPS – verschlüsseltes Web |
| 8080 | Oft Webserver während der Entwicklung |

Nur root darf Ports unter 1024 öffnen. `ss` (*socket statistics*) zeigt,
welche Ports lauschen:

```sh
ss -tulpn
```

Die Flags merkt man sich meist wie einen Spruch: **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric. `0.0.0.0:22` bedeutet, dass `sshd`
auf Port 22 an allen Adressen des Rechners lauscht, und `[::]:22` ist dasselbe
für IPv6. Die Spalte *Process* ist bei Prozessen anderer Benutzer leer – mit
`sudo` siehst du alle:

```sh
sudo ss -tulpn
```

Wenn der Übungsserver `myserver` aus dem Kapitel über Prozesse läuft, siehst du
ihn hier auf Port 8080. Der ältere Befehl `netstat -tulpn` (aus *net-tools*)
macht dasselbe.

## Aus dem Web holen: curl und wget

`curl` holt, was unter einer Adresse (einer **URL**) liegt, und gibt es im
Terminal aus. Probiere es mit myserver auf deinem eigenen Rechner:

Unter Ubuntu ist `curl` nicht vorinstalliert (`wget` aber schon):

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

Bekommst du `Couldn't connect to server`? Dann lauscht nichts auf dem Port –
vielleicht hast du myserver im Kapitel über Prozesse beendet. Starte ihn neu:

```sh
myserver
```

Mit `-I` zeigt curl nur die **Header** der Antwort, deren erste Zeile ein
**Statuscode** ist:

```sh
curl -I https://example.com
```

| Code | Bedeutet |
|---|---|
| 200 | OK |
| 301, 302 | Die Seite ist umgezogen – siehe `Location:` |
| 403 | Verboten |
| 404 | Nicht gefunden |
| 500 | Serverfehler |

Viele Websites leiten von `http://` auf `https://` um. Dann bekommst du nur
ein kurzes „301 Moved Permanently“. Mit `-L` folgt curl der Umleitung:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Da curl ins Terminal schreibt, eignet es sich hervorragend für eine Pipe. `-s`
(*silent*) schaltet die Fortschrittsanzeige ab:

```sh
curl -s https://example.com | grep title
```

Um in eine Datei zu speichern, nimmst du `-o FILE` (oder `-O`, das den
Dateinamen aus der Adresse übernimmt):

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` ist zum Herunterladen von Dateien gemacht. Es speichert immer in eine
Datei, zeigt den Fortschritt und folgt Umleitungen von selbst:

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

Um den Dateinamen selbst zu wählen, nimmst du ein großes `-O`:
`wget -O file.html URL`.

## SSH – auf einem anderen Rechner anmelden

**SSH** (*Secure Shell*) ist der übliche Weg, einen Linux-Rechner aus der Ferne
zu steuern, und alles, was übertragen wird, ist verschlüsselt. Auf dem Server
läuft der Dienst `sshd` auf Port 22, und du verbindest dich mit dem Client
`ssh`:

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` bedeutet „der Benutzer {{user}} auf dem Rechner server.lan“. Der
Befehl nach dem Host (`hostname`) läuft auf dem Server, und die Antwort wird
hier angezeigt – dort steht `server`, nicht `ubuntu`.

Wenn du dich zum ersten Mal mit einem Rechner verbindest, fragt ssh, ob du ihm
vertraust:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Tippe `yes` (das ganze Wort). Der **Host-Key** des Servers wird dann in
`~/.ssh/known_hosts` gespeichert. Ändert sich der Schlüssel später, warnt ssh
lautstark – es könnte bedeuten, dass sich jemand als der Server ausgibt.

Der Befehl kann auch aus mehreren Befehlen in Anführungszeichen bestehen:

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

Ohne Befehl meldet ssh dich an, und du bekommst eine Shell auf dem anderen
Rechner, die du mit `exit` verlässt. Das wird im Simulator nicht unterstützt –
dort schreibst du den Befehl immer direkt hinter den Host.

### Schlüssel statt Passwörter

Statt mit einem Passwort kannst du dich mit einem **Schlüsselpaar** anmelden.
Der private Schlüssel bleibt bei dir, der öffentliche kommt auf den Server:

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

Drücke bei den Fragen von `ssh-keygen` Enter, um die Standarddatei
`~/.ssh/id_ed25519` ohne Passphrase zu verwenden. `ssh-copy-id` fügt den
öffentlichen Schlüssel (`id_ed25519.pub`) in `~/.ssh/authorized_keys` auf dem
Server ein. Danach fragt ssh nicht mehr nach einem Passwort. Zeige den privaten
Schlüssel niemals jemandem!

Wie du mit `scp` und `rsync` Dateien über SSH kopierst und Servern in
`~/.ssh/config` kurze Namen gibst, lernst du im nächsten Kapitel.

## Wenn das Netzwerk nicht funktioniert

„Das Internet geht nicht“ kann viele Ursachen haben. Geh die Schritte der Reihe
nach durch, von innen nach außen – der erste Schritt, der fehlschlägt, zeigt,
wo das Problem liegt:

| Schritt | Befehl | Wenn es fehlschlägt |
|---|---|---|
| 1. Habe ich eine Adresse? | `ip a` | Die Karte ist aus (`state DOWN`) oder hat keine Adresse bekommen |
| 2. Gibt es einen Weg nach draußen? | `ip route` | Keine `default`-Zeile – kein Gateway |
| 3. Erreiche ich den Router? | `ping -c 3 192.168.1.1` | Problem im lokalen Netzwerk (Kabel, WLAN) |
| 4. Erreiche ich das Internet? | `ping -c 3 1.1.1.1` | Problem beim Router oder beim Provider |
| 5. Funktioniert DNS? | `ping -c 3 example.com` | Namensauflösung schlägt fehl – prüfe `/etc/resolv.conf` |

Schritt 4 pingt direkt eine Adresse an, ganz ohne Namen. Wenn Schritt 4
funktioniert, Schritt 5 aber nicht, ist fast immer DNS kaputt – eines der
häufigsten Probleme.

```quiz
`ping -c 3 1.1.1.1` funktioniert, aber `ping -c 3 example.com` antwortet mit
*Name or service not known*. Wo liegt das Problem am wahrscheinlichsten?
- [ ] Die Netzwerkkarte ist aus
- [ ] Es gibt keine Default-Route
- [x] DNS – die Namensauflösung funktioniert nicht
- [ ] example.com antwortet nicht auf ping
---
Wenn du eine Adresse im Internet erreichst, funktionieren Karte, Route und
Router. Übrig bleibt die Übersetzung des Namens – prüfe `/etc/resolv.conf`.
```

Probiere es selbst! Schalte die Netzwerkkarte ab, geh die Schritte durch und
schalte sie danach wieder ein:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## Die Pakete

Die Netzwerkwerkzeuge stecken in verschiedenen Paketen. Unter Ubuntu heißen
sie:

| Werkzeug | Paket unter Ubuntu |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

Wie üblich nennen andere Familien manche der Pakete anders – um solche
Unterschiede geht es im Teil über Distributionen und Pakete.

`traceroute` zeigt jeden Router, den die Pakete unterwegs passieren.
Installiere es und probiere `traceroute example.com`!

## Zusammenfassung

| Befehl | Macht |
|---|---|
| `ip a` | IP-Adressen anzeigen |
| `ip route` | Routing-Tabelle und Gateway anzeigen |
| `ping -c 3 HOST` | Testen, ob ein Rechner erreichbar ist |
| `dig +short NAME` | Einen Namen im DNS nachschlagen |
| `getent hosts NAME` | So nachschlagen, wie das System es tut (mit `/etc/hosts`) |
| `ss -tulpn` | Lauschende Ports anzeigen |
| `curl URL` | Holen und anzeigen |
| `curl -o FILE URL`, `wget URL` | In eine Datei herunterladen |
| `ssh USER@HOST COMMAND` | Einen Befehl auf einem anderen Rechner ausführen |
