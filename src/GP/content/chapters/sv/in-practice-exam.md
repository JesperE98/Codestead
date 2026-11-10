# Prov: I praktiken

Visa vad du har lärt dig i *I praktiken*: att hitta fel med felkontrollerna, felsökningsmeddelandena och verktygen, att
rendera text med FreeType, och 2D-spelet – spelloopen, spritar, banor, kollisioner, partiklar, efterbehandling,
power-ups och text. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in
svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
En kub ritas i en enda färg i stället för med sin textur. Du misstänker texturkoordinaterna. Vilken är den snabbaste kontrollen i shadern?
- [ ] Lägg till en `printf` i fragmentshadern och läs konsolen
- [ ] Sätt en brytpunkt i fragmentshadern i din C++-debugger
- [x] Skriv texturkoordinaterna som färgen – u som rött, v som grönt – och titta på bilden: en gradient betyder att de kommer fram, en enda färg att de inte gör det
- [ ] Rita kuben två gånger och jämför bilderna
---
GPU-kod har ingen konsol och inga brytpunkter i en vanlig debugger. Att skriva ett värde som färgen är det klassiska knepet; färger begränsas till 0..1, så värden med tecken behöver `* 0.5 + 0.5`.
```

```quiz
Vad säger GLSL:s referenskompilator `glslangValidator` om en shader?
- [x] Om den är giltig GLSL enligt specifikationen – oberoende av någon drivrutins egenheter
- [ ] Om pipelinen eller programmet som använder den är rätt inställt
- [ ] Hur snabbt den körs på din GPU
- [ ] Vilka värden dess variabler har vid en viss pixel
---
Kod som den avvisar bör man inte lita på någonstans, även om en drivrutin accepterar den. Hur shadern *används* – vilka attribut den får, vilka texturer som är bundna – kan den inte veta.
```

```quiz
Vad kan en bildrutefelsökare som RenderDoc visa om en fångad bildruta? (Flera svar är rätt.)
- [x] Varje API-anrop i bildrutan, med pipelinens tillstånd vid varje ritanrop
- [x] Innehållet i buffertar och texturer, render targets inräknade
- [ ] Raden i din C++-kod där varje variabel i shadern deklarerades
- [x] En pixels historik: vilka ritanrop som berörde den och vad var och ett skrev
---
De namn du ger objekt (`glObjectLabel`, `vkSetDebugUtilsObjectNameEXT`, `SetName`) syns där också, så fångsterna blir lättare att läsa.
```

```quiz
FreeTypes `face->glyph->advance.x` är 1536 för ett tecken i ett typsnitt på 24 pixlar. Hur långt flyttar `RenderText` pennan för det vid skala 1?
- [ ] 1536 pixlar
- [x] 24 pixlar: advance anges i 1/64 pixel, och `advance >> 6` delar med 64
- [ ] 6 pixlar: advance skiftas 6 bitar åt höger, vilket delar med 256
- [ ] 1536 / 24 = 64 pixlar
---
Skiftet med 6 bitar delar med 2⁶ = 64. Advance omfattar avståndet till nästa glyf, så pennan flyttas längre än glyfens bitmapp är bred.
```

```quiz
Vad är fördelen med FreeType jämfört med ett klassiskt bitmappstypsnitt?
- [ ] FreeTypes glyfer behöver ingen textur alls
- [ ] Ett bitmappstypsnitt kan inte ritas med blending
- [ ] FreeType-glyfer ritas som trianglar, utan shader
- [x] FreeType rastrerar typsnittets konturer i den pixelstorlek som efterfrågas, så en typsnittsfil ger skarpa glyfer i alla storlekar, och alla tecken som typsnittet innehåller – ett bitmappstypsnitt är förrastrerat i en storlek med en fast teckenuppsättning
---
Ett bitmappstypsnitt är snabbt och enkelt, och kursens Vulkan- och Direct3D 12-projekt lägger till och med tillbaka FreeTypes glyfer i en atlas – fylld vid körning, i den storlek programmet ber om.
```

```quiz
Textshadern ger `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r)`. Varför syns varje tecken som sin form och inte som en färgad rektangel?
- [ ] Därför att glyftexturen är genomskinlig utanför glyfen i alla fyra kanaler
- [ ] Därför att rektangeln klipps till glyfens kontur
- [x] Därför att glyfbitmappen med en kanal – dess täckning – blir alfa, och med alfablending lämnar en pixel med täckningen 0 bakgrunden oförändrad
- [ ] Därför att djuptestet förkastar de otäckta pixlarna
---
Utan blending skulle varje rektangel ritas som en rektangel i `textColor` med alfa ignorerad. Glyfens mjuka kanter har täckning mellan 0 och 1, som blendingen gör till mjuka konturer.
```

```quiz
Bollens position uppdateras som `Position += Velocity * dt`. Varför multipliceras hastigheten med `deltaTime`?
- [x] För att bollen ska flyttas lika långt per sekund oavsett bildfrekvens: en långsammare bildruta har ett större dt och flyttar den längre
- [ ] Därför att hastigheten lagras i pixlar per bildruta
- [ ] För att bollen inte ska lämna fönstret
- [ ] Därför att kollisionsdetekteringen behöver ett litet steg
---
Med kursens fasta tid är varje bildruta exakt 1/60 s, så positionerna är desamma i alla API:er och på alla datorer. Med en riktig klocka varierar dt, och spelet går ändå i samma takt.
```

```quiz
Sprite-renderarens modellmatris är translate(position) · translate(½ size) · rotate · translate(−½ size) · scale(size). Varför de två förflyttningarna med halva storleken?
- [ ] För att centrera spriten i fönstret
- [ ] För att texturen inte ska sträckas ut
- [ ] Därför att rektangelns hörn går från −1 till 1
- [x] För att rotera spriten kring sin mitt: rektangelns origo är dess övre vänstra hörn, så den flyttas så att mitten hamnar i origo, roteras där och flyttas tillbaka
---
Läst från höger till vänster: skala enhetsrektangeln till spritens storlek, flytta dess mitt till origo, rotera, flytta tillbaka och sedan till dess position. Utan dem skulle en sprite vrida sig kring sitt övre vänstra hörn.
```

```quiz
En banfil har 15 tal per rad och 8 rader, och banan fyller den övre halvan av fönstret på 800 × 600. Vilken storlek får varje block?
- [ ] 50 × 37,5 pixlar
- [x] 800 / 15 ≈ 53,3 × 300 / 8 = 37,5 pixlar
- [ ] 800 / 15 ≈ 53,3 × 600 / 8 = 75 pixlar
- [ ] Alltid 64 × 32 pixlar, blocktexturens storlek
---
`LoadLevel` får fönstrets bredd och halva dess höjd och delar dem med antalet kolumner och rader – blocktexturerna skalas för att passa.
```

```quiz
Hur tar AABB–cirkel-testet reda på om bollen nuddar ett block?
- [ ] Det testar om bollens omslutande låda överlappar blocket på båda axlarna
- [ ] Det jämför avståndet mellan de två mittpunkterna med radien plus halva blockets bredd
- [x] Det begränsar vektorn från blockets mitt till bollens mitt till blockets halva utsträckning – det ger den punkt på blocket som ligger närmast bollen – och kontrollerar om den punkten ligger närmare bollens mitt än dess radie
- [ ] Det testar blockets fyra hörn mot cirkeln
---
Lådtestet ensamt skulle rapportera träffar vid ett blocks hörn där den runda bollen inte nuddar det. Differensvektorn från den närmaste punkten är också det som kollisionshanteringen använder.
```

```quiz
Kollisionshanteringen finner att bollen träffade ett block underifrån med differensvektorn (2, −9) och radien 12,5. Vad händer med bollen?
- [x] Dess vertikala hastighet vänds, och den flyttas 3,5 pixlar (12,5 − 9) nedåt, ut ur blocket
- [ ] Dess horisontella hastighet vänds, och den flyttas 10,5 pixlar åt vänster
- [ ] Båda hastighetskomponenterna vänds, och den flyttas inte
- [ ] Den flyttas tillbaka dit den var i förra bildrutan
---
`VectorDirection` väljer den kompassriktning som har störst skalärprodukt – här vertikal –, inträngningen är radien minus avståndet på den axeln, och bara den komponenten av hastigheten vänds.
```

```quiz
Efter studsen mot racketen räknar learnopengl ut `Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity)`. Varför?
- [ ] För att göra bollen snabbare för varje studs
- [ ] För att bollen inte ska gå igenom racketen
- [ ] För att bollen ska gå rakt uppåt
- [x] Därför att den nya x-hastigheten beror på var bollen träffade racketen; att normalisera och skala med den gamla längden behåller bollens fart medan dess riktning ändras
---
Utan det skulle en träff nära racketens kant göra bollen mycket snabbare. Raden efter, `Velocity.y = -abs(Velocity.y)`, ser till att bollen alltid lämnar uppåt.
```

```quiz
Varför återanvänder partikelgeneratorn döda partiklar med `firstUnusedParticle` i stället för att skapa en ny partikel för varje ny som behövs?
- [ ] Därför att en partikel som har dött inte kan ritas igen
- [x] Därför att de 500 partiklarna skapas en gång: att återanvända en död undviker att minne allokeras och frigörs varje bildruta, och att leta från den senast använda hittar oftast en död direkt
- [ ] Därför att `rand()` skulle ge nya partiklar samma tal
- [ ] Därför att GPU:n bara tar emot ett fast antal ritanrop
---
Om ingen partikel är död skrivs den första över – det äldsta spåret bleknar lite tidigt, vilket ingen ser.
```

```quiz
I kapitlet Efterbehandling ritas spelet i ett multisamplat mål. Varför löses det målet upp till en textur innan efterbehandlingsshadern samplar det?
- [ ] Därför att ett multisamplat mål bara kan ritas i en gång per bildruta
- [ ] Därför att resolven lägger på effekterna
- [x] Därför att efterbehandlingsshadern samplar en vanlig textur med en färg per pixel; resolven tar medelvärdet av varje pixels samples och skriver det där – den kantutjämnade bilden av spelet
- [ ] Därför att ett multisamplat mål inte har några färgkanaler
---
Effekterna arbetar sedan på den bilden: shake gör den suddig, confuse speglar och inverterar den, chaos hittar dess kanter.
```

```quiz
Två pass-through-power-ups fångas efter varandra. När den första tar slut, varför fortsätter bollen att gå igenom block?
- [x] Därför att `UpdatePowerUps` bara slår av effekten om `IsOtherPowerUpActive` inte hittar någon annan aktiv power-up av samma typ – den andra är fortfarande aktiv
- [ ] Därför att 10 s läggs till bollen, inte till power-upen
- [ ] Därför att pass-through aldrig kan slås av
- [ ] Därför att den andra power-upen nollställer den förstas varaktighet
---
Effekten varar tills den sista power-upen av sin typ har tagit slut. Det som tas bort är bara power-ups som är förstörda och inte längre aktiva.
```

```quiz
Varför ritas texten med liven efter efterbehandlingsrektangeln och inte mellan `BeginRender` och `EndRender`?
- [ ] Därför att text inte kan ritas i ett multisamplat mål
- [ ] Därför att efterbehandlingsshadern skulle göra texten för liten
- [ ] Därför att liven bara är kända efter bildrutan
- [x] För att effekterna inte ska röra den: ritad i fönstret efter rektangeln förblir texten läsbar medan skärmen skakar, är förvirrad eller visar kaos
---
learnopengls kommentar säger det: "don't include in postprocessing". Allt som ritas före `EndRender` är en del av bilden som effekterna ändrar.
```

```quiz
learnopengls spel spelar musik och ljudeffekter. Vad bidrar {{api}} med till det?
- [ ] Det avkodar MP3-filen
- [x] Ingenting: ett grafik-API pratar bara med GPU:n – ett separat ljudbibliotek (irrKlang hos learnopengl, eller OpenAL Soft, miniaudio, SDL_mixer, XAudio2) spelar ljuden, anropat från spelets logik
- [ ] Det spelar ljuden genom GPU:ns ljudutgång
- [ ] Det mixar ljuden i en compute shader
---
Anropen hamnar i `Init` (musiken som upprepas) och `DoCollisions` (effekterna) – aldrig i renderingskoden.
```

:::opengl
```quiz
Två OpenGL-anrop i rad används fel, och sedan anropas `glGetError()` en gång. Vad returnerar den?
- [ ] Båda felen, som en bitmask
- [ ] Det andra felet, eftersom det skriver över det första
- [x] Det första felet: när en felflagga väl är satt registreras inga andra fel förrän flaggan har lästs – och att läsa den nollställer den
- [ ] `GL_NO_ERROR`, eftersom fel bara sparas under ett anrop
---
Därför anropas learnopengls `glCheckError()` efter små grupper av anrop, med `__FILE__` och `__LINE__`. På distribuerade system kan flera flaggor vara satta, så den läser dem i en loop.
```
:::
:::vulkan
```quiz
Ett Vulkan-program skapar en pipeline vars vertexshader läser en indata som pipelinen inte beskriver. `vkCreateGraphicsPipelines` returnerar `VK_SUCCESS`. Varför?
- [ ] Därför att Vulkan enligt specifikationen fyller saknade indata med noll
- [ ] Därför att felet bara rapporteras när pipelinen förstörs
- [ ] Därför att `VK_SUCCESS` betyder "lyckades med varningar"
- [x] Därför att drivrutinen inte kontrollerar valid usage – att bryta mot den är odefinierat beteende; bara validation layer rapporterar det, om det är påslaget, genom debug messengern
---
Att kontrollera varje anrop skulle kosta tid i varje bildruta i varje färdigt program. I ett release-bygge (`NDEBUG`) utelämnar kursens kod lagret.
```
:::
:::d3d12
```quiz
Vad är skillnaden mellan att läsa info queue med `CheckDebugMessages()` och en callback som registrerats med `RegisterMessageCallback`?
- [ ] Info queue innehåller bara fel, callbacken även varningar
- [x] Info queue ger de lagrade meddelandena i efterhand, vid nästa kontroll (learnopengls `glGetError`-sätt); callbacken anropas med varje meddelande i samma ögonblick som det skyldiga anropet görs (learnopengls debug output)
- [ ] Callbacken fungerar i release-byggen, info queue bara i debug-byggen
- [ ] Det finns ingen: båda anropas av GPU:n efter varje bildruta
---
Med `SetBreakOnSeverity` kan debug layer till och med bryta in i debuggern vid det skyldiga anropet – när en debugger är ansluten (`IsDebuggerPresent()`).
```
:::

:::opengl
```quiz
Varför slår learnopengl på `GL_DEBUG_OUTPUT_SYNCHRONOUS` tillsammans med debug output?
- [ ] För att göra debug output snabbare
- [x] För att drivrutinen ska anropa callbacken inne i det anrop som orsakade meddelandet: en brytpunkt i callbacken visar då det skyldiga anropet i anropsstacken
- [ ] Därför att debug output bara fungerar med synkron rendering
- [ ] För att rapportera varje meddelande två gånger
---
Utan den kan drivrutinen anropa callbacken senare, från en annan tråd, när anropsstacken inte längre visar varifrån felet kom.
```
:::
:::vulkan
```quiz
Ett valideringsmeddelande innehåller `VUID-VkGraphicsPipelineCreateInfo-Input-07904`. Vad är det?
- [ ] Pipelineobjektets handle
- [ ] En felkod som `vkCreateGraphicsPipelines` returnerade
- [ ] Raden i shadern där felet finns
- [x] Valid usage-ID:t: namnet på den regel i specifikationen som bröts – meddelandet slutar med regelns text
---
Med `vkSetDebugUtilsObjectNameEXT` får objekten i meddelandet också namn, så det säger vilken shadermodul det gäller.
```
:::
:::d3d12
```quiz
`SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_ERROR, TRUE)` anropas bara när `IsDebuggerPresent()` returnerar true. Varför?
- [ ] Därför att det bara fungerar på en GPU med inbyggd debugger
- [ ] Därför att det annars skulle göra programmet långsammare
- [x] Därför att brytningen utlöser ett undantag som en debugger fångar vid det skyldiga anropet; utan debugger hanterar ingen det och programmet avslutas
- [ ] Därför att info queue inte finns utan debugger
---
Med en debugger är brytningen som en brytpunkt vid anropet som bröt mot en regel – anropsstacken visar din rad.
```
:::

:::opengl
```quiz
learnopengls `Load` anropar `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` innan den laddar upp glyferna. Varför?
- [ ] För att texturerna ska använda 1 byte per kanal
- [ ] För att ladda upp bara en glyf åt gången
- [x] Därför att OpenGL som standard väntar sig att varje rad i bilddata börjar på en multipel av 4 byte, och en glyf med en byte per pixel har rader som är lika många byte som den är bred – en glyf på 13 pixlar skulle läsas med rader på 16 byte och bli sned
- [ ] Därför att `GL_RED`-texturer måste justeras till 1 pixel
---
De flesta bilder har 4 byte per pixel, så deras rader är alltid multiplar av 4 – standardvärdet märks aldrig där.
```
:::
:::vulkan
```quiz
Varför lägger Vulkan-projektet alla glyfer i en atlasbild i stället för learnopengls en textur per glyf?
- [ ] Därför att Vulkan-bilder måste vara kvadratiska
- [x] Därför att en bild inte kan vara 0 × 0 – mellanslagets bitmapp är det – och 128 bilder med minne, vyer och descriptor sets, med ett annat set bundet för varje tecken, vore många objekt för lite text
- [ ] Därför att `VK_FORMAT_R8_UNORM` bara är tillåtet för stora bilder
- [ ] Därför att shadern bara kan sampla en bild
---
Atlasen är det klassiska bitmappstypsnittets idé, fylld av FreeType vid körning: varje rektangel samplar sin glyfs rektangel, och ett descriptor set räcker för all text.
```
:::
:::d3d12
```quiz
Varför lägger Direct3D 12-projektet alla glyfer i en atlastextur i stället för learnopengls en textur per glyf?
- [ ] Därför att Direct3D 12-texturer måste vara kvadratiska
- [ ] Därför att `DXGI_FORMAT_R8_UNORM` bara är tillåtet för stora texturer
- [ ] Därför att pixelshadern bara kan sampla en textur
- [x] Därför att en textur inte kan vara 0 × 0 – mellanslagets bitmapp är det – och 128 resurser med uppladdningsbuffertar, barriärer och descriptors, med en table satt för varje tecken, vore många objekt för lite text
---
Atlasen är det klassiska bitmappstypsnittets idé, fylld av FreeType vid körning: varje rektangel samplar sin glyfs rektangel, en descriptor table räcker för all text, och en hel rad är ett ritanrop.
```
:::

:::opengl
```quiz
Hur ger OpenGL-versionen av sprite-renderaren varje sprite dess egen position, storlek, rotation och färg?
- [x] Med uniformerna `model` och `spriteColor`, som sätts före varje sprites ritanrop; projektionens uniform sätts en gång, den ändras aldrig
- [ ] Med en vertexbuffert per sprite
- [ ] Med push constants
- [ ] Genom att bygga om rektangelns hörn på CPU:n för varje sprite
---
Alla spritar delar en rektangel med sex hörn; bara uniformerna ändras. Det är enkelt – och skälet till att learnopengl föreslår instansiering för många spritar.
```
:::
:::vulkan
```quiz
Hur ger Vulkan-versionen av sprite-renderaren varje sprite dess egen position, storlek, rotation och färg?
- [ ] Med en uniform buffer per sprite, som uppdateras före varje ritanrop
- [x] Med push constants (`model` och `spriteColor`, 76 byte, för vertex- och fragmentsteget) som spelas in före varje sprites ritanrop; projektionen finns i uniform buffern
- [ ] Med en vertexbuffert per sprite
- [ ] Med en ny pipeline per sprite
---
En uniform buffer läses när command buffern körs, så att skriva om den mellan ritanropen skulle ge varje sprite de sista värdena; push constants spelas in med varje ritanrop.
```
:::
:::d3d12
```quiz
Hur ger Direct3D 12-versionen av sprite-renderaren varje sprite dess egen position, storlek, rotation och färg?
- [ ] Med en konstantbuffert per sprite, som skrivs om före varje ritanrop
- [ ] Med en vertexbuffert per sprite
- [x] Med root constants (`model` och `spriteColor`, 19 värden i root parameter 0) som sätts före varje sprites ritanrop med `SetGraphicsRoot32BitConstants`; projektionen finns i konstantbufferten
- [ ] Med en ny pipeline state per sprite
---
En konstantbuffert i en upload heap läses när command listen körs, så att skriva om den mellan ritanropen skulle ge varje sprite de sista värdena; root constants spelas in med varje ritanrop.
```
:::

:::opengl
```quiz
`DrawParticles` sätter `glBlendFunc(GL_SRC_ALPHA, GL_ONE)` och i sitt slut `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`. Varför det andra anropet?
- [ ] Därför att partikelshadern behöver det för nästa partikel
- [ ] Därför att `GL_ONE` ändå bara gäller ett ritanrop
- [ ] För att ta bort partiklarna från skärmen
- [x] Därför att blendfunktionen är globalt tillstånd: utan återställningen skulle bollen som ritas härnäst – och nästa bildrutas spritar – adderas till bilden i stället för att täcka den
---
I Vulkan och Direct3D 12 är blendtillståndet en del av pipelineobjektet, så partiklarna använder helt enkelt en andra pipeline och inget behöver återställas.
```
:::
:::vulkan
```quiz
Hur ritar Vulkan-projektet partiklarna additivt och spritarna med alfablending?
- [ ] Med `vkCmdSetBlendConstants` före partiklarna
- [x] Med två pipelines som skiljer sig i blendfaktorn för målfärgen – `VK_BLEND_FACTOR_ONE` för partiklarna, `ONE_MINUS_SRC_ALPHA` för spritarna; att binda en pipeline sätter hela dess tillstånd, så inget behöver återställas efteråt
- [ ] Med ett blendläge som skickas som push constant
- [ ] Genom att rita partiklarna i ett separat render pass
---
learnopengl ändrar den globala blendfunktionen och måste sätta tillbaka den efter partiklarna. En Vulkan-pipeline bär sitt blendtillstånd.
```
:::
:::d3d12
```quiz
Hur ritar Direct3D 12-projektet partiklarna additivt och spritarna med alfablending?
- [ ] Med `OMSetBlendFactor` före partiklarna
- [ ] Med ett blendläge som sätts som root constant
- [x] Med två pipeline states som skiljer sig i målets blend – `D3D12_BLEND_ONE` för partiklarna, `D3D12_BLEND_INV_SRC_ALPHA` för spritarna; att sätta en pipeline state sätter hela dess tillstånd, så inget behöver återställas efteråt
- [ ] Genom att rita partiklarna i ett separat render target
---
learnopengl ändrar den globala blendfunktionen och måste sätta tillbaka den efter partiklarna. En pipeline state i Direct3D 12 bär sitt blendtillstånd.
```
:::

:::opengl
```quiz
Hur gör `EndRender` om den multisamplade framebuffern till den textur som efterbehandlingsshadern samplar?
- [ ] Med `glCopyTexImage2D` från renderbuffern
- [ ] Efterbehandlingsshadern läser renderbufferns samples själv
- [x] `glBlitFramebuffer` från `MSFBO` (läs) till `FBO` (rita) med `GL_COLOR_BUFFER_BIT` – en blit från en multisamplad framebuffer till en med ett sample löser upp; sedan ritar `glBindFramebuffer(GL_FRAMEBUFFER, 0)` i fönstret igen
- [ ] `glGenerateMipmap` på renderbuffern
---
För en resolve måste de två rektanglarna vara lika stora, så `GL_NEAREST` räcker. En renderbuffer kan inte samplas alls – därav den andra framebuffern med en textur.
```
:::
:::vulkan
```quiz
Hur gör Vulkan-projektet om bilden med 4 samples till den textur som efterbehandlingsshadern samplar?
- [x] Texturen är subpassets resolve-attachment i passet utanför skärmen: när render passet slutar tas medelvärdet av varje pixels samples och skrivs i den, och den slutar i `SHADER_READ_ONLY_OPTIMAL`
- [ ] Med `vkCmdBlitImage` från bilden med 4 samples till texturen
- [ ] Efterbehandlingsshadern läser de 4 samplen med `texelFetch` och tar medelvärdet
- [ ] Swapkedjans bild är multisamplad och löser upp sig själv när den visas
---
`vkCmdBlitImage` kan inte ta en multisamplad källa. Och sprite- och partikelpipelines måste göras för det render passet med `VK_SAMPLE_COUNT_4_BIT` – en pipeline hör till ett render pass och ett antal samples.
```
:::
:::d3d12
```quiz
Hur gör Direct3D 12-projektet om render targetet med 4 samples till den textur som efterbehandlingsshadern samplar?
- [ ] Swapkedjans back buffer är multisamplad och löser upp sig själv när den visas
- [ ] Med `CopyResource` från det multisamplade målet till texturen
- [ ] Efterbehandlingsshadern läser de 4 samplen och tar medelvärdet
- [x] Med `ResolveSubresource(texture, 0, msTarget, 0, format)`, efter barriärer till `RESOLVE_SOURCE` och `RESOLVE_DEST` och med barriärer tillbaka till `RENDER_TARGET` och `PIXEL_SHADER_RESOURCE` efter den
---
En swapkedja med flip-modellen kan inte vara multisamplad alls. Och sprite- och partikel-PSO:erna måste ha `SampleDesc.Count` 4 för att rita i det multisamplade målet.
```
:::
