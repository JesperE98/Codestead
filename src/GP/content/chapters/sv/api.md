# {{api}}

Innan du skriver någon kod är det bra att veta vad {{api}} egentligen är, hur det är organiserat och vilken sorts
programmering det kräver av dig. Det här kapitlet har inga uppgifter: det är teorin du behöver för de kommande
kapitlen. Projektet till höger är fortfarande triangelprogrammet från introduktionen, så du kan bygga och köra det
och hitta koden som kapitlet pratar om.

:::opengl
## Vad OpenGL är

Man brukar kalla OpenGL för ett API (ett *Application Programming Interface*): en stor uppsättning funktioner för
att rita grafik. Strikt talat är OpenGL dock inte något bibliotek alls, utan en **specifikation**, som skrivs och
underhålls av [Khronos Group](https://www.khronos.org/opengl/).

Specifikationen anger exakt vad varje funktion ska göra och vad resultatet måste bli – men inte *hur* det ska
uppnås. Den delen lämnas åt den som *implementerar* specifikationen. Två implementationer kan fungera helt olika
inuti, så länge du som användare får de resultat som specifikationen lovar.

I praktiken skrivs implementationerna av grafikkortstillverkarna och levereras som en del av deras drivrutiner;
varje kort stöder vissa OpenGL-versioner. På macOS underhåller Apple implementationen själv, och på Linux finns både
tillverkarnas drivrutiner och implementationer med öppen källkod. När du anropar `glDrawArrays` är det alltså
drivrutinens kod som körs. En följd av det: när OpenGL gör något konstigt som specifikationen inte tillåter är
orsaken troligen en bugg i drivrutinen, och den vanliga lösningen är att installera en nyare drivrutin. Det är ett
av skälen till att det är bra att hålla grafikdrivrutinerna uppdaterade.

Khronos publicerar specifikationerna för alla OpenGL-versioner öppet i
[OpenGL registry](https://registry.khronos.org/OpenGL/index_gl.php). Om du vill veta exakt hur en funktion beter
sig är specifikationen för version 3.3 (den som kursen använder) en bra, om än teknisk, referens.

```quiz
Vad är OpenGL, strikt talat?
- [x] En specifikation: den säger vad varje funktion måste göra, och grafikkortstillverkarna implementerar den i sina drivrutiner
- [ ] Ett bibliotek skrivet av Khronos Group som du installerar bredvid ditt program
- [ ] En del av operativsystemet som fungerar likadant på alla grafikkort
---
OpenGL i sig är bara en specifikation. Koden som körs när du anropar `glDrawArrays` är drivrutinens implementation, och därför åtgärdas buggar i OpenGL oftast genom att uppdatera drivrutinen.
```

## Core profile kontra immediate mode

Äldre OpenGL användes i **immediate mode**, ofta kallat *fixed-function pipeline*. Du beskrev din geometri hörn för
hörn med enkla anrop, och biblioteket gjorde det mesta av arbetet i det dolda: hur hörnen transformerades och
belystes var i stort sett fastlagt, och du kunde bara slå på och av alternativ. Det var lätt att lära sig, men det
var ineffektivt och gav dig liten kontroll. När grafikhårdvaran blev programmerbar ville utvecklarna ha den
kontrollen, och specifikationen blev mer flexibel. OpenGL 3.0 markerade den gamla immediate mode-funktionaliteten
som föråldrad (deprecated), och sedan version 3.2 är specifikationen uppdelad i profiler: **core profile** innehåller
bara den moderna funktionaliteten, utan de föråldrade delarna.

I en core profile-kontext finns de föråldrade funktionerna helt enkelt inte, och att använda dem är ett fel, så du
tvingas arbeta på det moderna sättet: du lägger dina data i buffrar på GPU:n och skriver shaders som bearbetar dem.
Det är svårare i början än immediate mode, som dolde vad OpenGL faktiskt gör. Men det är mycket mer flexibelt och
effektivt, och eftersom inget är dolt förstår du till slut verkligen hur grafikprogrammering fungerar.

Det är också anledningen till att den här kursen är inriktad på core profile i OpenGL **version 3.3**. Du ser
begäran om just det i projektet, direkt efter att GLFW har initierats:

```cpp
glfwInit();
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
```

Senare versioner av OpenGL, upp till 4.6, lägger till användbara funktioner utan att ändra grundmekanismerna: de
erbjuder effektivare eller bekvämare sätt att göra samma saker. Allt du lär dig med 3.3 gäller därför fortfarande,
och när du är redo kan du ta till den nyare funktionaliteten där du behöver den. Tänk på att ju nyare version du
kräver, desto färre grafikkort kan köra ditt program – därför riktar sig många program mot en äldre version och
använder bara nyare funktioner när de finns.

```quiz
Ditt program ber om en OpenGL 3.3-kontext med core profile. Vad händer med de gamla immediate mode-funktionerna?
- [ ] De fungerar fortfarande, men går långsammare
- [x] De ingår inte i core profile: de finns inte tillgängliga, och att försöka använda dem är ett fel
- [ ] Drivrutinen gör automatiskt om dem till moderna anrop
---
Core profile är den del av specifikationen som saknar den föråldrade funktionaliteten. Det tvingar dig att använda det moderna, flexibla sättet att rita – vilket är det som kursen lär ut.
```

## Extensions

OpenGL kan byggas ut. När en tillverkare tar fram en ny renderingsteknik eller optimering levereras den ofta som en
**extension** i drivrutinen innan den ingår i någon OpenGL-version. Ett program kan använda den funktionaliteten på
hårdvara vars drivrutin erbjuder extensionen, utan att vänta på nästa version av specifikationen. Användbara
extensions tas ofta upp i senare OpenGL-versioner; mycket av det som är core i 3.3 började som en extension.

Eftersom inte alla drivrutiner erbjuder alla extensions måste ett program kontrollera att en extension finns innan
det använder den, och falla tillbaka på ett annat sätt när den saknas. Funktionsladdare som GLAD, som kursen
använder, kan genereras med de extensions du vill ha och talar då om vid körning vilka av dem som finns. För de
flesta tekniker i kursen räcker OpenGL 3.3; där en extension behövs säger kapitlet det.

```quiz
Vad är en extension i OpenGL?
- [ ] En nyare OpenGL-version som alla grafikkort stöder
- [x] Funktionalitet som en drivrutin erbjuder utöver core-specifikationen, och som ditt program måste kontrollera innan det använder den
- [ ] En filtyp för OpenGL-shaders
---
Extensions låter tillverkare leverera nya funktioner innan de ingår i specifikationen. Eftersom inte alla drivrutiner har dem kontrollerar du att en extension finns innan du använder den; populära extensions blir ofta en del av en senare OpenGL-version.
```

## Tillståndsmaskin

OpenGL är en enda stor **tillståndsmaskin** (state machine): en stor samling inställningar som avgör hur OpenGL
arbetar just nu. Det här tillståndet kallas OpenGL-**kontexten** (context). Att arbeta med OpenGL innebär mest att
ändra tillståndet – ställa in alternativ, binda buffrar – och sedan ge kommandon som arbetar med det tillstånd som
gäller för tillfället.

Säg att du vill rita linjer i stället för fyllda trianglar: du ändrar en inställning i kontexten, och från och med
då ritar varje ritkommando linjer, tills du ändrar tillbaka inställningen. Inget skickas med i själva ritanropet;
det använder helt enkelt det aktuella tillståndet.

OpenGL-funktioner finns därför i två sorter: **tillståndsändrande** funktioner som ställer in något i kontexten,
och **tillståndsanvändande** funktioner som utför något arbete utifrån det aktuella tillståndet. Projektets
render loop har en av varje:

```cpp
glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);
```

`glClearColor` ritar ingenting: den ställer bara in rensningsfärgen (clear color) i kontexten. `glClear`
*använder* sedan det tillståndet och fyller fönstret med den färg som är inställd. Behåll bilden av en enda stor
tillståndsmaskin i huvudet, så blir mycket av OpenGL:s uppbyggnad begriplig.

```quiz
I render loopen följs `glClearColor(0.2f, 0.3f, 0.3f, 1.0f);` av `glClear(GL_COLOR_BUFFER_BIT);`. Vilket påstående stämmer?
- [ ] Båda anropen fyller fönstret, så ett av dem kunde tas bort
- [x] `glClearColor` ändrar bara tillståndet (rensningsfärgen); `glClear` använder det tillståndet och fyller fönstret med det
- [ ] `glClearColor` fyller fönstret, och `glClear` gör resultatet synligt
---
`glClearColor` är en tillståndsändrande funktion och `glClear` en tillståndsanvändande. Färgen ligger kvar i kontexten tills du ändrar den igen.
```

## Objekt

OpenGL:s gränssnitt är ett C-gränssnitt, så att det kan anropas från många språk. Det har därför inga klasser; i
stället samlar det tillstånd som hör ihop i **objekt**. Ett OpenGL-objekt är en samling inställningar (och ofta
data) som utgör en del av tillståndet: ett *buffer object* är en bit GPU-minne med sina inställningar, och ett
*vertex array object* kommer ihåg hur hörndata i buffrar är ordnade. Du får aldrig en pekare eller ett C++-objekt
för dem: OpenGL ger dig ett nummer, ett **id**, som refererar till objektet.

Att använda ett objekt följer nästan alltid samma mönster: du *genererar* objektet och sparar dess id, du *binder*
det till ett mål (target) i kontexten, du ställer in dess alternativ eller data via det målet, och du binder loss
det igen genom att binda id 0. Det är precis vad projektet gör med sina hörndata:

```cpp
unsigned int VBO, VAO;
glGenVertexArrays(1, &VAO);
glGenBuffers(1, &VBO);
// bind the Vertex Array Object first, then bind and set vertex buffer(s), and then configure vertex attributes(s).
glBindVertexArray(VAO);

glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
```

`glGenBuffers` skapar ett buffer object och sparar dess id i `VBO`. `glBindBuffer(GL_ARRAY_BUFFER, VBO)` binder det
till målet `GL_ARRAY_BUFFER`, och från och med då arbetar varje anrop som gäller `GL_ARRAY_BUFFER` på *den här*
buffern: `glBufferData` kopierar in hörnen i den, utan att ens nämna `VBO`. Efteråt binder projektet loss den:

```cpp
glBindBuffer(GL_ARRAY_BUFFER, 0);
```

Poängen med objekt är att du kan skapa så många du vill, ställa in vart och ett en gång och senare bara binda det du
behöver. Ett program som ritar ett hus och en figur har varje modells data och inställningar i egna objekt; för att
rita en av dem binder det den modellens objekt och ritar, utan att ställa in alla alternativ igen.

```quiz
Vad gör `glBindBuffer(GL_ARRAY_BUFFER, VBO);`?
- [ ] Den kopierar hörndata till GPU:n
- [x] Den gör buffern med id `VBO` till aktuell `GL_ARRAY_BUFFER`, så att följande anrop på det målet arbetar på den
- [ ] Den skapar ett nytt buffer object
---
Att binda kopplar ett objekt till ett mål i kontexten. `glGenBuffers` skapar objektet, och `glBufferData` kopierar data till den buffer som är bunden till målet.
```
:::
:::vulkan
## Vad Vulkan är

Vulkan är ett API för grafik och beräkningar från [Khronos Group](https://www.khronos.org/), samma konsortium som
underhåller OpenGL. Liksom OpenGL är det en **specifikation**: Khronos beskriver exakt vad varje funktion måste
göra, och grafikkortstillverkarna implementerar den i sina drivrutiner. Ditt program pratar med drivrutinerna via
**Vulkan-loadern**, som hittar de installerade drivrutinerna och de valfria lagren (layers). Vulkan 1.0 släpptes
2016; nyare versioner (1.1, 1.2, 1.3, 1.4) har lagt till funktioner, men grundmodellen du lär dig här är densamma i
alla. Precis som vulkan-tutorial.com ber projektet om version 1.0 (`VK_API_VERSION_1_0`), eftersom allt det använder
har funnits sedan dess.

Vulkan körs på Windows, Linux och Android; på macOS och iOS körs det ovanpå Apples Metal via ett
översättningslager (MoltenVK).

## Varför Vulkan finns

OpenGL och de tidiga versionerna av Direct3D konstruerades när GPU:er i stort sett var hårdvara med fasta
funktioner och några få inställningar. Sedan blev GPU:erna mycket programmerbara, och de gamla API:erna byggdes ut
gång på gång för att ge tillgång till de nya funktionerna. Resultatet blev en abstraktion som inte längre stämde med
hårdvaran: drivrutinen fick utifrån en ström av tillståndsändringar lista ut vad programmet egentligen menade och
sedan översätta det till det som GPU:n behöver. Den gissningen kostar CPU-tid, och det är därför nya drivrutiner så
ofta ger stora prestandaförbättringar i vissa spel. Den gör också drivrutinerna komplexa, så beteendet skiljer sig
mellan tillverkare – till exempel i vilken shaderkod deras kompilatorer accepterar. Och eftersom OpenGL har allt sitt
tillstånd i en enda kontext som hör till en tråd är det svårt att använda flera CPU-trådar för att förbereda arbete
åt GPU:n.

Vulkan konstruerades från grunden för moderna GPU:er, även de tile-baserade GPU:erna i mobiler. Det är
**explicit**: du beskriver exakt och i detalj vad du vill, så drivrutinen behöver inte gissa och kan bli mycket
enklare och snabbare. Flera trådar kan spela in och skicka kommandon parallellt. Shaders lämnas till drivrutinen
som en standardiserad bytekod, SPIR-V, i stället för som källkod, vilket tar bort skillnaderna mellan
tillverkarnas kompilatorer. Och grafik och beräkningar går genom samma API.

```quiz
Varför konstruerades Vulkan som ett explicit API?
- [ ] Eftersom det bara behöver köras på Windows
- [ ] För att den första triangeln ska bli kortare att skriva än i OpenGL
- [x] Så att drivrutinen inte längre behöver gissa vad programmeraren menar: du säger exakt vad du vill, vilket minskar drivrutinens overhead och gör att kommandon kan spelas in på flera trådar
---
Äldre API:er lät drivrutinen lista ut vad du menade, vilket kostade prestanda och gav skillnader mellan tillverkare. Vulkan låter dig säga det rakt ut – mer kod, men förutsägbart beteende.
```

## Objekt och create infos

Vulkan har inget dolt globalt tillstånd som OpenGL:s kontext. Allt är explicita objekt med en handle-typ
(`VkInstance`, `VkDevice`, `VkBuffer` …), och du skickar med de objekt du menar till varje funktion. Objekt skapas
med `vkCreateXXX` (eller allokeras från ett annat objekt med `vkAllocateXXX`) och förstörs med `vkDestroyXXX`
(eller `vkFreeXXX`). Parametrarna skickas i en *create info*-struktur: du fyller i en struct, sätter dess medlem
`sType` för att tala om vilken struktur det är, och skickar en pekare till den. Så här beskriver projektet
applikationen och skapar **instansen** (instance), kopplingen mellan ditt program och Vulkan-biblioteket:

```cpp
VkApplicationInfo appInfo{};
appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
appInfo.pApplicationName = "Hello Triangle";
appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.pEngineName = "No Engine";
appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
appInfo.apiVersion = VK_API_VERSION_1_0;

VkInstanceCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
createInfo.pApplicationInfo = &appInfo;
```

```cpp
if (vkCreateInstance(&createInfo, nullptr, &instance) != VK_SUCCESS) {
    throw std::runtime_error("failed to create instance!");
}
```

Nästan varje funktion returnerar ett `VkResult` som är antingen `VK_SUCCESS` eller en felkod; projektet gör om fel
till undantag. `nullptr` är en valfri egen minnesallokerare för drivrutinens minne på CPU-sidan, som kursen aldrig
använder. Allt du skapar förstör du också själv: `cleanup()` förstör alla objekt i omvänd ordning.

## Det som krävs för att rita en triangel

Här är alla steg som krävs för att rendera en triangel i ett välskrivet Vulkan-program. Du bygger vart och ett av
dem i de kommande kapitlen; det här är bara helhetsbilden att relatera dem till. Det är listan med anrop i
projektets `initVulkan()`:

```cpp
void initVulkan() {
    createInstance();
    setupDebugMessenger();
    createSurface();
    pickPhysicalDevice();
    createLogicalDevice();
    createSwapChain();
    createImageViews();
    createRenderPass();
    createGraphicsPipeline();
    createFramebuffers();
    createCommandPool();
    createVertexBuffer();
    createCommandBuffer();
    createSyncObjects();
}
```

- **Instance och physical device.** Efter `VkInstance` letar du efter grafikkorten med stöd för Vulkan och väljer
  ett: en `VkPhysicalDevice`. Du kan fråga efter dess egenskaper och funktioner för att välja det bästa.
- **Logical device och köer.** Sedan skapar du en `VkDevice`, den *logiska enheten* (logical device): din koppling
  till det valda kortet, med de funktioner du vill använda påslagna. Det mesta arbetet i Vulkan – att rita, att
  flytta minne – utförs inte direkt utan skickas till en `VkQueue`. Köerna kommer från *queue families*, som var och
  en stöder en viss uppsättning operationer (grafik, beräkningar, överföring, presentation). Projektet behöver en
  kö som kan rita och en som kan presentera i fönstret (ofta samma family).
- **Window surface och swap chain.** Vulkan självt vet ingenting om fönster. `VkSurfaceKHR` (som GLFW gör av
  fönstret) och `VkSwapchainKHR` kommer från *extensions* för integration med fönstersystemet – det är vad
  suffixet `KHR` betyder. Swap chainen är en uppsättning bilder att rendera i; medan du ritar i en visas en annan på
  skärmen.
- **Image views och framebuffers.** En bild från swap chainen kapslas in i en `VkImageView` (vilken del av bilden
  som används, och hur) och en `VkFramebuffer` (vilka image views render passet ritar i).
- **Render pass.** Ett `VkRenderPass` beskriver bilderna som används under renderingen och vad som händer med deras
  innehåll – här: en färgbild som rensas i början.
- **Grafikpipeline.** `VkPipeline` innehåller *allt* inställbart tillstånd i GPU:n: shaderna, hörnens layout,
  viewporten, rasteriseringen, blandningen. Nästan inget kan ändras efteråt; en annan konfiguration är en annan
  pipeline. Det låter drivrutinen kompilera och optimera allt i förväg.
- **Command pool och command buffers.** Ritkommandon spelas in i en `VkCommandBuffer`, som allokeras från en
  `VkCommandPool`.
- **Huvudloopen.** Varje bildruta hämtar `drawFrame()` en bild från swap chainen, spelar in en command buffer som
  ritar i den, skickar den till grafikkön och presenterar bilden.

Till och med minnet för vertex buffern är explicit: projektet skapar `VkBuffer`, frågar vilka minnestyper den kan
ligga i, allokerar själv ett `VkDeviceMemory` och binder ihop de två.

```quiz
Vad är skillnaden mellan en `VkPhysicalDevice` och en `VkDevice`?
- [x] Physical device är ett grafikkort du kan välja; logical device är din koppling till det, med de funktioner och köer du bad om
- [ ] De är två namn på samma objekt
- [ ] Physical device är till för att rita, logical device för att presentera i fönstret
---
Du väljer en `VkPhysicalDevice` med `pickPhysicalDevice()` och skapar sedan en `VkDevice` för den i `createLogicalDevice()`. Nästan alla andra objekt skapas från den logiska enheten.
```

## Command buffers och köer

I OpenGL ser `glDrawArrays` ut att rita direkt (drivrutinen samlar ihop och skickar kommandona bakom din rygg). I
Vulkan gör du det själv: du **spelar in** kommandon i en command buffer – starta render passet, binda pipelinen,
binda vertex buffern, rita, avsluta render passet – och **skickar** sedan command buffern till en kö med
`vkQueueSubmit`. GPU:n utför den asynkront, medan ditt program fortsätter. Eftersom inspelning bara är att fylla en
buffer kan flera trådar spela in command buffers samtidigt, och en command buffer kan spelas in en gång och skickas
många gånger.

```quiz
Hur når ett ritkommando GPU:n i Vulkan?
- [ ] Drivrutinen samlar ihop alla anrop och skickar dem till GPU:n på egen hand
- [ ] `vkCmdDraw` ritar triangeln direkt
- [x] Det spelas in i en command buffer, som skickas till en kö med `vkQueueSubmit` och utförs asynkront
---
Funktionerna `vkCmd…` spelar bara in. Ingenting händer på GPU:n förrän command buffern har skickats till en kö.
```

## Explicit synkronisering

Eftersom GPU:n arbetar asynkront måste du tala om för Vulkan i vilken ordning saker ska hända – drivrutinen gör det
inte åt dig. Vulkan har två huvudverktyg för det:

- En **semaphore** (`VkSemaphore`) ordnar arbete *på GPU:n*: en köoperation signalerar den, en annan väntar på den.
  Projektet använder `imageAvailableSemaphore` så att renderingen väntar tills swap chain-bilden är tillgänglig,
  och `renderFinishedSemaphores` så att presentationen väntar tills renderingen är klar.
- Ett **fence** (`VkFence`) låter *CPU:n* vänta på GPU:n. Projektet väntar på `inFlightFence` i början av varje
  bildruta, så att det inte spelar in command buffern på nytt medan GPU:n fortfarande använder den:

```cpp
void drawFrame() {
    vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
    vkResetFences(device, 1, &inFlightFence);

    uint32_t imageIndex;
    vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);
```

Fel i synkroniseringen ger inte nödvändigtvis ett felmeddelande – de kan ge flimmer, trasiga bilder eller ett
program som fungerar på en GPU men inte på en annan. Därför är nästa verktyg så viktigt.

```quiz
Vad gör fencet `inFlightFence` i `drawFrame()`?
- [ ] Det får GPU:n att vänta tills swap chain-bilden är tillgänglig
- [ ] Det begränsar bildfrekvensen till skärmens uppdateringsfrekvens
- [x] Det får CPU:n att vänta tills GPU:n är klar med föregående bildruta, så att command buffern inte spelas in på nytt medan den används
---
Fences är till för att CPU:n ska vänta på GPU:n. Ordningen mellan operationer på GPU:n – hämta bild, rendera, presentera – sköts med semaforer.
```

## Extensions och validation layers

Liksom OpenGL har Vulkan **extensions**: funktionalitet utanför core-specifikationen som du måste slå på
uttryckligen. Deras namn har ett suffix som visar vem som gjort dem: `KHR` för extensions som Khronos har
godkänt, som surface och swap chain, `EXT` för extensions från flera tillverkare, som debug messengern. Projektet
slår på swap chain-extensionen på devicen:

```cpp
const std::vector<const char*> deviceExtensions = {
    VK_KHR_SWAPCHAIN_EXTENSION_NAME
};
```

Vulkan är konstruerat för hög prestanda och liten overhead i drivrutinen, så som standard gör det **mycket lite
felkontroll**. En felaktig parameter eller en glömd synkronisering kan krascha programmet, eller i det tysta
fungera på ditt grafikkort och misslyckas på ett annat. I stället kan du slå på **validation layers**: kod som
ligger mellan ditt program och drivrutinen och kontrollerar varje anrop mot specifikationen. Standardlagret är
`VK_LAYER_KHRONOS_validation`, som följer med Vulkan SDK från LunarG:

```cpp
const std::vector<const char*> validationLayers = {
    "VK_LAYER_KHRONOS_validation"
};

#ifdef NDEBUG
const bool enableValidationLayers = false;
#else
const bool enableValidationLayers = true;
#endif
```

I debug-byggen är lagret påslaget, och projektets `debugCallback` skriver ut dess meddelanden i utdata som
`validation layer: …`. I release-byggen stänger du av det och betalar ingenting för det. Ett korrekt program ger
inga valideringsfel – behandla vart och ett som en bugg.

```quiz
Du gör ett fel i ett Vulkan-anrop, och validation layers är inte påslagna. Vad händer?
- [ ] Drivrutinen rättar felet automatiskt
- [ ] Vulkan rapporterar alltid felet med ett tydligt meddelande
- [x] Kanske inget synligt: beteendet är odefinierat, så programmet kan krascha, rita fel eller råka fungera på din GPU
---
Vulkan självt kontrollerar väldigt lite för att hålla drivrutinen snabb. Validation layers gör kontrollerna under utvecklingen och skriver ut ett meddelande för varje felaktig användning de hittar.
```

## Shaders: SPIR-V

Vulkan tar inte emot shaderkällkod. Det tar emot **SPIR-V**, ett binärt mellanformat. Du skriver fortfarande
shaderna i ett högnivåspråk – i den här kursen GLSL, som i OpenGL – och kompilerar dem till SPIR-V innan programmet
körs (normalt med `glslc` från Vulkan SDK; här gör **Bygg & kör** det åt dig). Programmet laddar sedan de
kompilerade filerna:

```cpp
auto vertShaderCode = readFile("shaders/vert.spv");
auto fragShaderCode = readFile("shaders/frag.spv");
```

Eftersom varje drivrutin får samma, redan kompilerade bytekod är du inte längre beroende av varje tillverkares
GLSL-kompilator och dess egenheter.

## Tusen rader för en triangel

Projektets `main.cpp` är ungefär tusen rader lång – för en triangel. Det är den ärliga verkligheten med Vulkan:
innan något syns på skärmen måste du sätta upp allt som OpenGL:s drivrutin gjorde åt dig, och uttryckligen säga hur
minne, bilder, pipelines och synkronisering ska fungera.

Det lönar sig. Inget händer bakom din rygg, så prestandan är förutsägbar; arbetet fördelas över flera trådar; samma
kod beter sig likadant på alla tillverkares drivrutiner (med validation layers som håller dig ärlig); och du lär dig
hur moderna GPU:er verkligen fungerar. Dessutom är de flesta av raderna engångsuppsättning: när triangeln väl syns
på skärmen kräver texturer, en kamera eller ljus ungefär lika mycket ny kod som i OpenGL.
:::
:::d3d12
## Vad Direct3D 12 är

Direct3D 12 är 3D-grafik-API:et i Microsofts DirectX 12, som kom med Windows 10 år 2015. Till skillnad från OpenGL
och Vulkan är det ingen öppen specifikation: Microsoft gör API:et och runtime-delen (`d3d12.dll`), och
grafikkortstillverkarna skriver drivrutiner för det. Det körs på Windows 10 och 11 och på Xbox. Direct3D 12 arbetar
tillsammans med **DXGI** (DirectX Graphics Infrastructure), den del av Windows som känner till grafikkorten
(adapters) och skapar swap chains för fönster.

Direct3D 12 ger en lägre abstraktionsnivå över hårdvaran än tidigare versioner. Direct3D 11 skötte minnet, höll
reda på resursernas tillstånd och synkroniserade CPU:n och GPU:n åt dig; i Direct3D 12 gör ditt program det
självt. I gengäld är det snabbare och effektivare: drivrutinen har mindre overhead, och arbetet med att spela in
kommandon kan fördelas över flera CPU-trådar. Direct3D 12 är ett **explicit** API, som Vulkan: mer kod och mer
ansvar, men full kontroll.

```quiz
Vad är den största skillnaden mellan Direct3D 12 och Direct3D 11?
- [ ] Direct3D 12 lägger bara till nya shaderfunktioner; programmeringsmodellen är densamma
- [x] Direct3D 12 ligger på en lägre nivå: ditt program sköter själv minne, resurstillstånd och synkronisering mellan CPU och GPU, i utbyte mot mindre overhead i drivrutinen
- [ ] Direct3D 12 körs också på Linux och Android
---
Microsoft beskriver Direct3D 12 som en återgång till programmering på låg nivå: snabbare och effektivare, men du ansvarar för mer av arbetet.
```

## COM och ComPtr

Direct3D bygger på **COM** (Component Object Model). Varje objekt – devicen, en kö, en resurs – är ett
*gränssnitt* (interface) vars namn börjar med `I` (`ID3D12Device`, `ID3D12CommandQueue`, `IDXGISwapChain3` …).
Objekt skapas av funktioner eller av metoder i andra objekt, som fyller i en pekare åt dig; `IID_PPV_ARGS(&pointer)`
skickar med både gränssnittets ID och pekarens adress. COM-objekt räknar sina referenser: varje objekt har `AddRef`
och `Release`, och det tar bort sig självt när den sista referensen släpps.

Att anropa `Release` för hand är lätt att göra fel, så projektet (liksom Microsofts exempel) använder den smarta
pekaren `ComPtr`:

```cpp
// ComPtr is a smart pointer for COM objects: it releases the object when it goes away.
// It knows nothing about the GPU, though: OnDestroy() waits until the GPU is done
// before the objects are released.
using Microsoft::WRL::ComPtr;
```

Metoderna returnerar ett `HRESULT`, en resultatkod som talar om ifall anropet lyckades. Projektet lägger varje anrop
som kan misslyckas i `ThrowIfFailed`, som gör om ett misslyckat `HRESULT` till ett undantag:

```cpp
inline void ThrowIfFailed(HRESULT hr)
{
    if (FAILED(hr))
    {
        char message[64] = {};
        snprintf(message, sizeof(message), "HRESULT of 0x%08X", static_cast<unsigned int>(hr));
        throw std::runtime_error(message);
    }
}
```

```quiz
Vad gör en `ComPtr<ID3D12Device>` åt dig?
- [x] Den anropar `Release` på COM-objektet automatiskt när `ComPtr` försvinner, så att du inte läcker referenser
- [ ] Den väntar tills GPU:n är klar med devicen innan den tas bort
- [ ] Den skapar devicen när den deklareras
---
`ComPtr` sköter COM:s referensräkning. Den vet ingenting om GPU:n, och därför väntar programmet på GPU:n (i `OnDestroy()`) innan dess objekt släpps.
```

## Devicen och feature levels

**Devicen** (`ID3D12Device`) representerar grafikkortet och skapar nästan alla andra objekt. Projektet ber först
DXGI om en hårdvaruadapter med stöd för Direct3D 12 och skapar sedan devicen på den:

```cpp
ThrowIfFailed(D3D12CreateDevice(
    hardwareAdapter.Get(),
    D3D_FEATURE_LEVEL_11_0,
    IID_PPV_ARGS(&m_device)
    ));
```

`D3D_FEATURE_LEVEL_11_0` är den lägsta **feature level** som programmet behöver. En feature level är en väldefinierad
uppsättning GPU-funktionalitet (11_0, 11_1, 12_0, 12_1, 12_2); ett kort som stöder en nivå stöder allt i nivåerna
under den. Direct3D 12 fungerar med kort från feature level 11_0 och uppåt, så genom att be om 11_0 kan programmet
köras på så många kort som möjligt. En feature level säger vad ett kort kan göra, inte hur snabbt det är.

## Command queues, command lists och command allocators

I Direct3D 12 anropar du inte "rita" på devicen. Du **spelar in** kommandon i en **command list**
(`ID3D12GraphicsCommandList`) och lämnar listan till en **command queue** (`ID3D12CommandQueue`), som skickar den
till GPU:n. GPU:n utför den asynkront medan ditt program fortsätter. Projektet skapar en *direct*-kö, den sort som
kan utföra alla typer av kommandon:

```cpp
D3D12_COMMAND_QUEUE_DESC queueDesc = {};
queueDesc.Flags = D3D12_COMMAND_QUEUE_FLAG_NONE;
queueDesc.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;

ThrowIfFailed(m_device->CreateCommandQueue(&queueDesc, IID_PPV_ARGS(&m_commandQueue)));
```

Minnet som de inspelade kommandona lagras i tillhör en **command allocator** (`ID3D12CommandAllocator`). Varje
bildruta återställer `PopulateCommandList()` allocatorn och listan och spelar in bildrutans kommandon; sedan utför
`OnRender()` listan:

```cpp
// Command list allocators can only be reset when the associated
// command lists have finished execution on the GPU; apps should use
// fences to determine GPU execution progress.
ThrowIfFailed(m_commandAllocator->Reset());

// However, when ExecuteCommandList() is called on a particular command
// list, that command list can then be reset at any time and must be before
// re-recording.
ThrowIfFailed(m_commandList->Reset(m_commandAllocator.Get(), m_pipelineState.Get()));
```

```cpp
ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);
```

Eftersom inspelning bara är att fylla minne kan flera trådar spela in sina egna command lists samtidigt.

```quiz
Vilket objekt äger minnet som inspelade kommandon lagras i, och får bara återställas när GPU:n är klar med de kommandona?
- [ ] Command queue
- [ ] Command list
- [x] Command allocator
---
Command listen kan återställas direkt efter `ExecuteCommandLists`, men allocatorn innehåller fortfarande kommandona som GPU:n kanske håller på att utföra. Den kan bara återställas när ett fence visar att GPU:n är klar.
```

## Resurstillstånd och barriärer

Direct3D 12 kräver också att du talar om hur en resurs används. Swap chainens back buffer är i tillståndet
`PRESENT` medan den visas; innan något ritas i den flyttar command listen den till tillståndet `RENDER_TARGET` med
en **resource barrier**, och tillbaka igen innan den presenteras. Direct3D 11 höll reda på detta åt dig.

## Descriptor heaps

Shaders och pipelinen använder inte resurser direkt; de använder **descriptors** (även kallade *views*): små poster
som beskriver en resurs och hur den ska användas, till exempel en *render target view* (RTV) som säger "rita i den
här texturen". Descriptors ligger i **descriptor heaps**, arrayer av descriptors som du skapar och fyller själv.
Projektet skapar en heap med en RTV för var och en av de två back buffrarna:

```cpp
// Describe and create a render target view (RTV) descriptor heap.
D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
rtvHeapDesc.NumDescriptors = FrameCount;
rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
ThrowIfFailed(m_device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&m_rtvHeap)));
```

## Root signatures och pipeline state objects

**Root signaturen** (`ID3D12RootSignature`) beskriver vilka resurser shaderna får – constant buffers, texturer,
samplers – och var de kommer ifrån. Triangelns shaders använder inga resurser, så projektet skapar en tom root
signature som bara tillåter hörnens input layout.

**Pipeline state objectet** (PSO, `ID3D12PipelineState`) innehåller nästan allt GPU-tillstånd i ett enda objekt:
de kompilerade shaderna, hörnens input layout, rasterizer-, blend- och depth/stencil-tillståndet, typen av
primitiv topologi och render targetens format. Det skapas en gång, i förväg, så att drivrutinen kan kompilera och
optimera allt tillsammans; när du ritar är ett byte av tillstånd bara ett byte av PSO. En del av projektets
PSO-beskrivning:

```cpp
D3D12_GRAPHICS_PIPELINE_STATE_DESC psoDesc = {};
psoDesc.InputLayout = { inputElementDescs, _countof(inputElementDescs) };
psoDesc.pRootSignature = m_rootSignature.Get();
psoDesc.VS = CD3DX12_SHADER_BYTECODE(vertexShader.Get());
psoDesc.PS = CD3DX12_SHADER_BYTECODE(pixelShader.Get());
```

Typerna `CD3DX12_…` kommer från `d3dx12.h`, Microsofts header med hjälpstrukturer som fyller i Direct3D 12:s
beskrivningar med rimliga standardvärden.

## Fences

Eftersom GPU:n kör asynkront måste ditt program veta när GPU:n är klar med något – till exempel innan command
allocatorn återställs. För det har Direct3D 12 **fencet** (`ID3D12Fence`): ett objekt som håller ett 64-bitars
värde. Command queuen *signalerar* fencet (sätter ett nytt värde när allt arbete som skickats före har blivit
klart), och CPU:n läser värdet eller väntar på det med en event. Projektet väntar på att varje bildruta blir klar:

```cpp
// Signal and increment the fence value.
const UINT64 fence = m_fenceValue;
ThrowIfFailed(m_commandQueue->Signal(m_fence.Get(), fence));
m_fenceValue++;

// Wait until the previous frame is finished.
if (m_fence->GetCompletedValue() < fence)
{
    ThrowIfFailed(m_fence->SetEventOnCompletion(fence, m_fenceEvent));
    WaitForSingleObject(m_fenceEvent, INFINITE);
}
```

Att vänta på varje bildruta är enkelt men inte det snabbaste sättet – GPU:n står still medan CPU:n spelar in nästa
bildruta. De följande kapitlen behåller det så för enkelhetens skull, precis som Microsofts HelloWorld-exempel.

```quiz
Varför väntar `WaitForPreviousFrame()` på fencet innan nästa bildruta spelas in?
- [ ] Eftersom `ExecuteCommandLists` först returnerar när GPU:n är klar
- [ ] För att begränsa bildfrekvensen till skärmens uppdateringsfrekvens
- [x] Så att command allocatorn och back buffern inte återanvänds medan GPU:n fortfarande arbetar med föregående bildruta
---
`ExecuteCommandLists` returnerar direkt; GPU:n arbetar på egen hand. Fencet talar om för CPU:n när GPU:n har nått punkten där kön signalerade det.
```

## Debuglagret

Direct3D 12 kontrollerar väldigt lite på egen hand, för att runtime-delen ska vara snabb: ett misstag kan krascha
programmet eller bara ge en felaktig bild. Under utvecklingen slår du på **debuglagret** (debug layer), som
kontrollerar varje anrop och rapporterar fel och varningar i debuggerns utdata. Det måste slås på *innan* devicen
skapas, och det kräver Windows-tillvalet "Graphics Tools". Projektet slår på det i debug-byggen:

```cpp
#if defined(_DEBUG)
    // Enable the debug layer (requires the Graphics Tools "optional feature").
    // NOTE: Enabling the debug layer after device creation will invalidate the active device.
    {
        ComPtr<ID3D12Debug> debugController;
        if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
        {
            debugController->EnableDebugLayer();

            // Enable additional debug layers.
            dxgiFactoryFlags |= DXGI_CREATE_FACTORY_DEBUG;
        }
    }
#endif
```

```quiz
När måste debuglagret slås på?
- [x] Innan devicen skapas: slås det på efteråt blir devicen ogiltig
- [ ] Bara i release-byggen
- [ ] När som helst, till exempel när ett fel har inträffat
---
`EnableDebugLayer()` måste anropas före `D3D12CreateDevice`. Projektet gör det i början av `LoadPipeline()`, och bara i debug-byggen.
```

## Shaders: HLSL, DXBC och DXIL

Shaders för Direct3D skrivs i **HLSL** (High-Level Shading Language) och kompileras till bytekod som drivrutinen
gör om till GPU-kod. Det finns två kompilatorer: den äldre **FXC** kompilerar shader models upp till 5.1 till
**DXBC**-bytekod, och den nyare **DXC** kompilerar shader model 6.0 och senare till **DXIL**. Shaders kan kompileras
i förväg (med `fxc.exe` eller `dxc.exe`) eller medan programmet körs. Projektet kompilerar, liksom Microsofts
HelloWorld-exempel, `shaders.hlsl` vid start med `D3DCompileFromFile`, som använder FXC – shader model 5.0
(`vs_5_0`, `ps_5_0`), så bytekoden är DXBC:

```cpp
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
ThrowIfFailed(D3DCompileFromFile(L"shaders.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));
```

## Ungefär 500 rader för en triangel

Projektets `main.cpp` är drygt 500 rader – för en triangel. Innan något syns på skärmen sätter du upp fönstret,
devicen, kön, swap chainen, descriptor heapen, root signaturen, PSO:n, vertex buffern och fencet, sådant som
Direct3D 11 eller OpenGL till stor del gjorde åt dig. Det lönar sig: inget händer bakom din rygg, så prestandan är
förutsägbar, arbetet kan fördelas över trådar, och du lär dig hur moderna GPU:er verkligen fungerar. Det mesta är
engångsuppsättning: när triangeln väl syns på skärmen kräver nya funktioner ungefär lika mycket kod som i OpenGL.
:::

## Nu sätter vi igång

Nu vet du lite om vad {{api}} är och hur det fungerar. I de kommande kapitlen bygger du triangelprogrammet själv:
först ett fönster, sedan ett fönster som fylls med en färg, sedan triangeln. Innan du går vidare kan du bygga och
köra projektet en gång till och leta upp koden från det här kapitlet i editorn.

## Mer att läsa

:::opengl
- [learnopengl.com: OpenGL](https://learnopengl.com/Getting-started/OpenGL): kapitlet i den ursprungliga guiden som
  det här kapitlet följer.
- [Khronos: OpenGL](https://www.khronos.org/opengl/): OpenGL:s officiella hemsida.
- [OpenGL registry](https://registry.khronos.org/OpenGL/index_gl.php): OpenGL:s specifikationer och extensions.
:::
:::vulkan
- [vulkan-tutorial.com: Overview](https://vulkan-tutorial.com/Overview): kapitlet i Vulkan-guiden som det här
  kapitlet följer.
- [Vulkan Guide](https://docs.vulkan.org/guide/latest/index.html): Khronos guide till Vulkans begrepp.
- [Vulkan-specifikationen](https://docs.vulkan.org/spec/latest/index.html): de exakta reglerna för varje funktion.
:::
:::d3d12
- [What is Direct3D 12?](https://learn.microsoft.com/en-us/windows/win32/direct3d12/what-is-directx-12-): Microsofts
  översikt.
- [Important changes from Direct3D 11 to Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/important-changes-from-directx-11-to-directx-12):
  vad ett explicit API kräver att du gör själv.
- [D3D12HelloWorld-exemplen](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld):
  exemplen som kursens kod bygger på.
:::
