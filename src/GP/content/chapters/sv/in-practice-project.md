# Projekt: Hedgerow på höstmarknaden

På lördag är det höstmarknad i byn, och fru Thistlewood – ordförande i marknadskommittén och trefaldig vinnare av
klassen för jättepumpor – har hört att du har skrivit ett spel. ”Hedgerow på storbildsskärmen i bygdegården! Men inte
samma gamla spel som alla redan har sett. Det ska kännas som *vår* marknad.”

Hon har tagit med sig en lista. Den är skriven på baksidan av en frökatalog, och den är inte kort: en bana som är
marknadens egen, poäng så att besökarna kan skryta för varandra, lite gnistor, en present till varje besökare och en
riktig öppning av föreställningen. Allt på listan går att bygga med det du lärde dig i *I praktiken* – inget här är
nytt; utmaningen är att själv passa in bitarna i det färdiga spelet.

Du börjar från det färdiga Hedgerow från *Rendera text*, plus en ny fil: `levels/five.lvl`, ett tomt fält av nollor som
väntar på din bana.

## Uppdraget

1. **En bana som är marknadens egen.** Rita en femte bana i `levels/five.lvl` – en pumpa, en igelkott, marknadens
   initialer: vad du vill, bara den har några block som bollen kan slå sönder. Ladda den som femte bana när spelet
   startar, och låt spelet börja på den.
2. **En fullvärdig del av menyn.** W och S ska gå runt genom alla fem banorna (S från den första banan går till din
   bana), och efter game over måste ResetLevel kunna ladda om din bana.
3. **Räkna poäng.** Ge poäng för varje block som bollen slår sönder – tio styck, eller vad du vill – och visa `Score:`
   med poängen uppe till höger i fönstret. Ett nytt spel börjar på noll.
4. **Gnistor.** Ge gnistorna en av marknadens färger (guld, rosa, limegrönt – allt utom grått), och sätt upp ett
   tomtebloss: en fast punkt i fönstrets nedre halva, en bit från racketen, där gnistor hela tiden stiger upp.
5. **En gåva från ovan.** Lägg till en ny power-up som ger ett extra liv. Den skapas från block som går sönder, som de
   andra (men mer sällan, den är värdefull). Som marknadens välkomstgåva faller en från mitten av fönstret (y = 300),
   rakt ovanför racketen, när programmet startar – så att besökarna börjar med fyra liv.
6. **Föreställningen börjar.** Skriv en ny efterbehandlingseffekt: bilden tonar fram ur svart under de första två
   sekunderna. Texten ritas efter efterbehandlingen, så den går att läsa från början.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på *Kontrollera min kod*. Kursens simulator
spelar ditt spel med fast indata och trycker aldrig på ENTER, så spelet stannar i menyn – och det är precis där
besökarna i bygdegården ser det först. Update körs i menyn också, så gåvan faller även där.

## Tips på vägen

- En banfil är ett rutnät av tal, en rad i rutnätet per rad i filen: `0` är tomt, `1` en fast sten, `2` blått, `3`
  grönt, `4` gult och `5` orange. InitLevel sprider rutnätet över fönstrets övre halva, så din bana kan ha hur många
  rader och kolumner du vill – de andra har 15 kolumner och 8 rader. En bana med bara stenar går aldrig att vinna.
- Menyns val av bana använder `% 4` och talet `3` i dag. `game.Levels.size()` skulle fortsätta fungera om en sjätte bana
  någon gång dyker upp.
- RenderTexts `x` och `y` är textens övre vänstra hörn. I 24 pixlar är `Score:0` ungefär 90 pixlar bred, så
  `game.Width - 120.0f` lämnar plats för några siffror till.
- `Update(Particles, dt, object, newParticles)` skapar partiklar vid vilket GameObject som helst: de dyker upp vid dess
  `Position` och rör sig *mot* dess `Velocity` (en tiondel av den). Ett GameObject som aldrig ritas blir ett utmärkt
  tomtebloss – ge det en stor hastighet nedåt så stiger dess gnistor. Bollen och tomteblosset kan dela på de 500
  partiklarna.
- ActivatePowerUp får bara power-upen; liven hör till spelet (det globala `Hedgerow`). Kapitlet Power-ups lade sina
  test-power-ups i `game.PowerUps` i Init – gåvan fungerar likadant. Vilken som helst av de sex power-up-texturerna
  duger, färgad med en egen färg.
- En efterbehandlingseffekt är en ändring i efterbehandlingsshadern, som körs en gång för varje pixel i fönstret.
:::opengl
  Shadern får redan tiden: `post_processing.vs` deklarerar `uniform float time;`. Deklarera samma uniform i
  `post_processing.fs` så är det samma värde – uniforms hör till hela programmet.
:::
:::vulkan
  Shadern får redan tiden: `shaders/post_processing.frag` har push constant-blocket med `time` (`pc.time`). Glöm inte
  att kompilera om shadern till SPIR-V.
:::
:::d3d12
  Shadern får redan tiden: `post_processing.hlsl` har `time` i sin konstantbuffert, och pixelshadern kan läsa den lika
  väl som vertexshadern.
:::
- Syns något inte? Ritordningen spelar roll: gnistorna ritas efter racketen och före bollen, texten efter allt annat.

## Vill du göra mer?

När delmålen är klara är marknaden din. Spara ett rekord som överlever game over. Lägg till en sjätte bana, eller en
egen power-up – slow motion för bollen, en andra boll, en racket som krymper (en negativ, för balansens skull). Sätt ett
tomtebloss i vardera änden av racketen, tona till svart när det sista livet går förlorat, eller visa banans namn i
menyn. Och tryck sedan på ENTER och spela: fru Thistlewood räknar med att du har klarat din egen bana minst en gång.
