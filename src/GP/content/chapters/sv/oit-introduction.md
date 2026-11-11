# OIT: introduktion

Med det här kapitlet börjar en ny del: *Gästartiklar*. Mellan 2020 och 2022 publicerade learnopengl.com en serie
artiklar av gästskribenter om ämnen utanför huvudkursen – ordningsoberoende transparens, skelettanimation, scengrafer
och frustum culling, kaskaderade skuggkartor, tessellering, OpenGL:s direct state access, compute shaders, fysikaliskt
baserad bloom och ytljus. Varje artikel står i stort sett på egna ben och bygger på de delar du redan gått igenom. Som
allt tidigare är teknikerna inte knutna till ett visst API: de handlar om hur man organiserar pass, buffrar och shaders,
och de fungerar likadant i OpenGL, Vulkan och DirectX 12. Varje kapitel visar var {{api}} lägger dem – och där en
artikel handlar om OpenGL självt (*DSA*) berättar kapitlet vad de explicita API:erna gör i stället.

De två första kapitlen handlar om *ordningsoberoende transparens* (order-independent transparency, förkortat OIT). Det här
kapitlet förklarar problemet och de olika lösningsfamiljerna; nästa kapitel, *Weighted Blended*, implementerar en av dem.
I kapitlet *Blending* i delen *Avancerad OpenGL* renderade du halvgenomskinliga fönster och såg att de bara blev rätt när
du sorterade dem: först alla ogenomskinliga objekt, sedan de genomskinliga från det som ligger längst bort till det
närmaste. Kapitlet kallade det "bryt inte ordningen" och gick vidare. Här tittar vi på varför ordningen spelar roll,
varför det inte alltid går att sortera, och vad renderare gör i stället.

## Transparens och blending

En genomskinlig yta släpper igenom en del av ljuset bakifrån. I realtidsgrafik beskriver vi det med ett enda tal per
fragment, dess *alfa*: hur stor andel av det som ligger bakom som ytan täcker (dess opacitet). Alfa 1 är ogenomskinligt, 0
är osynligt, 0.5 täcker hälften. När ett fragment med färgen `Cs` och alfa `αs` hamnar på en pixel som redan har färgen
`Cd`, räknar blendingen ut

```text
C = Cs · αs + Cd · (1 − αs)
```

det välbekanta `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` – i Vulkan faktorerna `VK_BLEND_FACTOR_SRC_ALPHA` /
`VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`, i DirectX 12 `D3D12_BLEND_SRC_ALPHA` / `D3D12_BLEND_INV_SRC_ALPHA`. Operationen
kallas *over*-operatorn: det nya fragmentet läggs *över* det som redan finns. Den är helt rätt för ett genomskinligt lager
över en ogenomskinlig bakgrund. Med flera lager blir den bara rätt om lagren kommer bakifrån och framåt, eftersom `over`
inte är kommutativ: `A over B` är inte samma sak som `B over A`.

Ta ett grönt lager (0, 1, 0) och ett blått lager (0, 0, 1), båda med alfa 0.5, över svart. Först grönt, sedan blått
ovanpå:

```text
efter grönt:  (0, 1, 0) · 0.5 + (0, 0, 0) · 0.5       = (0, 0.5,  0)
efter blått:  (0, 0, 1) · 0.5 + (0, 0.5, 0) · 0.5     = (0, 0.25, 0.5)
```

Först blått, sedan grönt ovanpå:

```text
efter blått:  (0, 0, 1) · 0.5 + (0, 0, 0) · 0.5       = (0, 0,   0.5)
efter grönt:  (0, 1, 0) · 0.5 + (0, 0, 0.5) · 0.5     = (0, 0.5, 0.25)
```

Två olika färger. Det lager som kommer sist dominerar, och det är precis vad man väntar sig av flera lager färgat glas:
det närmaste ser man oförtunnat, de bakom genom det. Rätt resultat är alltså det där lagret längst bort blendas först och
det närmaste sist.

```quiz
Ett grönt och ett blått lager, båda med alfa 0.5, blendas över svart med over-operatorn. Det blå lagret ligger närmast kameran. Vilken ordning ger rätt färg, och vilken färg blir det?
- [ ] Vilken ordning som helst: blendingen adderar färgerna, så resultatet blir (0, 0.5, 0.5) åt båda hållen
- [ ] Först blått, sedan grönt: (0, 0.5, 0.25)
- [x] Först grönt, sedan blått: (0, 0.25, 0.5) – lagret längst bort först, det närmare ovanpå
- [ ] Först grönt, sedan blått: (0, 0.5, 0.25)
---
Over-operatorn väger det nya fragmentet med dess alfa och det som redan finns med 1 − alfa, så det lager som blendas sist väger tyngst. För att bilden ska bli rätt måste det vara det närmaste lagret – här det blå.
```

Det finns ett andra problem som inte har med formeln att göra: djupbuffern. Genomskinliga objekt ritas med djuptestet
påslaget, så att ogenomskinliga objekt framför dem döljer dem. Om de dessutom *skriver* sitt djup hindrar ett nära
genomskinligt fragment alla fragment bakom det från att ritas över huvud taget – djuptestet förkastar dem innan de hinner
blendas. Objektet längre bort försvinner helt enkelt bakom det närmare, som om det närmare vore ogenomskinligt. Stänger
man av djupskrivningen (`glDepthMask(GL_FALSE)`, `depthWriteEnable = VK_FALSE`, `D3D12_DEPTH_WRITE_MASK_ZERO`) slipper man
hålen, men då blir blendningsordningen den ordning objekten råkar ritas i – fortfarande fel, bara mindre uppenbart.

## Sortering

Det klassiska svaret är det från kapitlet *Blending*: rita alla ogenomskinliga objekt först, med djupskrivning påslagen;
sortera sedan de genomskinliga objekten efter avståndet till kameran och rita dem från det som ligger längst bort till
det närmaste. Det fungerar bra för många scener och är vad de flesta motorer fortfarande gör för det mesta av sin
transparens. Men det har sina gränser:

- **Sorteringen sker per objekt, blendingen per fragment.** Man sorterar efter ett avstånd per objekt, oftast mittpunktens.
  Två objekt vars mittpunkter ligger i en ordning kan ha fragment i den motsatta: en lång glasruta bredvid en liten, ett
  fönster sett snett från sidan. Den sorterade ordningen är rätt för de flesta pixlar och fel för några.
- **Objekt som skär varandra går inte att sortera.** Om två genomskinliga fyrhörningar går igenom varandra ligger den ena
  framför på ena sidan om skärningslinjen och bakom på den andra. Ingen ordning av de två objekten blir rätt överallt.
- **Cykliskt överlapp.** Tre objekt kan överlappa som bladen i en solfjäder: A framför B, B framför C, C framför A. Inte
  heller här blir någon ordning av hela objekt rätt – man skulle behöva dela upp dem.
- **Objekt som överlappar sig själva.** Ett enda genomskinligt mesh – en flaska, ett träds lövverk, ett partikelmoln i ett
  enda draw call – har trianglar framför andra trianglar i samma mesh. Att sortera objekten sorterar inte dem; man skulle
  behöva sortera trianglarna varje bildruta, och inte ens det fungerar för trianglar som skär varandra.
- **Kostnaden.** Sorteringen är CPU-arbete varje bildruta, och den krockar med andra ordningar man vill ha: efter material
  eller shader för att spara tillståndsbyten, framifrån och bakåt i det ogenomskinliga passet för att spara skuggningsarbete.

Att sortera per fragment vore alltid rätt – det är vad over-operatorn kräver – men GPU:n rastrerar trianglarna i den
ordning du skickar dem, och ett fragment vet ingenting om de andra fragment som kommer att hamna på samma pixel. Det är
det problemet ordningsoberoende transparens löser: att få resultatet av blending bakifrån och framåt (eller något nära
det) oavsett i vilken ordning draw-anropen kommer.

```quiz
Vilken av de här scenerna går INTE att få rätt genom att sortera de genomskinliga objekten bakifrån och framåt efter deras mittpunkter?
- [ ] Tre separata genomskinliga fyrhörningar på olika avstånd som inte skär varandra
- [x] Två genomskinliga fyrhörningar som går igenom varandra
- [ ] En genomskinlig fyrhörning framför en ogenomskinlig kub
- [ ] En genomskinlig fyrhörning över bakgrunden
---
Där två objekt skär varandra ligger vart och ett framför det andra på ena sidan om skärningslinjen, så ingen ordning av hela objekt blir rätt för varje pixel. Man skulle behöva dela upp dem, eller blenda per fragment – vilket är vad OIT gör.
```

## Ordningsoberoende transparens

Teknikerna faller i några familjer. De skiljer sig i hur exakta de är, hur mycket minne de behöver och hur många pass de
tar.

### Depth peeling

*Depth peeling* (Cass Everitt, NVIDIA, 2001) renderar den genomskinliga geometrin flera gånger. Det första passet behåller
per pixel det närmaste genomskinliga fragmentet – ett vanligt djuptest. Det andra passet behåller det närmaste fragmentet
*bakom* det som första passet hittade: det läser första passets djup och kastar allt som ligger på eller framför det.
Varje ytterligare pass skalar av nästa lager. Lagren blendas sedan i ordning, bakifrån och framåt (eller framifrån och
bakåt med "under"-operatorn). Resultatet är exakt, och det behövs bara djuptexturer och vanlig blending. Priset är ett
pass över all genomskinlig geometri per lager: en scen där upp till åtta ytor överlappar i någon pixel behöver åtta pass
för att bli rätt där. *Dual depth peeling* skalar framifrån och bakifrån samtidigt och halverar antalet pass.

### A-buffrar och länkade listor per pixel

En *A-buffer* (Loren Carpenter, 1984) håller inte en färg per pixel utan en lista med alla fragment som hamnar på den. På
GPU:er som kan skriva till godtyckligt minne från en fragment shader – image load/store eller shader storage buffers i
OpenGL 4.2/4.3, storage buffers i Vulkan, unordered access views i DirectX 12 – görs det med *länkade listor per pixel*:
ett pass lagrar varje genomskinligt fragment (färg, alfa, djup) i en stor buffer, med en atomisk räknare för att få en
ledig plats och ett atomiskt utbyte i en "huvud"-bild per pixel för att länka in det först i pixelns lista. Ett andra
pass över hela skärmen går igenom varje pixels lista, sorterar fragmenten efter djup och blendar dem bakifrån och framåt.
Resultatet är exakt för varje pixel med ett enda geometripass. Kostnaderna: minne vars storlek beror på hur många
fragment scenen ger (obegränsat i princip – man måste välja en storlek och bestämma vad som händer när den inte räcker),
atomiska operationer, och en sortering per pixel som blir långsam när listorna är långa. Varianter behåller bara de k
närmaste fragmenten per pixel (*k-buffrar*) för att begränsa minnet.

```quiz
Vad lagrar en länkad lista per pixel, och vad gör det andra passet?
- [ ] En färg per pixel, blendad i den ordning fragmenten kommer; det andra passet gör tone mapping
- [ ] Det närmaste genomskinliga fragmentet i varje pixel; det andra passet skalar av nästa lager
- [ ] En viktad summa av varje pixels färger; det andra passet dividerar med summan av vikterna
- [x] Varje genomskinligt fragment i varje pixel med dess djup; det andra passet sorterar varje pixels fragment efter djup och blendar dem bakifrån och framåt
---
Det gör tekniken exakt med ett geometripass, till priset av minne som växer med antalet fragment och atomiska operationer för att bygga listorna. Det första svaret är vanlig blending, det andra depth peeling, det tredje weighted blended OIT.
```

### Weighted blended OIT

*Weighted blended order-independent transparency* (Morgan McGuire och Louis Bavoil, 2013) offrar exaktheten för fart och
enkelhet. I stället för over-operatorn, som beror på ordningen, använder den operationer som inte gör det: summor och
produkter. I ett enda pass över den genomskinliga geometrin samlar den per pixel ihop summan av de genomskinliga färgerna,
var och en viktad med sin alfa och med en vikt som gynnar fragment nära kameran, och produkten av alla fragments
`(1 − α)` – hur mycket av bakgrunden som fortfarande syns igenom. Addition och multiplikation är kommutativa, så
draw-anropens ordning spelar inte längre någon roll. Ett avslutande pass över hela skärmen dividerar den viktade summan
med summan av vikterna, får fram en medelfärg och blendar den över den ogenomskinliga bilden med den täckning den räknat
ut.

Resultatet blir inte exakt detsamma som med sorterad blending: där flera lager överlappar visar tekniken ett viktat
medelvärde, där sorterad blending skulle låta det närmaste lagret synas tydligare. För partiklar, rök, glas och lövverk
märks det oftast knappt, och tekniken behöver bara två extra render targets, en fast mängd minne och ingen sortering alls.
Den fungerar på varje GPU som kan blenda i flera render targets med olika blendfunktioner – och det är därför learnopengl
valde den, och därför den är nästa kapitel.

### Moment och andra approximationer

Senare metoder förfinar idén att approximera transmittansen per pixel – hur synligheten av bakgrunden avtar med djupet –
i stället för att lagra varje fragment. *Moment-based OIT* (Münstermann, Krumpen, Klein och Peters, 2018) lagrar några
statistiska moment av fragmentens djup per pixel i ett första pass och rekonstruerar transmittansen på godtyckligt djup ur
dem i ett andra; *stochastic transparency* ersätter alfa med en slumpmässig täckningsmask och låter multisampling ta
medelvärdet. De hamnar mellan de exakta metoderna och weighted blending i både kvalitet och kostnad.

| Teknik | Exakt? | Geometripass | Minne |
|---|---|---|---|
| Sortering per objekt | där objekten inte skär eller överlappar sig själva | 1 | inget extra |
| Depth peeling | ja | ett per lager | några texturer i skärmstorlek |
| Länkade listor per pixel | ja (tills buffern tar slut) | 1 + ett resolve-pass | växer med fragmenten |
| Weighted blended OIT | approximation | 1 + ett kompositpass | två texturer i skärmstorlek |
| Moment-based OIT | approximation (bättre) | 2 + ett resolve-pass | några texturer i skärmstorlek |

```quiz
Varför är weighted blended OIT oberoende av i vilken ordning de genomskinliga objekten ritas?
- [ ] För att den sorterar fragmenten i fragment shadern
- [ ] För att den renderar ett pass per lager, från det närmaste till det som ligger längst bort
- [ ] För att den stänger av djuptestet
- [x] För att den bara adderar viktade färger och multiplicerar transmittanser – operationer vars resultat inte beror på ordningen – och gör om summan till en medelfärg på slutet
---
Det är också därför den är en approximation: ett medelvärde av lagren är inte vad den ordningsberoende over-operatorn ger, där det närmaste lagret dominerar.
```

Riktiga renderare blandar de här: de sorterar det som går att sortera, använder weighted blending eller en variant för
partiklar och andra volymer av små genomskinliga bitar, och sparar en exakt metod för de få fall där det spelar roll.

## Projektet

Projektet visar problemet: det är nästa kapitels start, ännu utan uppgifter. Tre fyrhörningar på 2 × 2 är vända mot
kameran, som står i (0, 0, 5) och tittar längs -z:

- en **röd** ogenomskinlig fyrhörning i (0.5, -0.2, 1.0);
- en **grön** fyrhörning med alfa 0.5 i (-0.3, -0.6, 2.0) – den närmaste;
- en **blå** fyrhörning med alfa 0.5 i (-0.6, 0.5, 0.0) – den som ligger längst bort, med sin nedre högra del bakom den
  röda.

learnopengls demo till nästa kapitel lägger alla tre i mitten, där de täcker varandra helt; kursen flyttar isär dem så
att varje fall syns – en genomskinlig fyrhörning över bakgrunden, över den ogenomskinliga, över en annan genomskinlig och
bakom den ogenomskinliga. Programmet ritar dem i learnopengls ordning: först den röda, sedan den gröna, sedan den blå. För
de två genomskinliga är det framifrån och bakåt – fel ordning – och de blendas på vanligt sätt, med djupskrivning
påslagen.

:::opengl
`main.cpp` begär en OpenGL **4.2** core-kontext, inte 3.3 som i resten av kursen: nästa kapitel behöver `glBlendFunci`
(en blendfunktion per färg-attachment, core sedan 4.0) och `layout (binding = N)` på samplers i GLSL (4.2). Alla shaders
börjar med `#version 420 core`. Det solida passet ritar den röda fyrhörningen med `solid.vs` / `solid.fs`
(`uniform vec3 color`), sedan slår programmet på blending och ritar den gröna och den blå med `transparent.vs` /
`transparent.fs`:

```cpp
        // ordinary alpha blending, in the order the objects happen to be drawn (not sorted by distance):
        // the green quad is drawn first although it is the nearest
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
```

`transparent.fs` skriver bara ut färgen med dess alfa (`frag = color;`). Varje draw-anrop sätter learnopengls två
uniforms, `mvp` och `color`. Filerna `composite.vs` / `.fs` och `screen.vs` / `.fs` finns redan till nästa kapitel;
`main` i `composite.fs` är fortfarande en TODO.
:::
:::vulkan
I Vulkan är blendfunktionen en del av pipelinen. Projektets hjälpfunktion `createPipeline(…)` tar emot djuptest,
djupskrivning, om det ska blendas och blendfaktorerna för upp till två färg-attachments, och den genomskinliga pipelinen
skapas med vanlig alfablending och djupskrivning påslagen:

```cpp
        // transparent objects: ordinary alpha blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA), depth test with depth writes
        createPipeline("shaders/transparent.vert.spv", "shaders/transparent.frag.spv", renderPass, 1, VK_TRUE, VK_TRUE, VK_TRUE,
            VK_BLEND_FACTOR_SRC_ALPHA, VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, VK_BLEND_FACTOR_ONE, VK_BLEND_FACTOR_ZERO, transparentPipeline);
```

Allt ritas i fönstrets render pass. learnopengls två uniforms `mvp` och `color` är push constants (`struct PushConstants
{ glm::mat4 mvp; glm::vec4 color; }`), och `transparent.frag` skriver ut `pc.color` som den är. Shaderfilerna
`composite.vert` / `.frag` och `screen.vert` / `.frag` finns redan till nästa kapitel; `main` i `composite.frag` är
fortfarande en TODO.
:::
:::d3d12
I DirectX 12 är blendfunktionen en del av pipeline state-objektet. Projektet ritar den röda fyrhörningen med
`m_solidPipelineState` och den gröna och den blå med `m_transparentPipelineState`, som blendar på vanligt sätt och
behåller standardinställningen för djupet (test LESS, skrivning på):

```cpp
        psoDesc.BlendState.RenderTarget[0].BlendEnable = TRUE;
        psoDesc.BlendState.RenderTarget[0].SrcBlend = D3D12_BLEND_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].DestBlend = D3D12_BLEND_INV_SRC_ALPHA;
        psoDesc.BlendState.RenderTarget[0].BlendOp = D3D12_BLEND_OP_ADD;
```

Allt ritas direkt i back buffern med en djupbuffer. learnopengls två uniforms `mvp` och `color` är root constants
(`struct ObjectConstants { XMFLOAT4X4 mvp; XMFLOAT4 color; }`), och `PSMain` i `transparent.hlsl` returnerar `color`
som den är. `composite.hlsl` och `screen.hlsl` finns redan till nästa kapitel; `PSMain` i `composite.hlsl` är
fortfarande en TODO.
:::

Det här kapitlet har inga uppgifter. Bygg och kör programmet: mot svart ser du den röda fyrhörningen till höger, den
halvgenomskinliga gröna nere till vänster framför den, och den halvgenomskinliga blå uppe till vänster, delvis dold
bakom den röda. Där den gröna ligger över den röda blandas de till en olivgrön ton – rätt, eftersom den röda är
ogenomskinlig och ritades först. Men titta på den blå fyrhörningens nedre vänstra hörn: där den gröna täcker den (runt
pixeln (230, 300)) saknas den blå helt enkelt. Hörnet är avskuret längs den gröna fyrhörningens överkant, och pixeln där
är rent mörkgrön (0, 128, 0) – grönt över svart.

```quiz
Varför saknas den blå fyrhörningen där den gröna täcker den?
- [ ] Over-operatorn ger noll för ett blått lager bakom ett grönt
- [x] Den gröna ritades först och skrev sitt djup; den blå bakom den klarar inte djuptestet där och blendas aldrig
- [ ] Den blå fyrhörningen ligger bakom den röda där
- [ ] Den blå fyrhörningens alfa är för liten för att synas genom den gröna
---
Djupskrivning på ett genomskinligt objekt gör att det döljer det som ligger bakom, som om det vore ogenomskinligt. Med djupskrivningen avstängd skulle den blå blendas över den gröna – fel ordning, som ger ett blåaktigt (0, 64, 128) i stället för det rätta (0, 128, 64), eftersom den gröna ligger närmare.
```

Nästa kapitel ersätter det genomskinliga passet med weighted blended OIT. Den ogenomskinliga fyrhörningen behåller sitt
vanliga pass, de genomskinliga hamnar i två extra render targets, och ett kompositpass sätter ihop allt – och sedan är
bilden densamma oavsett i vilken ordning de två genomskinliga fyrhörningarna ritas.

## Mer att läsa

- [OIT: Introduction](https://learnopengl.com/Guest-Articles/2020/OIT/Introduction): learnopengls gästartikel som det
  här kapitlet följer.
- [Blending](https://learnopengl.com/Advanced-OpenGL/Blending): learnopengls kapitel om blending och sortering, som
  kursens kapitel *Blending* följer.

:::opengl
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): blendfaktorerna och den
  ekvation de bildar.
:::
:::vulkan
- [Color blending (Fixed functions)](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  vulkan-tutorial om pipelinens blendinställningar.
:::
:::d3d12
- [D3D12_BLEND_DESC](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_blend_desc):
  pipeline state-objektets blendbeskrivning.
:::
