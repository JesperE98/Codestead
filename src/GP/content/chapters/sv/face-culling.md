# Face culling

Försök att föreställa dig en 3D-kub och räkna hur många sidor du som mest kan se från något håll. Om din fantasi inte
är alltför kreativ kom du förmodligen fram till högst 3. Du kan betrakta en kub från vilken position och/eller riktning
som helst, men du kommer aldrig att kunna se mer än 3 sidor. Varför ska vi då slösa kraft på att rita de andra 3
sidorna som vi inte ens kan se? Om vi kunde kasta dem på något sätt skulle vi spara mer än 50 % av kubens alla
körningar av fragment shadern!

Vi säger *mer än 50 %* i stället för 50 %, eftersom bara 2 eller till och med 1 sida kan synas från vissa vinklar. Då
sparar vi *mer* än 50 %.

Det är en riktigt bra idé, men det finns ett problem vi måste lösa: hur vet vi om en sida av ett föremål inte syns
från betraktarens synvinkel? Om vi föreställer oss en sluten form har var och en av dess sidor två ytor. Varje yta
är antingen *vänd mot* betraktaren eller visar ryggen åt betraktaren. Tänk om vi bara kunde rita de sidor som är
*vända mot* betraktaren?

Det är precis vad *face culling* gör. {{api}} kontrollerar vilka sidor som är *framsidor* (front facing) mot
betraktaren och ritar dem, medan alla sidor som är *baksidor* (back facing) kastas, vilket sparar oss många anrop av
fragment shadern. Vi måste dock tala om för {{api}} vilka av sidorna vi använder som faktiskt är framsidor och vilka
som är baksidor. Det görs med ett smart knep: genom att analysera vertexdatans *winding order* (varvordning).

:::opengl
Projektet är än en gång scenen från *Depth testing*: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0), metallgolvet,
`glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, kameran på (0, 0, 3), och learnopengls `cubeVertices` och
`planeVertices`. Face culling är avstängt – OpenGL:s standard.
:::
:::vulkan
Projektet är än en gång scenen från *Depth testing*: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0), metallgolvet,
en pipeline med djuptestet (`VK_COMPARE_OP_LESS`), kameran på (0, 0, 3), och alla vertexar i en enda vertex buffer –
kuben är vertex 0..35, golvet 36..41. Pipelinens rasterizer har `cullMode = VK_CULL_MODE_NONE`: du stängde av culling
i kapitlet *Coordinate systems*, eftersom learnopengls kub inte är gjord för det. I det här kapitlet rättar vi till det.
:::
:::d3d12
Projektet är än en gång scenen från *Depth testing*: de två marmorkuberna på (-1, 0, -1) och (2, 0, 0), metallgolvet,
ett PSO med djupfunktionen LESS, kameran på (0, 0, 3), shadrarna i `face_culling.hlsl`, och alla vertexar i en enda
vertex buffer – kuben är vertex 0 till 35, golvet 36 till 41. PSO:t har
`psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;`: du stängde av culling i kapitlet *Coordinate systems*,
eftersom learnopengls kub inte är gjord för det. I det här kapitlet rättar vi till det.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift trycker du på **Build & run**
(Ctrl+Enter) för att kompilera programmet och köra det i den inbyggda simulatorn.

## Winding order

När vi definierar en uppsättning triangelvertexar definierar vi dem i en viss ordning (winding order) som antingen är
*medurs* (clockwise) eller *moturs* (counter-clockwise). Varje triangel består av 3 vertexar, och vi anger de 3
vertexarna i en ordning sedd från triangelns mitt.

Tänk dig en triangel med hörnet 1 överst, 2 nere till höger och 3 nere till vänster. Går du 1 → 2 → 3 rör du dig
medurs; går du 1 → 3 → 2 rör du dig moturs. I vertexdatan är ordningen helt enkelt den ordning hörnen räknas upp i:

```text
// clockwise
vertices[0], // vertex 1
vertices[1], // vertex 2
vertices[2], // vertex 3
// counter-clockwise
vertices[0], // vertex 1
vertices[2], // vertex 3
vertices[1]  // vertex 2
```

Varje uppsättning av 3 vertexar som bildar en triangel har alltså en winding order. {{api}} använder den informationen
när primitiverna ritas för att avgöra om en triangel är en *framsida* eller en *baksida*.

:::opengl
Som standard behandlas trianglar med moturs vertexar som framsidor.
:::
:::vulkan
Vulkan har inget standardvärde här: du väljer vilken ordning som är framsidan med rasterizerns `frontFace`
(`VK_FRONT_FACE_COUNTER_CLOCKWISE` eller `VK_FRONT_FACE_CLOCKWISE`). Vår pipeline har fortfarande vulkan-tutorials
`VK_FRONT_FACE_CLOCKWISE` från kapitlet *Hello Triangle*.
:::
:::d3d12
Direct3D:s standard är den motsatta mot OpenGL:s: med `FrontCounterClockwise = FALSE` (som
`CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT)` sätter) är trianglar vars hörn går medurs på render targeten framsidorna.
Därför räknade kapitlet *Hello Triangle* upp sin triangels hörn medurs.
:::

När du bestämmer vertexordningen föreställer du dig triangeln som om den var vänd mot dig, så varje triangel du anger
ska gå moturs som om du tittade rakt på den. Det fiffiga med att ange alla vertexar så här är att den faktiska
ordningen beräknas i rastreringssteget, alltså när vertex shadern redan har körts. Vertexarna ses då från
*betraktarens* synvinkel – deras positioner på skärmen.

Alla triangelvertexar som betraktaren då har framför sig har faktiskt den ordning vi angav, men vertexarna i
trianglarna på kubens andra sida ritas nu så att deras ordning blir omvänd. Resultatet är att trianglarna vi tittar på
ses som framsidor och trianglarna på baksidan ses som baksidor.

Tänk på kubens framsida och dess baksida, båda angivna moturs sett utifrån kuben. Från kameran framför kuben går
framsidans trianglar moturs. Baksidans trianglar angavs moturs för någon som står *bakom* kuben; sett genom kuben
framifrån går samma hörn åt andra hållet: medurs. Baksidan är alltså en baksida – precis vad vi vill, eftersom den
ändå är dold bakom kuben.

```quiz
En triangels hörn går moturs på skärmen så som kameran ser den. Kameran flyttar sig nu till triangelns andra sida och tittar på den bakifrån. Hur ser samma hörn, i samma ordning, ut nu?
- [ ] Fortfarande moturs: ordningen lagras med vertexdatan
- [x] Medurs: sett från andra sidan går samma hörn åt andra hållet
- [ ] Triangeln syns inte alls bakifrån
- [ ] Det beror på texturkoordinaterna
---
Hörnens ordning i vertexdatan ändras aldrig, men deras positioner på skärmen gör det. Speglade av att man tittar från andra sidan går hörnen åt andra hållet – det är så rasterizern skiljer framsidor från baksidor.
```

Det finns en hake: det här fungerar bara om *varje* triangel i kuben angavs moturs sett utifrån. learnopengls kub, den
vi har använt sedan kapitlet *Coordinate systems*, gjordes inte med culling i tankarna: sett utifrån går dess fram-,
vänster- och undersida moturs, men dess bak-, höger- och ovansida medurs. learnopengls kapitel om face culling ger
därför en ny kub där varje triangel går moturs. Den har samma vertexar och texturkoordinater; i varje triangel på bak-,
höger- och ovansidan har två hörn bytt plats. För baksidan (z = -0.5):

:::opengl
```cpp
    float cubeVertices[] = {
        // positions          // texture Coords
        // every triangle is counter-clockwise when you look at its face from outside the cube
        // back face (z = -0.5)
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,

        // front face (z = 0.5)
        ...
```

Den gamla baksidan började med `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: sett bakifrån (från -z)
går det från nere till höger till nere till vänster och upp till uppe till vänster – medurs.
:::
:::vulkan
```cpp
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, {1.0f, 0.0f}},
    {{ 0.5f, -0.5f, -0.5f}, {1.0f, 1.0f}},
    {{ 0.5f,  0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{-0.5f,  0.5f, -0.5f}, {0.0f, 0.0f}},

    // front (z = +0.5)
    ...
```

Den gamla baksidan började med `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: sett bakifrån (från -z)
går det från nere till höger till nere till vänster och upp till uppe till vänster – medurs. (Texturkoordinaterna är
learnopengls med v vänt, som tidigare; varje hörn behåller sina egna.)
:::
:::d3d12
```cpp
            // every triangle is counter-clockwise when you look at its face from outside the cube
            // back face (z = -0.5)
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },

            // front face (z = 0.5)
            ...
```

Den gamla baksidan började med `(-0.5, -0.5, -0.5)`, `(0.5, -0.5, -0.5)`, `(0.5, 0.5, -0.5)`: sett bakifrån (från -z)
går det från nere till höger till nere till vänster och upp till uppe till vänster – medurs. (Texturkoordinaterna är
learnopengls med v vänt, som tidigare; varje hörn behåller sina egna.)
:::

Du behöver inte föreställa dig varje sida för att kontrollera en triangel. För hörnen a, b och c är kryssprodukten
(b − a) × (c − a) triangelns normal enligt högerhandsregeln: den pekar mot den sida varifrån hörnen går moturs. För den
gamla baksidan är det (1, 0, 0) × (1, 1, 0) = (0, 0, 1) – in i kuben, så sett utifrån gick den medurs. För den nya är
det (1, 1, 0) × (1, 0, 0) = (0, 0, -1): ut ur kuben.

Gör nu den första uppgiften, **ccw-cube**: skriv om kubens 36 vertexar så att varje triangel går moturs sett utifrån,
med varje vertex texturkoordinater bevarade, och tryck på **Build & run**. Ingenting ändras – inte en enda pixel –
eftersom ingenting cullas än. Ordningen på en triangels hörn spelar roll först när culling är påslaget.

```quiz
Hur kan du kontrollera att en triangel med hörnen a, b, c (i den ordningen) går moturs när du tittar på kubens sida utifrån?
- [ ] Alla tre hörnen har en positiv z-koordinat
- [ ] Dess texturkoordinater ökar från a till c
- [ ] Dess första hörn är det lägsta
- [x] Kryssprodukten (b − a) × (c − a) pekar ut ur kuben
---
Enligt högerhandsregeln pekar (b − a) × (c − a) mot den betraktare för vilken a → b → c går moturs. Om den pekar in i kuben byter du plats på två hörn.
```

## Face culling

I början av kapitlet sa vi att {{api}} kan kasta triangelprimitiver om de ritas som baksidor. Nu när vi vet hur vi
anger vertexarnas ordning kan vi börja använda face culling.

:::opengl
Face culling är avstängt som standard. För att slå på det behöver vi bara slå på OpenGL:s alternativ `GL_CULL_FACE`:

```cpp
    glEnable(GL_CULL_FACE); // do not draw the faces that point away from the camera
```

Från och med nu kastas alla sidor som inte är framsidor – inifrån en kub skulle du inte se något av den, eftersom alla
dess inre sidor är baksidor. Just nu sparar vi över 50 % av arbetet med att rita fragment om OpenGL råkar rita
baksidorna först (annars hade djuptestet redan kastat dem). Observera att det här bara fungerar riktigt bra med slutna
former som en kub. Vi måste stänga av face culling igen när vi ritar grässtråna från förra kapitlet, eftersom både
deras framsida *och* baksida ska synas.

OpenGL låter oss också ändra vilken sorts sida vi vill culla. Tänk om vi vill culla framsidorna och inte baksidorna?
Det anger vi med `glCullFace`:

```cpp
    glCullFace(GL_BACK);    // cull the back faces (the default)
```

Funktionen `glCullFace` har tre möjliga alternativ:

- `GL_BACK`: cullar bara baksidorna.
- `GL_FRONT`: cullar bara framsidorna.
- `GL_FRONT_AND_BACK`: cullar både fram- och baksidorna.

Startvärdet för `glCullFace` är `GL_BACK`. Vi kan också tala om för OpenGL att vi hellre vill ha medurs sidor som
framsidor i stället för moturs, med `glFrontFace`:

```cpp
    glFrontFace(GL_CCW);    // front faces are the counter-clockwise ones (the default)
```

Standardvärdet är `GL_CCW`, som står för moturs ordning, och det andra alternativet är `GL_CW`, som (förstås) står för
medurs ordning. Båda anropen sätter standardvärdena, men när de står utskrivna syns det vad programmet förlitar sig på.
De tre raderna hamnar där TODO:n står, efter `glDepthFunc`.
:::
:::vulkan
I Vulkan är face culling en del av pipelinen, i rastreringstillståndet (kapitlet *Fixed functions* i vulkan-tutorial):
`cullMode` säger vilka sidor som ska cullas och `frontFace` vilken ordning som är framsidan.

`cullMode` tar `VK_CULL_MODE_NONE`, `VK_CULL_MODE_FRONT_BIT`, `VK_CULL_MODE_BACK_BIT` eller
`VK_CULL_MODE_FRONT_AND_BACK` (båda – OpenGL:s `GL_FRONT_AND_BACK`). Vår kub går nu moturs sett utifrån, så framsidorna
ska vara de som går moturs – OpenGL:s `GL_CCW`:

```cpp
        // Skip the triangles that face away from the camera. Front = counter-clockwise on screen, like OpenGL's GL_CCW:
        // the y flip in the projection (proj[1][1] *= -1) shows the scene upright, so a triangle that is counter-clockwise
        // seen from outside is counter-clockwise on screen too (without the flip the picture and the winding would be
        // upside down).
        rasterizer.cullMode = VK_CULL_MODE_BACK_BIT;
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE;
```

Varför är moturs rätt, när Vulkans framebuffer har y nedåt? Vulkan bedömer ordningen i framebuffer-koordinater – på den
färdiga bilden, så som du ser den i fönstret. Utan vändningen skulle GLM:s projektion (gjord för OpenGL, med y uppåt)
lägga bilden upp och ner i Vulkans framebuffer med y nedåt, och den spegelbilden skulle vända varje triangels ordning.
`ubo.proj[1][1] *= -1` vänder bilden rätt igen, så varje triangel hamnar på skärmen med samma orientering som i OpenGL.
vulkan-tutorial gör samma byte till `VK_FRONT_FACE_COUNTER_CLOCKWISE` när den lägger till den här vändningen i sin
projektionsmatris, av just det skälet.

Observera att det här bara fungerar riktigt bra med slutna former som en kub. Eftersom pipelinen låser cull-läget
skulle grässtråna från förra kapitlet, där både framsidan *och* baksidan ska synas, behöva en pipeline med
`VK_CULL_MODE_NONE`.
:::
:::d3d12
I Direct3D 12 är face culling en del av PSO:ts rasterizer state: `CullMode` säger vilka sidor som ska cullas och
`FrontCounterClockwise` vilken ordning som är framsidan.

`CullMode` tar `D3D12_CULL_MODE_NONE`, `D3D12_CULL_MODE_FRONT` eller `D3D12_CULL_MODE_BACK`; det finns inget alternativ
för att culla båda (OpenGL:s `GL_FRONT_AND_BACK`). Vår kub går nu moturs sett utifrån, så framsidorna ska vara de som
går moturs – OpenGL:s `GL_CCW`. Vid TODO:n ersätter du raden med `D3D12_CULL_MODE_NONE`:

```cpp
        // Face culling: do not draw the triangles that face away from the camera (their back
        // faces). Which side is the front: counter-clockwise on the screen, like OpenGL's
        // default. (Direct3D's default is clockwise, but the right-handed view and projection
        // matrices give the same screen positions as OpenGL, so the same winding rule fits.)
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_BACK;
        psoDesc.RasterizerState.FrontCounterClockwise = TRUE;
```

Varför moturs, när Direct3D:s standard är medurs? Direct3D bedömer ordningen på render targeten – på den färdiga
bilden, så som du ser den i fönstret. Den här kursen bygger view och projektion med de högerhänta `XMMatrixLookAtRH`
och `XMMatrixPerspectiveFovRH`, som ger samma x och y i clip space som GLM:s `lookAt` och `perspective`, så varje
triangel hamnar på skärmen på samma ställe, med samma orientering, som i OpenGL. En sida som går moturs sett utifrån går
då moturs på skärmen när den är vänd mot kameran. (Direct3D:s medurs standard kommer från dess traditionella
vänsterhänta koordinater, där modeller har motsatt ordning.)

Observera att det här bara fungerar riktigt bra med slutna former som en kub. Eftersom PSO:t låser cull-läget skulle
grässtråna från förra kapitlet, där både framsidan *och* baksidan ska synas, behöva ett PSO med `D3D12_CULL_MODE_NONE`.
:::

:::opengl
```quiz
Vid vilken tidpunkt avgör OpenGL om en triangel är en framsida eller en baksida?
- [ ] När `glBufferData` laddar upp vertexarna, utifrån deras ordning i buffern
- [ ] I fragment shadern, för varje fragment för sig
- [x] Vid rastreringen, efter vertex shadern: utifrån ordningen på triangelns hörn på skärmen
- [ ] När `glEnable(GL_CULL_FACE)` anropas, en gång för alla trianglar
---
Bara de transformerade positionerna avslöjar från vilken sida kameran ser en triangel. Därför kan samma triangel vara en framsida från ena hållet och en baksida från det andra – och därför når en cullad triangel aldrig fragment shadern.
```
:::
:::vulkan
```quiz
Vulkans framebuffer har y nedåt. Varför är `VK_FRONT_FACE_COUNTER_CLOCKWISE` ändå rätt val för vår kub som går moturs?
- [ ] Vulkan mäter alltid ordningen i objektrummet, före alla transformationer
- [ ] `frontFace` ignoreras när `cullMode` är `VK_CULL_MODE_BACK_BIT`
- [x] Ordningen bedöms på den färdiga bilden, och `proj[1][1] *= -1` gör den bilden upprätt – så trianglarna behåller den orientering de har i OpenGL
- [ ] Vulkans y-axel nedåt gör medurs trianglar moturs bara i vertex shadern
---
Utan vändningen skulle bilden stå på huvudet, en spegelbild, och varje ordning vara omvänd. Med den går en sida som går moturs sett utifrån också moturs på skärmen, precis som i OpenGL. vulkan-tutorial byter till `VK_FRONT_FACE_COUNTER_CLOCKWISE` av just det skälet.
```
:::
:::d3d12
```quiz
Direct3D:s standard för framsidor är medurs. Varför sätter projektet `FrontCounterClockwise = TRUE`?
- [ ] Culling fungerar bara med framsidor som går moturs
- [ ] `D3D12_CULL_MODE_BACK` ignorerar `FrontCounterClockwise`
- [x] Ordningen bedöms på render targeten, och de högerhänta matriserna lägger varje triangel på skärmen som OpenGL gör – så kubens utsidor går moturs där
- [ ] HLSL-kompilatorn vänder vertexordningen i varje triangel
---
`XMMatrixLookAtRH` och `XMMatrixPerspectiveFovRH` ger samma x och y i clip space som GLM. En sida som går moturs sett utifrån går då moturs på render targeten när den är vänd mot kameran, så moturs är framsidan.
```
:::

Det finns en sak till innan vi kan slå på culling: golvet. Dess två trianglar är också en framsida – sidan som är vänd
uppåt, mot kameran ovanför, ska vara framsidan. Men learnopengls golv börjar med hörnen (5, -0.5, 5), (-5, -0.5, 5),
(-5, -0.5, -5): sett ovanifrån går det medurs. Cullat som en baksida skulle golvet helt enkelt försvinna. Att byta plats
på 2:a och 3:e hörnet i båda trianglarna (vart och ett med sina texturkoordinater) löser det:

:::opengl
```cpp
    float planeVertices[] = {
        // positions          // texture Coords (note we set these higher than 1 (together with GL_REPEAT as texture wrapping mode). this will cause the floor texture to repeat)
        // both triangles are counter-clockwise seen from above, so the floor's front face points up
         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,
        -5.0f, -0.5f,  5.0f,  0.0f, 0.0f,

         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
         5.0f, -0.5f, -5.0f,  2.0f, 2.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f
    };
```
:::
:::vulkan
```cpp
    // floor (y = -0.5): vertices 36..41, counter-clockwise seen from above (it was clockwise)
    {{ 5.0f, -0.5f,  5.0f}, {2.0f, 2.0f}},
    {{-5.0f, -0.5f, -5.0f}, {0.0f, 0.0f}},
    {{-5.0f, -0.5f,  5.0f}, {0.0f, 2.0f}},
    {{ 5.0f, -0.5f,  5.0f}, {2.0f, 2.0f}},
    {{ 5.0f, -0.5f, -5.0f}, {2.0f, 0.0f}},
    {{-5.0f, -0.5f, -5.0f}, {0.0f, 0.0f}}
```
:::
:::d3d12
```cpp
            // both triangles are counter-clockwise seen from above: the floor's front face points up
            { {  5.0f, -0.5f,  5.0f }, { 2.0f, 2.0f } },
            { { -5.0f, -0.5f, -5.0f }, { 0.0f, 0.0f } },
            { { -5.0f, -0.5f,  5.0f }, { 0.0f, 2.0f } },

            { {  5.0f, -0.5f,  5.0f }, { 2.0f, 2.0f } },
            { {  5.0f, -0.5f, -5.0f }, { 2.0f, 0.0f } },
            { { -5.0f, -0.5f, -5.0f }, { 0.0f, 0.0f } }
```
:::

```quiz
Vad skulle hända med backface culling påslaget om du lät learnopengls golvvertexar vara som de var?
- [ ] Ingenting: ett golv är ett enda plan, så culling gäller aldrig för det
- [x] Golvet skulle försvinna: dess trianglar går medurs sett ovanifrån, så kameran ser deras baksida
- [ ] Bara halvan av golvet bakom kuberna skulle försvinna
- [ ] Golvet skulle visa sin textur spegelvänd
---
Culling känner inte till golv och kuber, bara trianglar och deras ordning på skärmen. Kameran tittar på golvet ovanifrån; om dess hörn går medurs därifrån är båda trianglarna baksidor och cullas.
```

Gör nu uppgiften **cull-back**: slå på culling som ovan och rätta golvet, och tryck sedan på **Build & run**. Du borde
se … exakt samma bild som förut. (Några golvpixlar kan skilja sig en nivå eller två på grund av avrundning.)

Det är inget misstag. Kubernas baksidor – varje kubs bortre sidor – var redan dolda: de ritades, men framsidorna täckte
dem, och där en baksida ritades efter en framsida kastade djuptestet dess fragment. Nu rastreras de inte ens, så
fragment shadern körs aldrig för dem. Bilden är densamma; arbetet är mindre.

```quiz
Efter uppgiften **cull-back** ser bilden exakt likadan ut som förut. Vad ändrade culling?
- [x] Baksidorna rastreras inte längre, så fragment shadern körs inte för dem – förut ritades de och doldes sedan av framsidorna och djuptestet
- [ ] Ingenting: djuptestet hoppar redan över baksidor innan de rastreras
- [ ] Baksidorna ritas nu med en genomskinlig färg
---
Utan culling skuggade GPU:n också de dolda baksidorna, och antingen skrev framsidorna över dem eller så förkastades de i djuptestet. Culling släpper dem direkt efter vertex shadern – mer än halva fragmentarbetet för en kub sparat, utan synlig skillnad.
```

Det här är gott och väl, men låt oss se vad som händer när vi cullar de sidor vi *kan* se. learnopengls kapitel provar
den andra ordningen: med `glFrontFace(GL_CW)` blir de moturs sidorna baksidor, och backface culling tar nu bort sidorna
som är vända mot kameran. Samma sak händer om du behåller moturs framsidor och i stället cullar framsidorna:

:::opengl
```cpp
    glCullFace(GL_FRONT);   // cull the front faces: now only the back faces (the cubes' insides) are drawn
```
:::
:::vulkan
```cpp
        rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT; // the exercise: skip the front faces instead
```
:::
:::d3d12
```cpp
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;    // cull the front faces: now only the back faces (the cubes' insides) are drawn
```
:::

Gör nu den sista uppgiften, **cull-front**, och tryck på **Build & run**. Kuberna behåller sina konturer, men nu tittar
du in i dem: sidorna närmast dig är borta, och du ser insidan av de bortre sidorna, med marmorn på. Och golvet har
försvunnit: dess framsida är vänd uppåt, mot kameran, så det cullas nu.

```quiz
Med framsidorna cullade, varför ser kuberna ihåliga ut medan golvet försvinner helt?
- [x] Varje kub har fortfarande baksidor – dess bortre sidor, sedda inifrån – men golvets enda sida som kameran ser är dess framsida
- [ ] Golvet ritas efter kuberna, och culling påverkar bara det sista ritanropet
- [ ] Kubernas marmortextur har en alfakanal, golvets metalltextur har det inte
- [ ] Golvet är för långt bort för att rastreras
---
En sluten kub har alltid sidor som är vända bort från kameran, och de ritas nu. Golvet är en enda yta sedd ovanifrån: dess framsida cullas, och dess baksida pekar nedåt, bort från kameran, så ingenting av det blir kvar.
```

Face culling är ett utmärkt verktyg för att öka prestandan i dina program med minimal ansträngning; särskilt som alla
3D-program exporterar modeller med konsekvent ordning (moturs som standard). Du måste dock hålla reda på vilka föremål
som faktiskt har nytta av face culling och vilka som inte ska cullas alls.

## Övningar

- Kan du definiera om vertexdatan genom att ange varje triangel i medurs ordning och sedan rita scenen med medurs
  trianglar som framsidor? Bilden ska se exakt ut som efter uppgiften **cull-back** – inklusive golvet.

:::opengl
Medurs framsidor är `glFrontFace(GL_CW)`.
:::
:::vulkan
Medurs framsidor är `rasterizer.frontFace = VK_FRONT_FACE_CLOCKWISE`.
:::
:::d3d12
Medurs framsidor är `FrontCounterClockwise = FALSE`, Direct3D:s standard.
:::
