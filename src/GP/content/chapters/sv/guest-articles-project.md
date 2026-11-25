# Projekt: Museets planetarium

Stadsmuseet har en skatt: ett tvåhundra år gammalt planetarium i mässing – en urverksmodell av ett litet solsystem, där
en vev driver solens kugghjul, solens kugghjul driver planeterna och en planets kugghjul driver dess måne. Förra veckan
körde det fast. Urmakaren säger att han behöver till våren, och museet öppnar igen på fredag.

”Kan du inte bygga det i datorn?” frågar intendenten och putsar glasögonen. ”Bara för skärmen bredvid den tomma
montern. Besökarna vill bara se det gå runt.” Sedan, lite generad: ”Museets dator är rätt gammal. Låt den inte rita
något som ingen kan se.”

Ett planetarium av det här slaget är en scengraf i mässing: varje del rör sig med den del den hänger på. Allt du behöver
finns i kapitlen *Scengraf* och *Frustum culling* – inget här är nytt; utmaningen är att sätta ihop det själv. Du börjar
från det färdiga programmet i Frustum culling: dess rutnät av planeter med ringar, dess culling och dess räknare i
fönstrets titel. (I det här planetariet har varje himlakropp ringar – verkstadens kännetecken.)

## Uppdraget

1. **Solen.** Byt ut rutnätet mot planetariets sol: rotentiteten ensam, i origo, en och en halv gång så stor som
   modellen. Solen sitter fast på sitt stativ: den snurrar inte längre.
2. **Planeterna.** Häng tre planeter på solen – barn till rotentiteten, på rad längs dess x-axel: *Pip* på 2,4 med
   skalan 0,2, *Bramble* på 4 med skalan 0,35 och *Old Gourd* på 6 med skalan 0,4. Det är lokala värden, i solens
   enheter: ett barn ärver sin förälders skala, så i världen ligger de en och en halv gång så långt ut och är en och en
   halv gång så stora.
3. **Banorna.** Låt varje planet kretsa runt solen med sin egen fart, moturs sett ovanifrån och med start där den hänger
   nu: Pip 80 grader per sekund, Bramble 40, Old Gourd 20.
4. **Månen.** Ge Bramble en måne, *Burr*: ett barn till Bramble, 2,5 Bramble-enheter från den med skalan 0,35. Bramble
   snurrar runt sin egen axel med 120 grader per sekund – och tar Burr med sig runt, precis som kugghjulen gör.
5. **Räknaren.** Visa i fönstrets titel hur många av planetariets himlakroppar som ritas och hur många som frustumet
   sorterade bort. Efter fem sekunder har Bramble svängt långt ut till vänster, och titeln ska visa en bortsorterad
   kropp.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på *Kontrollera min kod*: kursens simulator
kör ditt program och letar efter himlakropparna där banorna måste ha fört dem.

## Tips på vägen

- Kom ihåg dirty-flaggan: `setLocalPosition`, `setLocalRotation` och `setLocalScale` markerar bara en entitet som
  ändrad, och `updateSelfAndChild` räknar om det som ändrats – och allt under det. Sätt de nya positionerna varje
  bildruta *innan* grafen uppdateras och ritas.
- Barnen lagras som värden i en `std::vector`. Att lägga till ett barn till solen kan flytta de andra barnen i minnet,
  så en pekare eller referens till en planet är säker först när alla planeter är tillagda. Lägg till månen efteråt.
- Moturs sett ovanifrån, med start på x-axeln: med `angle = fart × tid` är positionen på en cirkel med radien `r`
  `(r · cos(angle), 0, −r · sin(angle))` – samma håll som en positiv rotation runt y-axeln. Kom ihåg att `cos` och
  `sin` vill ha radianer.
- En planets egen rotation (dess lokala rotation) flyttar inte planeten, men den vrider allt som hänger på den.
- `drawSelfAndChild` räknar redan: `display` är det som ritades och `total` det som besöktes, så de bortsorterade
  kropparna är skillnaden.
:::opengl
- Renderingsloopen läser redan tiden: `currentFrame`.
:::
:::vulkan
- Scengrafen uppdateras i `recordCommandBuffer`, där `currentFrame` håller tiden.
:::
:::d3d12
- Scengrafen uppdateras i `OnUpdate`, där `time` håller sekunderna sedan starten.
:::

## Vill du göra mer?

När delmålen är klara är planetariet ditt. Luta Old Gourds axel lite, ge Pip en oval bana, lägg till en komet som dyker
in nära solen, eller en andra måne till Old Gourd. Låt kameran sakta kretsa runt planetariet och titta på räknaren:
frustumet följer kameran. Prova avgränsningssfärer i stället för lådor och jämför siffrorna. Och fundera på den här
innan du provar: varför får planeterna inte sorteras bort när solen gör det?
