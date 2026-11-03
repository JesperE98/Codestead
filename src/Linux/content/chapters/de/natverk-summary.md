# Zusammenfassung: Netzwerk

In diesem Teil hast du dich vom Terminal aus in einem kleinen Heimnetz
zurechtgefunden: deine eigene Adresse, der Weg hinaus ins Internet, Namen und
DNS, Ports, das Web und andere Rechner über SSH.

## Netzwerk

Jeder Rechner in einem Netzwerk hat eine **IP-Adresse**, und Adressen, die mit
`192.168.`, `10.` oder `172.16.`–`172.31.` beginnen, sind **privat**. `ip a`
zeigt die Schnittstellen und Adressen des Rechners – `lo` ist die
Loopback-Karte, und `127.0.0.1` (**localhost**) bedeutet immer den Rechner
selbst. Die **Netzmaske** (`/24`) sagt, welche Adressen im lokalen Netz
liegen; alles andere geht über die Standardroute zum **Gateway**, das
`ip route` anzeigt. `ping` testet, ob ein Rechner erreichbar ist.

**DNS** übersetzt Namen in Adressen. Bevor der Rechner DNS fragt, schaut er
in `/etc/hosts`, und `getent hosts` zeigt, was das System auflöst, während
`dig` direkt DNS fragt. Unter Ubuntu zeigt `/etc/resolv.conf` auf
`127.0.0.53`, systemd-resolved, und `dig`, `host` und `nslookup` stecken im
Paket `dnsutils`.

Ein **Port** bezeichnet ein Programm auf einem Rechner, und `ss -tulpn` zeigt,
welche Ports lauschen. `curl` holt eine URL und gibt sie aus, `wget` lädt in
eine Datei herunter – unter Ubuntu ist `wget` vorinstalliert, und `curl` wird
mit apt installiert. Mit **SSH** führst du verschlüsselt Befehle auf einem
anderen Rechner aus; beim ersten Mal bestätigst du den Host-Key des Servers,
und mit einem Schlüsselpaar brauchst du kein Passwort mehr.

In `~/.ssh/config` gibst du Servern mit `Host`, `HostName` und `User` kurze
Namen. `scp` kopiert wie `cp`, aber eine Seite wird als `HOST:PATH`
geschrieben, relativ zum Home-Verzeichnis dort. `rsync -av` kopiert nur, was
sich geändert hat; ein Schrägstrich am Ende der Quelle bedeutet „was im
Verzeichnis ist“, und `--delete` macht das Ziel zu einer exakten Kopie –
probiere es zuerst mit `-n` aus.

Wenn „das Internet nicht geht“, arbeite dich von innen nach außen vor:
Adresse, Route, Router, eine Adresse im Internet und zuletzt ein Name.
Funktionieren Adressen, aber keine Namen, liegt es an DNS.

## Befehle

| Befehl | Tut |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | IP-Adressen anzeigen |
| `ip route` | Die Routingtabelle und das Gateway anzeigen |
| `ping -c 3 HOST` | Testen, ob ein Rechner erreichbar ist |
| `sudo ip link set CARD down` / `up` | Eine Netzwerkkarte aus- / einschalten |
| `cat /etc/resolv.conf` | Welcher DNS-Server gefragt wird |
| `dig +short NAME`, `dig @SERVER NAME` | Einen Namen in DNS nachschlagen |
| `host NAME`, `nslookup NAME` | Einen Namen nachschlagen (mit `host` auch von Adresse zu Name) |
| `getent hosts NAME` | Nachschlagen wie das System (mit `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Was aus einer Pipe kommt, als root an `/etc/hosts` anhängen |
| `ss -tulpn` | Lauschende Ports anzeigen |
| `curl URL` | Holen und anzeigen |
| `curl -I URL`, `curl -L URL` | Nur die Header, Weiterleitungen folgen |
| `curl -o FILE URL`, `wget URL`, `wget -O FILE URL` | In eine Datei herunterladen |
| `ssh USER@HOST COMMAND` | Einen Befehl auf einem anderen Rechner ausführen |
| `ssh-keygen`, `ssh-copy-id USER@HOST` | Ein Schlüsselpaar erzeugen und den öffentlichen Schlüssel auf den Server legen |
| `ssh srv` mit `Host srv` in `~/.ssh/config` | Mit einem kurzen Namen anmelden |
| `scp FILE HOST:` · `scp HOST:FILE .` · `scp -r` | Auf einen · von einem anderen Rechner kopieren · ganze Verzeichnisse |
| `rsync -av SOURCE/ TARGET` | Nur kopieren, was sich geändert hat |
| `rsync -avn --delete SOURCE/ TARGET` | Einen Spiegel ausprobieren, ohne etwas zu tun |
