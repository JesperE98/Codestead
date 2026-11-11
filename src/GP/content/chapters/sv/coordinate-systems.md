# Koordinatsystem

I förra kapitlet lärde vi oss hur vi kan dra nytta av matriser genom att transformera alla vertexar med
transformationsmatriser. {{api}} förväntar sig att alla vertexar som ska bli synliga ligger i normaliserade
enhetskoordinater (normalized device coordinates) efter varje körning av vertex shadern. Det vill säga: x-, y- och
z-koordinaten för varje vertex ska ligga mellan `-1.0` och `1.0` (för z beror det, som du ska se, på API:t);
koordinater utanför detta intervall syns inte. Det vi brukar göra är att ange koordinaterna i ett intervall (eller
rum) som vi själva bestämmer, och i vertex shadern transformera dessa koordinater till normaliserade
enhetskoordinater (NDC). Dessa NDC lämnas sedan till rastreringen, som gör om dem till 2D-koordinater/pixlar på din
skärm.

Att transformera koordinater till NDC görs oftast steg för steg: vi transformerar ett objekts vertexar till flera
koordinatsystem innan vi till sist transformerar dem till NDC. Fördelen med att transformera dem via flera
*mellanliggande* koordinatsystem är att vissa operationer/beräkningar är enklare i vissa koordinatsystem, vilket
snart kommer att framgå. Det finns totalt 5 olika koordinatsystem som är viktiga för oss:

- Lokalt rum (local space, eller objektrum)
- Världsrum (world space)
- Vyrum (view space, eller ögonrum)
- Klipprum (clip space)
- Skärmrum (screen space)

Det är alla olika tillstånd som våra vertexar transformeras till innan de till slut blir fragment.

Du är förmodligen ganska förvirrad vid det här laget över vad ett rum eller koordinatsystem egentligen är, så vi
förklarar dem först på en högre nivå genom att visa helheten och vad varje rum representerar.

:::opengl
Det här kapitlets projekt är resultatet av *Transformations* med transformationen borttagen igen: den texturerade
lådan (80 % trälåda, 20 % ansikte) ligger platt mitt i fönstret, och `shader.vs` skriver
`gl_Position = vec4(aPos, 1.0);`. En sak är ny: shaderklassen är nu learnopengls **`shader_m.h`** – samma klass som
`shader_s.h`, med funktioner för att sätta vektorer och matriser tillagda (`setVec2/3/4`, `setMat2/3/4`). Den vi
använder är `setMat4`:

```cpp
    void setMat4(const std::string &name, const glm::mat4 &mat) const
    {
        glUniformMatrix4fv(glGetUniformLocation(ID, name.c_str()), 1, GL_FALSE, &mat[0][0]);
    }
```
:::
:::vulkan
Det här kapitlets projekt är resultatet av *Transformations* med transformationskoden borttagen igen: den
texturerade lådan ligger platt mitt i fönstret, `shader.vert` skriver `gl_Position = vec4(inPosition, 1.0);` och
vänder y, och `recordCommandBuffer()` ritar en gång utan att pusha något. Kvar från *Transformations* finns push
constant-intervallet i pipeline layouten och `struct PushConstants`, vars fält nu heter `glm::mat4 model`.

Kapitlet följer två delar av vulkan-tutorial: *Uniform buffers* och *Depth buffering*. Deras nya funktioner finns
redan som tomma stubbar och anropas från rätt ställen: `createDepthResources()` i `initVulkan()` direkt före
`createFramebuffers()`, `createUniformBuffers()` efter `createIndexBuffer()`, och `updateUniformBuffer()` i
`drawFrame()` direkt efter `vkAcquireNextImageKHR`.
:::
:::d3d12
Det här kapitlets projekt är resultatet av *Transformations* med transformationskoden borttagen igen:
`PopulateCommandList()` ritar den texturerade lådan en gång med `XMMATRIX model = XMMatrixIdentity();`, så den
ligger platt mitt i fönstret. Root-konstanterna i register `b0` heter nu
`struct ModelConstants { XMFLOAT4X4 model; }` (`cbuffer ModelConstants : register(b0) { float4x4 model; }` i
shadern). CBV/SRV-descriptor heapen har bytt namn till `m_cbvSrvHeap` (med `m_cbvSrvDescriptorSize`), eftersom den
ska rymma en constant buffer view bredvid de två texturernas SRV:er.

Constant buffern följer Microsofts exempel D3D12HelloConstBuffers, depth buffern det sätt som de andra
D3D12-exemplen (till exempel D3D12Bundles) skapar sina på.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE.

## Helheten

För att transformera koordinaterna från ett rum till nästa använder vi flera transformationsmatriser, där de
viktigaste är *model*-, *view*- och *projection*-matrisen. Våra vertexkoordinater börjar i *lokalt rum* som *lokala
koordinater* och bearbetas sedan vidare till *världskoordinater*, *vykoordinater*, *klippkoordinater* och hamnar
till sist som *skärmkoordinater*. Följande bild visar processen och vad varje transformation gör:

```text
                  model             view              projection
  lokalt rum   ─────────▶  världs- ─────────▶  vyrum ──────────────▶  klipprum
  (objekt)                 rum
                                                                         │
                                                    perspektivdivision   │
                                                                         ▼
  skärmrum  ◀───────────────────────────────────────────────  normaliserade enhets-
                       viewport-transformation                  koordinater (NDC)
```

1. Lokala koordinater är objektets koordinater relativt dess lokala origo; det är de koordinater som ditt objekt
   börjar i.
2. Nästa steg är att transformera de lokala koordinaterna till koordinater i världsrummet, alltså koordinater i
   förhållande till en större värld. Dessa koordinater är relativa till ett globalt origo för världen, tillsammans med
   många andra objekt som också placerats relativt världens origo.
3. Sedan transformerar vi världskoordinaterna till koordinater i vyrummet, så att varje koordinat är sedd från
   kamerans eller betraktarens synvinkel.
4. När koordinaterna är i vyrummet vill vi projicera dem till klippkoordinater. Klippkoordinater bearbetas till
   intervallet `-1.0` till `1.0` (z: se nedan) och avgör vilka vertexar som hamnar på skärmen. Projektionen till
   klippkoordinater kan lägga till perspektiv om vi använder perspektivprojektion.
5. Till sist transformerar vi klippkoordinaterna till skärmkoordinater i en process som kallas
   *viewport-transformation*, som transformerar koordinaterna från `-1.0` och `1.0` till det koordinatintervall som
   viewporten definierar. De resulterande koordinaterna skickas sedan till rastreringen som gör om dem till fragment.

Du har förmodligen fått en viss uppfattning om vad varje enskilt rum används till. Anledningen till att vi
transformerar våra vertexar till alla dessa rum är att vissa operationer är mer meningsfulla eller enklare i vissa
koordinatsystem. När du till exempel ändrar ditt objekt är det mest naturligt att göra det i lokalt rum, medan
beräkningar på objektet i förhållande till andra objekts positioner är mest naturliga i världskoordinater, och så
vidare. Om vi ville kunde vi definiera en enda transformationsmatris som går från lokalt rum till klipprum i ett
svep, men det ger oss mindre flexibilitet.

De tre första stegen är dina: du skriver dem som matriser och tillämpar dem i vertex shadern. De två sista –
perspektivdivisionen och viewport-transformationen – gör GPU:n åt dig efter vertex shadern. Vi går igenom varje
koordinatsystem mer i detalj nedan.

```quiz
I vilken ordning passerar en vertex koordinatsystemen?
- [ ] lokalt rum → klipprum → världsrum → vyrum → skärmrum
- [x] lokalt rum → världsrum → vyrum → klipprum → skärmrum
- [ ] lokalt rum → vyrum → världsrum → klipprum → skärmrum
- [ ] världsrum → lokalt rum → vyrum → klipprum → skärmrum
---
Model-matrisen för de lokala koordinaterna ut i världen, view-matrisen ställer världen framför kameran, projection-matrisen ger klippkoordinater, och GPU:ns perspektivdivision och viewport-transformation slutar på skärmen.
```

## Lokalt rum

Lokalt rum är det koordinatrum som är lokalt för ditt objekt, det vill säga där ditt objekt börjar. Tänk dig att du
har skapat din kub i ett modelleringsprogram (som Blender). Kubens origo ligger förmodligen i `(0,0,0)` även om
kuben kan hamna på ett helt annat ställe i den färdiga applikationen. Troligen har alla modeller du skapat
`(0,0,0)` som utgångsposition. Alla vertexar i din modell ligger därför i *lokalt* rum: de är alla lokala för ditt
objekt.

Vertexarna i lådan vi har använt angavs som koordinater mellan `-0.5` och `0.5` med `0.0` som origo. Det är lokala
koordinater.

## Världsrum

Om vi importerade alla våra objekt direkt i applikationen skulle de förmodligen alla ligga inuti varandra vid
världens origo `(0,0,0)`, vilket inte är vad vi vill. Vi vill ge varje objekt en position för att placera det i en
större värld. Koordinaterna i världsrummet är precis vad de låter som: koordinaterna för alla dina vertexar relativt
en (spel)värld. Det är i det här koordinatrummet du vill ha dina objekt transformerade, så att de ligger utspridda
(helst på ett realistiskt sätt). Objektets koordinater transformeras från lokalt rum till världsrum; det görs med
*model*-matrisen.

Model-matrisen är en transformationsmatris som förflyttar, skalar och/eller roterar ditt objekt för att placera det
i världen på den plats och i den riktning det hör hemma. Tänk dig att du transformerar ett hus genom att skala ner
det (det var lite för stort i lokalt rum), flytta det till en förort och rotera det lite åt vänster runt y-axeln så
att det passar fint bland grannhusen. Matrisen i förra kapitlet som placerade lådan runt om i scenen kan du också se
som en sorts model-matris; vi transformerade lådans lokala koordinater till olika platser i scenen/världen.

## Vyrum

Vyrummet är det som brukar kallas {{api}}s *kamera* (det kallas ibland även *kamerarum* eller *ögonrum*). Vyrummet
är resultatet av att transformera dina koordinater i världsrummet till koordinater som ligger framför användarens
blick. Vyrummet är alltså rummet sett från kamerans synvinkel. Det görs oftast med en kombination av förflyttningar
och rotationer som flyttar/roterar scenen så att vissa föremål hamnar framför kameran. Dessa sammansatta
transformationer lagras oftast i en *view-matris* som transformerar världskoordinater till vyrummet. I nästa kapitel
går vi grundligt igenom hur man skapar en sådan view-matris för att simulera en kamera.

:::vulkan d3d12
Precis som OpenGL har {{api}} ingen egen kamera: API:t vet ingenting om kameror, världar eller objekt. Kameran är
bara en matris som ditt program räknar ut och din vertex shader tillämpar.
:::

## Klipprum

I slutet av varje körning av vertex shadern förväntar sig {{api}} att koordinaterna ligger inom ett visst intervall,
och varje koordinat som hamnar utanför det *klipps*. Koordinater som klipps kastas bort, så de återstående
koordinaterna blir fragment som syns på skärmen. Det är också därifrån *klipprum* (clip space) har fått sitt namn.

Eftersom det inte är särskilt intuitivt att ange alla synliga koordinater inom intervallet `-1.0` till `1.0`,
anger vi en egen uppsättning koordinater att arbeta i och omvandlar dem tillbaka till NDC så som {{api}} förväntar
sig dem.

För att transformera vertexkoordinater från vyrum till klipprum definierar vi en så kallad *projektionsmatris* som
anger ett intervall av koordinater, t.ex. `-1000` till `1000` i varje dimension. Projektionsmatrisen omvandlar sedan
koordinater inom detta intervall till normaliserade enhetskoordinater. Alla koordinater utanför intervallet hamnar
inte mellan `-1.0` och `1.0` och klipps därför. Med det intervall vi angav i projektionsmatrisen skulle koordinaten
(`1250`, `500`, `750`) inte synas, eftersom x-koordinaten ligger utanför intervallet och därför omvandlas till en
koordinat större än `1.0` i NDC och klipps.

> Observera att om bara en del av en primitiv, t.ex. en triangel, ligger utanför klippvolymen så bygger GPU:n om
> triangeln till en eller flera trianglar som ryms inom klippintervallet.

Den synvolym som en projektionsmatris skapar kallas *frustum*, och varje koordinat som hamnar inuti denna frustum
hamnar på användarens skärm. Hela processen att omvandla koordinater inom ett angivet intervall till NDC, som enkelt
kan avbildas på 2D-koordinater, kallas *projektion*, eftersom projektionsmatrisen *projicerar* 3D-koordinater till
normaliserade enhetskoordinater som är lätta att avbilda i 2D.

När alla vertexar har transformerats till klipprummet utförs en sista operation som kallas *perspektivdivision*, där
vi dividerar positionsvektorernas x-, y- och z-komponent med vektorns homogena w-komponent; perspektivdivisionen är
det som gör om de fyrdimensionella klippkoordinaterna till tredimensionella normaliserade enhetskoordinater. Detta
steg utförs automatiskt i slutet av vertex shader-steget.

Det är efter detta steg som de resulterande koordinaterna avbildas på skärmkoordinater (med viewportens
inställningar) och görs om till fragment.

Den exakta formen på NDC-volymen är där de tre API:erna skiljer sig åt:

:::opengl
I OpenGL måste x, y **och z** för en synlig vertex alla ligga mellan `-1.0` och `1.0` efter perspektivdivisionen.
x = `-1` är viewportens vänstra kant, y = `-1` den **nedre** kanten (+y pekar uppåt), z = `-1` det nära planet och
z = `1` det bortre planet. Viewport-transformationen avbildar senare z från `-1..1` på djupintervallet `0..1` (som
sätts med `glDepthRange`, `0..1` som standard) – det är det värdet som hamnar i depth buffern.

```text
OpenGL NDC:   x  -1 (vänster) .. +1 (höger)
              y  -1 (nederst) .. +1 (överst)
              z  -1 (nära)    .. +1 (bortre)
```

GLM skrevs för OpenGL, så `glm::ortho` och `glm::perspective` ger exakt detta intervall.
:::
:::vulkan
Vulkans NDC skiljer sig från OpenGL:s på två sätt. **Djupet går från `0` till `1`** (inte `-1` till `1`): z = `0`
är det nära planet och z = `1` det bortre. Och **y pekar nedåt**: y = `-1` är viewportens *övre* kant och y = `1`
den nedre. x är som i OpenGL.

```text
Vulkan NDC:   x  -1 (vänster) .. +1 (höger)
              y  -1 (överst)  .. +1 (nederst)
              z   0 (nära)    ..  1 (bortre)
```

GLM skrevs för OpenGL, så som standard ger dess projektionsfunktioner OpenGL:s intervall. Två små ändringar anpassar
dem till Vulkan, precis som i vulkan-tutorial:

- `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` före GLM-includen gör att `glm::perspective` och `glm::ortho` avbildar djupet
  på `0..1`. Utan den skulle allt i den nära halvan av djupintervallet få negativt z och klippas.
- `proj[1][1] *= -1;` byter tecken på projektionens y-skala, så att +y i din värld fortfarande hamnar överst i
  fönstret. I *Transformations* gjorde vertex shadern denna vändning (`gl_Position.y = -gl_Position.y;`); från och
  med nu gör projektionsmatrisen det, och raden i shadern försvinner.
:::
:::d3d12
Direct3D:s NDC skiljer sig från OpenGL:s på ett sätt: **djupet går från `0` till `1`** (inte `-1` till `1`): z = `0`
är det nära planet och z = `1` det bortre. x och y är som i OpenGL – y = `-1` är viewportens nedre kant och +y pekar
uppåt.

```text
Direct3D NDC:  x  -1 (vänster) .. +1 (höger)
               y  -1 (nederst) .. +1 (överst)
               z   0 (nära)    ..  1 (bortre)
```

DirectXMaths projektionsfunktioner ger detta intervall. De finns i två varianter, `…LH` (vänsterhänt) och `…RH`
(högerhänt), som skiljer sig i vilket håll kameran tittar i vyrummet – vi återkommer till det i *Till 3D*. Kursen
använder de **högerhänta** (`XMMatrixPerspectiveFovRH`, `XMMatrixOrthographicOffCenterRH`), eftersom de använder
samma vyrum som GLM och OpenGL: med dem är varje tal i det här kapitlet detsamma som hos learnopengl.
:::

:::opengl
```quiz
Efter perspektivdivisionen har en vertex i scenen z = 0.5. Ligger den inom OpenGL:s synvolym, och hur är det med z = -0.5?
- [ ] z = 0.5 syns, z = -0.5 klipps eftersom den ligger framför det nära planet
- [ ] Båda klipps: z måste vara exakt 0 i NDC
- [ ] Bara z = -0.5 syns, eftersom +z pekar bort från kameran
- [x] Båda syns: OpenGL behåller z mellan -1 (nära) och 1 (bortre)
---
OpenGL:s NDC-kub går från -1 till 1 längs alla tre axlarna. Vulkan och Direct3D använder 0..1 för z, och därför byggs deras projektionsmatriser annorlunda.
```
:::
:::vulkan
```quiz
Efter perspektivdivisionen har en vertex i scenen z = -0.5. Vad händer med den i Vulkan?
- [x] Den klipps: Vulkan behåller z mellan 0 (nära) och 1 (bortre)
- [ ] Den ritas överst i fönstret, eftersom Vulkans y pekar nedåt
- [ ] Den ritas: Vulkan behåller z mellan -1 och 1 som OpenGL
- [ ] Den ritas, men bakom alla andra vertexar
---
Vulkans djupintervall i NDC är 0..1. Därför behövs `GLM_FORCE_DEPTH_ZERO_TO_ONE`: GLM:s standardprojektion (för OpenGL) skulle ge allt i den nära halvan av frustumet negativt z.
```
:::
:::d3d12
```quiz
Efter perspektivdivisionen har en vertex i scenen z = -0.5. Vad händer med den i Direct3D?
- [ ] Den ritas överst i fönstret, eftersom Direct3D:s y pekar nedåt
- [ ] Den ritas: Direct3D behåller z mellan -1 och 1 som OpenGL
- [ ] Den ritas, men bakom alla andra vertexar
- [x] Den klipps: Direct3D behåller z mellan 0 (nära) och 1 (bortre)
---
Direct3D:s djupintervall i NDC är 0..1, och dess y pekar uppåt som i OpenGL. DirectXMaths projektionsfunktioner ger dig detta intervall.
```
:::

För att transformera vykoordinater till klippkoordinater använder vi oftast en av två former av projektionsmatriser,
där varje form definierar sin egen frustum. Vi kan skapa antingen en *ortografisk* projektionsmatris eller en
*perspektivisk* projektionsmatris.

### Ortografisk projektion

En ortografisk projektionsmatris definierar en kubliknande frustum som anger klipprummet, där varje vertex utanför
lådan klipps. När vi skapar en ortografisk projektionsmatris anger vi bredd, höjd och längd på den synliga frustumen.
Alla koordinater inuti denna frustum hamnar inom NDC-intervallet efter att ha transformerats med matrisen och klipps
därför inte. Frustumen ser ut ungefär som en låda:

```text
                 bortre plan
             ┌──────────────┐
            ╱│             ╱│
           ╱ │            ╱ │      alla kanter parallella:
          ┌──────────────┐  │      en låda
          │  └───────────│──┘
  nära    │ ╱            │ ╱
  plan    │╱             │╱
          └──────────────┘
                 ▲
               kamera
```

Frustumen definierar de synliga koordinaterna och anges med en bredd, en höjd och ett *nära* och ett *bortre* plan.
Varje koordinat framför det nära planet klipps, och detsamma gäller koordinater bakom det bortre planet. Den
ortografiska frustumen avbildar alla koordinater inuti den direkt på normaliserade enhetskoordinater utan några
särskilda bieffekter, eftersom den inte rör den transformerade vektorns w-komponent; om w-komponenten förblir `1.0`
ändrar perspektivdivisionen inte koordinaterna.

:::opengl
För att skapa en ortografisk projektionsmatris använder vi GLM:s inbyggda funktion `glm::ortho`:

```cpp
glm::ortho(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
```
:::
:::vulkan
För att skapa en ortografisk projektionsmatris använder vi GLM:s inbyggda funktion `glm::ortho` – med
`GLM_FORCE_DEPTH_ZERO_TO_ONE` definierad, och med y vänt som i perspektivmatrisen senare:

```cpp
glm::mat4 proj = glm::ortho(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
proj[1][1] *= -1; // flip y: the scale ...
proj[3][1] *= -1; // ... and the offset, because this box isn't centred on y = 0
```

(Perspektivmatrisen nedan är centrerad, så för den är `proj[1][1]` allt som behöver vändas.)
:::
:::d3d12
För att skapa en ortografisk projektionsmatris använder vi DirectXMaths funktion `XMMatrixOrthographicOffCenterRH`:

```cpp
XMMATRIX projection = XMMatrixOrthographicOffCenterRH(0.0f, 800.0f, 0.0f, 600.0f, 0.1f, 100.0f);
```
:::

De två första parametrarna anger frustumens vänstra och högra koordinat, och den tredje och fjärde parametern anger
dess nedre och övre del. Med de fyra punkterna har vi definierat storleken på det nära och det bortre planet, och den
femte och sjätte parametern anger sedan avstånden till det nära och det bortre planet. Den här projektionsmatrisen
transformerar alla koordinater mellan dessa x-, y- och z-värden till normaliserade enhetskoordinater. Utskriven, med
*l*, *r*, *b*, *t* för vänster, höger, botten och topp och *n* och *f* för avstånden till det nära och det bortre
planet, ser matrisen ut så här:

:::opengl
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -2/(f-n)   -(f+n)/(f-n) |
| 0         0         0           1           |
```

En punkt på z = `-n` i vyrummet får z = `-1`, en punkt på z = `-f` får z = `1`.
:::
:::vulkan
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -1/(f-n)   -n/(f-n)     |
| 0         0         0           1           |
```

(före y-vändningen). En punkt på z = `-n` i vyrummet får z = `0`, en punkt på z = `-f` får z = `1`: bara den tredje
raden skiljer sig från OpenGL:s.
:::
:::d3d12
```text
| 2/(r-l)   0         0          -(r+l)/(r-l) |
| 0         2/(t-b)   0          -(t+b)/(t-b) |
| 0         0         -1/(f-n)   -n/(f-n)     |
| 0         0         0           1           |
```

En punkt på z = `-n` i vyrummet får z = `0`, en punkt på z = `-f` får z = `1`: bara den tredje raden skiljer sig från
OpenGL:s. Det här är matrisen skriven för en kolumnvektor till höger, som i GLSL; DirectXMath lagrar dess
transponat, eftersom den multiplicerar en radvektor från vänster (`v * M`, se *Transformations*).
:::

En ortografisk projektionsmatris avbildar koordinater direkt på det 2D-plan som är din skärm, men i verkligheten ger
en direkt projektion orealistiska resultat, eftersom projektionen inte tar hänsyn till *perspektiv*. Det är något som
den perspektiviska projektionsmatrisen fixar åt oss.

### Perspektivprojektion

Om du någon gång njuter av den grafik som *verkligheten* har att erbjuda märker du att föremål som är längre bort ser
mycket mindre ut. Denna märkliga effekt kallar vi *perspektiv*. Perspektiv märks särskilt när man tittar längs en
oändlig motorväg eller järnväg: vägens två linjer verkar mötas på tillräckligt långt avstånd.

På grund av perspektivet verkar linjerna alltså mötas på tillräckligt långt avstånd. Det är precis den effekten som
perspektivprojektion försöker efterlikna, och det gör den med en perspektivisk projektionsmatris. Projektionsmatrisen
avbildar ett givet frustumintervall på klipprummet, men ändrar också w-värdet för varje vertexkoordinat så att ju
längre bort från betraktaren en vertexkoordinat ligger, desto större blir w-komponenten. När koordinaterna har
transformerats till klipprummet ligger de i intervallet `-w` till `w` (allt utanför klipps). {{api}} kräver att de
synliga koordinaterna hamnar inom NDC-intervallet som vertex shaderns slutliga utdata, så när koordinaterna väl är i
klipprummet tillämpas perspektivdivision på klippkoordinaterna:

```text
         | x / w |
  out =  | y / w |
         | z / w |
```

Varje komponent i vertexkoordinaten divideras med dess w-komponent, vilket ger mindre vertexkoordinater ju längre bort
från betraktaren en vertex ligger. Det är ytterligare ett skäl till att w-komponenten är viktig: den hjälper oss med
perspektivprojektion. De resulterande koordinaterna ligger sedan i det normaliserade enhetsrummet.

:::opengl
En perspektivisk projektionsmatris kan skapas i GLM så här:

```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), (float)width/(float)height, 0.1f, 100.0f);
```
:::
:::vulkan
En perspektivisk projektionsmatris kan skapas i GLM så här (med `GLM_FORCE_DEPTH_ZERO_TO_ONE` definierad):

```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), (float)width/(float)height, 0.1f, 100.0f);
proj[1][1] *= -1;
```
:::
:::d3d12
En perspektivisk projektionsmatris kan skapas med DirectXMath så här:

```cpp
XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), (float)width / (float)height, 0.1f, 100.0f);
```
:::

Även perspektivfunktionen skapar en stor *frustum* som definierar det synliga rummet; allt utanför frustumen hamnar
inte i klippvolymen och klipps därför. En perspektivisk frustum kan ses som en oregelbundet formad låda där varje
koordinat inuti lådan avbildas på en punkt i klipprummet:

```text
            bortre plan
   ┌───────────────────────────┐
    ╲                         ╱
     ╲                       ╱
      ╲     frustumen       ╱
       ╲                   ╱
        ┌─────────────────┐   nära plan
         ╲      fov      ╱
          ╲             ╱
           ╲           ╱
                 ●  kamera
```

Den första parametern anger *fov*-värdet, som står för *field of view* (synfält) och bestämmer hur stort vyrummet är.
För en realistisk bild sätts det oftast till 45 grader, men för mer doom-liknande resultat kan du sätta ett högre
värde. Den andra parametern anger bildförhållandet (aspect ratio), som räknas ut genom att dividera viewportens bredd
med dess höjd. Den tredje och fjärde parametern anger frustumens *nära* och *bortre* plan. Vi brukar sätta det nära
avståndet till `0.1` och det bortre till `100.0`. Alla vertexar mellan det nära och det bortre planet och inuti
frustumen renderas.

> När near-värdet i din perspektivmatris är för stort (som `10.0`) klipper {{api}} alla koordinater nära kameran
> (mellan `0.0` och `10.0`), vilket kan ge ett resultat du kanske har sett i datorspel, där man kan se igenom vissa
> föremål när man går obekvämt nära dem.

Utskriven, med *a* för bildförhållandet:

:::opengl
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  1/tan(fov/2)    0               0           |
| 0                  0               -(f+n)/(f-n)    -2·f·n/(f-n) |
| 0                  0               -1              0           |
```
:::
:::vulkan
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  -1/tan(fov/2)   0               0           |
| 0                  0               -f/(f-n)        -f·n/(f-n)  |
| 0                  0               -1              0           |
```

– minustecknet i andra raden är `proj[1][1] *= -1`, den tredje raden är `GLM_FORCE_DEPTH_ZERO_TO_ONE`.
:::
:::d3d12
```text
| 1/(a·tan(fov/2))   0               0               0           |
| 0                  1/tan(fov/2)    0               0           |
| 0                  0               -f/(f-n)        -f·n/(f-n)  |
| 0                  0               -1              0           |
```

(återigen skriven för en kolumnvektor; `XMMATRIX` innehåller transponatet).
:::

Den sista raden är tricket: den kopierar `-z` till w. I vyrummet tittar kameran längs den negativa z-axeln, så `-z`
är avståndet framför kameran – och att dividera med det gör att saker som är dubbelt så långt bort blir hälften så
stora.

Låt oss följa en punkt hela vägen, med de tal som kapitlet kommer att använda: fov 45°, a = 800 / 600, n = `0.1`,
f = `100`. Då är 1/tan(22.5°) ≈ `2.414` och 2.414 / a ≈ `1.811`. Ta lådans övre högra hörn (`0.5`, `0.5`, `0.0`) och
flytta det 3 enheter bort från kameran, till (`0.5`, `0.5`, `-3.0`) i vyrummet. Projektionen ger
x = 1.811 · 0.5 ≈ `0.905`, y = 2.414 · 0.5 ≈ `1.207` och w = `3`. Efter divisionen med w ligger hörnet på
x ≈ `0.302`, y ≈ `0.402` i NDC – en tredjedel av vad det skulle vara utan divisionen, och x och y är inte längre
utdragna efter fönstrets 4:3-form, eftersom x skalades med `1/a`. För djupet:

:::opengl
z = (-1.002 · -3 − 0.2002) / 3 ≈ `0.935` i NDC, som viewport-transformationen avbildar på (0.935 + 1) / 2 ≈ `0.968`
i depth buffern.
:::
:::vulkan
z = (-1.001 · -3 − 0.1001) / 3 ≈ `0.968` i NDC, som hamnar oförändrat i depth buffern (viewportens djupintervall är
`0..1`). OpenGL kommer fram till exakt samma värde i depth buffern på en annan väg: `0.935` i NDC, som sedan avbildas
från `-1..1` på `0..1`.
:::
:::d3d12
z = (-1.001 · -3 − 0.1001) / 3 ≈ `0.968` i NDC, som hamnar oförändrat i depth buffern (viewportens djupintervall är
`0..1`). OpenGL kommer fram till exakt samma värde i depth buffern på en annan väg: `0.935` i NDC, som sedan avbildas
från `-1..1` på `0..1`.
:::

Lägg märke till hur nära 1 det är, fast punkten bara ligger 3 av 100 enheter bort: djupet efter en
perspektivprojektion är inte linjärt – det mesta av precisionen går åt nära det nära planet. Avancerade kapitel
återkommer till det.

Med ortografisk projektion avbildas varje vertexkoordinat direkt på klipprummet utan någon finurlig
perspektivdivision (divisionen görs fortfarande, men w-komponenten ändras inte (den förblir `1`) och har därför ingen
effekt). Eftersom den ortografiska projektionen inte använder perspektiv ser föremål längre bort inte mindre ut,
vilket ger en konstig bild. Därför används ortografisk projektion främst för 2D-rendering och för vissa arkitekt-
eller ingenjörstillämpningar där vi helst inte vill att vertexarna förvrängs av perspektiv. Program för
3D-modellering som Blender använder ibland ortografisk projektion vid modellering, eftersom den återger varje objekts
mått mer exakt. Sida vid sida visar perspektivprojektionen de avlägsna vertexarna mindre, medan den ortografiska
ritar varje kub lika stor, oavsett hur långt bort den är.

```quiz
Två likadana kuber står framför en perspektivkamera, den ena 2 enheter bort och den andra 4 enheter bort. Varför ser den bortre hälften så stor ut?
- [x] Projektionen lägger avståndet i w, och när x och y divideras med w (perspektivdivisionen) halveras den bortre kubens koordinater
- [ ] Rastreringen hoppar över varannan pixel i föremål som är långt bort
- [ ] Det bortre planet drar avlägsna vertexar mot skärmens mitt
- [ ] Projektionsmatrisen multiplicerar avlägsna vertexar med en mindre skalfaktor i x och y
---
Skalningen av x och y i projektionsmatrisen är densamma för alla vertexar. Skillnaden kommer från w = -z: den bortre kubens w är dubbelt så stort, så efter divisionen är dess x och y hälften så stora.
```

## Allt tillsammans

Vi skapar en transformationsmatris för vart och ett av stegen ovan: model-, view- och projection-matrisen. En
vertexkoordinat transformeras sedan till klippkoordinater så här:

```text
V_clip = M_projection · M_view · M_model · V_local
```

Lägg märke till att ordningen i matrismultiplikationen är omvänd (kom ihåg att matrismultiplikation läses från höger
till vänster). Den resulterande vertexen ska sedan tilldelas vertex shaderns utdataposition, och {{api}} utför sedan
automatiskt perspektivdivision och klippning.

:::opengl
Den resulterande vertexen tilldelas `gl_Position` i vertex shadern.

**Och sedan?** Vertex shaderns utdata kräver att koordinaterna ligger i klipprummet, vilket är precis vad vi just
ordnade med transformationsmatriserna. OpenGL utför sedan *perspektivdivision* på klippkoordinaterna för att
transformera dem till normaliserade enhetskoordinater. Därefter använder OpenGL parametrarna från `glViewport` för att
avbilda de normaliserade enhetskoordinaterna på skärmkoordinater, där varje koordinat motsvarar en punkt på din skärm
(i vårt fall en skärm på 800x600). Denna process kallas *viewport-transformation*. NDC (`-1`, `-1`) blir fönstrets
nedre vänstra hörn.
:::
:::vulkan
Den resulterande vertexen tilldelas `gl_Position` i vertex shadern – samma inbyggda variabel som i OpenGL.

**Och sedan?** Vulkan utför *perspektivdivision* på klippkoordinaterna för att transformera dem till normaliserade
enhetskoordinater, och avbildar dem sedan på framebuffern med den `VkViewport` du sätter i `recordCommandBuffer()`
(x, y, bredd, höjd, och `minDepth = 0.0f` / `maxDepth = 1.0f` för djupet). Det är *viewport-transformationen*. NDC
(`-1`, `-1`) blir fönstrets **övre** vänstra hörn.
:::
:::d3d12
Den resulterande vertexen är vertex shaderns utdata `SV_POSITION`.

**Och sedan?** Direct3D utför *perspektivdivision* på klippkoordinaterna för att transformera dem till normaliserade
enhetskoordinater, och avbildar dem sedan på render targeten med den viewport du sätter med `RSSetViewports`
(`m_viewport`: x, y, bredd, höjd och djupet `0..1`). Det är *viewport-transformationen*. NDC (`-1`, `-1`) blir
fönstrets nedre vänstra hörn.
:::

Det här är ett svårt ämne att förstå, så om du fortfarande inte är riktigt säker på vad varje rum används till
behöver du inte oroa dig. Nedan ser du hur vi faktiskt kan använda dessa koordinatrum, och det kommer fler exempel i
de följande kapitlen.

### Var matriserna bor

Innan vi använder dem finns en praktisk fråga: hur kommer de tre matriserna fram till vertex shadern? De ändras inte
lika ofta. I det här kapitlet kommer du att rita tio kuber per bildruta. Varje kub har sin **egen model-matris**, så
model-matrisen ändras mellan två draw-anrop. **View- och projection-matrisen** är desamma för alla tio kuber: de
ändras högst en gång per bildruta (view när kameran rör sig, projection när fönstret ändrar storlek).

:::opengl
I OpenGL är alla tre **uniforms** i shaderprogrammet, satta med `ourShader.setMat4(…)`. En uniform behåller sitt
värde tills du sätter den igen, och varje draw-anrop använder de värden programmet har i det ögonblick anropet görs –
OpenGL ser till att de bevaras för det anropet. Du kan alltså helt enkelt sätta model-matrisen före varje draw-anrop
och sätta view och projection en gång per bildruta. Det är så learnopengl gör, och så gör du också.

```cpp
        ourShader.setMat4("model", model);
        ourShader.setMat4("view", view);
        ourShader.setMat4("projection", projection);
```

`setMat4` anropar `glUniformMatrix4fv` med `GL_FALSE` som *transpose*-parameter: GLM lagrar sina matriser kolumn för
kolumn, vilket är precis den ordning OpenGL förväntar sig.
:::
:::vulkan
I Vulkan väljer du själv mekanismen, och de två sorternas värden passar två olika:

- **Model-matrisen: en push constant.** Push constants känner du igen från *Transformations*: `vkCmdPushConstants`
  kopierar byten *in i command buffern*. Varje draw-anrop som spelas in efteråt ser de värden som pushades före det,
  så tio pushar och tio draw-anrop ger tio olika model-matriser. Projektet har redan intervallet och
  `struct PushConstants { glm::mat4 model; };`.
- **View och projection: en uniform buffer.** En uniform buffer är en vanlig `VkBuffer` som shadern läser via en
  descriptor. Command buffern hänvisar bara till den; GPU:n läser dess *innehåll* när den utför kommandona. Därför ser
  varje draw-anrop i en bildruta samma värden – precis rätt för view och projection, och precis fel för
  model-matrisen: om du skrev tio model-matriser i en och samma buffer medan du spelade in, skulle alla tio kuber få
  den sista.

vulkan-tutorial lägger alla tre matriserna i uniform buffern, eftersom den bara ritar ett objekt. Vi följer i stället
learnopengls uppdelning. (vulkan-tutorial påpekar själv att push constants är det effektivare sättet att skicka en
liten, ofta ändrad mängd data till shaderprogrammen.)

#### Descriptor layout och buffer

Datan till uniform buffern är en struct med samma layout som uniform-blocket i vertex shadern:

```cpp
// The same layout as the uniform block in the vertex shader: the matrices that stay the same for every draw of a frame.
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
};
```

GLM:s `glm::mat4` motsvarar GLSL:s `mat4` byte för byte (16 floats, kolumn för kolumn), och två matriser behöver
ingen utfyllnad. (Vulkan har regler för justering i uniform buffers – en `vec3` eller en nästlad struct kan behöva
`alignas(16)`; vulkan-tutorials kapitel om descriptor poolen förklarar dem. Matriser är alltid rätt justerade.)

Buffern som rymmer den: eftersom CPU:n skriver den varje bildruta ligger den i host-visible minne, som de staging
buffers du känner till – ingen kopiering till device-local minne. Projektet får en medlem för buffern, en för dess
minne och en pekare till det mappade minnet:

```cpp
    VkBuffer uniformBuffer;
    VkDeviceMemory uniformBufferMemory;
    void* uniformBufferMapped;
```

`createUniformBuffers()` skapar den med hjälpfunktionen `createBuffer()` från kapitlet *Textures* och mappar den:

```cpp
    void createUniformBuffers() {
        VkDeviceSize bufferSize = sizeof(UniformBufferObject);

        createBuffer(bufferSize, VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, uniformBuffer, uniformBufferMemory);

        // "persistent mapping": the memory stays mapped while the program runs, we write to it every frame
        vkMapMemory(device, uniformBufferMemory, 0, bufferSize, 0, &uniformBufferMapped);
    }
```

Buffern förblir mappad under hela programmet. Att mappa kostar en del, och vulkan-tutorial kallar tekniken
*persistent mapping*. I `cleanup()` förstörs buffern och dess minne frigörs – att frigöra minnet avmappar det:

```cpp
        vkDestroyBuffer(device, uniformBuffer, nullptr);
        vkFreeMemory(device, uniformBufferMemory, nullptr);
```

> vulkan-tutorial skapar en uniform buffer per frame in flight, eftersom CPU:n skriver nästa bildrutas värden medan
> GPU:n kanske fortfarande läser den förras. Kursens program har en enda frame in flight: `drawFrame()` väntar på
> fencen innan `updateUniformBuffer()` skriver buffern, så GPU:n läser den aldrig just då, och en buffer räcker.

Gör nu uppgiften **uniform-buffer**: structen, de tre medlemmarna, `createUniformBuffers()` och de två raderna i
cleanup. Bilden ändras inte – inget använder buffern än.

#### Descriptor pool och set

Shadern når buffern via en descriptor, precis som texturerna: projektets descriptor set har redan lådans sampler i
binding 0 och ansiktets i binding 1. Uniform buffern blir binding 2 i samma set. Först layouten, i
`createDescriptorSetLayout()`:

```cpp
        VkDescriptorSetLayoutBinding uboLayoutBinding{};
        uboLayoutBinding.binding = 2;
        uboLayoutBinding.descriptorCount = 1;
        uboLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        uboLayoutBinding.pImmutableSamplers = nullptr;
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;

        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {samplerLayoutBinding, faceSamplerLayoutBinding, uboLayoutBinding};
```

`stageFlags` anger vilka shadersteg som läser den: bara vertex shadern. Poolen måste ha plats för en descriptor av den
nya typen, så `createDescriptorPool()` får en andra pool size:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[0].descriptorCount = 2; // the set has two combined image samplers
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[1].descriptorCount = 1; // and one uniform buffer
```

Och `createDescriptorSets()` skriver descriptorn: en `VkDescriptorBufferInfo` anger vilken buffer och vilken del av
den, och en tredje `VkWriteDescriptorSet` lägger den i binding 2:

```cpp
        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);

        std::array<VkWriteDescriptorSet, 3> descriptorWrites{};
```

```cpp
        descriptorWrites[2].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[2].dstSet = descriptorSet;
        descriptorWrites[2].dstBinding = 2;
        descriptorWrites[2].dstArrayElement = 0;
        descriptorWrites[2].descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        descriptorWrites[2].descriptorCount = 1;
        descriptorWrites[2].pBufferInfo = &bufferInfo;
```

Bilder använder `pImageInfo`, buffrar `pBufferInfo`. `recordCommandBuffer()` binder redan setet med
`vkCmdBindDescriptorSets`, så inget annat ändras där.

Gör nu uppgiften **uniform-descriptor**. Bilden ändras fortfarande inte.
:::
:::d3d12
I Direct3D 12 väljer du själv mekanismen, och de två sorternas värden passar två olika:

- **Model-matrisen: root-konstanter.** Dem känner du igen från *Transformations*: root-parameter 1 rymmer 16
  32-bitarskonstanter (`ModelConstants`, register `b0`), och `SetGraphicsRoot32BitConstants` spelar in deras värden
  *i command listan*. Varje draw-anrop ser de värden som sattes före det, så tio anrop och tio draw-anrop ger tio
  olika model-matriser.
- **View och projection: en constant buffer.** En constant buffer är en vanlig buffer-resurs som shadern läser via en
  *constant buffer view* (CBV). Command listan hänvisar bara till den; GPU:n läser dess *innehåll* när den utför
  kommandona. Därför ser varje draw-anrop i en bildruta samma värden – precis rätt för view och projection, och
  precis fel för model-matrisen: om du skrev tio model-matriser i en och samma constant buffer medan du spelade in,
  skulle alla tio kuber få den sista.

Root signaturen är begränsad till 64 DWORD; en matris som root-konstanter kostar 16 av dem, en descriptor table bara
1. Root-konstanter är det snabbaste sättet att få fram några få värden till en shader, constant buffers sättet för
allt som är större.

#### Constant buffern

Det här är vad Microsofts exempel D3D12HelloConstBuffers gör (det flyttar en triangel med en förskjutning). Datan är
en struct med samma layout som `cbuffer` i shadern – plus utfyllnad:

```cpp
    // The constant buffer: what the vertex shader sees as cbuffer SceneConstantBuffer.
    // Its size must be a multiple of 256 bytes.
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        float padding[32]; // Padding so the constant buffer is 256-byte aligned.
    };
    static_assert((sizeof(SceneConstantBuffer) % 256) == 0, "Constant Buffer size must be 256-byte aligned");
```

En constant buffer view måste börja på en 256-bytegräns och täcka en multipel av 256 byte. Två matriser är
2 × 64 = 128 byte; 32 floats utfyllnad gör 256. `static_assert` stoppar bygget om någon lägger till en medlem och
bryter mot regeln.

Klassen får buffern och en pekare till dess mappade minne:

```cpp
    ComPtr<ID3D12Resource> m_constantBuffer;
    UINT8* m_pCbvDataBegin = nullptr;    // where the constant buffer is mapped (CPU address)
```

CBV:n är en descriptor, och descriptorer som shaderprogram använder bor i den shader-synliga CBV/SRV-heapen. Plats 0
och 1 rymmer texturernas SRV:er, så heapen växer till tre:

```cpp
        cbvSrvHeapDesc.NumDescriptors = 3;    // one SRV per texture + one CBV
```

I slutet av `LoadAssets()` skapas buffern i en **upload heap** – CPU:n skriver den varje bildruta, GPU:n läser den –
dess CBV läggs på heapens tredje plats (descriptor 2, en `m_cbvSrvDescriptorSize` längre fram än den andra texturens),
och den mappas för gott:

```cpp
    // Create the constant buffer.
    {
        const UINT constantBufferSize = sizeof(SceneConstantBuffer);    // CB size is required to be 256-byte aligned.

        // An upload heap: the CPU writes the buffer every frame, the GPU reads it.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
        CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(constantBufferSize);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &bufferDesc,
            D3D12_RESOURCE_STATE_GENERIC_READ,
            nullptr,
            IID_PPV_ARGS(&m_constantBuffer)));

        // Describe and create a constant buffer view (CBV) in the third slot of the
        // CBV/SRV heap (descriptor 2), after the two textures' SRVs.
        D3D12_CONSTANT_BUFFER_VIEW_DESC cbvDesc = {};
        cbvDesc.BufferLocation = m_constantBuffer->GetGPUVirtualAddress();
        cbvDesc.SizeInBytes = constantBufferSize;
        CD3DX12_CPU_DESCRIPTOR_HANDLE cbvHandle(m_cbvSrvHeap->GetCPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_device->CreateConstantBufferView(&cbvDesc, cbvHandle);

        // Map the constant buffer. We don't unmap this until the app closes.
        // Keeping things mapped for the lifetime of the resource is okay.
        CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
        ThrowIfFailed(m_constantBuffer->Map(0, &readRange, reinterpret_cast<void**>(&m_pCbvDataBegin)));
    }
```

Till skillnad från vertex buffern avmappas den aldrig: precis som i exemplet förblir pekaren `m_pCbvDataBegin` giltig
så länge resursen lever, och varje bildruta gör helt enkelt `memcpy` av nya värden dit.

> D3D12HelloConstBuffers väntar på GPU:n i slutet av varje bildruta, och det gör kursens `OnRender()` också. Därför
> räcker en constant buffer: när CPU:n skriver den för nästa bildruta har GPU:n läst färdigt. Program som har flera
> bildrutor i flykt behöver en buffer (eller en 256-bytesdel) per bildruta.

Gör nu uppgiften **constant-buffer**. Bilden ändras inte – inget läser buffern än.
:::

:::opengl
```quiz
I loopen med tio kuber anropar du `ourShader.setMat4("model", model)` före varje `glDrawArrays`. Varför får varje kub sin egen model-matris?
- [ ] `glDrawArrays` återställer uniforms till enhetsmatrisen efter ritningen
- [ ] Det gör den inte: alla kuber får den sista model-matrisen, och bara view och projection skiljer sig
- [ ] OpenGL ritar alla tio kuber vid `glfwSwapBuffers`, var och en med model-matrisen från sitt eget varv, lagrad i VAO:n
- [x] Varje draw-anrop använder de uniform-värden programmet har i det ögonblick anropet görs
---
En uniform är programtillstånd. Att sätta den mellan två draw-anrop ändrar den för nästa anrop; OpenGL ser till att det tidigare anropet ändå använder det tidigare värdet.
```
:::
:::vulkan
```quiz
Varför hamnar model-matrisen i en push constant medan view och projection hamnar i uniform buffern?
- [ ] Push constants syns bara för fragment shadern
- [ ] Uniform buffern får bara skrivas en gång, när programmet startar
- [ ] En uniform buffer kan inte rymma mer än två matriser
- [x] Push constants spelas in i command buffern med varje draw-anrop; uniform bufferns innehåll läses när GPU:n utför kommandona, så alla draw-anrop i en bildruta ser samma värden
---
Tio pushar och tio draw-anrop ger tio model-matriser. Tio skrivningar i en och samma uniform buffer under inspelningen skulle bara lämna den sista åt alla tio draw-anrop – bra för view och projection, som inte ändras under en bildruta.
```
:::
:::d3d12
```quiz
Varför hamnar model-matrisen i root-konstanter medan view och projection hamnar i constant buffern?
- [ ] Constant buffern får bara skrivas en gång, när programmet startar
- [x] Root-konstanter spelas in i command listan med varje draw-anrop; constant bufferns innehåll läses när GPU:n utför kommandona, så alla draw-anrop i en bildruta ser samma värden
- [ ] En constant buffer kan inte rymma mer än två matriser
- [ ] Root-konstanter syns bara för pixel shadern
---
Tio anrop till `SetGraphicsRoot32BitConstants` och tio draw-anrop ger tio model-matriser. Tio skrivningar i en och samma constant buffer under inspelningen skulle bara lämna den sista åt alla tio draw-anrop – bra för view och projection, som inte ändras under en bildruta.
```
:::

## Till 3D

Nu när vi vet hur vi transformerar 3D-koordinater till 2D-koordinater kan vi börja rendera riktiga 3D-objekt i
stället för det tråkiga 2D-plan vi har visat hittills.

För att börja rita i 3D skapar vi först en model-matris. Model-matrisen består av de förflyttningar, skalningar
och/eller rotationer vi vill tillämpa för att transformera alla objektets vertexar till det globala världsrummet.
Låt oss transformera vårt plan lite genom att rotera det runt x-axeln, så att det ser ut att ligga på golvet.
Model-matrisen ser då ut så här:

:::opengl
```cpp
glm::mat4 model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
```
:::
:::vulkan
```cpp
glm::mat4 model = glm::mat4(1.0f);
model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
```
:::
:::d3d12
```cpp
XMMATRIX model = XMMatrixRotationX(XMConvertToRadians(-55.0f));
```
:::

Genom att multiplicera vertexkoordinaterna med denna model-matris transformerar vi dem till världskoordinater. Vårt
plan, som ligger lite på golvet, representerar alltså planet i den globala världen.

Sedan behöver vi skapa en view-matris. Vi vill flytta oss en bit bakåt i scenen så att objektet blir synligt (i
världsrummet står vi i origo `(0,0,0)`). Tänk på följande för att röra dig i scenen:

- Att flytta kameran bakåt är detsamma som att flytta hela scenen framåt.

Det är precis vad en view-matris gör: vi flyttar hela scenen åt motsatt håll mot dit vi vill att kameran ska röra
sig. Eftersom vi vill flytta oss bakåt och OpenGL är ett högerhänt system måste vi röra oss längs den positiva
z-axeln. Det gör vi genom att förflytta scenen mot den negativa z-axeln. Det ger intrycket av att vi rör oss bakåt.

> **Högerhänt system**
>
> Enligt konvention är OpenGL ett högerhänt system. Det betyder i princip att den positiva x-axeln pekar åt höger,
> den positiva y-axeln uppåt och den positiva z-axeln bakåt. Tänk dig att skärmen är mittpunkten för de tre axlarna
> och att den positiva z-axeln går genom skärmen mot dig.
>
> För att förstå varför det kallas högerhänt gör du så här:
>
> - Sträck ut höger arm längs den positiva y-axeln med handen överst.
> - Låt tummen peka åt höger.
> - Låt pekfingret peka uppåt.
> - Böj nu långfingret 90 grader nedåt.
>
> Om du gjorde rätt pekar tummen mot den positiva x-axeln, pekfingret mot den positiva y-axeln och långfingret mot
> den positiva z-axeln. Om du gjorde detsamma med vänster arm skulle du se att z-axeln är omvänd. Det kallas ett
> vänsterhänt system och används ofta av DirectX. Observera att OpenGL i normaliserade enhetskoordinater faktiskt
> använder ett vänsterhänt system (projektionsmatrisen byter handenheten).

:::vulkan
Vulkan har i sig ingen åsikt om världs- och vyrummet – handenheten där väljs av ditt matematikbibliotek. GLM är
högerhänt som standard, så med GLM använder du exakt OpenGL:s konvention: +x åt höger, +y uppåt, kameran tittar längs
-z. Bara projektionen (med `proj[1][1] *= -1`) anpassar resultatet till Vulkans NDC.
:::
:::d3d12
Direct3D har i sig heller ingen åsikt om världs- och vyrummet – handenheten väljs av ditt matematikbibliotek.
DirectXMath har båda: `…LH`-funktionerna låter kameran titta längs **+z** (den klassiska DirectX-konventionen),
`…RH`-funktionerna längs **-z** som i OpenGL. Med `XMMatrixPerspectiveFovRH` använder du exakt OpenGL:s konvention:
+x åt höger, +y uppåt, +z mot dig – så alla learnopengls positioner och rotationer fungerar oförändrade.
:::

Vi går igenom hur man rör sig i scenen mer i detalj i nästa kapitel. Tills vidare ser view-matrisen ut så här:

:::opengl
```cpp
glm::mat4 view = glm::mat4(1.0f);
// note that we're translating the scene in the reverse direction of where we want to move
view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
```
:::
:::vulkan
```cpp
glm::mat4 view = glm::mat4(1.0f);
// note that we're translating the scene in the reverse direction of where we want to move
view = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
```
:::
:::d3d12
```cpp
XMMATRIX view = XMMatrixTranslation(0.0f, 0.0f, -3.0f);
```
:::

Det sista vi behöver definiera är projektionsmatrisen. Vi vill använda perspektivprojektion för vår scen, så vi
deklarerar projektionsmatrisen så här:

:::opengl
```cpp
glm::mat4 projection;
projection = glm::perspective(glm::radians(45.0f), 800.0f / 600.0f, 0.1f, 100.0f);
```

Nu när vi har skapat transformationsmatriserna ska vi skicka dem till shaderprogrammen. Först deklarerar vi
transformationsmatriserna som uniforms i vertex shadern och multiplicerar dem med vertexkoordinaterna:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoord;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    // note that we read the multiplication from right to left
    gl_Position = projection * view * model * vec4(aPos, 1.0);
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

Vi ska också skicka matriserna till shadern (det görs oftast varje bildruta, eftersom transformationsmatriser brukar
ändras mycket). I renderingsloopen, vid `// TODO:` efter `ourShader.use();`:

```cpp
        // create transformations
        glm::mat4 model         = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        glm::mat4 view          = glm::mat4(1.0f);
        glm::mat4 projection    = glm::mat4(1.0f);
        model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));
        view  = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
        projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // pass them to the shader
        ourShader.setMat4("model", model);
        ourShader.setMat4("view", view);
        // note: currently we set the projection matrix each frame, but since the projection matrix rarely changes it's often best practice to set it outside the main loop only once.
        ourShader.setMat4("projection", projection);
```

Gör nu uppgiften **plane**.
:::
:::vulkan
```cpp
glm::mat4 proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
proj[1][1] *= -1;
```

Bildförhållandet tas från swap chainens extent, som i vulkan-tutorial. Y-vändningen fungerar bara tillsammans med
Vulkans djupintervall, så lägg först till definitionen överst i `main.cpp`, innan GLM inkluderas:

```cpp
// Vulkan's depth range is 0..1 (OpenGL's is -1..1): make glm::perspective use it.
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
```

View och projection hamnar i uniform buffern. `updateUniformBuffer()` körs en gång per bildruta, efter väntan på
fencen, och kopierar dem till det mappade minnet:

```cpp
    void updateUniformBuffer() {
        UniformBufferObject ubo{};
        // note that we're translating the scene in the reverse direction of where we want to move
        ubo.view = glm::translate(glm::mat4(1.0f), glm::vec3(0.0f, 0.0f, -3.0f));
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan (this replaces the flip in the shader)
        ubo.proj[1][1] *= -1;

        memcpy(uniformBufferMapped, &ubo, sizeof(ubo));
    }
```

Model-matrisen pushas i `recordCommandBuffer()`, vid `// TODO:` före draw-anropet:

```cpp
        // the model matrix: tilt the plane back
        glm::mat4 model = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        model = glm::rotate(model, glm::radians(-55.0f), glm::vec3(1.0f, 0.0f, 0.0f));

        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

Vertex shadern deklarerar båda blocken – uniform buffern i binding 2, push constant-blocket som tidigare – och
multiplicerar:

```glsl
#version 450

layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(push_constant) uniform PushConstants {
    mat4 model;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    // note that we read the multiplication from right to left
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
    fragTexCoord = inTexCoord;
}
```

Observera att raden `gl_Position.y = -gl_Position.y;` är borta: projektionsmatrisen vänder y nu. Med båda
vändningarna skulle planet stå upp och ner – och eftersom det också vänder trianglarnas varvriktning på skärmen
skulle back-face culling ta bort det helt.

Gör nu uppgiften **plane**.
:::
:::d3d12
```cpp
XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);
```

View och projection hamnar i constant buffern, så shadern behöver ett sätt att nå den. CBV:n ligger i heapen, och
shaderprogram når descriptorer i heapen via en **descriptor table** i root signaturen. Lägg till ett andra
descriptor range – en CBV, med början i register `b1` – och root-parameter 2, en table med det intervallet för vertex
shadern:

```cpp
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);

        // A second range: 1 CBV at register b1, for the table of root parameter 2.
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
```

```cpp
        // Root parameter 2: a descriptor table with the constant buffer view (b1:
        // view and projection), for the vertex shader.
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_VERTEX);
```

(`b0` är redan upptaget av root-konstanterna, så constant buffern blir `b1`.) Värdena skrivs en gång per bildruta, i
`OnUpdate()` – Microsofts exempel uppdaterar sina constant buffers där, innan `OnRender()` spelar in bildrutan:

```cpp
    // The view matrix moves the whole scene 3 units away from the camera. The *RH
    // functions use a right-handed system like OpenGL: the camera looks down -z.
    XMMATRIX view = XMMatrixTranslation(0.0f, 0.0f, -3.0f);

    // The projection matrix adds perspective: a 45 degree field of view, the window's
    // aspect ratio, and the near and far planes at 0.1 and 100 units.
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    // Copy both into the constant buffer, transposed like the model matrix. The GPU
    // has finished the previous frame (OnRender waits for it), so it is not reading it.
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

De lagras transponerade av samma skäl som model-matrisen i *Transformations*: HLSL läser en `float4x4` ur en constant
buffer kolumn för kolumn. I `PopulateCommandList()` sätts root-parameter 2:s table till heapens tredje descriptor,
direkt efter texturernas table:

```cpp
    // Root parameter 2: the table with the constant buffer view, the heap's third
    // descriptor.
    CD3DX12_GPU_DESCRIPTOR_HANDLE cbvHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, cbvHandle);
```

Till sist deklarerar shadern constant buffern och multiplicerar:

```hlsl
// The constant buffer at register b1 (the CBV in root parameter 2's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};
```

```hlsl
    // The position is a row vector, multiplied by the matrices from left to right:
    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);
```

Med radvektorer läses ordningen från vänster till höger – samma transformationer som GLSL:s
`projection * view * model * position`, tillämpade i samma ordning.

Gör nu uppgiften **view-projection**. Model-matrisen är fortfarande enhetsmatrisen, så du ser effekten av view och
projection för sig: lådan är mindre – från (279, 179) till (520, 420), de tal vi räknade ut ovan – och den är
**kvadratisk**. Hittills var den utdragen efter fönstrets 4:3-form; bildförhållandet i projektionen tar bort det.

Byt sedan ut enhetsmatrisen i `PopulateCommandList()` mot rotationen:

```cpp
    // The model matrix: rotate the rectangle by -55 degrees about the x axis, so it
    // lies tilted back like a floor.
    XMMATRIX model = XMMatrixRotationX(XMConvertToRadians(-55.0f));
```

Gör nu uppgiften **plane**.
:::

Om du kör programmet ska resultatet se ut som ett golv som lutar bakåt: en trapets, smal vid den bortre (övre)
kanten och bred vid den nära (nedre), med lådan upprätt på den. Planet ligger på ett tänkt golv. Om du inte får samma
resultat, jämför din kod med kodutdragen ovan.

```quiz
Du vill ha kameran 3 enheter längre bak, på z = +3, tittande längs -z. Vad lägger du i view-matrisen?
- [ ] En rotation med 180° runt y-axeln
- [ ] En förflyttning med (0, 0, 3): kameran rör sig i +z
- [ ] Ingenting – projektionens nära plan på 0.1 flyttar kameran bakåt automatiskt
- [x] En förflyttning med (0, 0, -3): att flytta kameran bakåt är detsamma som att flytta hela scenen framåt
---
View-matrisen flyttar världen, inte kameran, så den använder det omvända av kamerans rörelse. Lägg scenen på z = -3 så ligger den 3 enheter framför en kamera i origo som tittar längs -z.
```

## Mer 3D

Hittills har vi arbetat med ett 2D-plan, om än i 3D-rummet, så låt oss ta den äventyrliga vägen och bygga ut vårt
2D-plan till en 3D-kub. För att rendera en kub behöver vi totalt 36 vertexar (6 sidor * 2 trianglar * 3 vertexar
vardera). 36 vertexar är mycket att skriva, så du kan hämta dem här:

:::opengl
```cpp
    float vertices[] = {
        // positions          // texture coords
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,

        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,

        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,

        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f
    };
```

Varje sida har sina egna fyra hörn med egna texturkoordinater, så en element buffer skulle spara lite: vi ritar kuben
med `glDrawArrays` och tar bort `indices` och `EBO` – dess `glGenBuffers`, bindningen och uppladdningen till
`GL_ELEMENT_ARRAY_BUFFER` och dess `glDeleteBuffers`. Attributpekarna förblir som de är (fortfarande 5 floats per
vertex). Draw-anropet blir:

```cpp
        // render box
        glBindVertexArray(VAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
```

Gör nu uppgiften **cube**. Du ser en låda – men en konstig sådan; mer om det strax.
:::
:::vulkan
```cpp
// learnopengl's cube: 6 faces of 2 triangles, 36 vertices (no index buffer).
// The texture coordinates have v flipped (1 - v) because learnopengl flips the images when loading them.
const std::vector<Vertex> vertices = {
    // back (z = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},
    {{0.5f, -0.5f, -0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 1.0f}},

    // front (z = +0.5)
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 0.0f}},
    {{-0.5f, 0.5f, 0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},

    // left (x = -0.5)
    {{-0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},

    // right (x = +0.5)
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},

    // bottom (y = -0.5)
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, -0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, -0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, -0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, -0.5f, -0.5f}, {0.0f, 0.0f}},

    // top (y = +0.5)
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}},
    {{0.5f, 0.5f, -0.5f}, {1.0f, 0.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{0.5f, 0.5f, 0.5f}, {1.0f, 1.0f}},
    {{-0.5f, 0.5f, 0.5f}, {0.0f, 1.0f}},
    {{-0.5f, 0.5f, -0.5f}, {0.0f, 0.0f}}
};
```

Det är learnopengls positioner och texturkoordinater, med v vänt som i de tidigare kapitlen. Varje sida har sina egna
fyra hörn med egna texturkoordinater, så en index buffer skulle spara lite: ta bort `indices`, medlemmarna
`indexBuffer`/`indexBufferMemory`, `createIndexBuffer()` och anropet till den, de två raderna i cleanup och
`vkCmdBindIndexBuffer`, och rita med `vkCmdDraw`:

```cpp
        vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
```

En sak till. Vår pipeline cullar baksidor (`VK_CULL_MODE_BACK_BIT`, med medurs trianglar som framsidor).
learnopengls kub gjordes inte för culling: OpenGL cullar inte om du inte slår på det, och kubens trianglar har inte
alla samma varvriktning. Med culling påslagen skulle vissa sidor försvinna. Slå därför av den:

```cpp
        rasterizer.cullMode = VK_CULL_MODE_NONE; // the cube's triangles are not all wound the same way
```

Gör nu uppgiften **cube**. Du ser en låda – men en konstig sådan; mer om det strax.
:::
:::d3d12
```cpp
        // A cube: 6 faces of 2 triangles, 36 vertices. The texture coordinates are
        // learnopengl.com's with v flipped (1 - v): Direct3D's v = 0 is the image's top.
        Vertex vertices[] =
        {
            // position                texture coords
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 1.0f } },

            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 0.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },

            { { -0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },

            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },

            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f, -0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f, -0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f, -0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f, -0.5f, -0.5f }, { 0.0f, 0.0f } },

            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } },
            { {  0.5f,  0.5f, -0.5f }, { 1.0f, 0.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { {  0.5f,  0.5f,  0.5f }, { 1.0f, 1.0f } },
            { { -0.5f,  0.5f,  0.5f }, { 0.0f, 1.0f } },
            { { -0.5f,  0.5f, -0.5f }, { 0.0f, 0.0f } }
        };
```

Det är learnopengls positioner och texturkoordinater, med v vänt som i de tidigare kapitlen. Varje sida har sina egna
fyra hörn med egna texturkoordinater, så en index buffer skulle spara lite: ta bort index bufferns block i
`LoadAssets()`, medlemmarna `m_indexBuffer` och `m_indexBufferView` och anropet `IASetIndexBuffer`, och rita utan
index – learnopengls `glDrawArrays(GL_TRIANGLES, 0, 36)`:

```cpp
    m_commandList->DrawInstanced(36, 1, 0, 0);
```

En sak till. Som standard cullar Direct3D baksidor – trianglar som går moturs på skärmen. learnopengls kub gjordes
inte för culling: OpenGL cullar inte om du inte slår på det, och kubens trianglar har inte alla samma varvriktning.
Med culling påslagen skulle vissa sidor försvinna. Slå därför av den i PSO:n:

```cpp
        psoDesc.RasterizerState = CD3DX12_RASTERIZER_DESC(D3D12_DEFAULT);
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // the cube's triangles are not all clockwise: draw both sides
```

Gör nu uppgiften **cube**. Du ser en låda – men en konstig sådan; mer om det strax.
:::

För skojs skull låter vi kuben rotera med tiden:

:::opengl
```cpp
        model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));
```

Detta ersätter rotationen med -55°: vinkeln är tiden i sekunder, i radianer, runt axeln (0.5, 1.0, 0.0).
`glm::rotate` normaliserar axeln åt dig.
:::
:::vulkan
```cpp
        // the model matrix: rotate the cube over time
        glm::mat4 model = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        model = glm::rotate(model, (float)glfwGetTime(), glm::vec3(0.5f, 1.0f, 0.0f));
```

Detta ersätter rotationen med -55°: vinkeln är GLFW:s tid i sekunder, i radianer, runt axeln (0.5, 1.0, 0.0).
`glm::rotate` normaliserar axeln åt dig. `recordCommandBuffer()` körs varje bildruta, så varje bildruta pushar en ny
matris.
:::
:::d3d12
```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // The model matrix: rotate the cube about the axis (0.5, 1, 0) by the time (in
    // radians). XMMatrixRotationAxis normalizes the axis.
    XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(0.5f, 1.0f, 0.0f, 0.0f), time);
```

Detta ersätter rotationen med -55° i `PopulateCommandList()`: vinkeln är tiden sedan första bildrutan, i radianer,
runt axeln (0.5, 1.0, 0.0). `XMMatrixRotationAxis` är `glm::rotate` med en axel, och den normaliserar också axeln.
:::

Gör nu uppgiften **spin**. Tja, det liknar en kub en aning, men något är fel. Vissa av kubens sidor ritas över andra
sidor. Det beror på att när {{api}} ritar din kub triangel för triangel, fragment för fragment, skriver den över
varje pixelfärg som kanske redan har ritats där. Trianglarna i ett draw-anrop når framebuffern i den ordning de står i
vertex buffern, och inget kontrollerar vilken av dem som är närmast – så vissa trianglar ritas ovanpå varandra fast
den ena tydligt borde ligga bakom den andra: den sida som kommer senare i `vertices` vinner, nära eller långt bort.

```quiz
Varför kan du utan djuptest se sidor på kubens baksida genom de främre?
- [ ] Baksidorna ritas med omvända texturkoordinater
- [ ] Texturens alfakanal gör de främre sidorna genomskinliga
- [x] Varje fragment skriver helt enkelt över pixeln; trianglar som ritas senare täcker tidigare, oavsett vilken som är närmast
- [ ] Projektionsmatrisen lägger kubens bortre sida framför den närmre
---
Utan djuptest är det bara ritordningen som avgör vilken färg som blir kvar i en pixel. Något måste komma ihåg hur långt bort pixelns nuvarande färg ligger: depth buffern.
```

Lyckligtvis finns det en buffer som lagrar djupinformation: *z-buffern*, som låter {{api}} avgöra när en pixel ska
ritas över och när den inte ska det. Med z-buffern kan vi ställa in {{api}} att göra djuptestning.

### Z-buffer

GPU:n lagrar all sin djupinformation i en z-buffer, även kallad *depth buffer*. Det är en bild lika stor som
färgbuffern som lagrar ett djupvärde per pixel. När djuptestning är påslagen testar GPU:n varje fragments djupvärde
mot innehållet i depth buffern: om det aktuella fragmentet ligger bakom det andra kastas det, annars skrivs det över
(och dess djupvärde skrivs in i depth buffern). Denna process kallas *djuptestning*.

Djupvärdet är fragmentets z efter viewport-transformationen, mellan `0` (nära planet) och `1` (bortre planet) – i alla
tre API:erna, som vi såg ovan. Två inställningar får testet att fungera:

- I början av varje bildruta rensas depth buffern till `1.0`, det bortre planet: det längsta bort något kan vara.
- Testet är "mindre än": ett fragment klarar testet om dess djup är *mindre* än värdet som redan finns lagrat.

Det första fragmentet som hamnar på en pixel klarar alltså alltid testet, och därefter bara närmare fragment. Utan
rensning skulle förra bildrutans djupvärden ligga kvar i buffern och dölja den här bildrutans fragment.

:::opengl
GLFW skapar automatiskt en sådan buffer åt dig (precis som den har en färgbuffer som lagrar utbildens färger). Djupet
lagras i varje fragment (som fragmentets `z`-värde), och när fragmentet vill skriva ut sin färg jämför OpenGL dess
djupvärde med z-buffern.

Men om vi vill vara säkra på att OpenGL faktiskt utför djuptestningen måste vi först tala om för OpenGL att vi vill
slå på djuptestning; den är avslagen som standard. Vi slår på djuptestning med `glEnable`. Funktionerna `glEnable` och
`glDisable` låter oss slå på/av viss funktionalitet i OpenGL. Funktionaliteten är sedan på/av tills ett nytt anrop
slår av/på den. Just nu vill vi slå på djuptestning genom att aktivera `GL_DEPTH_TEST`, en gång, efter att GLAD har
laddats:

```cpp
    // configure global opengl state
    // -----------------------------
    glEnable(GL_DEPTH_TEST);
```

Eftersom vi använder en depth buffer vill vi också rensa den före varje renderingsvarv (annars ligger förra
bildrutans djupinformation kvar i buffern). Precis som när vi rensar färgbuffern kan vi rensa depth buffern genom att
ange biten `GL_DEPTH_BUFFER_BIT` till `glClear`:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT); // also clear the depth buffer now!
```

OpenGL:s standardvärden är exakt de två inställningarna ovan: `glClearDepth` är `1.0` och `glDepthFunc` är `GL_LESS`.

Gör nu uppgiften **depth-test**. Varsågod! En fullt texturerad kub med korrekt djuptestning som roterar med tiden.
:::
:::vulkan
Swap chainen ger dig bara färgbilder. Depth buffern är ditt jobb: en bild, dess minne och en vy, ett attachment i
render passet och framebuffrarna, och djuptillstånd i pipelinen. Det här är vulkan-tutorials kapitel *Depth
buffering*.

#### Djupbild och vy

```cpp
    VkImage depthImage;
    VkDeviceMemory depthImageMemory;
    VkImageView depthImageView;
```

En djupbild räcker – bara en bildruta ritas åt gången. Den har swap chainens storlek. Dess format måste innehålla en
djupkomponent; vulkan-tutorial påpekar att vi inte behöver något särskilt format, eftersom vi aldrig läser texlarna
från programmet – den behöver bara rimlig noggrannhet, och minst 24 bitar är vanligt. Alla format stöds inte på alla
GPU:er, så vi frågar efter det första i en lista med kandidater som enheten stöder som djup-attachment:

```cpp
    VkFormat findSupportedFormat(const std::vector<VkFormat>& candidates, VkImageTiling tiling, VkFormatFeatureFlags features) {
        for (VkFormat format : candidates) {
            VkFormatProperties props;
            vkGetPhysicalDeviceFormatProperties(physicalDevice, format, &props);

            if (tiling == VK_IMAGE_TILING_LINEAR && (props.linearTilingFeatures & features) == features) {
                return format;
            } else if (tiling == VK_IMAGE_TILING_OPTIMAL && (props.optimalTilingFeatures & features) == features) {
                return format;
            }
        }

        throw std::runtime_error("failed to find supported format!");
    }

    VkFormat findDepthFormat() {
        return findSupportedFormat(
            {VK_FORMAT_D32_SFLOAT, VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT},
            VK_IMAGE_TILING_OPTIMAL,
            VK_FORMAT_FEATURE_DEPTH_STENCIL_ATTACHMENT_BIT
        );
    }
```

`VK_FORMAT_D32_SFLOAT` är en 32-bitars float per pixel; de två andra har även en stencilkomponent, som vi inte
använder än. Sedan skapar `createDepthResources()` bilden med hjälpfunktionen `createImage()` från kapitlet
*Textures*, som djup-attachment i device-local minne, och dess vy:

```cpp
    void createDepthResources() {
        VkFormat depthFormat = findDepthFormat();

        createImage(swapChainExtent.width, swapChainExtent.height, depthFormat, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, depthImage, depthImageMemory);
        depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT);
    }
```

`createImageView()` hade tidigare `VK_IMAGE_ASPECT_COLOR_BIT` hårdkodat. Vyn för en djupbild måste ange djupaspekten,
så funktionen får en tredje parameter:

```cpp
    VkImageView createImageView(VkImage image, VkFormat format, VkImageAspectFlags aspectFlags) {
```

```cpp
        viewInfo.subresourceRange.aspectMask = aspectFlags;
```

och de befintliga anropen skickar `VK_IMAGE_ASPECT_COLOR_BIT` – swap chainens vyer i `createImageViews()` och de två
texturvyerna:

```cpp
            swapChainImageViews[i] = createImageView(swapChainImages[i], swapChainImageFormat, VK_IMAGE_ASPECT_COLOR_BIT);
```

```cpp
        textureImageView = createImageView(textureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
        faceTextureImageView = createImageView(faceTextureImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
```

I `cleanup()` förstör du vyn och bilden och frigör minnet:

```cpp
        vkDestroyImageView(device, depthImageView, nullptr);
        vkDestroyImage(device, depthImage, nullptr);
        vkFreeMemory(device, depthImageMemory, nullptr);
```

Bilden börjar i `VK_IMAGE_LAYOUT_UNDEFINED`. vulkan-tutorial visar hur man gör övergången explicit med en barrier, och
påpekar sedan att det inte behövs: render passet sköter det, som du ser härnäst. Det är också därför
`createDepthResources()` kan köras före `createFramebuffers()` – i den här kursen innan command poolen ens finns.

Gör nu uppgiften **depth-image**. Bilden ändras inte än: djupbilden finns, men inget använder den.

#### Render pass, framebuffer och pipeline

I `createRenderPass()` blir djupbilden render passets andra attachment:

```cpp
        VkAttachmentDescription depthAttachment{};
        depthAttachment.format = findDepthFormat();
        depthAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
        depthAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
        depthAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
        depthAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
        depthAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        depthAttachment.finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

`loadOp = CLEAR` är Vulkans motsvarighet till `GL_DEPTH_BUFFER_BIT`: render passet rensar den i början. `storeOp =
DONT_CARE`, eftersom ingen behöver djupvärdena efter att bildrutan har ritats. Den initiala layouten `UNDEFINED` säger
att vi inte bryr oss om det tidigare innehållet (det rensas ändå); den slutliga layouten är den som subpasset använder.
Subpasset refererar till den som attachment 1:

```cpp
        VkAttachmentReference depthAttachmentRef{};
        depthAttachmentRef.attachment = 1;
        depthAttachmentRef.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
```

```cpp
        subpass.pColorAttachments = &colorAttachmentRef;
        subpass.pDepthStencilAttachment = &depthAttachmentRef;
```

Ett subpass kan bara använda ett djup-(+stencil-)attachment, så till skillnad från färg-attachments är det en enda
pekare, inte en array. Subpass-beroendet får djupstegen och djupåtkomsterna, och render passet båda attachments:

```cpp
        dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_LATE_FRAGMENT_TESTS_BIT;
        dependency.srcAccessMask = VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;
        dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT | VK_PIPELINE_STAGE_EARLY_FRAGMENT_TESTS_BIT;
        dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT | VK_ACCESS_DEPTH_STENCIL_ATTACHMENT_WRITE_BIT;

        std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, depthAttachment};
        VkRenderPassCreateInfo renderPassInfo{};
        renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
        renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
        renderPassInfo.pAttachments = attachments.data();
```

Djupbilden används först i steget *early fragment tests*, där load-operationen rensar den – en skrivning. Och
eftersom varje bildruta använder samma djupbild måste rensningen vänta tills förra bildrutans djupskrivningar (i
steget *late fragment tests*) är klara. Det är vad de extra steg- och åtkomstbitarna säger.

Varje framebuffer får djupbildens vy som sitt andra attachment – samma vy för varje bild i swap chainen:

```cpp
            std::array<VkImageView, 2> attachments = {
                swapChainImageViews[i],
                depthImageView
            };
```

```cpp
            framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
            framebufferInfo.pAttachments = attachments.data();
```

Pipelinen får sitt djuptillstånd i `createGraphicsPipeline()`:

```cpp
        VkPipelineDepthStencilStateCreateInfo depthStencil{};
        depthStencil.sType = VK_STRUCTURE_TYPE_PIPELINE_DEPTH_STENCIL_STATE_CREATE_INFO;
        depthStencil.depthTestEnable = VK_TRUE;
        depthStencil.depthWriteEnable = VK_TRUE;
        depthStencil.depthCompareOp = VK_COMPARE_OP_LESS;
        depthStencil.depthBoundsTestEnable = VK_FALSE;
        depthStencil.stencilTestEnable = VK_FALSE;
```

```cpp
        pipelineInfo.pDepthStencilState = &depthStencil;
```

`depthTestEnable` jämför varje fragments djup med buffern, `depthWriteEnable` skriver djupet för de fragment som
klarar testet (genomskinliga objekt testar senare utan att skriva). `VK_COMPARE_OP_LESS` behåller närmare fragment.
Depth bounds-testet och stenciltestet förblir avslagna.

Sist rensningsvärdena. Nu finns det ett per attachment, i attachment-ordning – färgen, och djupet `1.0`:

```cpp
        // one clear value per attachment: the colour, and the depth 1.0 (the far plane)
        std::array<VkClearValue, 2> clearValues{};
        clearValues[0].color = {{0.2f, 0.3f, 0.3f, 1.0f}};
        clearValues[1].depthStencil = {1.0f, 0};

        renderPassInfo.clearValueCount = static_cast<uint32_t>(clearValues.size());
        renderPassInfo.pClearValues = clearValues.data();
```

Gör nu uppgiften **depth-test**. Varsågod! En fullt texturerad kub med korrekt djuptestning som roterar med tiden.
:::
:::d3d12
Swap chainen ger dig bara färgbuffrar. Depth buffern är ditt jobb: en descriptor heap för dess vy, en textur, vyn,
djuptillstånd i PSO:n och två ändringar i `PopulateCommandList()`.

#### Depth buffern

Render target views bor i en RTV-heap; depth stencil views bor i en egen heaptyp, en **DSV-heap**. En descriptor,
inte shader-synlig (shaderprogram läser den aldrig), skapad i `LoadPipeline()` bredvid RTV-heapen:

```cpp
        // Describe and create a depth stencil view (DSV) descriptor heap.
        D3D12_DESCRIPTOR_HEAP_DESC dsvHeapDesc = {};
        dsvHeapDesc.NumDescriptors = 1;
        dsvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_DSV;
        dsvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
        ThrowIfFailed(m_device->CreateDescriptorHeap(&dsvHeapDesc, IID_PPV_ARGS(&m_dsvHeap)));
```

Klassen får medlemmarna `ComPtr<ID3D12DescriptorHeap> m_dsvHeap;` och `ComPtr<ID3D12Resource> m_depthStencil;`. I
slutet av `LoadAssets()` skapas djuptexturen – ett 32-bitars float-djup per pixel (`DXGI_FORMAT_D32_FLOAT`), lika stor
som fönstret, i en default heap, med flaggan som tillåter att den används som depth stencil:

```cpp
    // Create the depth buffer and its depth stencil view.
    {
        D3D12_DEPTH_STENCIL_VIEW_DESC depthStencilDesc = {};
        depthStencilDesc.Format = DXGI_FORMAT_D32_FLOAT;
        depthStencilDesc.ViewDimension = D3D12_DSV_DIMENSION_TEXTURE2D;
        depthStencilDesc.Flags = D3D12_DSV_FLAG_NONE;

        // The value the depth buffer is usually cleared to: 1.0, the far plane.
        D3D12_CLEAR_VALUE depthOptimizedClearValue = {};
        depthOptimizedClearValue.Format = DXGI_FORMAT_D32_FLOAT;
        depthOptimizedClearValue.DepthStencil.Depth = 1.0f;
        depthOptimizedClearValue.DepthStencil.Stencil = 0;

        // A texture as big as the window, one 32-bit float depth per pixel (1 array
        // slice, 1 mip level), in a default heap and in the DEPTH_WRITE state.
        CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
        CD3DX12_RESOURCE_DESC depthDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D32_FLOAT, m_width, m_height, 1, 1, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL);
        ThrowIfFailed(m_device->CreateCommittedResource(
            &heapProperties,
            D3D12_HEAP_FLAG_NONE,
            &depthDesc,
            D3D12_RESOURCE_STATE_DEPTH_WRITE,
            &depthOptimizedClearValue,
            IID_PPV_ARGS(&m_depthStencil)));

        m_device->CreateDepthStencilView(m_depthStencil.Get(), &depthStencilDesc, m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    }
```

Resursen börjar i `D3D12_RESOURCE_STATE_DEPTH_WRITE` och stannar där: den används bara som depth buffer, så inga
barriers behövs. Det *optimerade rensningsvärdet* talar om för drivrutinen vilket värde vi kommer att rensa till; att
rensa till exakt det värdet kan gå snabbare på många GPU:er (ett annat värde fungerar också, men kan ge en varning
från debug-lagret).

#### Pipeline-tillståndet

Hittills har PSO:n slagit av djuptestning (`DepthEnable = FALSE`, från D3D12HelloTriangle). Ersätt de två raderna med
standardtillståndet för djup och stencil och tala om för PSO:n vilket format DSV:n har:

```cpp
        // The default depth stencil state: depth test on (a pixel is kept only if it is
        // nearer than the one already there, D3D12_COMPARISON_FUNC_LESS), depth writes on.
        psoDesc.DepthStencilState = CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT);
```

```cpp
        psoDesc.DSVFormat = DXGI_FORMAT_D32_FLOAT;
```

`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` betyder: djuptest på, djupskrivning på (`D3D12_DEPTH_WRITE_MASK_ALL`),
jämförelse `D3D12_COMPARISON_FUNC_LESS`, stencil av.

#### Att använda den

I `PopulateCommandList()` binds depth buffern tillsammans med render targeten och rensas varje bildruta, direkt efter
färgen:

```cpp
    CD3DX12_CPU_DESCRIPTOR_HANDLE dsvHandle(m_dsvHeap->GetCPUDescriptorHandleForHeapStart());
    m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle);
```

```cpp
    m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH, 1.0f, 0, 0, nullptr);
```

`D3D12_CLEAR_FLAG_DEPTH` rensar bara djupet (det finns ingen stencil i ett D32-format), till `1.0`; de två sista
argumenten (0 rektanglar, `nullptr`) rensar hela texturen. En depth buffer räcker till båda backbuffrarna, eftersom
`OnRender()` väntar tills varje bildruta är klar.

Gör nu uppgiften **depth-test**. Varsågod! En fullt texturerad kub med korrekt djuptestning som roterar med tiden.
:::

```quiz
Depth buffern rensas till 1.0 varje bildruta, och djuptestet är "mindre än". Vad uppnår det?
- [ ] Ingenting ändras så länge du inte också rensar färgbuffern
- [ ] Bara fragment som ligger exakt på det bortre planet ritas
- [x] Det första fragmentet på en pixel klarar alltid testet, och därefter ersätter bara fragment som är närmare än det lagrade djupet det
- [ ] Fragment ritas bakifrån och fram, så bortre sidor täcker närmare
---
1.0 är det bortre planet, så varje synligt fragment ligger närmare än det rensade värdet. Varje fragment som klarar testet skriver sitt djup, och senare fragment måste slå det. Utan rensning skulle förra bildrutans djup blockera den här bildrutans fragment.
```

### Fler kuber!

Säg att vi vill visa 10 av våra kuber på skärmen. Varje kub ser likadan ut men skiljer sig i var i världen den står,
och var och en har en annan rotation. Kubens grafiska uppbyggnad är redan definierad, så vi behöver inte ändra våra
buffrar eller attributarrayer när vi renderar fler objekt. Det enda vi behöver ändra för varje objekt är dess
model-matris, som transformerar kuberna ut i världen.

Först definierar vi en förflyttningsvektor för varje kub som anger dess position i världsrummet. Vi definierar 10
kubpositioner i en array:

:::opengl
```cpp
    // world space positions of our cubes
    glm::vec3 cubePositions[] = {
        glm::vec3( 0.0f,  0.0f,  0.0f),
        glm::vec3( 2.0f,  5.0f, -15.0f),
        glm::vec3(-1.5f, -2.2f, -2.5f),
        glm::vec3(-3.8f, -2.0f, -12.3f),
        glm::vec3( 2.4f, -0.4f, -3.5f),
        glm::vec3(-1.7f,  3.0f, -7.5f),
        glm::vec3( 1.3f, -2.0f, -2.5f),
        glm::vec3( 1.5f,  2.0f, -2.5f),
        glm::vec3( 1.5f,  0.2f, -1.5f),
        glm::vec3(-1.3f,  1.0f, -1.5f)
    };
```

Lägg den direkt efter `vertices[]`. I renderingsloopen vill vi nu anropa `glDrawArrays` 10 gånger, men den här gången
skicka en annan model-matris till vertex shadern varje gång innan vi gör draw-anropet. Vi skapar en liten loop i
renderingsloopen som renderar vårt objekt 10 gånger med en ny model-matris varje gång. Observera att vi också ger
varje låda en liten egen rotation. View och projection sätts en gång, före loopen, och de gamla `model`-raderna
utanför loopen tas bort:

```cpp
        // create transformations
        glm::mat4 view          = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        glm::mat4 projection    = glm::mat4(1.0f);
        view       = glm::translate(view, glm::vec3(0.0f, 0.0f, -3.0f));
        projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // pass transformation matrices to the shader
        ourShader.setMat4("view", view);
        // note: currently we set the projection matrix each frame, but since the projection matrix rarely changes it's often best practice to set it outside the main loop only once.
        ourShader.setMat4("projection", projection);

        // render boxes
        glBindVertexArray(VAO);
        for (unsigned int i = 0; i < 10; i++)
        {
            // calculate the model matrix for each object and pass it to shader before drawing
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            ourShader.setMat4("model", model);

            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
```cpp
// world space positions of our cubes
const std::vector<glm::vec3> cubePositions = {
    glm::vec3( 0.0f,  0.0f,  0.0f),
    glm::vec3( 2.0f,  5.0f, -15.0f),
    glm::vec3(-1.5f, -2.2f, -2.5f),
    glm::vec3(-3.8f, -2.0f, -12.3f),
    glm::vec3( 2.4f, -0.4f, -3.5f),
    glm::vec3(-1.7f,  3.0f, -7.5f),
    glm::vec3( 1.3f, -2.0f, -2.5f),
    glm::vec3( 1.5f,  2.0f, -2.5f),
    glm::vec3( 1.5f,  0.2f, -1.5f),
    glm::vec3(-1.3f,  1.0f, -1.5f)
};
```

Lägg den bredvid `vertices`, före `struct PushConstants`. I `recordCommandBuffer()` vill vi nu anropa `vkCmdDraw` 10
gånger, men den här gången pusha en ny model-matris varje gång innan vi spelar in draw-anropet. Vi skapar en liten
loop som renderar vårt objekt 10 gånger med en ny model-matris varje gång. Observera att vi också ger varje låda en
liten egen rotation. Loopen ersätter den enda pushen och det enda draw-anropet:

```cpp
        for (unsigned int i = 0; i < 10; i++) {
            // calculate the model matrix for each object and push it before drawing
            glm::mat4 model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));

            PushConstants constants{};
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```

Vertex buffern, pipelinen och descriptor setet binds en gång; bara push constants ändras mellan draw-anropen. View och
projection stannar i uniform buffern, som skrivs en gång per bildruta.
:::
:::d3d12
```cpp
    // World space positions of our cubes.
    XMFLOAT3 cubePositions[] =
    {
        XMFLOAT3( 0.0f,  0.0f,  0.0f),
        XMFLOAT3( 2.0f,  5.0f, -15.0f),
        XMFLOAT3(-1.5f, -2.2f, -2.5f),
        XMFLOAT3(-3.8f, -2.0f, -12.3f),
        XMFLOAT3( 2.4f, -0.4f, -3.5f),
        XMFLOAT3(-1.7f,  3.0f, -7.5f),
        XMFLOAT3( 1.3f, -2.0f, -2.5f),
        XMFLOAT3( 1.5f,  2.0f, -2.5f),
        XMFLOAT3( 1.5f,  0.2f, -1.5f),
        XMFLOAT3(-1.3f,  1.0f, -1.5f)
    };
```

Lägg den i `PopulateCommandList()`, där tidsraderna och den enda model-matrisen stod (inget använder tiden längre, så
de raderna tas bort). Nu vill vi anropa `DrawInstanced` 10 gånger, men den här gången sätta en ny model-matris varje
gång innan vi spelar in draw-anropet. Vi skapar en liten loop som renderar vårt objekt 10 gånger med en ny
model-matris varje gång. Observera att vi också ger varje låda en liten egen rotation:

```cpp
    // Draw the cube 10 times, each with its own model matrix: rotate by 20 degrees
    // per cube about the axis (1, 0.3, 0.5), then move it to its position.
    for (UINT i = 0; i < 10; i++)
    {
        float angle = 20.0f * i;
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(1.0f, 0.3f, 0.5f, 0.0f), XMConvertToRadians(angle))
            * XMMatrixTranslation(cubePositions[i].x, cubePositions[i].y, cubePositions[i].z);

        // Root parameter 1: this cube's model matrix. Root constants are recorded with
        // each draw, so every cube keeps its own.
        ModelConstants modelConstants = {};
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(ModelConstants) / 4, &modelConstants, 0);

        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```

Lägg märke till ordningen i produkten: med DirectXMaths radvektorer roterar `rotation * translation` först och
flyttar sedan – samma sak som learnopengls `glm::translate` följt av `glm::rotate`, som GLM tillämpar på vertexen i
omvänd ordning. View och projection stannar i constant buffern, som skrivs en gång per bildruta i `OnUpdate()`.
:::

Läs model-matrisen från höger till vänster: varje kub roteras först runt sin egen mittpunkt – 20° mer än kuben före,
runt axeln (1.0, 0.3, 0.5) – och flyttas sedan till sin position i världen. Den första kuben, i origo med vinkeln 0,
står rakt framför dig.

Gör nu uppgiften **ten-cubes**. Den här koden uppdaterar model-matrisen varje gång en ny kub ritas, totalt 10 gånger.
Nu bör vi titta in i en värld fylld av 10 konstigt roterade kuber, några nära, några långt bort och mindre.

Perfekt! Det ser ut som att vår låda har hittat några likasinnade vänner. Om du kör fast, jämför din kod med
kodutdragen ovan.

## Övningar

- Experimentera med FoV- och aspect ratio-parametrarna i projektionsfunktionen. Se om du kan lista ut hur de påverkar
  den perspektiviska frustumen.
- Lek med view-matrisen genom att förflytta i olika riktningar och se hur scenen ändras. Tänk på view-matrisen som ett
  kameraobjekt.
- Försök få var tredje låda (inklusive den första) att rotera med tiden, medan de andra lådorna står still, med hjälp
  av bara model-matrisen.

De två första är experiment för dig – prova dem efter den sista uppgiften och ångra dem efteråt (ett bredare FoV gör
allt mindre och visar mer av världen; ett bildförhållande som inte stämmer med fönstret drar ut bilden igen). Den
tredje är kapitlets sista uppgift.

:::opengl
Inuti loopen, direkt efter att vinkeln räknats ut, använder var tredje kub i stället tiden:

```cpp
            float angle = 20.0f * i;
            if (i % 3 == 0) // every 3rd iteration (including the first) we set the angle using GLFW's time function.
                angle = (float)glfwGetTime() * 25.0f;
```
:::
:::vulkan
Inuti loopen, direkt efter att vinkeln räknats ut, använder var tredje kub i stället tiden:

```cpp
            float angle = 20.0f * i;
            if (i % 3 == 0) { // every 3rd iteration (including the first) we set the angle using GLFW's time function
                angle = (float)glfwGetTime() * 25.0f;
            }
```
:::
:::d3d12
Tidsraderna kommer tillbaka, före kubpositionerna:

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
```

och inuti loopen, direkt efter att vinkeln räknats ut, använder var tredje kub i stället tiden:

```cpp
        float angle = 20.0f * i;
        if (i % 3 == 0)    // every 3rd cube (including the first) rotates with the time
            angle = time * 25.0f;
```
:::

`i % 3 == 0` är sant för kub 0, 3, 6 och 9. Deras vinkel växer med 25 grader per sekund; de andra behåller sin fasta
`20.0f * i`.

Gör nu uppgiften **rotate-every-third**. Fyra av de tio lådorna vrider sig långsamt, de andra sex står still.

Nu har du gått hela vägen från en vertex i lokalt rum till en pixel på skärmen. I nästa kapitel gör vi view-matrisen
till en riktig kamera som du kan röra dig med genom den här lilla världen.
