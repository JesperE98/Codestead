# Projekt: Das Clubhaus

Du und ein paar Freunde habt einen Geheimclub gegründet. Der Club hat einen
Namen, einen Handschlag und ein Passwort – aber kein Clubhaus. Dein Computer hat
allerdings jede Menge Platz. Die Regeln sind einfach: Nur Mitglieder kommen
hinein, an der Tür klopft man mit einem Skript, es gibt einen geheimen Eingang,
nachts hält jemand Wache, und es gibt immer eine Sicherungskopie, falls das
Clubhaus jemals auffliegt.

Alles, was du brauchst, kennst du aus *Das System*: Rechte, Variablen, Links,
Prozesse und Archive. Nichts davon ist neu; die Herausforderung ist, die Teile
selbst zusammenzusetzen.

## Der Auftrag

1. **Bau das Clubhaus.** Lege das Verzeichnis `~/{{clubDir}}` an. Nur du darfst
   es lesen, darin schreiben und es betreten – die Gruppe und alle anderen
   bekommen nichts (`rwx------`).
2. **Stell einen Türsteher ein.** Schreib das Skript `~/{{clubDir}}/{{knockScript}}`,
   das mit `echo` das Passwort des Clubs ausgibt. Mach es ausführbar und führe es
   aus.
3. **Markiere den Weg.** Lege die Umgebungsvariable `{{clubVar}}` mit dem
   vollständigen Pfad zum Clubhaus an, sodass `cd ${{clubVar}}` dich dorthin
   bringt.
4. **Versteck einen geheimen Eingang.** Lege einen symbolischen Link
   `~/{{documents}}/{{wardrobe}}` an, der direkt ins Clubhaus führt. Niemand
   sucht ein Clubhaus hinten in einem Kleiderschrank.
5. **Stell eine Nachtwache auf.** Lass `sleep 3600` im Hintergrund laufen, damit
   sie eine Stunde lang Wache hält – und weiterläuft, auch wenn du dich abmeldest.
   (Eine Nachtwache, die nichts anderes tut als schlafen: sehr lebensnah.)
6. **Mach eine Sicherungskopie.** Pack das ganze Clubhaus in das komprimierte
   Archiv `~/{{clubBackup}}`.
7. **Schick die Nachtwache nach Hause.** Der Morgen ist da – beende den Prozess.

Die Etappen in der Liste neben diesem Text werden automatisch geprüft, während du deine
Befehle ausführst.

## Tipps für unterwegs

- `ls -ld ~/{{clubDir}}` zeigt die Rechte des Verzeichnisses selbst statt seines
  Inhalts. r = 4, w = 2 und x = 1.
- Der Türsteher braucht nur eine Zeile. Setz einfache Anführungszeichen darum,
  dann landet sie genau so in der Datei, wie du sie geschrieben hast. Ein Skript
  im Verzeichnis, in dem du bist, startest du mit `./` vor dem Namen.
- Keine Leerzeichen um `=`, wenn du eine Variable anlegst, und vergiss `export`
  nicht – sonst bleibt sie eine gewöhnliche Shell-Variable. Prüfe es mit
  `echo ${{clubVar}}`.
- `ln -s` nimmt zuerst das Ziel und zuletzt den Namen des Links. Probier dann
  `cd ~/{{documents}}/{{wardrobe}}` und schau, wo du landest.
- `jobs` zeigt deine Hintergrundjobs mit ihren Nummern, und `ps` zeigt ihre PIDs.
- Pack aus deinem Home-Verzeichnis heraus, dann beginnen die Pfade im Archiv mit
  `{{clubDir}}/`. `tar -tzf` zeigt, was hineingekommen ist.

## Lust auf mehr?

Wenn die Etappen geschafft sind, kann der Club wachsen. Leg einen Alias an, der
dich mit einem einzigen Wort ins Clubhaus bringt. Leg eine Mitgliederliste ins
Clubhaus und einen harten Link darauf in dein Home-Verzeichnis. Pack die
Sicherungskopie in einem neuen Verzeichnis aus und prüfe, ob der Türsteher das
Passwort noch kennt. Und was passiert mit dem geheimen Eingang, wenn das
Clubhaus umzieht?
