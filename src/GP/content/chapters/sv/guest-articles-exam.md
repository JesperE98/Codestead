# Prov: Gästartiklar

Visa vad du har lärt dig i *Gästartiklar*: ordningsoberoende transparens, skelettanimation, scengrafen och frustum
culling, kaskaderade skuggkartor, terräng från en höjdkarta med och utan tessellering, direct state access, fysikaliskt
baserad bloom, compute shaders och ytljus. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla
och tryck på **Lämna in svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
I vilka av de här scenerna kan man INTE få rätt bild överallt genom att sortera de genomskinliga objekten bakifrån och fram efter deras mittpunkter? (Flera svar är rätt.)
- [x] Två genomskinliga rutor som skär igenom varandra
- [ ] Tre små genomskinliga kvadrater långt ifrån varandra, på olika avstånd
- [x] Ett moln av genomskinliga partiklar som ritas som ett mesh i ett enda draw call
- [x] Tre genomskinliga objekt som överlappar som bladen i en fläkt: A framför B, B framför C, C framför A
---
Sortering ordnar hela objekt. Objekt som skär varandra, cyklisk överlappning och ett mesh som överlappar sig självt kräver en ordning per fragment – det som ordningsoberoende transparens ger.
```

```quiz
Vilken teknik för ordningsoberoende transparens är exakt men behöver ett pass över all genomskinlig geometri för varje lager den löser upp?
- [ ] Weighted blended OIT
- [ ] Länkade listor per pixel
- [x] Depth peeling
- [ ] Momentbaserad OIT
---
Varje pass behåller det närmaste fragmentet bakom lagret som passet före hittade. Länkade listor per pixel är exakta med ett geometripass (plus ett upplösningspass); weighted blended och momentbaserad OIT är approximationer.
```

```quiz
Tre genomskinliga lager med alfa 0.5, 0.5 och 0.2 täcker en pixel. Vilken revealage räknar weighted blended OIT ut där?
- [x] 0.2 = 0.5 · 0.5 · 0.8, oavsett i vilken ordning lagren ritas
- [ ] 0.8, alfa för lagret som ritas sist
- [ ] 0.25, eftersom det svagaste lagret ignoreras
- [ ] Det beror på vilket lager som ligger närmast kameran
---
Revealage är produkten av alla (1 − α) – exakt och oberoende av ordningen. Bara färgen, det viktade medelvärdet, är en approximation.
```

```quiz
Hur får ackumulerings- och revealage-målen sitt innehåll i det genomskinliga passet?
- [ ] Båda blendar med `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`; compositepasset skiljer dem åt
- [x] Ackumuleringen adderar `(C · α, α) · w` med `ONE, ONE` från 0; revealage börjar på 1 och multipliceras med `1 − α` med `ZERO, ONE_MINUS_SRC_COLOR`
- [ ] Fragment shadern läser båda målen och skriver de nya värdena
- [ ] Ackumuleringen multipliceras, revealage summeras
---
Den fasta blendingen räknar ut summan och produkten, så ingen shader behöver läsa målet den skriver. Det kräver olika blendfunktioner för de två målen i samma draw call.
```

```quiz
Tentakelns ben `Upper` sitter på y = 1.1 i bindposen. Vilken är dess offsetmatris, och vilken är dess slutliga matris `globalTransform · offset` medan tentakeln står i bindposen?
- [ ] Identiteten; `translate(0, 1.1, 0)`
- [ ] `translate(0, 1.1, 0)`; `translate(0, 2.2, 0)`
- [ ] `translate(0, -1.1, 0)`; `translate(0, -1.1, 0)`
- [x] `translate(0, -1.1, 0)`; identiteten
---
Offsetmatrisen är inversen av benets globala transform i bindposen: den för en vertex in i benets rum. I bindposen tar den globala transformen ut den igen, så meshet förblir som det modellerades.
```

```quiz
Varför interpolerar animatören benens rotationer som kvaternioner med slerp i stället för att interpolera rotationsmatrisernas element?
- [x] Linjärt interpolerade rotationsmatriser är inga rotationer – meshet krymper och skjuvas mellan nycklarna; slerp rör sig längs den kortaste bågen med konstant vinkelhastighet
- [ ] Eftersom assimp inte kan lagra rotationsmatriser
- [ ] Eftersom slerp är billigare än att addera två matriser
- [ ] Eftersom kvaternioner också innehåller benets skala
---
Eulervinklar misslyckas på ett annat sätt: de tre vinklarna ändras oberoende av varandra och kan svänga genom orienteringar som ingen av nycklarna har. Positioner och skalor interpoleras linjärt med `mix`.
```

```quiz
Tentakelns animation har 1000 ticks per sekund, längden 2000 ticks och nycklar vid 0, 500, 1000, 1500 och 2000. Mellan vilka nycklar interpolerar ett ben efter 2.6 s uppspelning, och med vilken faktor?
- [ ] 2500 och 3000, faktor 0.2
- [ ] 0 och 500, faktor 0.6
- [ ] 1500 och 2000, faktor 0.6
- [x] 500 och 1000, faktor 0.2
---
2.6 s är 2600 ticks; `fmod(2600, 2000)` = 600, mellan nycklarna vid 500 och 1000: `(600 − 500) / (1000 − 500)` = 0.2.
```

```quiz
I en scengraf är en planet skalad till 0.5. Dess måne har den lokala positionen (3.5, 0, 0) och den lokala skalan 0.6. Hur långt från planetens mittpunkt ligger månen i världen, och hur stor är den?
- [ ] 3.5 enheter bort, med skalan 0.6 – lokala värden är världsvärden
- [x] 1.75 enheter bort, med skalan 0.3 – förälderns skala följer med till barnets position och storlek
- [ ] 1.75 enheter bort, med skalan 0.6
- [ ] 7 enheter bort, med skalan 1.2
---
`global = parentGlobal · local`: planetens skala gäller allt i dess rum, månens förskjutning också.
```

```quiz
Med dirty-flaggan får en entitet mitt i trädet en ny lokal position. Vad räknar nästa uppdatering om?
- [ ] Bara den entitetens matris
- [ ] Varje entitet i trädet, som utan flaggan
- [x] Den entitetens matris och matriserna för allt under den, vars globala matriser innehåller den
- [ ] Den entiteten och dess förälder
---
Oförändrade entiteter ovanför och bredvid behåller sina matriser; uppdateringen letar bara vidare nedåt genom dem efter ändrade entiteter.
```

```quiz
En planets begränsningssfär har radien 1.2 i världsrummet. Mittpunktens tecknade avstånd till frustumets fjärrplan (normalen riktad inåt) är −0.8, och den ligger väl innanför de andra fem planen. Ritas planeten?
- [ ] Nej: ett negativt tecknat avstånd betyder utanför frustumet
- [x] Ja: sfären ligger på eller framför planet när avståndet är större än −radien, och −0.8 > −1.2 – planeten sticker in i frustumet
- [ ] Nej: mittpunkten måste ligga innanför varje plan
- [ ] Bara om dess AABB också säger det
---
Testet är konservativt: en modell vars volym ligger delvis innanför ritas, och GPU:n klipper resten. Det kan rita något osynligt men hoppar aldrig över något synligt.
```

```quiz
I det vridna rutnätet släpper axelriktade lådor igenom 38 planeter där sfärer släpper igenom 37. Varför sitter lådorna inte tätare, fast den ringade planeten passar mycket bättre i en låda än i en sfär?
- [ ] Eftersom AABB:er bara testas mot fyra av de sex planen
- [ ] Eftersom lådans storlek mäts från det minsta positiva flyttalet
- [ ] Eftersom lådor bortser från entitetens skala
- [x] Eftersom modellmatrisen vrider lådan med rutnätet, och den axelriktade lådan runt en vriden låda är större än lådan själv
---
En AABB sitter tätt bara så länge objektet är riktat längs axlarna. En orienterad låda (OBB) behåller den täta passformen, till ett högre pris per test.
```

```quiz
Vad sparar frustum culling? (Flera svar är rätt.)
- [x] De draw calls som CPU:n skulle spela in och skicka för objekt utanför vyn
- [ ] Fragmenten för planeter som skyms av andra planeter i vyn
- [x] Vertex shaderns arbete med de cullade objektens vertexar
- [ ] Pixlarna för objekten som syns
---
Culling vet ingenting om skymning – en skymd planet ligger inne i frustumet och ritas – och ett synligt objekt kostar lika mycket som förut.
```

```quiz
Varför delar kaskaderade skuggkartor upp kamerans vy i skivor med var sin skuggkarta?
- [ ] Eftersom en skuggkarta inte kan vara större än 1024 × 1024
- [x] Eftersom en karta över en stor vy sprider sina texlar jämnt medan vyn visar nära saker stora: nära kameran blir det för få texlar per pixel – perspektivaliasing
- [ ] Eftersom ett riktat ljus behöver en karta per kubsida
- [ ] Eftersom djuptestet inte kan jämföra avstånd bortom 50 enheter
---
De nära skivorna är korta och deras kartor skarpa; de bortre skivorna är långa, men långt bort täcker en texel få pixlar, så en grövre karta räcker där.
```

```quiz
learnopengl sträcker ut z-intervallet för varje kaskads ljuslåda med `zMult = 10`. Vad skulle gå fel om lådan slutade vid skivans hörn?
- [ ] Skuggkartorna skulle innehålla negativa djup
- [ ] Kaskaderna skulle överlappa
- [ ] Biasen skulle behöva vara tio gånger större
- [x] Objekt mellan ljuset och skivan – utanför kamerans vy, men som kastar skuggor in i den – skulle klippas bort i djuppasset, och deras skuggor skulle försvinna
---
Faktorn måste anpassas till scenen; att låta ljuslådans när- och fjärrplan följa scenens gränser utnyttjar djupprecisionen bättre.
```

```quiz
Varför delar den kaskaderade skuggfunktionen biasen med kaskadens fjärravstånd?
- [x] Biasen är ett avstånd i skuggkartans djupintervall; en större kaskadlåda gör samma bias till ett större avstånd i världen, vilket lossar skuggorna från det som kastar dem (peter panning)
- [ ] Eftersom de bortre kaskaderna renderas med culling av framsidor
- [ ] För att göra de bortre skuggorna mörkare
- [ ] Eftersom PCF behöver en annan bias i varje kaskad
---
Ju längre bort och större kaskaden är, desto mindre bias i djupenheter – så att den motsvarar ett liknande avstånd i världen i varje kaskad.
```

```quiz
CPU-terrängen är en uppsättning triangle strips med två rader var. Varför kan inte hela indexbufferten ritas som en enda strip?
- [ ] Eftersom en strip får ha högst 512 index
- [ ] Eftersom stripsens vindningsordning växlar
- [x] Eftersom den sista vertexen i en strip och den första i nästa skulle bilda långa trianglar tvärs över terrängen; varje strip behöver ett eget draw call, eller ett restart-index emellan
- [ ] Eftersom vertexbufferten saknar texturkoordinater
---
learnopengl ritar 255 strips en i taget, var och en från sin egen plats i indexbufferten. Primitive restart avslutar en strip med ett särskilt index, så att ett draw call räcker för alla.
```

```quiz
Vilket tesselleringssteg bestämmer hur fint en patch delas upp, och vilket räknar ut var varje ny vertex hamnar?
- [ ] Tessellatorn bestämmer nivåerna; vertex shadern placerar de nya vertexarna
- [ ] Evaluation- (domain-) shadern bestämmer nivåerna; control- (hull-) shadern placerar vertexarna
- [ ] Båda bestäms av den fasta tessellatorn
- [x] Control- (hull-) shadern sätter tesselleringsnivåerna per patch; evaluation- (domain-) shadern körs för varje genererad punkt och räknar ut dess position
---
Mittemellan gör den fasta tessellatorn om nivåerna till (u, v)-punkter och trianglar över en abstrakt patch – utan att känna till positioner eller texturer.
```

```quiz
learnopengls nivåer på 8 med `fractional_odd_spacing` delar varje kant i 9 segment, varav två är kortare. Varför lönar sig fraktionell spacing när nivåerna beror på avståndet?
- [ ] Eftersom ett udda antal segment kräver färre trianglar
- [x] Eftersom en nivå som ändras mjukt då flyttar punkterna mjukt, i stället för att nya punkter dyker upp plötsligt vid hela tal
- [ ] Eftersom heltals-spacing inte kan gå över nivå 8
- [ ] Eftersom fraktionell spacing läser höjdkartan med mipmaps
---
`equal_spacing` (`integer` i Direct3D) avrundar uppåt till hela, lika långa segment: en nivå som passerar ett heltal skulle lägga till punkter på en gång.
```

```quiz
Control shadern med nivåer efter avstånd räknar ut varje yttre nivå från det närmaste av kantens två hörn, inte från patchens mittpunkt. Varför?
- [ ] Eftersom patchens mittpunkt inte är känd i control shadern
- [ ] Eftersom de inre nivåerna måste vara större än de yttre
- [ ] Eftersom tessellatorn bara tar emot nivåer från hörn
- [x] Eftersom två grannpatches delar kanten: räknad från kantens egna hörn får den samma nivå i båda, så att punkterna ligger i linje – annars öppnas sprickor mellan patcherna
---
De inre nivåerna får skilja sig fritt mellan patches: de påverkar bara insidan av en patch.
```

```quiz
Höjdkartan har mipmaps, men evaluation- (domain-) shadern läser bara nivå 0. Varför?
- [ ] Eftersom en textur med en kanal inte kan ha mipmaps
- [ ] Eftersom tessellatorn klämmer varje koordinat mot kanten
- [x] Eftersom evaluation-steget körs före rastreringen: det finns inga derivator i skärmrummet att välja en mipnivå efter
- [ ] Eftersom mipmaps bara genereras för fragment shaderns texturer
---
Därför skapar Vulkan- och Direct3D 12-versionerna höjdkartan med en nivå och läser den med en uttrycklig nivå (`SampleLevel(…, 0)`).
```

```quiz
Vad är skillnaden mellan `glGenBuffers` och `glCreateBuffers`?
- [x] `glGenBuffers` reserverar bara namn – objektet skapas när ett namn binds första gången, vilket också bestämmer dess typ; `glCreateBuffers` skapar objekten direkt, så att de kan redigeras via namnet utan att någonsin bindas
- [ ] `glCreateBuffers` allokerar också buffertens minne
- [ ] `glGenBuffers` är för vertexbuffrar, `glCreateBuffers` för alla andra sorter
- [ ] Det finns ingen; `glCreateBuffers` är bara det nyare namnet
---
Det är också därför `glCreateTextures` tar target som parameter: texturens typ måste vara känd när den skapas.
```

```quiz
En buffert skapades med `glNamedBufferStorage(VBO, size, data, 0)`. Vad lovar det sista argumentet, och vad händer om programmet senare anropar `glNamedBufferStorage` på samma buffert igen?
- [ ] 0 betyder "använd standardtipset för användning"; det andra anropet allokerar om bufferten
- [ ] 0 betyder att GPU:n aldrig läser bufferten; det andra anropet ignoreras
- [x] 0 betyder att innehållet aldrig ändras från CPU:n efter att bufferten skapats; lagringen är oföränderlig, så det andra anropet är ett fel
- [ ] 0 betyder att bufferten kan mappas; det andra anropet ändrar dess storlek
---
`GL_DYNAMIC_STORAGE_BIT` skulle tillåta `glNamedBufferSubData`, map-bitarna mappning. En fast storlek och flaggor som anges i förväg låter drivrutinen veta var minnet finns – steget mot de explicita API:erna.
```

```quiz
Den fysikaliskt baserade bloomen slutar med `hdrColor = mix(hdrColor, bloomColor, 0.04)` i stället för den gamla `hdrColor += bloomColor`. Vad ändras?
- [ ] Bara ljusstyrkan: `mix` är `+=` skalat med 0.04
- [ ] Bara pixlar ljusare än 1.0 får bloom
- [ ] Bloomen ersätter scenen där den är ljusare
- [x] Det finns ingen tröskel och inget ljus läggs till: 4 % av varje pixels ljus tas från den och sprids runt den, som när en lins sprider en del av ljuset som passerar
---
Ljusa saker glöder eftersom 4 % av mycket ljus fortfarande är mycket; en svagt belyst väggs glöd är för svag för att synas.
```

```quiz
Vad skyddar Karis-medelvärdet i den första nedsamplingen mot?
- [ ] Bandning i nivåerna med R11G11B10
- [x] Eldflugor: en enda extremt ljus pixel som dominerar sin ruta och hoppar mellan texlar när kameran rör sig – varje ruta viktas med `1 / (1 + luma)`
- [ ] Ljus som läcker över texturens kant
- [ ] Att uppsamplingens additiva blending svämmar över
---
Det behövs bara i den första nedsamplingen, där enskilda pixlar fortfarande är enskilda pixlar; efter den är bilden jämn nog.
```

```quiz
En compute shader har `local_size_x = 10, local_size_y = 10`. Vilken texel skriver anropet med det lokala id:t (3, 4) i arbetsgruppen (2, 1), om det skriver `gl_GlobalInvocationID.xy` (`SV_DispatchThreadID.xy`)?
- [ ] (5, 5)
- [ ] (3, 4)
- [x] (23, 14)
- [ ] (32, 41)
---
Globalt id = grupp-id × gruppstorlek + lokalt id: (2 · 10 + 3, 1 · 10 + 4). En dispatch med 80 × 60 grupper täcker texturen på 800 × 600 med ett anrop per texel.
```

```quiz
Programmet startar compute shadern som skriver texturen och ritar sedan fyrhörningen som samplar den. Varför behövs en barriär mellan dem?
- [ ] Eftersom en compute shader bara får köras när inget render pass är aktivt
- [ ] Eftersom barriären gör om texturens format från 32-bitars flyttal till 8 bitar
- [ ] Eftersom dispatchen måste bli klar på CPU:n innan draw callet spelas in
- [x] Eftersom GPU:n kör arbetet asynkront och cachar det som skrivs: utan den kan fyrhörningens fragment shader läsa texturen före eller medan compute shadern skriver den
---
I grafikpipelinen räknar API:et ut de flesta sådana beroenden; det en compute shader skriver till en bild täcks inte, så programmet måste ange dem.
```

```quiz
Vad är idén bakom linjärt transformerade cosinusar?
- [ ] Att sampla GGX-loben med många strålar per pixel, viktade med en cosinus
- [ ] Att ersätta polygonljuset med ett punktljus i dess mittpunkt
- [x] Att integrera den GGX-lika fördelningen över polygonen är detsamma som att integrera en avklippt cosinus över polygonen transformerad med M⁻¹ – som har en exakt kantformel
- [ ] Att göra ljusets form suddig i en textur efter strävheten
---
Matriserna anpassades i förväg för ett rutnät av strävheter och betraktningsvinklar (LTC1); LTC2 innehåller BRDF:ens storlek med Fresneltermerna och den horisontklippta sfären.
```

```quiz
Varför behöver ytljusets diffusa del ingen uppslagning i LTC1?
- [ ] Eftersom den diffusa delen räknas ut på CPU:n
- [x] Eftersom Lamberts diffusa reflektion är själva den avklippta cosinusen: M⁻¹ är identiteten
- [ ] Eftersom den diffusa delen bara använder LTC2.w
- [ ] Eftersom ett tvåsidigt ljus saknar diffus del
---
Bara den glansiga delen behöver den anpassade M⁻¹ för sin strävhet och betraktningsvinkel; resultatet är `color · intensity · (specular + mDiffuse · diffuse)`.
```

:::opengl
```quiz
Det genomskinliga passet i weighted blended OIT renderar till två färg-attachments med olika blendfunktioner. Vilka OpenGL-anrop sätter dem och rensar varje mål till sitt eget värde?
- [x] `glBlendFunci(0, …)` och `glBlendFunci(1, …)` (core sedan 4.0), och `glClearBufferfv(GL_COLOR, i, value)` per draw buffer
- [ ] `glBlendFunc` två gånger, det andra anropet för attachment 1
- [ ] `glBlendFuncSeparate`, som sätter färg och alfa var för sig
- [ ] `glClear` med två anrop till `glClearColor`
---
`glBlendFuncSeparate` skiljer färg från alfa, inte ett mål från ett annat. `glClear` rensar varje draw buffer till samma `glClearColor`.
```
:::
:::vulkan
```quiz
Den genomskinliga pipelinen i weighted blended OIT har två color blend attachment states med olika faktorer. Vad kräver Vulkan för det?
- [x] Device featuren `independentBlend`, kontrollerad i `isDeviceSuitable` och påslagen när enheten skapas – utan den måste alla attachment states i en pipeline vara lika
- [ ] Två pipelines, en per attachment
- [ ] Ett eget subpass per färg-attachment
- [ ] Ingenting: varje pipeline kan blenda varje attachment på olika sätt
---
Det är learnopengls `glBlendFunci` på Vulkans vis. Nästan varje stationär GPU har featuren, men programmet måste be om den.
```
:::
:::d3d12
```quiz
Det genomskinliga pipeline state-objektet i weighted blended OIT sätter olika blendfunktioner i `BlendState.RenderTarget[0]` och `[1]`. Vad behöver det mer?
- [x] `BlendState.IndependentBlendEnable = TRUE` – utan den använder Direct3D `RenderTarget[0]` för alla mål
- [ ] Ett andra pipeline state-objekt för det andra målet
- [ ] En root-parameter per render target
- [ ] Ingenting: varje post gäller alltid sitt eget mål
---
Det är learnopengls `glBlendFunci` på Direct3D:s vis. Pixel shadern skriver de två målen genom en struct med `SV_TARGET0` och `SV_TARGET1`.
```
:::

:::opengl
```quiz
Benens id:n ställs in med `glVertexAttribIPointer(3, 4, GL_INT, …)`. Vad skulle gå fel med `glVertexAttribPointer(3, 4, GL_INT, GL_FALSE, …)` och en `ivec4` i shadern?
- [ ] Ingenting: båda funktionerna skickar heltal vidare
- [ ] Vikterna skulle läsas som id:n
- [x] `glVertexAttribPointer` gör om datan till flyttal på vägen, så shaderns heltalsindata skulle inte få id:na
- [ ] Id:na skulle normaliseras till 0..1
---
Heltalsattribut behöver **I**-varianten; vikterna, som är flyttal, använder den vanliga `glVertexAttribPointer` på location 4.
```
:::
:::vulkan
```quiz
Hur levererar Vulkan benens id:n till vertex shaderns `ivec4`-indata på location 3?
- [ ] Med `VK_FORMAT_R32G32B32A32_SFLOAT` och en typomvandling i shadern
- [ ] Genom uniform-bufferten, bredvid benmatriserna
- [x] Med attributformatet `VK_FORMAT_R32G32B32A32_SINT` – ett format för heltal med tecken; ett flyttals- eller normaliserat format skulle leverera flyttal
- [ ] Med en push constant per vertex
---
Det är Vulkans motsvarighet till OpenGL:s `glVertexAttribIPointer`; vikterna använder `VK_FORMAT_R32G32B32A32_SFLOAT` på location 4.
```
:::
:::d3d12
```quiz
learnopengl räknar ut ett bens slutliga matris som `globalTransformation * offset` med GLM. Hur skriver kursen det med DirectXMath, och varför?
- [ ] Likadant, `globalTransformation * offset`: matrisprodukter beror inte på biblioteket
- [ ] `XMMatrixInverse(nullptr, offset) * globalTransformation`, eftersom DirectXMath lagrar inverser
- [x] `offset * globalTransformation`, eftersom DirectXMath multiplicerar radvektorer från vänster, så transformerna skrivs i den ordning de tillämpas – offset först
- [ ] `globalTransformation * XMMatrixTranspose(offset)`, eftersom HLSL transponerar matriser
---
Av samma skäl är en nods globala transform `nodeTransform * parentTransform`. Matriserna som blir resultatet är GLM:s, transponerade.
```
:::

:::opengl
```quiz
Djuppasset i kaskaderade skuggkartor har en geometry shader med `layout (triangles, invocations = 5) in;` och sätter `gl_Layer = gl_InvocationID`. Vad gör det?
- [ ] Det ritar scenen fem gånger från CPU:n
- [x] Geometry shadern körs fem gånger per triangel, och varje anrop transformerar den med sin kaskads ljusrumsmatris och skickar den till lagret med samma nummer i det lagrade framebuffer-objektet
- [ ] Det delar varje triangel i fem mindre
- [ ] Det väljer en av fem skuggkartor slumpvis
---
Instansierade geometry shaders är core sedan OpenGL 4.0; framebuffer-objektet är lagrat eftersom `glFramebufferTexture` kopplade in hela texturarrayen.
```
:::
:::vulkan
```quiz
learnopengls `getFrustumCornersWorldSpace` använder `2.0f * z - 1.0f` för hörnens z. Varför använder Vulkan-versionen `z` (0 eller 1) i stället?
- [ ] Eftersom Vulkans y-axel pekar nedåt
- [ ] Eftersom ljusets projektion är ortografisk
- [ ] Eftersom Vulkans texturarrayer börjar på lager 1
- [x] Eftersom Vulkans NDC-djup med `GLM_FORCE_DEPTH_ZERO_TO_ONE` går från 0 till 1; z = −1 skulle ligga framför närplanet, och varje kaskads låda skulle växa
---
De fyra hörnen i x och y är desamma i alla API:er; bara djupintervallet för normaliserade enhetskoordinater skiljer.
```
:::
:::d3d12
```quiz
Djuppassets geometry shader har `[instance(5)]` och skriver `SV_RenderTargetArrayIndex`. Vad gör de?
- [ ] De ritar fem instanser av varje kub
- [ ] De väljer kaskaden som en pixel hör till
- [ ] De får pixel shadern att köras fem gånger per pixel
- [x] Geometry shadern körs fem gånger per triangel (`SV_GSInstanceID` 0 till 4), och varje anrop skickar sin transformerade triangel till den skivan i djuptexturens array
---
De är GLSL:s `invocations = 5`, `gl_InvocationID` och `gl_Layer`. DSV:n täcker alla fem skivorna i arrayen, så ett draw call fyller alla kaskader.
```
:::

:::opengl
```quiz
OpenGL kan rita tessellerade patches utan tessellation control shader. Varifrån kommer nivåerna då?
- [ ] Från `GL_MAX_TESS_GEN_LEVEL`: varje patch delas så fint som möjligt
- [x] Från standardnivåerna som sätts med `glPatchParameterfv(GL_PATCH_DEFAULT_OUTER_LEVEL, …)` och `GL_PATCH_DEFAULT_INNER_LEVEL`
- [ ] Från evaluation shaderns `layout`-rad
- [ ] Ingenstans: programmet går inte att länka
---
Vulkan och Direct3D 12 har inga sådana standardvärden och behöver alltid control- (hull-) steget – därför behåller kursen det i varje API och varje tillstånd.
```
:::
:::vulkan
```quiz
Vad behöver en grafikpipeline med tessellering i Vulkan?
- [ ] Bara evaluation shadern; control shadern är valfri, som i OpenGL
- [x] Device featuren `tessellationShader`, både en control och en evaluation shader, topologin `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` och ett tesselleringstillstånd med `patchControlPoints`
- [ ] Ett eget render pass för den tessellerade geometrin
- [ ] Bara `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST`; patchstorleken tas från draw callet
---
Därför skriver startens control shader nivå 1 överallt: utan den hade pipelinen inte gått att bygga.
```
:::
:::d3d12
```quiz
OpenGL:s control shader skriver nivåerna i `if (gl_InvocationID == 0)`. Var räknar Direct3D 12 ut dem?
- [ ] I domain shadern, en gång per genererad punkt
- [ ] I hull shaderns huvudfunktion, en gång per kontrollpunkt
- [x] I hull shaderns patch constant-funktion, som körs en gång per patch och returnerar `SV_TessFactor[4]` och `SV_InsideTessFactor[2]`
- [ ] I root signaturen, som root constants
---
Hull shaderns huvudfunktion körs per utgående kontrollpunkt (`SV_OutputControlPointID`) och skickar punkterna vidare; dess attribut deklarerar domän, partitionering och utgående topologi.
```
:::

:::opengl
```quiz
Hur skriver compute shadern till texturen som skärmfyrhörningen samplar på texture unit 0?
- [ ] Också genom texture unit 0, med `texture()` och en skrivmask
- [ ] Genom att rendera i den med ett framebuffer-objekt
- [ ] Genom en shader storage buffer som kopieras till texturen
- [x] Genom image unit 0, bunden med `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F)` – image units är skilda från texture units, och formatet måste vara ett storleksbestämt som stämmer med shaderns
---
`imageStore` skriver med heltalskoordinater, utan sampler, filtrering eller mipmaps; samma textur ligger kvar bunden på texture unit 0 för fyrhörningen.
```
:::
:::vulkan
```quiz
I vilken image layout håller programmet texturen som compute shadern skriver och fyrhörningen samplar, och varför?
- [ ] `SHADER_READ_ONLY_OPTIMAL`, eftersom fyrhörningen samplar den
- [ ] `COLOR_ATTACHMENT_OPTIMAL`, eftersom compute shadern skriver den
- [ ] `TRANSFER_DST_OPTIMAL`, eftersom den fylls från GPU:n
- [x] `GENERAL`, den layout där en shader både får skriva till en bild och sampla den – den används av storage image-descriptorn och av fyrhörningens combined image sampler
---
Image memory-barriären mellan dispatchen och render passet behåller layouten och ordnar compute-skrivningarna före fragment shaderns läsningar.
```
:::
:::d3d12
```quiz
Hur skriver compute shadern texturen, och vad får pixel shadern att vänta på den?
- [ ] En render target view och en `ClearRenderTargetView` mellan passen
- [ ] En andra SRV med skrivåtkomst; nästa bildrutas fence
- [ ] En kopieringskö som kopierar resultatet till texturen
- [x] En unordered access view (`RWTexture2D<float4>`, u0) på en textur skapad med `ALLOW_UNORDERED_ACCESS`, och en övergångsbarriär från `UNORDERED_ACCESS` till `PIXEL_SHADER_RESOURCE` före fyrhörningen
---
I slutet av bildrutan gör en andra barriär om texturen för nästa dispatch. Två compute-pass på samma UAV skulle använda en UAV-barriär i stället.
```
:::

:::opengl
```quiz
Med DSA ersätts `glVertexAttribPointer` av tre anrop. Vilket av dem säger varifrån datan kommer?
- [ ] `glVertexArrayAttribFormat`
- [ ] `glVertexArrayAttribBinding`
- [x] `glVertexArrayVertexBuffer`, som matar en bindningspunkt från en buffert med en offset och en stride
- [ ] `glEnableVertexArrayAttrib`
---
`glVertexArrayAttribFormat` beskriver attributet (komponenter, typ, offset inom en vertex), `glVertexArrayAttribBinding` kopplar det till en bindningspunkt. Formatet ligger kvar när bufferten byts.
```
:::
:::vulkan
```quiz
DSA delar upp OpenGL:s vertexuppsättning i ett attributs format och bufferten som matar det. Var håller Vulkan de två?
- [ ] Båda i ett vertex array-objekt
- [ ] Båda i descriptor seten
- [x] Formatet i pipelinen (`VkVertexInputAttributeDescription` och `VkVertexInputBindingDescription`), buffrarna bundna per draw call med `vkCmdBindVertexBuffers`
- [ ] Formatet i vertexbufferten, bufferten i render passet
---
Vulkan har ingen VAO och har aldrig haft bind to edit: varje anrop namnger objekten det arbetar på – modellen som DSA för OpenGL mot.
```
:::
:::d3d12
```quiz
DSA delar upp OpenGL:s vertexuppsättning i ett attributs format och bufferten som matar det. Var håller Direct3D 12 de två?
- [ ] Båda i ett vertex array-objekt
- [ ] Båda i root signaturen
- [x] Formatet i pipeline state-objektets input layout, buffrarna bundna per draw call med `IASetVertexBuffers` och vyer som bär stride
- [ ] Formatet i vertexbuffertens vy, bufferten i input layouten
---
Direct3D 12 har ingen VAO och har aldrig haft bind to edit: varje anrop namnger objektet det arbetar på – modellen som DSA för OpenGL mot.
```
:::

:::opengl
```quiz
De åtta ytljusen sätts som `areaLights[i].points[k]`, `areaLights[i].color` och så vidare. Varför behöver OpenGL-programmet inte tänka på structens minneslayout?
- [ ] Eftersom OpenGL packar structar utan utfyllnad
- [x] Eftersom varje medlem i varje arrayelement är en egen uniform med en egen location, som sätts via namnet – det finns ingen buffert vars layout C++-sidan måste matcha
- [ ] Eftersom ljusen lagras i en textur
- [ ] Eftersom GLSL saknar typen `bool`
---
De explicita API:erna lägger ljusen i en uniform- eller constant buffer, där std140 eller HLSL:s packningsregler bestämmer offseten och C++-spegeln måste stämma med dem.
```
:::
:::vulkan
```quiz
I std140-uniformblocket är ett ljus `{ float intensity; vec3 color; vec4 points[4]; bool twoSided; }`. Varför är det 112 byte?
- [ ] Eftersom std140 lagrar varje medlem som en `mat4`
- [ ] Eftersom en `bool` tar 16 byte
- [x] `color` justeras som en `vec4` och börjar på 16, de fyra hörnen tar 16 byte var från 32, `twoSided` tar 4 byte på 96, och structen avrundas uppåt till en multipel av 16
- [ ] Eftersom arrayen med 32 ljus delas jämnt
---
C++-spegeln skriver ut utfyllnaden så att dess offset stämmer med shaderns. Hörnen är `vec4` i shadern eftersom varje arrayelement ändå börjar på en 16-bytesgräns.
```
:::
:::d3d12
```quiz
I HLSL:s constant buffer är ett ljus `{ float intensity; float3 color; float4 points[4]; bool twoSided; }`. Varför är det 96 byte?
- [ ] Eftersom HLSL lagrar varje medlem som en `float4x4`
- [ ] Eftersom en `bool` tar 16 byte
- [x] `intensity` och `color` delar den första 16-bytesraden, de fyra hörnen tar en rad var, `twoSided` börjar den sista raden, och en struct i en cbuffer-array fyller hela rader
- [ ] Eftersom arrayen med 32 ljus delas jämnt
---
En `float3` får följa en `float` så länge den inte korsar en radgräns – vilket std140 inte tillåter, så Vulkans version av samma struct tar 112 byte.
```
:::
