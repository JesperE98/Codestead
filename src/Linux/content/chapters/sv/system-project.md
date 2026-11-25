# Projekt: Klubbhuset

Du och ett par kompisar har startat en hemlig klubb. Klubben har ett namn, en
handskakning och ett lösenord – men inget klubbhus. Fast din dator har ju gott
om plats. Reglerna är enkla: bara medlemmar kommer in, man knackar på dörren
med ett skript, det finns en hemlig ingång, någon håller vakt på natten, och det
finns alltid en säkerhetskopia ifall klubbhuset skulle bli upptäckt.

Allt du behöver har du från *Systemet*: rättigheter, variabler, länkar,
processer och arkiv. Ingenting här är nytt; utmaningen är att sätta ihop bitarna
själv.

## Uppdraget

1. **Bygg klubbhuset.** Skapa katalogen `~/{{clubDir}}`. Bara du får läsa,
   skriva och gå in i den – gruppen och övriga får ingenting (`rwx------`).
2. **Anställ en dörrvakt.** Skriv skriptet `~/{{clubDir}}/{{knockScript}}`, som
   skriver ut klubbens lösenord med `echo`. Gör det körbart och kör det.
3. **Märk ut vägen.** Skapa miljövariabeln `{{clubVar}}` med hela sökvägen till
   klubbhuset, så att `cd ${{clubVar}}` tar dig dit.
4. **Göm en hemlig ingång.** Skapa en symbolisk länk
   `~/{{documents}}/{{wardrobe}}` som leder rakt in i klubbhuset. Ingen letar
   efter ett klubbhus längst in i en garderob.
5. **Ställ ut en nattvakt.** Kör `sleep 3600` i bakgrunden, så att den håller
   vakt i en timme – och fortsätter även om du loggar ut. (En nattvakt som inte
   gör något annat än sover: mycket verklighetstroget.)
6. **Gör en säkerhetskopia.** Packa hela klubbhuset i det komprimerade arkivet
   `~/{{clubBackup}}`.
7. **Skicka hem nattvakten.** Morgonen är här – avsluta processen.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- `ls -ld ~/{{clubDir}}` visar rättigheterna för själva katalogen i stället för
  innehållet. r = 4, w = 2 och x = 1.
- Dörrvakten behöver bara en rad. Sätt enkla citattecken runt den, så hamnar den
  i filen precis som du skrev den. Ett skript i katalogen du står i körs med `./`
  framför namnet.
- Inga mellanslag runt `=` när du skapar en variabel, och glöm inte `export` –
  annars blir den bara en vanlig skalvariabel. Kontrollera med
  `echo ${{clubVar}}`.
- `ln -s` tar målet först och länkens namn sist. Prova sedan
  `cd ~/{{documents}}/{{wardrobe}}` och se var du hamnar.
- `jobs` visar dina bakgrundsjobb med deras nummer, och `ps` visar deras PID.
- Packa från hemkatalogen, så börjar sökvägarna i arkivet med `{{clubDir}}/`.
  `tar -tzf` visar vad som kom med.

## Vill du göra mer?

När delmålen är klara kan klubben växa. Gör ett alias som tar dig till
klubbhuset med ett enda ord. Lägg en medlemslista i klubbhuset och en hård länk
till den i hemkatalogen. Packa upp säkerhetskopian i en ny katalog och
kontrollera att dörrvakten fortfarande kan lösenordet. Och vad händer med den
hemliga ingången om klubbhuset flyttas?
