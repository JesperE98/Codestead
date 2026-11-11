# Slutord

De här sista kapitlen gav en glimt av hur det är att skapa något mer än bara en teknisk demo i {{api}}. Vi skapade ett
komplett 2D-spel från grunden: en spelloop med indata, spritar som ritas med en ortografisk projektion, banor som laddas
från filer, en boll som kolliderar med block och racketen, partiklar, efterbehandlingseffekter, power-ups, text för
liven och menyn – och, i learnopengls version, ljud. Allt detta med begrepp från de tidigare kapitlen: texturer,
transformationer, blending, framebuffers, multisampling och textrendering. Vi lärde oss egentligen inga nya spännande
grafiktekniker, utan snarare hur man kombinerar all kunskap hittills till en större helhet.

**Det här kapitlet har inga uppgifter.** Dess projekt är det färdiga spelet – lösningen från kapitlet `render-text`: en
`main.cpp` plus dess shadrar, `textures/`, `levels/` och `fonts/`.
:::opengl
`main.cpp` innehåller spelets structar och fria funktioner.
:::
:::vulkan
`main.cpp` innehåller vulkan-tutorials applikationsklass och spelets structar och fria funktioner.
:::
:::d3d12
`main.cpp` innehåller klassen `D3D12App` och spelets structar och fria funktioner.
:::
Med kursens fasta indata (bara mellanslag) visar det menyn över bana ett, "Lives:3" uppe till vänster och bollen på
racketen. På din egen dator trycker du på ENTER för att starta, A och D för att flytta racketen och mellanslag för att
släppa bollen – och spelar.

Ett enkelt spel som det här kan göras på tusentals olika sätt, och det här är bara ett av många. Ju större ett spel blir,
desto mer börjar man använda abstraktioner och designmönster; learnopengl rekommenderar boken och webbplatsen *Game
Programming Patterns* för vidare läsning. Kursen skrev learnopengls klasser som vanliga structar och fria funktioner i en
enda fil, eftersom det är lätt att följa i en editor; ett riktigt projekt skulle dela upp koden i klasser och filer, som
learnopengl gör. Tänk på att det är en svår bedrift att skapa ett spel med extremt ren och genomtänkt kod (ofta nästan
omöjligt). Gör helt enkelt ditt spel på det sätt som känns rätt just då. Ju mer du övar på spelutveckling, desto fler nya
och bättre sätt att lösa problem lär du dig. Låt inte strävan efter perfekt kod ta modet ifrån dig; fortsätt koda!

## Optimeringar

Innehållet i de här kapitlen och det färdiga spelets kod var helt inriktade på att förklara begreppen så enkelt som
möjligt, utan att gå in mycket på optimering. learnopengl listar några av de vanligaste förbättringarna som finns i
moderna 2D-spel, för när bildfrekvensen börjar sjunka:

- **Sprite sheet / texturatlas**: i stället för att rendera en sprite med en egen textur åt gången kombinerar man alla
  texturer som behövs i en enda stor textur – som glyfatlasen i kapitlet Textrendering – och väljer spriten med dess
  texturkoordinater. Att byta textur kan vara dyrt, så med en atlas behöver vi sällan göra det; det låter också GPU:n
  cacha texturen effektivare.
- **Instansierad rendering**: i stället för att rendera en rektangel åt gången samlar man alla rektanglar och renderar
  dem med ett enda ritanrop. Varje sprite består av samma hörn och skiljer sig bara i sin modellmatris och färg, vilket en
  instansierad array kan rymma (se kapitlet Instancing). Partiklar och textens glyfer kan ritas på samma sätt.
- **Triangle strips**: en rektangel som triangle strip behöver bara 4 hörn i stället för 6, vilket sparar en tredjedel av
  de data som skickas till GPU:n.
- **Rumsuppdelning**: när vi letar efter kollisioner jämför vi bollen med varje block i banan, fast de flesta inte ens
  kommer i närheten av bollen i den här bildrutan. Algoritmer för rumsuppdelning – BSP-träd, quadtrees och octrees,
  k-d-träd – delar in rummet i regioner; då behöver bara blocken i bollens region(er) kontrolleras. För ett så litet spel
  är det troligen överdrivet, men för större spel med mer komplicerad kollisionsdetektering ökar det prestandan avsevärt.
- **Färre tillståndsbyten**: tillståndsbyten (binda texturer, byta shader) är i allmänhet ganska dyra, så undvik att göra
  många av dem. Ett sätt är att komma ihåg det aktuella tillståndet och bara byta när ett värde måste ändras; ett annat är
  att sortera objekten efter tillstånd – först allt med shader ett, sedan allt med shader två, och så vidare, likadant för
  texturer, blendtillstånd och framebuffers.

:::opengl
De här ger dig några tips om knep som kan höja ett 2D-spels prestanda. De ger dig också en glimt av OpenGL:s styrka:
genom att göra det mesta av renderingen för hand har vi full kontroll över hela processen – och därmed också full makt
över hur den optimeras.
:::
:::vulkan
I Vulkan ser några av dem annorlunda ut, och Vulkan lägger till egna:

- **Flera bildrutor i farten**: spelet spelar in en command buffer och väntar på dess fence varje bildruta, så CPU:n väntar
  medan GPU:n ritar. vulkan-tutorials kapitel *Frames in flight* (`MAX_FRAMES_IN_FLIGHT`) låter CPU:n spela in nästa
  bildruta under tiden – med en command buffer, en fence och en vertexbuffert för texten per bildruta.
- **Samla spritarna**: varje sprite är en `vkCmdDraw` med sina egna push constants. En instansbuffert med varje blocks
  modellmatris och färg skulle rita alla block med ett ritanrop – ett descriptor set per textur kan finnas kvar, eller så
  gör en texturatlas det till ett.
- **En pipeline cache** (`VkPipelineCache`) som sparas mellan körningar gör det snabbare att skapa pipelines vid start.
- De tillståndsbyten som OpenGL gör implicit är explicita här: att binda en pipeline sätter hela dess tillstånd på en gång,
  så att sortera ritanropen efter pipeline är Vulkans form av "färre tillståndsbyten".
:::
:::d3d12
I Direct3D 12 ser några av dem annorlunda ut, och det lägger till egna:

- **Samla spritarna**: varje sprite och partikel är ett ritanrop med sina egna root constants – enkelt, men långsamt för
  många objekt. Ett riktigt spel skulle samla dem: instansiering med en buffert per instans, som i kapitlet Instancing,
  eller en dynamisk vertexbuffert per bildruta, som textens.
- **Flera bildrutor i farten**: spelet väntar på GPU:n i slutet av varje bildruta (`WaitForPreviousFrame`), så CPU:n
  väntar medan GPU:n ritar. Exemplet D3D12HelloFrameBuffering har en command allocator och ett fence-värde per back
  buffer, så att CPU:n spelar in nästa bildruta under tiden.
- **En spriteatlas** som glyfatlasen: en textur, en descriptor table för alla spritar.
- De tillståndsbyten som OpenGL gör implicit är explicita här: att sätta en pipeline state sätter hela dess tillstånd på
  en gång, så att sortera ritanropen efter pipeline state är Direct3D 12:s form av "färre tillståndsbyten".
:::

Om du inte är nöjd med spelets prestanda får du gärna ta något av de här som övning.

## Var kreativ

Nu när du har sett hur man skapar ett enkelt spel i {{api}} är det upp till dig att skapa egna renderings- och
spelprogram. Många av de tekniker vi har gått igenom kan användas i de flesta 2D-spel: spriterendering,
kollisionsdetektering, efterbehandling, textrendering och partiklar. Några idéer för Hedgerow självt: fler banor och en
baneditor, topplistor, nya power-ups, kombinerade effekter, eller ljud med något av biblioteken i kapitlet Ljud. Nu är det
upp till dig att ta de här teknikerna, kombinera och ändra dem på det sätt du tycker är rätt, och utveckla ditt eget
handgjorda spel.

```quiz
Vilken av de här är *inte* en av learnopengls föreslagna optimeringar för ett 2D-spel?
- [ ] Att kombinera texturerna i ett sprite sheet / en texturatlas
- [ ] Att rita alla spritar med ett instansierat ritanrop
- [x] Att rendera varje sprite i högre upplösning och skala ned bilden
- [ ] Rumsuppdelning, så att bollen bara testas mot block nära den
---
Att rendera i högre upplösning skulle kosta mer, inte mindre. De andra minskar texturbyten, ritanrop eller kollisionstester.
```

```quiz
Vad sparar rumsuppdelning i spelets kollisionsdetektering?
- [ ] Tiden för att rita blocken
- [ ] Minnet för banfilerna
- [x] Kollisionstester: bollen testas bara mot blocken i sin egen region (sina egna regioner) av fönstret, inte mot varje block i banan
- [ ] Tiden för att hantera en kollision när den väl har hittats
---
För en banas block spelar det knappt någon roll; för ett spel med tusentals objekt och dyra tester gör det det.
```

```quiz
Varför har kursens spel allt i en `main.cpp` med structar och fria funktioner?
- [x] Därför att det är lätt att följa i en editor och i den inbyggda simulatorn, medan learnopengl delar upp sitt spel i klasser och filer; ett riktigt projekt skulle göra som learnopengl
- [ ] Därför att {{api}} bara kan anropa fria funktioner
- [ ] Därför att klasser är långsammare än structar i C++
- [ ] Därför att ett spel måste kompileras från en enda fil
---
I C++ skiljer sig en struct och en klass bara i sin standardåtkomst. Kursen följer learnopengls kod steg för steg, bara i en annan form.
```

:::opengl
```quiz
learnopengl föreslår färre tillståndsbyten. Vad betyder det för det färdiga spelet?
- [ ] Att anropa `glGetError` mer sällan
- [ ] Att använda färre framebuffers
- [x] Att undvika onödiga anrop till `glBindTexture`, `glUseProgram` och liknande – till exempel genom att komma ihåg vad som är bundet och bara byta vid behov, eller genom att sortera ritanropen efter shader och textur
- [ ] Att skapa varje OpenGL-objekt en gång vid start
---
Spelet binder en textur för varje sprite, även när nästa block använder samma. En tillståndscache eller sorterade ritanrop skulle hoppa över de bindningarna.
```
:::
:::vulkan
```quiz
Vulkan-spelet väntar på GPU:n varje bildruta. Vad skulle flera bildrutor i farten ändra?
- [ ] GPU:n skulle rita varje bildruta snabbare
- [ ] Bilderna skulle bli mjukare eftersom bildrutor blandas
- [ ] Validation layer skulle rapportera färre meddelanden
- [x] CPU:n skulle kunna spela in nästa bildruta medan GPU:n fortfarande ritar den förra – vilket kräver en command buffer, en fence och de buffertar som CPU:n skriver om varje bildruta, som textens vertexbuffert, en gång per bildruta i farten
---
vulkan-tutorials kapitel *Frames in flight* gör just det med `MAX_FRAMES_IN_FLIGHT = 2`. Textens vertexbuffert, som skrivs över varje bildruta, skulle då behöva en kopia per bildruta.
```
:::
:::d3d12
```quiz
Direct3D 12-spelet väntar på GPU:n i slutet av varje bildruta (`WaitForPreviousFrame`). Vad skulle flera bildrutor i farten ändra?
- [ ] GPU:n skulle rita varje bildruta snabbare
- [ ] Bilderna skulle bli mjukare eftersom bildrutor blandas
- [ ] Debug layer skulle rapportera färre meddelanden
- [x] CPU:n skulle kunna spela in nästa bildruta medan GPU:n fortfarande ritar den förra – vilket kräver en command allocator och ett fence-värde per bildruta, och kopior per bildruta av det som CPU:n skriver om varje bildruta, som textens vertexbuffert
---
Exemplet D3D12HelloFrameBuffering visar mönstret. I dag kan textbufferten nollställas varje bildruta bara för att den förra bildrutan är klar.
```
:::

## Mer att läsa

- [Final thoughts](https://learnopengl.com/In-Practice/2D-Game/Final-thoughts): learnopengls kapitel som det här
  kapitlet följer.
- [Instancing](https://learnopengl.com/Advanced-OpenGL/Instancing): många objekt med ett ritanrop.

:::vulkan
- [Frames in flight (Vulkan Tutorial)](https://vulkan-tutorial.com/Drawing_a_triangle/Drawing/Frames_in_flight): att
  spela in nästa bildruta medan GPU:n ritar.
:::
:::d3d12
- [D3D12HelloFrameBuffering](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld/src/HelloFrameBuffering):
  flera bildrutor i farten.
:::
