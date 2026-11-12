# Assimp

I alla scener hittills har vi lekt flitigt med vår lilla vän lådan, men med tiden kan även de bästa vänner bli lite
tråkiga. I större grafikprogram finns det oftast massor av komplicerade och intressanta modeller som är mycket vackrare
att titta på än en orörlig låda. Till skillnad från lådan kan vi dock inte gärna definiera alla vertexar, normaler och
texturkoordinater för komplicerade former som hus, fordon eller människoliknande figurer för hand. Det vi vill i stället
är att *importera* modellerna till programmet: modeller som 3D-grafiker omsorgsfullt har skapat i verktyg som Blender,
3DS Max eller Maya.

Med de här så kallade *3D-modelleringsverktygen* kan grafiker skapa komplicerade former och lägga texturer på dem genom
en process som kallas *uv-mappning*. Verktygen tar sedan automatiskt fram alla vertexkoordinater, vertexnormaler och
texturkoordinater när de exporterar dem till ett modellfilformat vi kan använda. På så sätt har grafikerna en
omfattande verktygslåda för att skapa modeller av hög kvalitet utan att behöva bry sig särskilt mycket om de tekniska
detaljerna. Allt det tekniska är gömt i den exporterade modellfilen. Vi som grafikprogrammerare *måste* däremot bry oss
om de tekniska detaljerna.

Det är vårt jobb att tolka de exporterade modellfilerna och plocka ut all relevant information, så att vi kan lagra den
i ett format som {{api}} förstår. Ett vanligt problem är att det finns dussintals olika filformat, som vart och ett
exporterar modelldatan på sitt eget sätt. Modellformat som Wavefronts `.obj` innehåller bara modelldata med lite
materialinformation, som modellfärger och diffuse/specular maps, medan modellformat som det XML-baserade Collada är
extremt omfattande och innehåller modeller, ljus, många slags material, animationsdata, kameror, fullständig
sceninformation och mycket mer. Wavefronts objektformat anses allmänt vara ett lätttolkat modellformat, och det är värt
att titta in i en sådan fil en gång för att se hur datan är uppbyggd – det gör vi med den här delens modell nedan. Det
bör ge dig en grundläggande bild av hur modellfilformat i allmänhet är uppbyggda.

Sammantaget finns det många olika filformat, och någon gemensam struktur mellan dem finns oftast inte. Om vi vill
importera en modell från de här filformaten skulle vi alltså behöva skriva en egen importerare för varje filformat vi
vill kunna läsa. Som tur är finns det ett bibliotek för just detta.

## Den här delens modell

learnopengl.com använder en ryggsäck som modell i den här delen; kursen har en egen modell: en liten planet med en ring,
`models/planet.obj`. Det är en Wavefront-`.obj`-fil, en vanlig textfil som du kan öppna i din IDE (**Kopiera
startfilerna** lägger den i din projektmapp). Dess första rader anger materialbiblioteket, `planet.mtl`, och börjar det
första objektet:

```text
# A small planet with a ring - drawn for Codestead GP (see make_planet.py).
mtllib planet.mtl
o planet
```

Sedan kommer listor med tal. `v` är en vertexposition, `vt` en texturkoordinat och `vn` en normal, en per rad:

```text
v 0.07466 0.98079 -0.18024
...
vt 0.18750 0.93750
...
vn 0.07466 0.98079 -0.18024
```

`usemtl planet` säger att ytorna efter raden använder materialet `planet` i `planet.mtl`, och själva ytorna är
`f`-rader. Varje hörn av en yta är en trippel *position/texturkoordinat/normal* – tre index, räknade från 1, in i de
tre listorna:

```text
usemtl planet
...
f 101/101/101 102/102/102 69/69/69
```

Det andra objektet, `o rings`, är en platt ring runt planeten. Alla dess ytor pekar åt samma håll, så alla deras hörn
delar en enda normal – det tredje indexet förblir 562 medan positionerna byts:

```text
o rings
...
usemtl rings
...
f 562/562/562 563/563/562 565/565/562
```

Planeten är en sfär med radien 1 (960 trianglar), ringen sträcker sig från 1,4 till 2,0 (96 trianglar), och
`planet.mtl` beskriver de två materialen, vart och ett med en diffuse map (`map_Kd`) och en specular map (`map_Ks`) –
precis förra delens ljuskartor:

```text
newmtl planet
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.5 0.5 0.5
Ns 32.0
map_Kd planet_diffuse.png
map_Ks planet_specular.png

newmtl rings
Ka 0.0 0.0 0.0
Kd 1.0 1.0 1.0
Ks 0.1 0.1 0.1
Ns 8.0
map_Kd rings.png
map_Ks rings_specular.png
```

Lägg märke till att ett hörn av en yta har *tre* index, ett per lista, medan en vertex på GPU:n – i {{api}} som
överallt – har *ett* index som väljer alla dess attribut på en gång. Ringen visar varför filen gör så: 98 positioner,
men bara en normal. En modellinläsare måste därför bygga sina egna vertexar: en för varje olik kombination av
position, texturkoordinat och normal.

```quiz
Ett hörn av en yta i `.obj`-filen skrivs `563/563/562`. Varför kan GPU:n inte använda talen direkt som sin index buffer?
- [x] Det är tre separata index – in i positionerna, texturkoordinaterna och normalerna – medan en index buffer har ett index per vertex som väljer alla dess attribut tillsammans
- [ ] För att GPU:n bara kan rita fyrhörningar, och OBJ-ytor är trianglar
- [ ] För att OBJ-index är flyttal
---
Filen lagrar varje lista utan upprepningar, och varje hörn väljer ur varje lista för sig. GPU:ns vertexhämtning läser en vertex – position, normal och texturkoordinater sida vid sida – per index. Så inläsaren gör varje olik trippel till en vertex (OBJ-index börjar dessutom på 1, GPU:ns på 0).
```

## Ett bibliotek för modellinläsning

Ett mycket populärt bibliotek för att importera modeller heter [Assimp](https://learnopengl.com/Model-Loading/Assimp),
som står för *Open Asset Import Library*. Assimp kan importera dussintals olika modellfilformat (och exportera till
några också) genom att läsa in all modellens data i Assimps generella datastruktur. Så snart Assimp har läst in
modellen kan vi hämta all data vi behöver ur Assimps datastruktur. Eftersom Assimps datastruktur är densamma oavsett
vilket filformat vi importerade, skyddar den oss från alla de olika filformaten därute.

När en modell importeras via Assimp läser biblioteket in hela modellen i ett *scen*-objekt som innehåller all data i
den importerade modellen/scenen. Assimp har sedan en samling noder, där varje nod innehåller index till data som
lagras i scenobjektet och där varje nod kan ha hur många barn som helst. learnopengl.com visar det som ett diagram; i
ord ser (en förenklad) modell av Assimps struktur ut så här:

- **Scenen** (`aiScene`): all data i scenen/modellen finns i objektet `aiScene`, till exempel alla material
  (`mMaterials`) och meshar (`mMeshes`). Det innehåller också en referens till scenens rotnod (`mRootNode`).
- **Noderna** (`aiNode`): scenens rotnod kan innehålla barnnoder (som alla andra noder, `mChildren`) och kan ha en
  uppsättning index som pekar på meshdata i scenobjektets array `mMeshes`. Scenens `mMeshes` innehåller de egentliga
  `aiMesh`-objekten; värdena i en nods `mMeshes` är bara index in i scenens mesharray.
- **En mesh** (`aiMesh`): ett meshobjekt innehåller själv all relevant data som behövs för att rendera, tänk
  vertexpositioner (`mVertices`), normalvektorer (`mNormals`), texturkoordinater (`mTextureCoords`), ytor (`mFaces`)
  och objektets material (`mMaterialIndex`).
- **En yta** (`aiFace`): en mesh innehåller flera ytor (faces). En yta representerar en renderingsprimitiv för
  objektet (trianglar, fyrhörningar, punkter). En yta innehåller indexen för de vertexar som bildar en primitiv
  (`mIndices`). Eftersom vertexarna och indexen hålls isär blir det lätt för oss att rendera via en index buffer (se
  *Hello Triangle*).
- **Ett material** (`aiMaterial`): slutligen länkar en mesh också till ett materialobjekt med flera funktioner för att
  hämta ett objekts materialegenskaper. Tänk färger och/eller texturkartor (som diffuse och specular maps).

Till skillnad från `.obj`-filen har en `aiMesh` redan *ett* index per vertex: Assimps importerare har byggt vertexarna
av filens tripplar av position/texturkoordinat/normal, så dess ytor kan gå rakt in i en index buffer.

Det vi vill göra är: först läsa in ett objekt i ett scenobjekt, rekursivt hämta motsvarande meshobjekt från var och en
av noderna (vi söker rekursivt igenom varje nods barn), och bearbeta varje meshobjekt för att få fram vertexdatan,
indexen och dess materialegenskaper. Resultatet är en samling meshdata som vi vill samla i ett enda `Model`-objekt.

```quiz
Var lagras en meshs vertexdata egentligen i Assimps struktur?
- [x] I `aiMesh`-objekten i scenens array `mMeshes`; en nod har bara index in i den arrayen
- [ ] I materialet, bredvid texturerna
- [ ] I noden: varje `aiNode` har sina egna vertexar
---
Scenen äger alla meshar och material. Noderna organiserar dem bara – vilka meshar som hör ihop och hur delarna förhåller sig till varandra (förälder/barn) – genom att lagra index in i `scene->mMeshes`. Inläsaren går alltså igenom noderna och slår upp varje mesh i scenen.
```

> **Mesh**
>
> När grafiker modellerar föremål i sina verktyg skapar de i allmänhet inte en hel modell av en enda form. Oftast
> består varje modell av flera delmodeller/former. Var och en av de enskilda formerna kallas en *mesh*. Tänk på en
> människoliknande figur: grafiker modellerar oftast huvudet, armar och ben, kläderna och vapnen som separata delar,
> och alla de här mesharna tillsammans utgör den färdiga modellen. En enda mesh är det minsta vi behöver för att rita
> ett föremål i {{api}} (vertexdata, index och materialegenskaper). En modell består (oftast) av flera meshar.

Vår planet är en sådan modell: filens objekt `o planet` och `o rings` blir två meshar, var och en med sitt eget
material – planetens yta och ringen ser olika ut och har olika texturer, så de kan inte dela ett. För en `.obj`-fil
skapar Assimp en rotnod med en barnnod per objekt, och varje barn hänvisar till sin mesh.

```quiz
Varför består `planet.obj` av två meshar, `planet` och `rings`, och inte en?
- [ ] För att Assimp bara kan läsa in objekt som är sfärer
- [x] En mesh har exakt ett material, och planeten och ringen har olika material (olika diffuse och specular maps)
- [ ] För att en mesh får ha högst 1000 trianglar
---
En mesh är den minsta enhet vi ritar med en uppsättning texturer. Allt som behöver andra texturer – här ringen med `rings.png` och `rings_specular.png` – blir en egen mesh, och modellen är samlingen av båda.
```

I de följande kapitlen skapar vi egna klasser `Model` och `Mesh` som läser in och lagrar importerade modeller med den
struktur vi just har beskrivit. När vi sedan vill rita en modell renderar vi inte modellen som helhet, utan alla de
enskilda meshar som modellen består av.

:::vulkan
### Vulkan: tinyobjloader

Vulkan har ingen egen modellinläsare – lika lite som en egen bildinläsare. vulkan-tutorial.com:s kapitel
[Loading models](https://vulkan-tutorial.com/Loading_models) använder det lilla biblioteket **tinyobjloader** i
stället för Assimp, och det gör även den här kursen. Assimp skulle fungera lika bra med Vulkan (dess data är
API-oberoende), men det är ett stort bibliotek med många beroenden, medan tinyobjloader är en enda header,
`tiny_obj_loader.h`, precis som `stb_image.h`. Priset: det läser bara ett format, Wavefront `.obj` med sin `.mtl`-fil.

tinyobjloader har ingen scen och inga noder. Ett enda anrop, `tinyobj::LoadObj`, fyller tre platta strukturer:

- **`tinyobj::attrib_t attrib`** – alla positioner, normaler och texturkoordinater i filen som platta arrayer av
  floats: `attrib.vertices` (3 floats per position), `attrib.normals` (3 per normal) och `attrib.texcoords` (2 per
  texturkoordinat). Det är filens listor `v`, `vn` och `vt`.
- **`std::vector<tinyobj::shape_t> shapes`** – filens objekt (`o planet`, `o rings`). Varje shapes `mesh.indices` har
  ett `tinyobj::index_t` per hörn med tre medlemmar, `vertex_index`, `normal_index` och `texcoord_index` – tripplarna
  från `f`-raderna, räknade från 0. `mesh.material_ids` har materialnumret för varje yta. `LoadObj` gör om varje yta
  till trianglar om du inte ber om något annat, så yta `i` har hörnen `3 * i` till `3 * i + 2`.
- **`std::vector<tinyobj::material_t> materials`** – materialen i `.mtl`-filen i filens ordning (`planet` = 0,
  `rings` = 1), med sina färger och texturnamn (`diffuse_texname`, `specular_texname` …).

I Vulkan är learnopengls "mesh" alltså ett intervall av ytor med ett materialnummer – och det jobb som Assimps
importerare gör, att bygga en vertex per olik trippel, blir vårt: kapitlet *Model* gör det med en hashtabell, och
därför ger kapitlet *Mesh* vår `Vertex` en `operator==` och en hashfunktion. Eftersom allt hamnar i en enda vertex
buffer ritar kursen hela modellen med ett enda draw-anrop och låter varje vertex bära sitt materialnummer.

Att använda biblioteket kräver samma två rader som `stb_image.h`, i exakt en källfil:

```cpp
#define TINYOBJLOADER_IMPLEMENTATION
#include <tiny_obj_loader.h>
```

Definitionen gör att den filen även kompilerar bibliotekets kod; det finns inget att länka.
:::

## Bygga Assimp

:::opengl
Du kan ladda ner Assimp från dess GitHub-sida och välja motsvarande version; alla aktuella versioner fungerar med
koden i den här delen. Det är klokt att kompilera biblioteken själv, eftersom de förkompilerade biblioteken inte alltid
fungerar på alla system. Titta tillbaka på kapitlet *Creating a window* om du har glömt hur du kompilerar ett bibliotek
själv med CMake.

På Linux är det enklare: distributionens paket (till exempel `libassimp-dev` på Debian och Ubuntu) har headerfilerna
och det delade biblioteket. Då länkas programmet med ett bibliotek till:

```text
g++ -std=c++17 main.cpp glad.c -Iinclude -o model_loading -lglfw -ldl -lassimp
```

:::ide clion vscode
Installera Assimp – på Debian och Ubuntu `libassimp-dev`, på macOS `brew install assimp`, på Windows med
[vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) `vcpkg install assimp:x64-windows` – och lägg till
två rader i slutet av din `CMakeLists.txt`, för det här och alla senare kapitel:

```text
find_package(assimp REQUIRED)
target_link_libraries(${PROJECT_NAME} PRIVATE assimp::assimp)
```

`find_package` hittar det installerade biblioteket, och att länka mot målet `assimp::assimp` lägger till dess
include-mapp och dess bibliotek. Med vcpkg måste CMake använda vcpkg:s toolchain-fil: ge CMake
`-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake` (i CLion under **CMake options** i profilen, i VS Code
i inställningen `cmake.configureSettings`). Toolchain-filen kopierar då också Assimps DLL bredvid ditt program.
:::
:::ide vs rider
Enklast på Windows är [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview):
`vcpkg install assimp:x64-windows` bygger Assimp, och `vcpkg integrate install` (en gång) gör att varje Visual
Studio-projekt hittar biblioteken som vcpkg installerade – Rider bygger samma projekt. Ditt projekt får då Assimps
include-mapp och bibliotek av sig självt, och vcpkg kopierar Assimps DLL bredvid din `.exe` när du bygger. Utan vcpkg
bygger du Assimp från källkoden med CMake, lägger till dess `include`-mapp bland **Additional Include Directories**,
dess `.lib` bland **Additional Dependencies** (och filens mapp bland **Additional Library Directories**), och kopierar
dess DLL bredvid din `.exe` – programmet skulle inte starta utan den.
:::

Headerfilerna du behöver är `<assimp/Importer.hpp>` (klassen `Assimp::Importer` som läser en fil), `<assimp/scene.h>`
(strukturerna `aiScene`, `aiNode`, `aiMesh` …) och `<assimp/postprocess.h>` (flaggorna för de efterbearbetningssteg som
Assimp kan göra vid inläsningen, som att göra om varje yta till trianglar).
:::
:::vulkan
learnopengl.com:s OpenGL-kod behöver Assimp byggt och länkat, som beskrivs på dess sida. För kursens Vulkan-program
finns det inget att bygga: tinyobjloader är en enda header. Du laddar ner `tiny_obj_loader.h` från dess GitHub-sida
(precis som vulkan-tutorial gör) till `libs/tinyobjloader` – ditt projekt från *Sätt upp din IDE* har redan den mappen
bland sina include-mappar. Om du vill använda Assimp med Vulkan – för andra format, eller animationer – visar
gästartikeln *Skeletal Animation*, som behöver det, hur du lägger till det.
:::
:::d3d12
DirectX 12-programmet använder också Assimp: kursen portar learnopengls klasser `Mesh` och `Model`, så det behöver
samma bibliotek.

:::ide clion vscode
Installera Assimp med [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) –
`vcpkg install assimp:x64-windows` – och lägg till två rader i slutet av din `CMakeLists.txt`, för det här och alla
senare kapitel:

```text
find_package(assimp REQUIRED)
target_link_libraries(${PROJECT_NAME} PRIVATE assimp::assimp)
```

`find_package` hittar det installerade biblioteket, och att länka mot målet `assimp::assimp` lägger till dess
include-mapp och dess bibliotek. Med vcpkg måste CMake använda vcpkg:s toolchain-fil: ge CMake
`-DCMAKE_TOOLCHAIN_FILE=<vcpkg>/scripts/buildsystems/vcpkg.cmake` (i CLion under **CMake options** i profilen, i VS Code
i inställningen `cmake.configureSettings`). Toolchain-filen kopierar då också Assimps DLL bredvid ditt program.
:::
:::ide vs rider
Enklast på Windows är [vcpkg](https://learn.microsoft.com/en-us/vcpkg/get_started/overview):
`vcpkg install assimp:x64-windows` bygger Assimp, och `vcpkg integrate install` (en gång) gör att varje Visual
Studio-projekt hittar biblioteken som vcpkg installerade – Rider bygger samma projekt. Ditt projekt får då Assimps
include-mapp och bibliotek av sig självt, och vcpkg kopierar Assimps DLL bredvid din `.exe` när du bygger. Utan vcpkg
bygger du Assimp från källkoden med CMake, lägger till dess `include`-mapp bland **Additional Include Directories**,
dess `.lib` bland **Additional Dependencies** (och filens mapp bland **Additional Library Directories**), och kopierar
dess DLL bredvid din `.exe` – programmet skulle inte starta utan den.
:::

Headerfilerna är `<assimp/Importer.hpp>` (klassen `Assimp::Importer` som läser en fil), `<assimp/scene.h>` (strukturerna
`aiScene`, `aiNode`, `aiMesh` …) och `<assimp/postprocess.h>` (flaggorna för de efterbearbetningssteg som Assimp kan
göra vid inläsningen, som att göra om varje yta till trianglar).

En sak att känna till när Assimp möter Direct3D: Assimp lämnar ut sin data i ett högerhänt koordinatsystem med
framsidor moturs, OpenGL:s konventioner, och har en efterbearbetningsflagga, `aiProcess_ConvertToLeftHanded`, för
program som arbetar vänsterhänt. Vårt DirectX 12-program har använt högerhänta matriser (`XMMatrixLookAtRH`,
`XMMatrixPerspectiveFovRH`) sedan *Coordinate Systems*, precis som learnopengl, så det läser in modellen oförändrad.
:::

:::opengl
```quiz
Ditt OpenGL-program anropar nu `Assimp::Importer::ReadFile`. Vad behöver bygget utöver det i de tidigare kapitlen?
- [ ] Bara `#define ASSIMP_IMPLEMENTATION` i en källfil, som för stb_image
- [x] Assimps headerfiler (`<assimp/Importer.hpp>`, `<assimp/scene.h>`, `<assimp/postprocess.h>`) och dess bibliotek vid länkningen – `-lassimp` på Linux
- [ ] Ingenting: Assimp är en del av OpenGL
---
Assimp är ett kompilerat bibliotek, inte en enda header: headerfilerna deklarerar dess klasser och funktioner, och länkaren behöver biblioteket som innehåller dem. Därför får bygget `-lassimp` (eller Assimps `.lib` och DLL på Windows).
```
:::
:::vulkan
```quiz
Hur kommer tinyobjloaders kod med i Vulkan-programmets bygge?
- [x] `#define TINYOBJLOADER_IMPLEMENTATION` före `#include <tiny_obj_loader.h>` i exakt en källfil – då innehåller headern bibliotekets kod
- [ ] Vulkan läser `.obj`-filer själv; tinyobjloader behövs bara för `.mtl`-filen
- [ ] Programmet länkas med `-ltinyobjloader`
---
tinyobjloader är ett bibliotek i en enda header, som `stb_image.h`: normalt deklarerar headern bara, och i den enda filen med definitionen kompilerar den även implementationen. Det finns inget att länka.
```
:::
:::d3d12
```quiz
DirectX 12-programmet anropar `Assimp::Importer::ReadFile`. Vad behöver projektet för det?
- [x] Assimps include-mapp och dess bibliotek vid länkningen (och dess DLL bredvid `.exe`-filen) – till exempel installerat med `vcpkg install assimp`
- [ ] Bara `#define ASSIMP_IMPLEMENTATION` i en källfil, som för stb_image
- [ ] Ingenting: Assimp är en del av Windows SDK, som `d3d12.lib`
---
Assimp är ett kompilerat bibliotek, inte en enda header: headerfilerna deklarerar dess klasser och funktioner, länkaren behöver dess `.lib`, och programmet läser in dess DLL när det startar. vcpkg:s integration ställer in include-mappen och biblioteket åt dig.
```
:::

## Projektet

Det här kapitlet har ingen kod att skriva – learnopengls kapitel *Assimp* har inte heller någon. Projektet är redan det
som de två nästa kapitlen arbetar i, så du kan se dig omkring i det och sedan bygga och köra det: fönstret visar bara
den mörkgrå rensningsfärgen (0.05, 0.05, 0.05), eftersom inget ritas än. (I de följande kapitlen markerar
`// TODO:`-kommentarerna var din kod ska in, och du bygger och kör den i din IDE som tidigare.)

:::opengl
Projektet är learnopengls scen `model_loading.cpp` före modellen: `main.cpp` med kameran från kapitlet *Camera* i
(0, 0, 3) riktad längs -z (WASD, musstyrning och zoom), djuptestet, en shader
`Shader ourShader("model_loading.vs", "model_loading.fs");` och matriserna – bland dem modellmatrisen som lutar
planeten 25° kring x-axeln så att ringen syns, och skalar den med 0,5:

```cpp
        // world transformation of the model
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        ourShader.setMat4("model", model);
```

Shadrarna är learnopengls `1.model_loading.vs/.fs`: vertex shadern tar emot en position, en normal och
texturkoordinater (location 0, 1 och 2), och fragment shadern ger ut färgen från `texture_diffuse1` – ett namn du
förstår i nästa kapitel. `mesh.h` väntar med `// TODO:`-kommentarer på kapitlet *Mesh*; `model.h` och Assimps
headerfiler kommer i kapitlet *Model*.

:::ide vs rider
Lägg till `mesh.h` i projektet (**Project → Add Existing Item…**; i Rider **Add → Existing Item…** i projektets
snabbmeny) för att öppna den från Solution Explorer; `#include "mesh.h"` hittar den bredvid `main.cpp` utan någon
inställning.
:::
:::
:::vulkan
Projektet är learnopengls scen `model_loading.cpp` före modellen, i Vulkan: kameran från kapitlet *Camera* i
(0, 0, 3) riktad längs -z (WASD, musstyrning och zoom), en djupbuffer, en pipeline `modelPipeline` från
`shaders/model_loading.vert` och `.frag`, uniform buffern med vy- och projektionsmatriserna på binding 0, och
modellmatrisen som push constant – den lutar planeten 25° kring x-axeln så att ringen syns, och skalar den med 0,5.
Culling är avstängt (`VK_CULL_MODE_NONE`): ringen är en enda platt yta som måste synas från båda hållen.
`// TODO:`-kommentarerna i `main.cpp` och shadrarna är till för kapitlet *Mesh*; tinyobjloader kommer i kapitlet
*Model*.
:::
:::d3d12
Projektet är learnopengls scen `model_loading.cpp` före modellen, i DirectX 12: kameran från kapitlet *Camera* i
(0, 0, 3) riktad längs -z (WASD, musstyrning och zoom), en djupbuffer, `model_loading.hlsl` med learnopengls
modellshadrar (`VSMain` tar emot `POSITION`, `NORMAL` och `TEXCOORD`, `PSMain` returnerar färgen från
`texture_diffuse1`), och modellmatrisen som root constants – den lutar planeten 25° kring x-axeln så att ringen syns,
och skalar den med 0,5. Culling är avstängt (`D3D12_CULL_MODE_NONE`): ringen är en enda platt yta som måste synas från
båda hållen. Root signaturen har redan en tabell med två texturer (t0 och t1) för root parameter 2, som varje mesh
sätter när den ritas. `// TODO:`-kommentarerna i `main.cpp` är till för kapitlet *Mesh*; Assimps headerfiler kommer i
kapitlet *Model*.
:::

```quiz
Hur kommer programmet i de följande kapitlen att rita den inlästa planeten?
- [ ] Genom att be modellinläsaren rita den
- [x] Genom att rita var och en av dess meshar – planeten och ringen – med meshens egna vertexar, index och texturer
- [ ] Som ett enda föremål med en textur, eftersom en modell är en enda form
---
En modellinläsare läser bara data; att rita är vårt jobb. En modell är en samling meshar, så att rita modellen betyder att rita varje mesh med texturerna från dess eget material.
```

Nu när vi förhoppningsvis har en bild av hur Assimp är uppbyggt kan vi börja skriva en klass som håller datan för en
mesh: kapitlet *Mesh*.

## Mer att läsa

- [Assimp](https://learnopengl.com/Model-Loading/Assimp) på learnopengl.com: kapitlet som det här följer, med
  diagrammet över Assimps struktur.

:::vulkan
- [Loading models](https://vulkan-tutorial.com/Loading_models) på vulkan-tutorial.com: att läsa in en `.obj`-fil med
  tinyobjloader.
:::
:::d3d12
- [What is vcpkg?](https://learn.microsoft.com/en-us/vcpkg/get_started/overview) på Microsoft Learn: pakethanteraren
  som installerar Assimp för ett Visual Studio-projekt.
:::
