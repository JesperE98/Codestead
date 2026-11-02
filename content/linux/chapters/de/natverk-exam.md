# Prüfung: Netzwerk

Zeig, was du über Adressen, Namen, Ports, das Web und SSH gelernt hast. Die
Fragen decken den ganzen Teil ab, und zum Bestehen brauchst du 80 % richtig.

```quiz
Welche dieser Adressen sind **privat** – werden also nur in lokalen Netzen
verwendet? (Wähle alle passenden aus.)
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
Ein Webserver, den du entwickelst, läuft auf deinem eigenen Rechner. Wohin
geht der Verkehr, wenn du ihn unter `http://localhost:8080` testest?
- [ ] Hinaus zum Router und zurück
- [x] Nirgendwohin – Verkehr an localhost verlässt nie den Rechner
- [ ] Zum DNS-Server, der ihn zurückschickt
- [ ] An `192.168.1.1`
```

```try
ip route
---
Die Zeile `default` zeigt das Gateway, an das alles andere geschickt wird.
```

Die Zeile für `localhost` in `/etc/hosts` ist das, was das System findet. Was
gibt das hier aus?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

Welchen DNS-Server fragt Ubuntu laut `/etc/resolv.conf`?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` ist systemd-resolved, ein lokaler Vermittler auf deinem eigenen
Rechner, der seinerseits den Router fragt.
```

```quiz
Du führst `ping 192.168.1.1` ohne Optionen aus. Wann hört es auf?
- [ ] Nach 3 Paketen
- [ ] Nach einem Paket
- [x] Wenn du Strg+C drückst
- [ ] Wenn die erste Antwort ankommt
---
Mit `-c` wählst du, wie viele Pakete geschickt werden.
```

Die Reihenfolge, in der das System Namen nachschlägt, steht in
`/etc/nsswitch.conf`. Was gibt das hier aus?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
Zuerst die Datei (`/etc/hosts`), dann DNS.
```

```quiz
Du hast `server.lan` in `/etc/hosts` eingetragen. `ping server.lan`
funktioniert, aber `dig +short server.lan` gibt nichts aus. Warum?
- [ ] Die Zeile in `/etc/hosts` ist falsch
- [x] `dig` fragt direkt DNS und ignoriert `/etc/hosts`
- [ ] `dig` braucht `sudo`
- [ ] `ping` verwendet keine Namen
---
Um zu sehen, was das *System* auflöst, nimm `getent hosts server.lan`.
```

```quiz
`myserver` lauscht auf Port 8080 und läuft als normaler Benutzer. Was wäre
anders, wenn er auf Port 80 lauschen würde?
- [ ] Nichts
- [x] Nur root darf Ports unter 1024 öffnen
- [ ] Port 80 ist nur für SSH
- [ ] Port 80 lässt sich auf localhost nicht verwenden
```

```quiz
`curl -I http://linux.org` antwortet `301 Moved Permanently`. Wie bekommst
du die eigentliche Seite?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org` – der Weiterleitung folgen
- [ ] `curl -o http://linux.org`
- [ ] Gar nicht – 301 bedeutet, dass die Seite weg ist
```

```quiz
Du verbindest dich mit ssh zu `server.lan`, und ssh warnt lautstark, dass
sich der Host-Key des Servers geändert hat. Was könnte das bedeuten?
- [ ] Dein Passwort ist abgelaufen
- [x] Jemand könnte sich als der Server ausgeben
- [ ] Der Server hat einen neuen Benutzer
- [ ] Dein Schlüsselpaar ist kaputt
---
Der Host-Key wurde beim ersten Verbinden in `~/.ssh/known_hosts`
gespeichert.
```

```quiz
Du willst dich mit einem Schlüsselpaar statt mit einem Passwort am Server
anmelden. Welcher Schlüssel kommt auf den Server?
- [x] Der öffentliche Schlüssel, `id_ed25519.pub`
- [ ] Der private Schlüssel, `id_ed25519`
- [ ] Beide
- [ ] Keiner – der Server erzeugt seinen eigenen
---
`ssh-copy-id` fügt den öffentlichen Schlüssel zu `~/.ssh/authorized_keys`
auf dem Server hinzu. Zeig den privaten Schlüssel nie jemandem!
```

```quiz
`ip a` zeigt eine Adresse, und du kannst andere Rechner in
`192.168.1.0/24` anpingen, aber nichts draußen im Internet. `ip route` hat
keine Zeile `default`. Was ist falsch?
- [ ] DNS
- [x] Es gibt kein Gateway – niemand weiß, wohin Verkehr außerhalb des lokalen Netzes geschickt werden soll
- [ ] Die Netzwerkkarte ist ausgeschaltet
- [ ] `/etc/hosts` fehlt
```
