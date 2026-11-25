# Projekt: Loggdetektiven

Klockan är 07.45 och chefen står vid ditt skrivbord med en kaffekopp i handen.
– Servern krånglade i går. Ingen vet varför, och kunderna har börjat ringa.
Kan du ta reda på vad som hände och skriva en kort rapport innan lunch?

Allt du behöver finns i loggfilen `~/{{documents}}/server.log` – och i kommandona
du har lärt dig i *Grunderna*. Ingenting här är nytt; utmaningen är att sätta ihop
bitarna själv.

## Uppdraget

1. **Öppna en utredning.** Skapa mappen `~/{{caseDir}}` med undermappen
   `{{evidence}}`. All bevisning och rapporten hamnar där.
2. **Säkra bevisen.** Kopiera loggen till `{{evidence}}`. Arbeta sedan med
   kopian – originalet ska ligga orört kvar.
3. **Plocka ut felen.** Spara alla rader med `ERROR` i en egen fil,
   `~/{{caseDir}}/{{errorsFile}}`.
4. **Skriv rapporten.** Rapporten `~/{{caseDir}}/{{caseReport}}` byggs upp en rad i
   taget:
   - först **antalet varningar** – rader med `WARN`, oavsett om det står med stora
     eller små bokstäver,
   - sedan **den första felraden**, så att det syns när problemen började,
   - sist **klockslagen** för alla fel, ett per rad, det senaste först.
5. **Avsluta fallet.** Visa hela rapporten och kontrollera att allt kom med.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- Titta gärna på loggen först med `cat` eller `less`, så att du vet hur raderna ser ut.
- Tänk på skillnaden mellan `>` och `>>`: den ena skriver över filen, den andra
  lägger till i slutet. Skrev du över rapporten av misstag? Ingen fara – börja om
  från antalet varningar.
- En pipe (`|`) skickar utskriften från ett kommando vidare till nästa. Flera
  delmål blir korta om du kopplar ihop två eller tre kommandon.
- Varje rad i loggen består av fält åtskilda av mellanslag: datum, klockslag,
  nivå och meddelande.

## Vill du göra mer?

När delmålen är klara kan du fortsätta utreda på egen hand. Vilken sida gav
felet `404`? Hur många rader har nivån `INFO`? Lägg till det du hittar i
rapporten – en riktig detektiv lämnar inga trådar lösa.
