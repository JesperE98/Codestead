# Projekt: Der Log-Detektiv

Es ist Viertel vor acht, und deine Chefin steht mit einer Tasse Kaffee an deinem Schreibtisch.
„Der Server hat gestern Ärger gemacht. Niemand weiß, warum, und die Kunden rufen schon an.
Kannst du herausfinden, was passiert ist, und bis zum Mittag einen kurzen Bericht schreiben?“

Alles, was du brauchst, steht in der Logdatei `~/{{documents}}/server.log` – und in den
Befehlen, die du in *Grundlagen* gelernt hast. Nichts davon ist neu; die Herausforderung
ist, die Teile selbst zusammenzusetzen.

## Der Auftrag

1. **Eröffne eine Ermittlung.** Lege den Ordner `~/{{caseDir}}` mit dem Unterordner
   `{{evidence}}` an. Alle Beweise und der Bericht kommen dort hinein.
2. **Sichere die Beweise.** Kopiere das Log nach `{{evidence}}`. Arbeite danach mit der
   Kopie – das Original bleibt unberührt.
3. **Zieh die Fehler heraus.** Speichere alle Zeilen mit `ERROR` in einer eigenen Datei,
   `~/{{caseDir}}/{{errorsFile}}`.
4. **Schreib den Bericht.** Der Bericht `~/{{caseDir}}/{{caseReport}}` entsteht Zeile für Zeile:
   - zuerst die **Anzahl der Warnungen** – Zeilen mit `WARN`, egal ob groß oder klein
     geschrieben,
   - dann **die erste Fehlerzeile**, damit man sieht, wann der Ärger anfing,
   - zuletzt die **Uhrzeiten** aller Fehler, eine pro Zeile, die späteste zuerst.
5. **Schließ den Fall ab.** Zeig den ganzen Bericht an und prüfe, ob alles drin ist.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du deine
Befehle ausführst.

## Tipps für unterwegs

- Schau dir das Log zuerst mit `cat` oder `less` an, damit du weißt, wie die Zeilen aussehen.
- Denk an den Unterschied zwischen `>` und `>>`: Das eine überschreibt die Datei, das andere
  hängt ans Ende an. Den Bericht aus Versehen überschrieben? Kein Problem – fang wieder bei
  der Anzahl der Warnungen an.
- Eine Pipe (`|`) gibt die Ausgabe eines Befehls an den nächsten weiter. Mehrere Etappen
  werden kurz, wenn du zwei oder drei Befehle verbindest.
- Jede Zeile des Logs besteht aus Feldern, die durch Leerzeichen getrennt sind: Datum,
  Uhrzeit, Stufe und Meldung.

## Lust auf mehr?

Wenn die Etappen geschafft sind, kannst du auf eigene Faust weiterermitteln. Welche Seite
lieferte den Fehler `404`? Wie viele Zeilen haben die Stufe `INFO`? Schreib, was du findest,
in den Bericht – ein echter Detektiv lässt keine Fragen offen.
