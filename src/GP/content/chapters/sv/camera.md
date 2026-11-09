# Kamera

I förra kapitlet gick vi igenom vymatrisen och hur vi kan använda den för att röra oss i scenen (vi backade en
liten bit). {{api}} känner i sig inte till begreppet *kamera*, men vi kan försöka simulera en genom att flytta alla
objekt i scenen åt motsatt håll, vilket ger illusionen av att det är vi som rör oss.

I det här kapitlet går vi igenom hur du sätter upp en kamera i {{api}}. Vi bygger en kamera i flygstil som låter dig
röra dig fritt i en 3D-scen. Vi går också igenom tangentbords- och musinmatning och avslutar med en egen kameraklass.

:::opengl
Det här kapitlets projekt är resultatet från *Coordinate Systems*: samma filer (`main.cpp`, `shader_m.h`,
`shader.vs`, `shader.fs`, `container.png`, `awesomeface.png`) och samma tio texturerade lådor, där var tredje (kub 0,
3, 6 och 9) roterar med tiden. Varje bildruta bygger renderloopen en `view`-matris (en förflyttning med (0, 0, -3))
och en `projection`-matris (45°, 800/600, 0.1, 100) och sätter dem med `ourShader.setMat4`; sedan räknar
`for`-loopen ut en `model`-matris per kub och ritar den med `glDrawArrays`.
:::
:::vulkan
Det här kapitlets projekt är resultatet från *Coordinate Systems*: tio djuptestade, texturerade lådor, där var tredje
(kub 0, 3, 6 och 9) roterar med tiden. Vy- och projektionsmatriserna ligger i uniform buffern, som
`updateUniformBuffer()` fyller i varje bildruta; varje kubs modellmatris skickas som push constant före dess
ritanrop i `recordCommandBuffer()`. Allt kameraarbete i det här kapitlet sker i `updateUniformBuffer()` och i ny
inmatningskod; `recordCommandBuffer()` ändras inte.
:::
:::d3d12
Det här kapitlets projekt är resultatet från *Coordinate Systems*: tio djuptestade, texturerade lådor, där var tredje
(kub 0, 3, 6 och 9) roterar med tiden. `OnUpdate` skriver vymatrisen (`XMMatrixTranslation(0, 0, -3)`) och
45°-projektionen till constant buffern varje bildruta; `PopulateCommandList` sätter varje kubs modellmatris som root
constants och ritar den. Allt kameraarbete i det här kapitlet sker i `OnUpdate` och i fönstrets meddelandehanterare,
`WindowProc`; `PopulateCommandList` ändras inte.
:::

Den här gången har projektet inga `// TODO:`-kommentarer: varje uppgift ändrar eller bygger ut kod som redan finns,
och uppgiftstexten talar om var. Efter varje uppgift trycker du på **Build & run** (Ctrl+Enter) för att kompilera
programmet och köra det i den inbyggda simulatorn.

> Den inbyggda simulatorn kan inte trycka på tangenter eller flytta musen. När kameran väl styrs med tangentbordet och
> musen visar förhandsvisningen därför kamerans **startvy** – som, ska du se, är exakt den bild du börjar med. Bara
> den cirklande kameran i den andra uppgiften rör sig synbart av sig själv, över tid. Allt du skriver är ändå riktig
> inmatningskod: på din egen dator låter samma program dig flyga genom scenen.

## Kamera-/vyrymd

När vi pratar om kamera-/vyrymden menar vi alla vertexkoordinater sedda ur kamerans perspektiv, med kameran som
scenens origo: vymatrisen omvandlar alla världskoordinater till vykoordinater som är relativa till kamerans position
och riktning. För att definiera en kamera behöver vi dess position i världsrymden, riktningen den tittar åt, en vektor
som pekar åt höger och en vektor som pekar uppåt från kameran. En uppmärksam läsare märker kanske att vi i själva
verket ska skapa ett koordinatsystem med 3 vinkelräta enhetsaxlar och kamerans position som origo.

:::d3d12
> DirectXMaths *RH*-funktioner, som den här kursen använder, arbetar i ett högerhänt koordinatsystem precis som
> OpenGL: +x åt höger, +y uppåt och +z ut ur skärmen, mot dig. Allt i det här avsnittet är därför detsamma i
> Direct3D 12. (DirectXMath har också vänsterhänta *LH*-versioner, där +z pekar in i skärmen; då skulle du behöva byta
> tecken på varje z nedan.)
:::

### 1. Kamerans position

Kamerans position är enkel att få fram. Kamerapositionen är en vektor i världsrymden som pekar på kamerans position.
Vi ställer kameran på samma position som i förra kapitlet:

:::opengl vulkan
```cpp
glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 3.0f);
```
:::
:::d3d12
```cpp
XMVECTOR cameraPos = XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f);
```
:::

> Glöm inte att den positiva z-axeln går genom skärmen mot dig, så om vi vill att kameran ska backa rör vi oss längs
> den positiva z-axeln.

### 2. Kamerans riktning

Nästa vektor vi behöver är kamerans riktning, alltså åt vilket håll den pekar. Än så länge låter vi kameran peka mot
scenens origo: (0, 0, 0). Kommer du ihåg att om vi subtraherar två vektorer från varandra får vi en vektor som är
skillnaden mellan dem? Att subtrahera kamerans positionsvektor från scenens origo ger alltså den riktningsvektor vi
vill ha. För vymatrisens koordinatsystem vill vi att z-axeln ska vara positiv, och eftersom kameran enligt konvention
pekar mot den negativa z-axeln vill vi negera riktningsvektorn. Om vi byter ordning på subtraktionen får vi en vektor
som pekar längs kamerans positiva z-axel:

:::opengl vulkan
```cpp
glm::vec3 cameraTarget = glm::vec3(0.0f, 0.0f, 0.0f);
glm::vec3 cameraDirection = glm::normalize(cameraPos - cameraTarget);
```
:::
:::d3d12
```cpp
XMVECTOR cameraTarget = XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f);
XMVECTOR cameraDirection = XMVector3Normalize(cameraPos - cameraTarget);
```
:::

> Namnet *riktningsvektor* är inte det bäst valda, eftersom den faktiskt pekar åt motsatt håll mot det den siktar på.

### 3. Högeraxeln

Nästa vektor vi behöver är en *högervektor* som representerar kamerarymdens positiva x-axel. För att få fram den
använder vi ett litet trick: först anger vi en *uppåtvektor* som pekar uppåt (i världsrymden). Sedan tar vi
kryssprodukten av uppåtvektorn och riktningsvektorn från steg 2. Eftersom resultatet av en kryssprodukt är en vektor
som är vinkelrät mot båda vektorerna får vi en vektor som pekar längs den positiva x-axeln (byter vi ordning i
kryssprodukten får vi en vektor som pekar längs den negativa x-axeln):

:::opengl vulkan
```cpp
glm::vec3 up = glm::vec3(0.0f, 1.0f, 0.0f);
glm::vec3 cameraRight = glm::normalize(glm::cross(up, cameraDirection));
```
:::
:::d3d12
```cpp
XMVECTOR up = XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f);
XMVECTOR cameraRight = XMVector3Normalize(XMVector3Cross(up, cameraDirection));
```
:::

### 4. Uppåtaxeln

Nu när vi har både x-axelns och z-axelns vektor är det ganska enkelt att få fram vektorn som pekar längs kamerans
positiva y-axel: vi tar kryssprodukten av riktningsvektorn och högervektorn:

:::opengl vulkan
```cpp
glm::vec3 cameraUp = glm::cross(cameraDirection, cameraRight);
```
:::
:::d3d12
```cpp
XMVECTOR cameraUp = XMVector3Cross(cameraDirection, cameraRight);
```
:::

Med hjälp av kryssprodukten och några knep har vi kunnat skapa alla vektorer som bildar vy-/kamerarymden. För de mer
matematiskt lagda läsarna: processen kallas *Gram-Schmidt* inom linjär algebra. Med de här kameravektorerna kan vi nu
skapa en **LookAt**-matris, som visar sig vara mycket användbar när man skapar en kamera.

För vår kamera i (0, 0, 3) som tittar mot origo blir resultaten enkla: riktningen är (0, 0, 1), högervektorn
(1, 0, 0) och uppåtvektorn (0, 1, 0) – kamerans axlar är exakt världens axlar. Kom ihåg det till första uppgiften.

```quiz
Kamerans riktningsvektor räknas ut som `normalize(cameraPos - cameraTarget)`. Åt vilket håll pekar den?
- [ ] Från kameran mot målet – åt det håll kameran tittar
- [x] Från målet mot kameran – motsatt det håll kameran tittar, längs vyrymdens positiva z-axel
- [ ] Längs världens uppåtaxel, vinkelrätt mot siktlinjen
---
Kameran tittar längs sin egen negativa z-axel, så vyrymdens positiva z-axel pekar bakåt, ut ur skärmen. Att subtrahera målet från positionen ger precis den axeln – därför är namnet *riktning* lite missvisande.
```

## Look At

En fin sak med matriser är att om du definierar en koordinatrymd med 3 vinkelräta (eller icke-linjära) axlar kan du
skapa en matris av de 3 axlarna plus en förflyttningsvektor, och sedan omvandla vilken vektor som helst till den
koordinatrymden genom att multiplicera den med matrisen. Det är precis vad *LookAt*-matrisen gör, och nu när vi har 3
vinkelräta axlar och en positionsvektor som definierar kamerarymden kan vi skapa vår egen LookAt-matris:

```text
           | Rx  Ry  Rz  0 |   | 1  0  0  -Px |
LookAt  =  | Ux  Uy  Uz  0 | * | 0  1  0  -Py |
           | Dx  Dy  Dz  0 |   | 0  0  1  -Pz |
           | 0   0   0   1 |   | 0  0  0   1  |
```

Här är *R* högervektorn, *U* uppåtvektorn, *D* riktningsvektorn och *P* kamerans positionsvektor. Observera att
rotationsdelen (vänstra matrisen) och förflyttningsdelen (högra matrisen) är inverterade (transponerad respektive
negerad), eftersom vi vill rotera och förflytta världen åt motsatt håll mot hur vi vill att kameran ska röra sig. Med
den här LookAt-matrisen som vymatris omvandlas alla världskoordinater till vyrymden vi just definierade.
LookAt-matrisen gör alltså precis vad den heter: den skapar en vymatris som *tittar* på ett givet mål.

:::opengl
Som tur är gör GLM redan allt det här åt oss. Vi behöver bara ange en kameraposition, en målposition och en vektor som
representerar uppåtvektorn i världsrymden (uppåtvektorn vi använde för att räkna ut högervektorn). GLM skapar sedan
LookAt-matrisen som vi kan använda som vymatris:

```cpp
glm::mat4 view;
view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f),
                   glm::vec3(0.0f, 0.0f, 0.0f),
                   glm::vec3(0.0f, 1.0f, 0.0f));
```

Funktionen `glm::lookAt` tar i tur och ordning en position, ett mål och en uppåtvektor. Ersätt förflyttningen i
renderloopen i projektet med det här anropet:

```cpp
        // camera/view transformation: a camera at (0, 0, 3) looking at the origin, with +y as up
        view       = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
Som tur är gör GLM redan allt det här åt oss – och det fungerar för Vulkan precis som för OpenGL, eftersom vymatrisen
bara flyttar världen in i kamerarymden; skillnaderna mellan API:erna (djup från 0 till 1, y nedåt i clip space)
hanteras av projektionsmatrisen, som projektet redan justerar med `GLM_FORCE_DEPTH_ZERO_TO_ONE` och
`ubo.proj[1][1] *= -1`. Vi behöver bara ange en kameraposition, en målposition och en vektor som representerar
uppåtvektorn i världsrymden (uppåtvektorn vi använde för att räkna ut högervektorn). Du kanske känner igen
`glm::lookAt` från vulkan-tutorials kapitel *Uniform buffers*, som tittar på sin rektangel från (2, 2, 2) med **z**
som uppåtaxel; vi behåller learnopengls konvention, där y är uppåt.

Ersätt förflyttningen i `updateUniformBuffer()` med det här anropet:

```cpp
        // camera/view transformation: a camera at (0, 0, 3) looking at the origin, with +y as up
        ubo.view = glm::lookAt(glm::vec3(0.0f, 0.0f, 3.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```

Funktionen `glm::lookAt` tar i tur och ordning en position, ett mål och en uppåtvektor.
:::
:::d3d12
Som tur är gör DirectXMath redan allt det här åt oss. `XMMatrixLookAtRH(EyePosition, FocusPosition, UpDirection)`
tar kamerans position, målpositionen och en vektor som representerar uppåtvektorn i världsrymden (uppåtvektorn vi
använde för att räkna ut högervektorn), och returnerar LookAt-matrisen för ett högerhänt koordinatsystem –
motsvarigheten till GLM:s `glm::lookAt`. DirectXMath multiplicerar radvektorer (`v * M`), så den `XMMATRIX` den
returnerar är transponatet av matrisen ovan: R, U och D är dess kolumner och förflyttningen ligger i sista raden.
Matematiken är densamma.

Ersätt förflyttningen i `OnUpdate` med en look-at-matris:

```cpp
    // The view matrix: a camera at (0, 0, 3) looking at the origin, with +y as up.
    // The *RH functions use a right-handed system like OpenGL: +z points out of the
    // screen, towards you.
    XMMATRIX view = XMMatrixLookAtRH(XMVectorSet(0.0f, 0.0f, 3.0f, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
```

> Blanda inte ihop `XMMatrixLookAtRH` och `XMMatrixLookAtLH`. LH-versionen bygger en vymatris för ett vänsterhänt
> system där kameran tittar längs +z; tillsammans med projektets högerhänta `XMMatrixPerspectiveFovRH` skulle scenen
> hamna bakom kameran.
:::

Gör nu den första uppgiften, **look-at**. När du bygger och kör den ändras *ingenting* – och det är hela poängen. Som
vi såg ovan har en kamera i (0, 0, 3) som tittar mot origo med +y uppåt världens x-, y- och z-axel som sina höger-,
uppåt- och riktningsvektorer. Rotationsdelen av LookAt-matrisen blir då enhetsmatrisen, och det som återstår är en
förflyttning med -cameraPos = (0, 0, -3): exakt den matris du hade innan.

```quiz
Efter uppgiften **look-at** är bilden identisk med den tidigare. Varför är en look-at-matris från (0, 0, 3) mot origo, med (0, 1, 0) som uppåt, lika med en förflyttning med (0, 0, -3)?
- [x] Kamerans höger-, uppåt- och riktningsvektorer är världens x-, y- och z-axel, så rotationsdelen är enhetsmatrisen och bara förflyttningen med -cameraPos återstår
- [ ] Look-at-funktionen ignorerar sitt mål när målet är origo
- [ ] De två matriserna är olika, men skillnaden är för liten för att synas i ett fönster på 800×600
---
LookAt-matrisen är en rotation (kamerans axlar som rader) gånger en förflyttning med den negerade positionen. När kamerans axlar är lika med världens axlar gör rotationen ingenting, så matriserna är exakt lika – inte bara snarlika.
```

Innan vi ger oss på användarinmatning ska vi först leka lite genom att låta kameran rotera runt scenen. Vi behåller
målet i (0, 0, 0). Med lite trigonometri skapar vi varje bildruta en x- och en z-koordinat som representerar en punkt
på en cirkel, och dem använder vi som kameraposition. Genom att räkna om x- och z-koordinaten över tid passerar vi alla
punkter på cirkeln, och kameran roterar därmed runt scenen. Vi förstorar cirkeln med en förutbestämd `radius` och
skapar en ny vymatris varje bildruta utifrån tiden:

:::opengl
```cpp
        // camera/view transformation: the camera circles the scene, always looking at the origin
        float radius = 10.0f;
        float camX = static_cast<float>(sin(glfwGetTime()) * radius);
        float camZ = static_cast<float>(cos(glfwGetTime()) * radius);
        view       = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```
:::
:::vulkan
```cpp
        // camera/view transformation: the camera circles the scene, always looking at the origin
        float radius = 10.0f;
        float camX = static_cast<float>(std::sin(glfwGetTime()) * radius);
        float camZ = static_cast<float>(std::cos(glfwGetTime()) * radius);
        ubo.view = glm::lookAt(glm::vec3(camX, 0.0f, camZ), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 1.0f, 0.0f));
```

`glfwGetTime()` returnerar antalet sekunder sedan GLFW initierades – samma klocka som OpenGL-program använder.
:::
:::d3d12
`OnUpdate` behöver tiden för det här. Det finns ingen `glfwGetTime()` i ett Win32-program, så vi mäter sekunderna
sedan första bildrutan med `std::chrono`, precis som projektet redan gör för de roterande kuberna i
`PopulateCommandList`:

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // The view matrix: the camera circles the scene at a distance of 10 (in the
    // xz plane), always looking at the origin, with +y as up.
    float radius = 10.0f;
    float camX = std::sin(time) * radius;
    float camZ = std::cos(time) * radius;
    XMMATRIX view = XMMatrixLookAtRH(XMVectorSet(camX, 0.0f, camZ, 0.0f), XMVectorSet(0.0f, 0.0f, 0.0f, 0.0f), XMVectorSet(0.0f, 1.0f, 0.0f, 0.0f));
```
:::

Gör nu uppgiften **circle**. Kameran kretsar nu runt scenen på avståndet 10, ett helt varv var 2π ≈ 6,3 sekund, och
tittar hela tiden mot origo: kub 0 stannar i mitten av fönstret medan de andra lådorna – mycket mindre nu – svänger
runt den. Vid t = 0 står kameran i (0, 0, 10), framför scenen; en sekund senare står den i (8,4, 0, 5,4), och alla
lådor har flyttat in i fönstrets högra halva. Låt den köra en stund i simulatorn och se scenen vrida sig.

Vymatrisen byggs om varje bildruta, och varje bildruta måste den nå vertex shadern igen:

:::opengl
Den är uniformen `view` i `shader.vs` (`uniform mat4 view;`) och sätts direkt efter att den räknats ut:

```cpp
        // pass transformation matrices to the shader
        ourShader.setMat4("view", view);
```

En uniform behåller sitt värde tills du sätter den igen, så det räcker att sätta den en gång per bildruta – före
ritanropen.
:::
:::vulkan
Den är medlemmen `view` i `UniformBufferObject` i uniform buffern (binding 2 i `shader.vert`). `drawFrame()` anropar
`updateUniformBuffer()` varje bildruta, efter att ha väntat på fencen, och den kopierar de nya matriserna till den
permanent mappade buffern:

```cpp
        memcpy(uniformBufferMapped, &ubo, sizeof(ubo));
```

Projektet har bara en bildruta in flight, så GPU:n är klar med förra bildrutan (och sina läsningar av buffern) innan
CPU:n skriver över den.
:::
:::d3d12
Den är medlemmen `view` i `SceneConstantBuffer` (`cbuffer SceneConstantBuffer : register(b1)` i `shaders.hlsl`). I
slutet av `OnUpdate` kopieras matrisen till constant buffern, transponerad precis som modellmatrisen:

```cpp
    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

`OnRender` väntar tills GPU:n är klar med varje bildruta, så GPU:n läser inte buffern medan `OnUpdate` skriver till
den.
:::

## Gå runt

Det är kul att svänga kameran runt en scen, men det är roligare att sköta all förflyttning själv! Först behöver vi
sätta upp ett kamerasystem, så det är praktiskt att definiera några kameravariabler överst i programmet:

:::opengl
```cpp
// camera
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

De hamnar under inställningarna, före `main`: globala variabler, så att inmatningsfunktionerna du ska skriva kan
ändra dem. `LookAt`-anropet blir nu:

```cpp
        // camera/view transformation: look from cameraPos in the direction of cameraFront
        view       = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
```
:::
:::vulkan
```cpp
// camera
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Precis som i learnopengl är de globala variabler på filnivå, före structen `PushConstants` och klassen
`HelloTriangleApplication` – GLFW-callbackarna du skriver senare är vanliga funktioner och når dem där.
`LookAt`-anropet i `updateUniformBuffer()` blir nu:

```cpp
        // camera/view transformation: look from cameraPos in the direction of cameraFront
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
```
:::
:::d3d12
```cpp
// The camera: where it is, the direction it looks in, and which way is up. Globals,
// so that OnUpdate and the window's message handler can both use them.
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f,  3.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

De hamnar före `class D3D12App`. Vymatrisen i `OnUpdate` blir nu:

```cpp
    // The view matrix: look from cameraPos in the direction of cameraFront.
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
```

DirectXMath överlagrar de aritmetiska operatorerna för `XMVECTOR` (`+`, `-`, `*` med ett flyttal, `+=`, `-=`), så
koden läses som GLM-versionen. Det finns också `XMMatrixLookToRH(cameraPos, cameraFront, cameraUp)`, som tar
riktningen direkt – Microsofts exempel använder den i sin klass `SimpleCamera` – och ger samma matris.
:::

Först sätter vi kamerans position till den tidigare definierade `cameraPos`. Målet är den aktuella positionen plus
riktningsvektorn vi just definierade. Det ser till att kameran fortsätter att titta i målriktningen hur vi än rör
oss. Observera att `cameraFront` pekar åt det håll kameran *tittar*, (0, 0, -1) – till skillnad från
riktningsvektorn i de tidigare avsnitten, som pekade bakåt – och att `cameraUp` här helt enkelt är världens
uppåtvektor; look-at-funktionen räknar ut kamerans verkliga uppåtaxel från den.

Gör nu uppgiften **free-camera**: lägg till de tre variablerna och ersätt den cirklande kameran (dess `radius`,
`camX` och `camZ` försvinner) med look-at-anropet ovan. Standardbilden är tillbaka – kameran står still i (0, 0, 3)
och tittar längs -z – och från och med nu rör sig kameran bara när dess variabler ändras.

Låt oss leka lite med variablerna genom att uppdatera vektorn `cameraPos` när vi trycker på några tangenter.

:::opengl
Vi har redan en funktion `processInput` som hanterar GLFW:s tangentbordsinmatning, så vi lägger till några fler
tangentkommandon. Varje anrop till `glfwGetKey` frågar GLFW om en tangent hålls nere just nu:

```cpp
    float cameraSpeed = static_cast<float>(2.5 * deltaTime);
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        cameraPos += cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        cameraPos -= cameraSpeed * cameraFront;
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
```
:::
:::vulkan
Vulkan-projektet har ingen funktion `processInput` än, så vi lägger till en som medlem i `HelloTriangleApplication`,
efter mönster från learnopengl. Varje anrop till `glfwGetKey` frågar GLFW om en tangent hålls nere just nu. Escape
stänger fönstret – det behöver du när musen väl är fångad:

```cpp
    void processInput() {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
            glfwSetWindowShouldClose(window, GLFW_TRUE);
        }

        float cameraSpeed = 2.5f * deltaTime; // units per second, the same speed at any frame rate
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
            cameraPos += cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
            cameraPos -= cameraSpeed * cameraFront;
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
            cameraPos -= glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
            cameraPos += glm::normalize(glm::cross(cameraFront, cameraUp)) * cameraSpeed;
        }
    }
```

`mainLoop()` anropar den varje bildruta, direkt efter att `glfwPollEvents()` har behandlat fönstrets händelser.
:::
:::d3d12
Ett Win32-program frågar inte om en tangent är nedtryckt; Windows *berättar* det för fönstret, med meddelanden.
`WM_KEYDOWN` kommer när en tangent trycks ned (och upprepas medan den hålls), `WM_KEYUP` när den släpps. För att veta
vilka tangenter som hålls nere – det som `glfwGetKey` talar om för ett GLFW-program – håller vi en array, indexerad
med tangentens *virtual-key code*. För bokstavstangenter är den koden den stora bokstaven: `'W'` är 0x57.

```cpp
// Which keys are held down, by virtual-key code ('W', VK_UP ...). WindowProc keeps it up to date.
bool keys[256] = {};
```

`WindowProc` håller den uppdaterad (Escape stänger fortfarande fönstret):

```cpp
    case WM_KEYDOWN:
        // Escape closes the window; any key pressed is held down until its WM_KEYUP.
        if (wParam == VK_ESCAPE)
        {
            DestroyWindow(hWnd);
        }
        keys[static_cast<UINT8>(wParam)] = true;
        return 0;

    case WM_KEYUP:
        keys[static_cast<UINT8>(wParam)] = false;
        return 0;
```

och `OnUpdate`, som körs en gång per bildruta, flyttar kameran:

```cpp
    float cameraSpeed = 2.5f * deltaTime;
    if (keys['W'])
        cameraPos += cameraSpeed * cameraFront;
    if (keys['S'])
        cameraPos -= cameraSpeed * cameraFront;
    if (keys['A'])
        cameraPos -= XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;
    if (keys['D'])
        cameraPos += XMVector3Normalize(XMVector3Cross(cameraFront, cameraUp)) * cameraSpeed;
```

Microsofts exempel gör likadant i sin klass `SimpleCamera`: `OnKeyDown`/`OnKeyUp` noterar vilka tangenter som är
nedtryckta, och `Update(elapsedSeconds)` flyttar kameran en gång per bildruta.
:::

När vi trycker på någon av tangenterna WASD uppdateras kamerans position. Vill vi gå framåt eller bakåt adderar eller
subtraherar vi riktningsvektorn, skalad med en hastighet, till positionsvektorn. Vill vi gå i sidled tar vi en
kryssprodukt för att skapa en *högervektor* och rör oss längs den. Det ger den välbekanta *strafe*-effekten när man
använder kameran.

> Observera att vi normaliserar den resulterande högervektorn. Om vi inte gjorde det skulle kryssprodukten kunna ge
> vektorer av olika längd beroende på `cameraFront`. Utan normalisering skulle vi röra oss långsamt eller snabbt
> beroende på kamerans orientering i stället för med en jämn hastighet.

Skriv inte in den här koden riktigt än: den använder en `deltaTime` som inte finns. Var den kommer ifrån är ämnet för
nästa avsnitt.

## Rörelsehastighet

learnopengls första version av den här koden använder en konstant `cameraSpeed` på 0.05 enheter per bildruta. Det
fungerar, men grafikprogram och spel brukar hålla reda på en *deltatime*-variabel som lagrar hur lång tid det tog att
rendera den senaste bildrutan, och det finns en god anledning till det. I praktiken har folk olika mycket
datorkraft, och resultatet är att vissa kan rendera många fler bildrutor per sekund än andra. När en användare
renderar fler bildrutor än en annan anropas också inmatningskoden oftare. Följden blir att vissa rör sig väldigt
snabbt och andra väldigt långsamt, beroende på deras dator. När du levererar ditt program vill du att det beter sig
likadant på all slags hårdvara.

Vi multiplicerar då alla hastigheter med värdet `deltaTime`. Resultatet är att när vi har en stor `deltaTime` i en
bildruta, alltså när den förra bildrutan tog längre tid än genomsnittet, blir hastigheten i den bildrutan också lite
högre för att väga upp det. Med det här sättet spelar det ingen roll om du har en väldigt snabb eller långsam dator:
kamerans hastighet balanseras ut så att alla användare får samma upplevelse.

För att räkna ut `deltaTime` håller vi reda på 2 globala variabler:

:::opengl vulkan
```cpp
// timing
float deltaTime = 0.0f; // time between current frame and last frame
float lastFrame = 0.0f;
```
:::

:::opengl
I varje bildruta räknar vi sedan ut det nya värdet på `deltaTime` för senare bruk, i början av renderloopen:

```cpp
        // per-frame time logic
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;
```
:::
:::vulkan
I varje bildruta räknar vi sedan ut det nya värdet på `deltaTime` i `mainLoop()`, innan händelserna hämtas och
inmatningen behandlas:

```cpp
        while (!glfwWindowShouldClose(window)) {
            // per-frame time logic
            float currentFrame = static_cast<float>(glfwGetTime());
            deltaTime = currentFrame - lastFrame;
            lastFrame = currentFrame;

            glfwPollEvents();
            processInput();
            drawFrame();
        }
```
:::
:::d3d12
I `OnUpdate` kommer tiden sedan förra bildrutan från `std::chrono`. En lokal `static`-variabel initieras bara vid
första anropet, så `lastFrame` börjar vid första bildrutan och behåller sedan förra bildrutans tid:

```cpp
    // Per-frame time logic: deltaTime is the time since the last frame, in seconds.
    static auto lastFrame = std::chrono::high_resolution_clock::now();
    auto currentFrame = std::chrono::high_resolution_clock::now();
    float deltaTime = std::chrono::duration<float, std::chrono::seconds::period>(currentFrame - lastFrame).count();
    lastFrame = currentFrame;
```

Det här hamnar allra först i `OnUpdate`, före förflyttningskoden. Huvudloopen i `wWinMain` anropar `OnUpdate` och
`OnRender` när inga fönstermeddelanden väntar, så varje bildruta ser först de tangenter som ändrats sedan förra.
:::

Nu när vi har `deltaTime` kan vi ta med den när vi räknar ut hastigheterna: `cameraSpeed` är 2.5 × `deltaTime`,
vilket får kameran att röra sig 2,5 enheter per sekund, hur snabbt bildrutorna än kommer.

Gör nu uppgiften **wasd**. Utan tangenter syns ingen förändring – simulatorn visar standardbilden. På din egen dator
flyttar W kameran framåt in i scenen (lådorna växer), S bakåt, A åt vänster och D åt höger, lika långt per sekund vid
alla bildfrekvenser. Tillsammans med förra avsnittet har vi nu ett mycket jämnare och mer konsekvent kamerasystem för
att röra oss i scenen.

```quiz
En dator kör programmet i 30 bildrutor per sekund, en annan i 120. På båda håller användaren in W i exakt en sekund. Hur långt flyttar sig kameran?
- [ ] 2,5 enheter vid 30 fps, 10 enheter vid 120 fps
- [x] 2,5 enheter på båda: varje bildruta flyttar 2,5 × deltaTime, och deltaTime för en sekunds bildrutor blir tillsammans en sekund
- [ ] 2,5 enheter vid 120 fps, 0,625 enheter vid 30 fps
---
Med ett fast steg per bildruta skulle den snabbare datorn köra inmatningskoden fyra gånger så ofta och flytta sig fyra gånger så långt. Att multiplicera med deltaTime gör hastigheten till enheter per sekund: många korta bildrutor flyttar lite var, få långa bildrutor flyttar mer var.
```

## Se dig omkring

Att bara använda tangentbordet för att röra sig är inte särskilt spännande, särskilt eftersom vi inte kan vända oss
om, vilket begränsar rörelsen ganska mycket. Det är där musen kommer in!

För att se oss omkring i scenen måste vi ändra vektorn `cameraFront` utifrån musens rörelser. Att ändra
riktningsvektorn utifrån musens rotationer är dock lite krångligt och kräver lite trigonometri. Om du inte förstår
trigonometrin, oroa dig inte – du kan hoppa direkt till kodavsnitten; du kan alltid komma tillbaka senare om du vill
veta mer.

## Eulervinklar

Eulervinklar är 3 värden som kan representera vilken rotation som helst i 3D, definierade av Leonhard Euler någon
gång på 1700-talet. Det finns 3 eulervinklar: *pitch*, *yaw* och *roll*:

- **Pitch** är vinkeln som anger hur mycket vi tittar uppåt eller nedåt – en rotation runt kamerans högeraxel.
- **Yaw** anger hur mycket vi tittar åt vänster eller höger – en rotation runt uppåtaxeln.
- **Roll** anger hur mycket vi rollar, vilket mest används i kameror för rymdflygning – en rotation runt
  blickriktningen.

Var och en av eulervinklarna representeras av ett enda värde, och med kombinationen av alla 3 kan vi räkna ut vilken
rotationsvektor som helst i 3D. I vårt kamerasystem bryr vi oss bara om yaw och pitch, så vi går inte in på roll här.

Givet ett pitch- och ett yaw-värde kan vi omvandla dem till en 3D-vektor som representerar en ny riktningsvektor.
Omvandlingen från yaw och pitch till en riktningsvektor kräver lite trigonometri. Föreställ dig en rätvinklig
triangel vars hypotenusa har längden 1, med en vinkel θ där hypotenusan möter närliggande katet. Från trigonometrin
(*soh cah toa*) vet vi att den närliggande katetens längd är cos θ / h = cos θ / 1 = **cos θ** och att den motstående
katetens längd är sin θ / h = sin θ / 1 = **sin θ**. Det ger oss allmänna formler för att få fram längden på båda
kateterna i en rätvinklig triangel, beroende på den givna vinkeln.

Låt oss först titta på yaw. Föreställ dig att du tittar ovanifrån ned på xz-planet: riktningsvektorn ligger platt i
planet, och yaw är dess vinkel räknad från x-axeln. Dess x-komponent är då `cos(yaw)` och dess z-komponent
`sin(yaw)`:

```text
direction.x = cos(yaw)
direction.z = sin(yaw)
```

Föreställ dig nu samma triangel från sidan: pitch lutar vektorn uppåt eller nedåt ut ur xz-planet. Dess y-komponent
är `sin(pitch)`, och den del som är kvar i xz-planet krymper till `cos(pitch)`. Både x- och z-komponenten skalas med
det, vilket ger oss den slutliga riktningsvektorn:

```text
direction.x = cos(yaw) * cos(pitch)
direction.y = sin(pitch)
direction.z = sin(yaw) * cos(pitch)
```

:::opengl vulkan
Vinklarna lagras i grader, men `sin` och `cos` förväntar sig radianer, så koden omvandlar dem först med
`glm::radians`.
:::
:::d3d12
Vinklarna lagras i grader, men `std::sin` och `std::cos` förväntar sig radianer, så koden omvandlar dem först med
`XMConvertToRadians`, DirectXMaths motsvarighet till `glm::radians`.
:::

Det ger oss en formel för att omvandla yaw och pitch till en tredimensionell riktningsvektor som vi kan använda för
att se oss omkring.

Vi har byggt scenen så att allt ligger åt den negativa z-axelns håll. Men om vi tittar på yaw-triangeln i x och z ser
vi att yaw 0 får kamerans riktningsvektor att peka längs den positiva x-axeln. För att kameran ska peka mot den
negativa z-axeln från början ger vi yaw startvärdet -90 grader, ett kvarts varv från +x mot -z (cos(-90°) = 0,
sin(-90°) = -1):

```cpp
float yaw = -90.0f;
```

Du har säkert undrat vid det här laget: hur sätter och ändrar vi yaw och pitch?

```quiz
Med yaw = 0° och pitch = 0° ger formeln riktningen (cos 0 · cos 0, sin 0, sin 0 · cos 0). Vart skulle kameran titta, och varför börjar koden med yaw = -90°?
- [x] Längs +x, åt höger; yaw = -90° ger (0, 0, -1), riktningen kameran tittade åt innan
- [ ] Längs -z; yaw = -90° vänder kameran upp och ned för att passa fönstrets y-axel
- [ ] Rakt upp längs +y; -90° lutar ned den till horisonten
---
cos 0 = 1 och sin 0 = 0, så riktningen är (1, 0, 0). Med yaw = -90° är cos(-90°) = 0 och sin(-90°) = -1: riktningen är (0, 0, -1), längs den negativa z-axeln, så scenen ser likadan ut som innan muskoden lades till.
```

## Musinmatning

Yaw- och pitch-värdena får vi från musens (eller en handkontrolls/joysticks) rörelser, där vågräta musrörelser
påverkar yaw och lodräta påverkar pitch. Idén är att spara musens position från förra bildrutan och i den aktuella
bildrutan räkna ut hur mycket den har ändrats. Ju större vågrät eller lodrät skillnad, desto mer uppdaterar vi pitch
eller yaw och desto mer ska kameran röra sig.

:::opengl vulkan
Först talar vi om för GLFW att den ska dölja markören och *fånga* den. Att fånga markören betyder att muspekaren,
när programmet har fokus, stannar i fönstrets mitt (tills programmet tappar fokus eller avslutas). Det gör vi med ett
enkelt konfigurationsanrop:

```cpp
    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```

Efter det här anropet syns musen inte, hur vi än flyttar den, och den ska inte kunna lämna fönstret. Det är perfekt
för ett FPS-kamerasystem. Med GLFW:s egna ord "hides and grabs the cursor, providing virtual and unlimited cursor
movement": den rapporterade positionen fortsätter växa förbi fönstrets kanter, så du kan fortsätta vrida dig åt
samma håll.

För att räkna ut pitch och yaw måste vi be GLFW lyssna på musrörelser. Det gör vi genom att skapa en callbackfunktion
med följande prototyp:

```cpp
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
```

Här är `xpos` och `ypos` musens aktuella position. Så snart vi har registrerat callbackfunktionen hos GLFW anropas
`mouse_callback` varje gång musen rör sig:

```cpp
    glfwSetCursorPosCallback(window, mouse_callback);
```
:::
:::d3d12
Win32 har inget läge för "inaktiverad markör" som GLFW, så vi bygger ett av tre delar:

- `ShowCursor(FALSE)` döljer markören. Projektet anropar den en gång, direkt efter `ShowWindow`.
- Windows skickar `WM_MOUSEMOVE` till fönstret när markören rör sig över det. Dess `lParam` innehåller markörens
  position i klientytan, i pixlar från övre vänstra hörnet. Läs den med `GET_X_LPARAM` och `GET_Y_LPARAM` från
  `<windowsx.h>`, inte med `LOWORD`/`HIWORD`: koordinaterna kan vara negativa på system med flera skärmar.
- Efter varje rörelse lägger vi tillbaka markören i fönstrets mitt med `SetCursorPos`, så att den aldrig når en kant
  – precis som med GLFW:s fångade markör kan musen fortsätta vrida kameran åt samma håll.

```cpp
        // Hide the cursor over the window: the mouse turns the camera now.
        ShowCursor(FALSE);
```

Matematiken hamnar i en fri funktion `OnMouseMove(float xpos, float ypos)` – motsvarigheten till learnopengls
`mouse_callback` – som `WindowProc` anropar för varje `WM_MOUSEMOVE`.

> Spel läser ofta muslook från *raw input* (`WM_INPUT`) i stället, som rapporterar musens egen rörelse i stället för
> markörpositioner. Markörvarianten här ligger närmare learnopengl och kräver ingen extra konfiguration.
:::

När vi hanterar musinmatning för en kamera i flygstil finns det flera steg vi måste ta innan vi kan räkna ut kamerans
riktningsvektor:

1. Räkna ut musens förflyttning sedan förra bildrutan.
2. Lägg till förflyttningen till kamerans yaw- och pitch-värden.
3. Lägg till begränsningar för pitchens minsta och största värde.
4. Räkna ut riktningsvektorn.

Första steget är att räkna ut musens förflyttning sedan förra bildrutan. Först måste vi spara musens senaste position
i programmet, och den initierar vi till skärmens mitt (skärmen är 800 gånger 600):

:::opengl d3d12
```cpp
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```
:::
:::vulkan
```cpp
float lastX =  WIDTH / 2.0f;
float lastY =  HEIGHT / 2.0f;
```
:::

Sedan räknar vi i musens callbackfunktion ut förflyttningen mellan förra och aktuella bildrutan:

```cpp
    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;
```

Observera att vi multiplicerar förflyttningen med ett värde `sensitivity`. Utan den multiplikationen skulle
musrörelserna bli alldeles för kraftiga; skruva på känsligheten tills du är nöjd. Y-förflyttningen är omvänd eftersom
fönsterkoordinater växer *nedåt*: när musen flyttas uppåt blir `ypos` mindre, och vi vill att det ska titta uppåt – en
positiv pitch.

Sedan lägger vi till förflyttningen till de globalt deklarerade värdena `pitch` och `yaw`:

```cpp
    yaw += xoffset;
    pitch += yoffset;
```

I tredje steget vill vi lägga till några begränsningar för kameran så att användaren inte kan göra konstiga
kamerarörelser (som också orsakar en LookAt-vändning när riktningsvektorn blir parallell med världens uppåtriktning).
Pitch måste begränsas så att användaren inte kan titta högre än 89 grader (vid 90 grader får vi LookAt-vändningen)
och inte heller lägre än -89 grader. Det gör att användaren kan titta upp mot himlen eller ned mot fötterna, men inte
längre. Vid exakt ±90 grader skulle riktningen vara parallell med uppåtvektorn, deras kryssprodukt – kamerans
högervektor – skulle bli noll, och look-at-matrisen skulle inte längre vara definierad. Begränsningarna fungerar så
att eulervärdet ersätts med gränsvärdet när det går över gränsen:

```cpp
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;
```

Observera att vi inte begränsar yaw, eftersom vi inte vill begränsa användaren i vågrät rotation. Det är dock lika
enkelt att lägga till en begränsning för yaw om du vill.

Det fjärde och sista steget är att räkna ut den faktiska riktningsvektorn med formeln från förra avsnittet och spara
den, normaliserad, i `cameraFront`. Tangenten `W` går då dit du tittar.

Om du kör koden nu märker du att kameran gör ett stort, plötsligt hopp första gången fönstret får fokus från
muspekaren. Orsaken är att så fort markören kommer in i fönstret anropas muscallbacken med `xpos` och `ypos` lika med
platsen där musen kom in i fönstret. Den ligger ofta långt från skärmens mitt, vilket ger stora förflyttningar och
därmed ett stort hopp. Vi kan komma runt problemet genom att definiera en global `bool`-variabel som håller reda på om
det är första gången vi får musinmatning. Om det är första gången sätter vi den sparade muspositionen till de nya
värdena `xpos` och `ypos`. Följande musrörelser använder då den nyss inkomna musens koordinater för att räkna ut
förflyttningarna:

```cpp
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }
```

Den slutliga koden blir då:

:::opengl
```cpp
// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    glm::vec3 front;
    front.x = cos(glm::radians(yaw)) * cos(glm::radians(pitch));
    front.y = sin(glm::radians(pitch));
    front.z = sin(glm::radians(yaw)) * cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}
```

Den hamnar i slutet av `main.cpp`, med en deklaration bredvid de andra överst i filen. De globala variablerna hamnar
under kameravektorerna:

```cpp
bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```

och de två GLFW-anropen hamnar direkt efter `glfwSetFramebufferSizeCallback`:

```cpp
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);

    // tell GLFW to capture our mouse
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```
:::
:::vulkan
```cpp
// glfw: whenever the mouse moves, this callback is called
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn) {
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    if (firstMouse) {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos; // reversed since window y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f; // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // make sure that when pitch is out of bounds, screen doesn't get flipped
    if (pitch > 89.0f) {
        pitch = 89.0f;
    }
    if (pitch < -89.0f) {
        pitch = -89.0f;
    }

    glm::vec3 front;
    front.x = std::cos(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    front.y = std::sin(glm::radians(pitch));
    front.z = std::sin(glm::radians(yaw)) * std::cos(glm::radians(pitch));
    cameraFront = glm::normalize(front);
}
```

Callbacken är en fri funktion på filnivå, före structen `PushConstants`, under de här globala variablerna:

```cpp
bool firstMouse = true;
float yaw   = -90.0f; // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  WIDTH / 2.0f;
float lastY =  HEIGHT / 2.0f;
```

GLFW anropar vanliga C-funktioner; den kan inte anropa en medlemsfunktion i `HelloTriangleApplication`.
vulkan-tutorial löser det för sin resize-callback med `glfwSetWindowUserPointer`, som sparar en pekare till
programmet i fönstret så att en statisk callback kan hämta tillbaka den med `glfwGetWindowUserPointer`. Med
kameratillståndet i globala variabler, som i learnopengl, behöver vi inte det. Registrera callbacken och fånga
markören i `initWindow()` direkt efter att fönstret skapats:

```cpp
        window = glfwCreateWindow(WIDTH, HEIGHT, "Vulkan", nullptr, nullptr);
        glfwSetCursorPosCallback(window, mouse_callback);

        // tell GLFW to capture our mouse
        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
```

GLFW anropar callbacken inifrån `glfwPollEvents()`, så `cameraFront` är uppdaterad innan `drawFrame()` bygger
vymatrisen.
:::
:::d3d12
```cpp
// Mouse look: WindowProc calls this whenever the mouse moves, with the cursor's
// position in the window's client area (in pixels from its top left corner).
void OnMouseMove(float xpos, float ypos)
{
    // The first time, the cursor can be anywhere: start from there instead of
    // jumping from (lastX, lastY).
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;    // reversed since y-coordinates go from top to bottom
    lastX = xpos;
    lastY = ypos;

    float sensitivity = 0.1f;    // change this value to your liking
    xoffset *= sensitivity;
    yoffset *= sensitivity;

    yaw += xoffset;
    pitch += yoffset;

    // Make sure that when pitch is out of bounds, the screen doesn't get flipped.
    if (pitch > 89.0f)
        pitch = 89.0f;
    if (pitch < -89.0f)
        pitch = -89.0f;

    XMVECTOR front = XMVectorSet(
        std::cos(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(pitch)),
        std::sin(XMConvertToRadians(yaw)) * std::cos(XMConvertToRadians(pitch)),
        0.0f);
    cameraFront = XMVector3Normalize(front);
}
```

Den hamnar före `WindowProc` (kommentaren `// Main message handler for the window.`), och de globala variablerna
hamnar under `keys`:

```cpp
// Mouse look: the camera's direction as two angles, in degrees.
bool firstMouse = true;
float yaw   = -90.0f;    // yaw is initialized to -90.0 degrees since a yaw of 0.0 results in a direction vector pointing to the right so we initially rotate a bit to the left.
float pitch =  0.0f;
float lastX =  800.0f / 2.0f;
float lastY =  600.0f / 2.0f;
```

`WindowProc` får ett nytt case. Det reagerar bara medan vårt fönster är förgrundsfönstret, så efter Alt+Tab är musen
fri igen. Det skickar positionen till `OnMouseMove` och fångar sedan markören:

```cpp
    case WM_MOUSEMOVE:
        // Only while the window is the active one, so the mouse is free otherwise.
        if (GetForegroundWindow() == hWnd)
        {
            int xpos = GET_X_LPARAM(lParam);
            int ypos = GET_Y_LPARAM(lParam);
            OnMouseMove(static_cast<float>(xpos), static_cast<float>(ypos));

            // Capture the cursor: put it back in the middle of the window, so it never
            // reaches an edge. lastX and lastY move with it, so the jump does not turn
            // the camera (the WM_MOUSEMOVE it causes has an offset of 0).
            RECT clientRect = {};
            GetClientRect(hWnd, &clientRect);
            POINT centre = { clientRect.right / 2, clientRect.bottom / 2 };
            if (xpos != centre.x || ypos != centre.y)
            {
                lastX = static_cast<float>(centre.x);
                lastY = static_cast<float>(centre.y);
                ClientToScreen(hWnd, &centre);
                SetCursorPos(centre.x, centre.y);
            }
        }
        return 0;
```

`GetClientRect` ger klientytans storlek, `ClientToScreen` gör om mittpunkten till skärmkoordinater, vilket är vad
`SetCursorPos` förväntar sig. När markören flyttas skickar Windows ett nytt `WM_MOUSEMOVE`, i mitten; eftersom
`lastX` och `lastY` först sattes till mitten blir dess förflyttning 0. Lägg till sist till `#include <windowsx.h>`
under `#include <windows.h>` för `GET_X_LPARAM` och `GET_Y_LPARAM`.
:::

Gör nu uppgiften **mouse-look**. Utan musrörelser ligger standardbilden kvar.

:::opengl vulkan
GLFW kan rapportera markörens position en gång när den fångas, men tack vare `firstMouse` sätter det bara `lastX` och
`lastY`, och den omräknade `cameraFront` skiljer sig från (0, 0, -1) bara genom avrundning.
:::
:::d3d12
`cameraFront` behåller värdet (0, 0, -1) fram till första `WM_MOUSEMOVE`, och tack vare `firstMouse` sätter även det
bara `lastX` och `lastY`.
:::

På din egen dator försvinner markören, när du flyttar musen åt höger vrids vyn åt höger (scenen glider åt vänster),
när du flyttar den uppåt tittar du uppåt – men aldrig längre än ±89° – och W går nu dit du tittar.

:::opengl vulkan
```quiz
Vad gör `glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED)` för muslooken?
- [x] Den döljer markören och håller den i fönstret; GLFW rapporterar en virtuell, obegränsad markörposition, så kameran kan fortsätta vrida sig utan att markören stannar vid fönstrets kant
- [ ] Den stänger av callbacken för markörpositionen tills användaren klickar i fönstret
- [ ] Den spikar fast markören i fönstrets mitt, så att `mouse_callback` alltid får 400 och 300
---
Positionerna som skickas till `mouse_callback` fortsätter att ändras – det är så callbacken räknar ut sina förflyttningar – men de begränsas inte längre av fönstret. Utan fångad markör skulle markören stanna vid skärmkanten, och kameran med den.
```
:::
:::d3d12
```quiz
Hanteraren för `WM_MOUSEMOVE` lägger tillbaka markören i fönstrets mitt med `SetCursorPos` och sätter innan dess `lastX` och `lastY` till mitten. Varför flyttas `lastX` och `lastY` också?
- [x] `SetCursorPos` orsakar ett nytt `WM_MOUSEMOVE` i mitten; med `lastX`/`lastY` redan där blir dess förflyttning 0, så hoppet tillbaka vrider inte kameran
- [ ] `SetCursorPos` flyttar bara markören till positionen som är lagrad i `lastX` och `lastY`
- [ ] Det sätter `firstMouse` till `true` igen, så att nästa rörelse börjar om
---
Utan det skulle varje verklig rörelse följas av en lika stor rörelse tillbaka till mitten, och kameran skulle vrida sig tillbaka dit den var.
```
:::

## Zoom

Som en liten extra finess i kamerasystemet implementerar vi också zoomning. I förra kapitlet sa vi att *synfältet*
(*field of view*, *fov*) i hög grad avgör hur mycket av scenen vi ser. När synfältet blir mindre blir scenens
projicerade rymd mindre. Den mindre rymden projiceras över samma NDC, vilket ger illusionen av att zooma in. För att
zooma använder vi musens scrollhjul.

:::opengl
Precis som för musrörelser och tangentbordsinmatning finns det en callbackfunktion för musens scrollning:

```cpp
// glfw: whenever the mouse scroll wheel scrolls, this callback is called
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    fov -= (float)yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}
```

Den hamnar i slutet av `main.cpp`, med en deklaration överst bredvid de andra.
:::
:::vulkan
Precis som för musrörelser och tangentbordsinmatning finns det en callbackfunktion för musens scrollning, återigen en
fri funktion före structen `PushConstants`:

```cpp
// glfw: whenever the mouse scroll wheel scrolls, this callback is called
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset) {
    fov -= static_cast<float>(yoffset);
    if (fov < 1.0f) {
        fov = 1.0f;
    }
    if (fov > 45.0f) {
        fov = 45.0f;
    }
}
```
:::
:::opengl vulkan
Vid scrollning anger `yoffset` hur mycket vi scrollade lodrätt – positivt när hjulet vrids uppåt, bort från dig. När
`scroll_callback` anropas ändrar vi innehållet i den globalt deklarerade variabeln `fov`, som börjar på 45 och hamnar
under `lastY`:

```cpp
float fov   =  45.0f;
```

Eftersom 45 är standardvärdet för fov vill vi begränsa zoomnivån till mellan 1.0 och 45.0. Vi måste också registrera
scroll-callbacken, direkt efter callbacken för markörpositionen:

```cpp
    glfwSetScrollCallback(window, scroll_callback);
```
:::
:::d3d12
Windows rapporterar scrollhjulet med `WM_MOUSEWHEEL`. Det höga ordet i dess `wParam` – läs det med
`GET_WHEEL_DELTA_WPARAM` – är hur långt hjulet vreds, i multipler av `WHEEL_DELTA` (120) per hack: positivt när det
vrids bort från dig, negativt mot dig. Att dela med `WHEEL_DELTA` ger learnopengls `yoffset` på 1 per hack (hjul med
finare upplösning skickar mindre värden):

```cpp
    case WM_MOUSEWHEEL:
        // One notch of the wheel is WHEEL_DELTA (120); a fine wheel sends less.
        OnMouseWheel(static_cast<float>(GET_WHEEL_DELTA_WPARAM(wParam)) / WHEEL_DELTA);
        return 0;
```

`OnMouseWheel`, bredvid `OnMouseMove`, ändrar den globalt deklarerade `fov`, som börjar på 45:

```cpp
// Zoom: WindowProc calls this when the mouse wheel turns, with the number of notches
// (positive: turned away from you, which zooms in).
void OnMouseWheel(float yoffset)
{
    fov -= yoffset;
    if (fov < 1.0f)
        fov = 1.0f;
    if (fov > 45.0f)
        fov = 45.0f;
}
```

```cpp
// Zoom: the field of view, in degrees.
float fov   =  45.0f;
```

Eftersom 45 är standardvärdet för fov vill vi begränsa zoomnivån till mellan 1.0 och 45.0.
:::

Nu måste vi skicka perspektivprojektionsmatrisen till GPU:n varje bildruta, men den här gången med variabeln `fov`
som synfält:

:::opengl
```cpp
        projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
```

Projektet sätter redan projektionen varje bildruta. Den gamla anmärkningen ovanför
`ourShader.setMat4("projection", projection)`, som föreslog att den bara skulle sättas en gång utanför loopen, gäller
inte längre: ersätt den med en kommentar om att projektionen nu ändras när fov ändras (zoom) och därför sätts varje
bildruta.
:::
:::vulkan
```cpp
        ubo.proj = glm::perspective(glm::radians(fov), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
```

`updateUniformBuffer()` bygger redan om båda matriserna varje bildruta, så det här är den enda ändringen.
:::
:::d3d12
```cpp
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(fov), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);
```

`OnUpdate` bygger redan om projektionen varje bildruta, så det här är den enda ändringen där.
:::

Gör nu uppgiften **zoom**. Utan scrollning förblir fov 45 och du ser standardbilden. På din egen dator zoomar
scrollning uppåt in (mindre fov, större lådor) ned till ett synfält på 1°, och scrollning nedåt zoomar ut igen, som
mest tillbaka till 45°. Och där har du det: ett enkelt kamerasystem som låter dig röra dig fritt i en 3D-miljö.

```quiz
Tre hack uppåt med scrollhjulet ändrar `fov` från 45 till 42. Vad händer med bilden?
- [x] Lådorna ser lite större ut: ett mindre synfält projicerar en mindre del av scenen på samma fönster
- [ ] Lådorna ser mindre ut, eftersom ett mindre synfält flyttar kameran bakåt
- [ ] Ingenting, förrän programmet startas om och projektionsmatrisen skapas på nytt
---
Kameran flyttar sig inte – bara projektionen ändras. En smalare vyvolym sträcks ut över samma normaliserade enhetskoordinater, så allt i den ritas större. Eftersom projektionsmatrisen byggs om från `fov` varje bildruta syns ändringen direkt.
```

Experimentera gärna lite, och om du kör fast kan du jämföra din kod med lösningen.

> Observera att ett kamerasystem med eulervinklar ändå inte är perfekt. Beroende på dina begränsningar och din
> uppställning kan det fortfarande uppstå gimbal lock. Det bästa kamerasystemet byggs med kvaternioner, men det får
> vänta till ett senare ämne.

## Kameraklass

I de kommande kapitlen använder vi alltid en kamera för att enkelt se oss omkring i scenerna och se resultaten från
alla vinklar. Eftersom kamerakoden kan ta upp en hel del plats i varje kapitel abstraherar vi dock bort detaljerna
lite och skapar ett eget kameraobjekt som gör det mesta av jobbet åt oss, med några trevliga extrafunktioner.
learnopengl gör det med en klass `Camera` i `camera.h`. Det här steget är **valfritt** i kursen: projekten behåller de
globala variabler och fria funktioner du just skrev, så om du skriver klassen blir dina bilder desamma.

:::opengl vulkan
Precis som Shader-objektet definieras kameraklassen helt i en enda headerfil. I stora drag:

```cpp
// Defines several possible options for camera movement. Used as abstraction to stay away from window-system specific input methods
enum Camera_Movement {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT
};

// Default camera values
const float YAW         = -90.0f;
const float PITCH       =  0.0f;
const float SPEED       =  2.5f;
const float SENSITIVITY =  0.1f;
const float ZOOM        =  45.0f;

class Camera
{
public:
    // camera Attributes
    glm::vec3 Position;
    glm::vec3 Front;
    glm::vec3 Up;
    glm::vec3 Right;
    glm::vec3 WorldUp;
    // euler Angles
    float Yaw;
    float Pitch;
    // camera options
    float MovementSpeed;
    float MouseSensitivity;
    float Zoom;

    // returns the view matrix calculated using Euler Angles and the LookAt Matrix
    glm::mat4 GetViewMatrix()
    {
        return glm::lookAt(Position, Position + Front, Up);
    }

    void ProcessKeyboard(Camera_Movement direction, float deltaTime);
    void ProcessMouseMovement(float xoffset, float yoffset, bool constrainPitch = true);
    void ProcessMouseScroll(float yoffset);

private:
    // calculates the front vector from the Camera's (updated) Euler Angles
    void updateCameraVectors();
};
```

Funktionskropparna är koden du skrev: `ProcessKeyboard` flyttar `Position` med `MovementSpeed * deltaTime` längs
`Front` eller `Right`, `ProcessMouseMovement` tillämpar känsligheten, lägger till förflyttningarna till `Yaw` och
`Pitch` och begränsar pitch, och `ProcessMouseScroll` ändrar `Zoom` mellan 1 och 45. En sak är ny:
`updateCameraVectors` räknar också ut kamerans egna vektorer `Right` och `Up` från `Front` och `WorldUp`:

```cpp
        Right = glm::normalize(glm::cross(Front, WorldUp));  // normalize the vectors, because their length gets closer to 0 the more you look up or down which results in slower movement.
        Up    = glm::normalize(glm::cross(Right, Front));
```

Programmet har sedan en `Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));`, använder `camera.GetViewMatrix()` och
`glm::radians(camera.Zoom)` till sina matriser, anropar `camera.ProcessKeyboard(FORWARD, deltaTime)` och de andra från
sin tangenthantering, och skickar förflyttningarna till `camera.ProcessMouseMovement` och `camera.ProcessMouseScroll`
från GLFW-callbackarna.
:::
:::vulkan
I Vulkan-projektet är det naturliga stället för den en medlem `Camera camera;` i `HelloTriangleApplication`.
GLFW-callbackarna kan då nå den på samma sätt som vulkan-tutorials resize-callback når programmet: spara `this` med
`glfwSetWindowUserPointer(window, this)` och hämta tillbaka den i callbacken med
`reinterpret_cast<HelloTriangleApplication*>(glfwGetWindowUserPointer(window))`.
:::
:::d3d12
Med DirectXMath ser klassen likadan ut: `XMVECTOR`-medlemmarna `Position`, `Front`, `Up`, `Right` och `WorldUp`,
vinklarna `Yaw` och `Pitch`, och inställningarna `MovementSpeed`, `MouseSensitivity` och `Zoom`, med:

- `GetViewMatrix()` som returnerar `XMMatrixLookAtRH(Position, Position + Front, Up)`;
- `ProcessKeyboard(direction, deltaTime)` som flyttar `Position` längs `Front` eller `Right` med
  `MovementSpeed * deltaTime`;
- `ProcessMouseMovement(xoffset, yoffset)` som tillämpar känsligheten, ändrar `Yaw` och `Pitch`, begränsar pitch och
  anropar `updateCameraVectors()`;
- `ProcessMouseScroll(yoffset)` som ändrar `Zoom` mellan 1 och 45;
- `updateCameraVectors()` som räknar ut `Front` från vinklarna, och sedan
  `Right = XMVector3Normalize(XMVector3Cross(Front, WorldUp))` och `Up = XMVector3Normalize(XMVector3Cross(Right, Front))`.

Ett naturligt ställe för den är en medlem i `D3D12App`, med publika metoder `OnKeyDown`/`OnKeyUp`/`OnMouseMove`/
`OnMouseWheel` som `WindowProc` anropar via pekaren som sparats med `SetWindowLongPtr(hwnd, GWLP_USERDATA, …)` – på
samma sätt som Microsofts exempel lämnar över inmatning till sin `SimpleCamera`. Observera att `SimpleCamera` är en
kamera som bara styrs med tangentbordet (piltangenterna vrider den) och har en egen konvention för yaw, så dess kod
motsvarar inte det här kapitlet rad för rad.
:::

En kameraklass ger dig ett ställe för allt kameratillstånd och ett gränssnitt, vilket är praktiskt när flera program
delar samma kamera. De globala variablerna du skrev gör exakt samma jobb, och därför behåller kursen dem.

## Övningar

- Se om du kan göra om kameran så att den blir en **riktig FPS-kamera** där du inte kan flyga; du kan bara se dig
  omkring medan du stannar på xz-planet.
- Försök skapa en **egen LookAt-funktion** där du själv bygger en vymatris som beskrevs i början av kapitlet. Ersätt
  bibliotekets look-at-funktion med din egen implementation och se om den fortfarande beter sig likadant. Prova också
  med den cirklande kameran, där varje bildruta ger en annan matris.

Det här är inga uppgifter i projektet: prova dem när du är klar med uppgifterna, och använd **Build & run** för att
jämföra bilderna.

:::opengl vulkan
För den första övningen, sätt `cameraPos.y = 0.0f;` efter kontrollerna av W/A/S/D – du kan fortfarande titta uppåt
och nedåt, men när du går lämnar du aldrig marken.
:::
:::d3d12
För den första övningen, sätt `cameraPos = XMVectorSetY(cameraPos, 0.0f);` efter kontrollerna av W/A/S/D i
`OnUpdate` – du kan fortfarande titta uppåt och nedåt, men när du går lämnar du aldrig marken.
:::

:::opengl vulkan
För den andra övningen är det här learnopengls lösning. GLM lagrar matriser kolumn för kolumn, så `mat[col][row]` är
elementet i kolumn `col` och rad `row`:

```cpp
glm::mat4 calculate_lookAt_matrix(glm::vec3 position, glm::vec3 target, glm::vec3 worldUp)
{
    // 1. Position = known
    // 2. Calculate cameraDirection
    glm::vec3 zaxis = glm::normalize(position - target);
    // 3. Get positive right axis vector
    glm::vec3 xaxis = glm::normalize(glm::cross(glm::normalize(worldUp), zaxis));
    // 4. Calculate camera up vector
    glm::vec3 yaxis = glm::cross(zaxis, xaxis);

    // Create translation and rotation matrix
    // In glm we access elements as mat[col][row] due to column-major layout
    glm::mat4 translation = glm::mat4(1.0f); // Identity matrix by default
    translation[3][0] = -position.x; // Fourth column, first row
    translation[3][1] = -position.y;
    translation[3][2] = -position.z;
    glm::mat4 rotation = glm::mat4(1.0f);
    rotation[0][0] = xaxis.x; // First column, first row
    rotation[1][0] = xaxis.y;
    rotation[2][0] = xaxis.z;
    rotation[0][1] = yaxis.x; // First column, second row
    rotation[1][1] = yaxis.y;
    rotation[2][1] = yaxis.z;
    rotation[0][2] = zaxis.x; // First column, third row
    rotation[1][2] = zaxis.y;
    rotation[2][2] = zaxis.z;

    // Return lookAt matrix as combination of translation and rotation matrix
    return rotation * translation; // Remember to read from right to left (first translation then rotation)
}
```
:::
:::d3d12
För den andra övningen är det här ett sätt att skriva den med DirectXMath. Kom ihåg att DirectXMath arbetar med
radvektorer, så rotationen är transponatet av matrisen i texten (axlarna blir dess kolumner), och produkten läses från
vänster till höger:

```cpp
XMMATRIX MyLookAtRH(FXMVECTOR position, FXMVECTOR target, FXMVECTOR worldUp)
{
    XMVECTOR zaxis = XMVector3Normalize(position - target);                                // the camera direction
    XMVECTOR xaxis = XMVector3Normalize(XMVector3Cross(XMVector3Normalize(worldUp), zaxis)); // the right axis
    XMVECTOR yaxis = XMVector3Cross(zaxis, xaxis);                                          // the up axis

    // The three axes as rows, then transposed: as columns, for row vectors.
    XMMATRIX rotation = XMMatrixTranspose(XMMATRIX(xaxis, yaxis, zaxis, XMVectorSet(0.0f, 0.0f, 0.0f, 1.0f)));
    XMMATRIX translation = XMMatrixTranslationFromVector(-position);

    return translation * rotation; // row vectors: first the translation, then the rotation
}
```

Den förutsätter att w-komponenterna i de tre axlarna är 0, vilket gäller för vektorer som skapats med
`XMVectorSet(…, 0.0f)` som i projektet.
:::

Grattis – nu kan du flyga genom din scen. Det här är sista kapitlet i *Getting started*: du har ett fönster, shaders,
texturer, transformationer, en 3D-scen och en kamera att titta på den med – allt som de kommande kapitlen bygger på.
