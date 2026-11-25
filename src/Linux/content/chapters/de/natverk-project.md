# Projekt: Die Website ist down!

Freitag, 16:47 Uhr. Dein Telefon klingelt. Es ist deine Chefin, außer Atem:
„Die Website ist down! Die Kunden sehen unsere Öffnungszeiten nicht, und
derselbe Kunde hat schon dreimal angerufen!“

Die Website der Firma ist der kleine Webserver `myserver` auf Port 8080 – auf
*deinem* Rechner. Ja, wirklich. Jemand hat ihn vor Jahren „vorübergehend“ dort
hingestellt, und seitdem hat sich niemand getraut, ihn umzuziehen.

Ist es das Netz? Der Webserver? Oder der Laptop der Chefin? Finde es von innen
nach außen heraus, schreib alles in ein Störungsprotokoll – und sorg dafür, dass
es beim nächsten Mal einfacher geht. Alles, was du brauchst, steckt in
*Netzwerk*; die Herausforderung ist, die Teile selbst zusammenzusetzen.

## Der Auftrag

1. **Beginne das Protokoll.** Lege den Ordner `~/{{incidentDir}}` mit dem
   Störungsprotokoll `{{incidentLog}}` an und schreib die IP-Adresse des Rechners
   und die Adresse des Gateways hinein.
2. **Der Weg hinaus.** Zeige, dass das Netz bis hinaus ins Internet funktioniert,
   Namensauflösung inklusive: Füge dem Protokoll einen Ping mit drei Paketen an
   einen Namen im Internet hinzu.
3. **Lauscht da jemand?** Finde heraus, ob etwas auf Port 8080 lauscht. Wenn
   nicht, starte den Webserver und prüfe noch einmal.
4. **Antwortet die Website?** Füge dem Protokoll die Antwort-Header der
   Startseite, `http://localhost:8080`, hinzu. Der Statuscode soll 200 sein.
5. **Ein Schlüssel für den Server.** Beim nächsten Mal willst du ohne Passwort
   auf den Server `server.lan`. Erzeuge ein Schlüsselpaar und lege den
   öffentlichen Schlüssel auf den Server.
6. **Sichern.** Kopiere den ganzen Ordner `~/{{incidentDir}}` in dein
   Home-Verzeichnis auf dem Server, damit das Protokoll erhalten bleibt, selbst
   wenn dein eigener Rechner aufgibt.
7. **Aus der Ferne lesen.** Zeige das Protokoll, das auf dem Server liegt, mit
   `ssh` an – ohne dass jemand nach einem Passwort fragt.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du deine
Befehle ausführst.

## Tipps für unterwegs

- `>` legt eine Datei an (oder überschreibt sie), und `>>` hängt an ihr Ende an:
  Beginne das Protokoll mit `>` und bleib danach bei `>>`.
- Arbeite dich von innen nach außen vor: Adresse, Route, Router, Internet und
  zuletzt ein Name. Ohne `-c` macht `ping` weiter, bis du es stoppst.
- `ss -tulpn` zeigt die lauschenden Ports. Die Spalte *Process* ist leer für
  Prozesse, die anderen Benutzern gehören – hier zählt der Port.
- Unter Ubuntu ist `curl` nicht vorinstalliert: `sudo apt update` und
  `sudo apt install curl`. `-I` holt nur die Header.
- Der Kurzname `srv` aus `~/.ssh/config` funktioniert überall – genauso wie
  `{{user}}@server.lan` und `{{user}}@192.168.1.10`.
- `rsync -av QUELLE/ srv:ZIEL/` – der Schrägstrich nach der Quelle bedeutet „was
  im Verzeichnis ist“.
- Fragt `ssh` immer noch nach einem Passwort? Dann liegt der Schlüssel noch nicht
  auf dem Server.

## Lust auf mehr?

Wenn die Etappen geschafft sind, kannst du weitermachen. Schalte die Netzwerkkarte
mit `sudo ip link set enp0s3 down` ab, schau, wo die Kette von innen nach außen
reißt, und schalte sie mit `up` wieder ein. Hol die Seite `/about.html` der
Website mit `curl`. Füge dem Protokoll eine Zeile hinzu und führe dasselbe
`rsync -av` noch einmal aus – nur die Änderung wird übertragen. Und ruf die Chefin
zurück. (Gerüchten zufolge war ihr Laptop im Flugmodus.)
