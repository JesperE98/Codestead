# Projekt: Der Berichtsroboter

Erinnerst du dich an den Tag, an dem der Server Ärger gemacht hat? Deine Chefin war
von deinem Bericht begeistert – ein bisschen zu sehr. „Großartig. So einen will ich
jeden Morgen auf dem Schreibtisch haben. An jedem Werktag. Vor sieben.“ Du hast nicht
vor, um sechs aufzustehen, um `grep`-Befehle zu tippen. Zum Glück musst du das auch
nicht: Du kannst jetzt Skripte schreiben. Zeit, einen Roboter zu bauen, der die
Arbeit für dich erledigt.

Der Roboter liest das Log `~/{{documents}}/server.log` und schreibt einen kurzen
Bericht: wie viele Zeilen es von jeder Stufe gibt und welche Fehler aufgetreten
sind. Alles, was er braucht, steht in *Skripte und Automatisierung* – die
Herausforderung ist, es selbst zusammenzusetzen.

## Der Auftrag

1. **Bau den Roboter.** Lege das Skript `~/{{robotScript}}` mit einer Shebang-Zeile
   und einer Zeile an, die eine Überschrift ausgibt. Mach es ausführbar und führe es
   aus.
2. **Bring ihm bei, nach dem Log zu fragen.** Der Roboter bekommt die Logdatei als
   erstes Argument. Ohne Argument aufgerufen, soll er erklären, wie man ihn benutzt,
   und mit einem Exit-Code ungleich 0 aufhören.
3. **… und sich über fehlende Dateien zu beschweren.** Gibt es die Datei im Argument
   nicht, sagt der Roboter das und hört mit einem Exit-Code ungleich 0 auf. Probier
   es mit einem Dateinamen aus, den es nicht gibt.
4. **Zähl die Stufen.** Mit `~/{{documents}}/server.log` aufgerufen, gibt der
   Roboter aus, wie viele Zeilen das Log von jeder Stufe hat – gezählt mit `awk`.
   Vorsicht: `WARN` und `warn` sind dieselbe Stufe!
5. **Liste die Fehler auf.** Unter den Zahlen listet der Bericht jeden Fehler mit
   Uhrzeit und Meldung auf – aber **ohne** das Datum, das ohnehin in jeder Zeile
   dasselbe ist. Entferne es mit `sed`.
6. **Stell den Roboter ein.** Plane ihn mit cron: Er läuft montags bis freitags um
   06:30 mit dem Server-Log, und seine Ausgabe wird an `~/{{robotLog}}` angehängt.
   Behalte deine alten Jobs.
7. **Generalprobe.** Führe den Befehl des Jobs einmal von Hand aus, damit der
   heutige Bericht in `~/{{robotLog}}` landet, und sieh dir die Datei an.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du
deine Befehle ausführst.

## Tipps für unterwegs

- Bau den Roboter Stück für Stück und führe ihn nach jeder Änderung aus. Am
  einfachsten schreibst du das ganze Skript jedes Mal neu mit dem Here-Dokument –
  es ersetzt die alte Version.
- Probier jede Zeile zuerst auf der Kommandozeile aus, mit dem Pfad des Logs statt
  `"$1"`. Wenn sie dort funktioniert, kommt sie ins Skript.
- `echo $?` direkt nach dem Roboter zeigt, mit welchem Exit-Code er aufgehört hat.
- `toupper()` in `awk` macht aus `warn` ein `WARN`, und `sort | uniq -c` zählt
  gleiche Zeilen.
- Jede Zeile des Logs beginnt mit dem Datum und einem Leerzeichen – der Befehl `s`
  von `sed` kann diesen Teil durch nichts ersetzen.
- Jobs in cron laufen nicht in deinem Terminal: Nimm vollständige Pfade wie
  `~/{{robotScript}}` und leite die Ausgabe in eine Datei. Mit `>>` wird der Bericht
  jedes Morgens ans Ende angehängt, statt den von gestern zu überschreiben.

## Lust auf mehr?

Wenn die Etappen geschafft sind, kann der Roboter neue Tricks lernen. Schreib das
Datum mit `$(date)` in die Überschrift. Mach aus jedem Teil des Berichts eine eigene
Funktion. Lass den Roboter mit `for file in "$@"` mehrere Logs auf einmal nehmen,
oder zähl, wie viele Anfragen die Antwort `404` bekamen. Und wenn die App an einem
Werktag um 06:30 noch offen ist, zeigt `journalctl -u cron`, dass der Roboter
wirklich zur Arbeit gegangen ist.
