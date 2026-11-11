# Felsökning

Det här kapitlet inleder kursens sista del: *I praktiken*, learnopengls sista avsnitt. Här sätts det du har lärt dig i
arbete. Först kommer två kapitel som varje grafikprogram behöver förr eller senare – *Felsökning* (det här) och
*Textrendering* – och sedan ett komplett 2D-spel som byggs steg för steg under resten av delen. learnopengl bygger en
klon av ett välkänt arkadspel; kursen bygger ett eget spel av samma slag, **Hedgerow**: en boll, ett racket och en mur
av block i en trädgård i skymningen. Inget av detta är bundet till ett visst API: att hitta fel, rita text och skriva en
spelloop fungerar likadant i OpenGL, Vulkan och DirectX 12, och varje kapitel visar hur {{api}} gör det.

Grafikprogrammering kan vara väldigt roligt, men den kan också vara en stor källa till frustration när något inte
renderas riktigt rätt, eller kanske inte renderas alls. Eftersom det mesta vi gör handlar om att manipulera pixlar kan
det vara svårt att lista ut orsaken till ett fel när något inte fungerar som det ska. Att felsöka den här sortens
*visuella* fel skiljer sig från det du är van vid när du felsöker fel på CPU:n. Vi har ingen konsol att skriva text
till, inga brytpunkter att sätta i GPU-kod och inget enkelt sätt att kontrollera tillståndet i GPU:ns körning.

I det här kapitlet tittar vi på flera tekniker och knep för att felsöka ditt {{api}}-program. Felsökning i {{api}} är
inte särskilt svårt, och att lära sig teknikerna lönar sig garanterat i längden.

## Projektet

Projektet är learnopengls felsökningsdemo: en träkub (`wood.png`, kursens egen textur), 2.5 enheter framför kameran,
som vrider sig 10° per sekund kring axeln (1, 1, 1). Det finns ingen vymatris – kameran står i origo och tittar längs
-z – och projektionen är en perspektivprojektion med 45° synfält och ett bortre plan på 10. Djuptestet och
back-face culling är påslagna.

Ett värde skiljer sig från learnopengls demo: fönstret rensas till **(0.2, 0.3, 0.3)**, en mörk blågrön färg, i stället
för svart. Du ser snart varför: halvvägs genom kapitlet ritas kuben *svart*, och mot en svart bakgrund skulle du inte se
den alls.

learnopengl gömmer två fel i sin demo som läsaren ska hitta, och det gör projektet också. Bygg och kör det:

:::opengl
fönstret visar bara den blågröna rensningsfärgen. Ingen kub, och ingenting skrivs ut. De två felen är learnopengls
egna: ett när texturen laddas och ett när uniformerna sätts – men programmet säger ingenting om dem. Att hitta dem är
vad det här kapitlet handlar om.
:::
:::vulkan
kuben finns där, men i en enda platt mörkbrun färg – inga ådringar alls. Inget i fönstret säger varför. Programmet
skriver ändå ut något: några rader som börjar med `validation layer:`. Felet är Vulkans eget (learnopengls två fel är
OpenGL-anrop som saknar motsvarighet i Vulkan): något som vertex shadern behöver saknas i pipelinen. Att hitta det är
vad det här kapitlet handlar om.
:::
:::d3d12
fönstret visar bara den blågröna rensningsfärgen. Ingen kub. Precis som learnopengls demo har projektet två fel: ett i
`PopulateCommandList`, som gör att ritanropet inte hittar sin projektion och sin textur, och ett i `LoadTexture`, i
texturens shader resource view. Programmet säger ingenting om dem. Att hitta dem är vad det här kapitlet handlar om.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Uppgifterna lägger först till verktygen och använder
sedan det de rapporterar för att rätta felen.

## glGetError()

:::opengl
I samma ögonblick som du använder OpenGL felaktigt (till exempel konfigurerar en buffer utan att först ha bundit någon)
märker OpenGL det och sätter en eller flera felflaggor bakom kulisserna. Vi kan fråga efter felflaggorna med en
funktion som heter `glGetError`, som kontrollerar vilka flaggor som är satta och returnerar ett felvärde om OpenGL har
använts fel:

```cpp
GLenum glGetError();
```

När `glGetError` anropas returnerar den antingen en felflagga eller inget fel alls. Felkoderna som `glGetError` kan
returnera står nedan:

| Flagga | Kod | Beskrivning |
|---|---|---|
| `GL_NO_ERROR` | 0 | Inget användarfel sedan förra anropet av `glGetError`. |
| `GL_INVALID_ENUM` | 1280 | Sätts när en uppräkningsparameter (enum) inte är tillåten. |
| `GL_INVALID_VALUE` | 1281 | Sätts när en värdeparameter inte är tillåten. |
| `GL_INVALID_OPERATION` | 1282 | Sätts när tillståndet för ett kommando inte är tillåtet för dess parametrar. |
| `GL_STACK_OVERFLOW` | 1283 | Sätts när en push-operation på en stack får stacken att svämma över. |
| `GL_STACK_UNDERFLOW` | 1284 | Sätts när en pop-operation görs medan stacken redan är tom. |
| `GL_OUT_OF_MEMORY` | 1285 | Sätts när en minnesallokering inte kan allokera (tillräckligt med) minne. |
| `GL_INVALID_FRAMEBUFFER_OPERATION` | 1286 | Sätts vid läsning från eller skrivning till en framebuffer som inte är komplett. |

I OpenGL:s funktionsdokumentation hittar du alltid vilka felkoder en funktion genererar när den används felaktigt.
Tittar du till exempel i dokumentationen för `glBindTexture` hittar du alla felkoder den kan ge under avsnittet
*Errors*.

När en felflagga väl är satt rapporteras inga andra felflaggor. Dessutom nollställer `glGetError` alla felflaggor när
den anropas (eller bara en på ett distribuerat system, se nedan). Det betyder att om du anropar `glGetError` en gång i
slutet av varje bildruta och den returnerar ett fel, kan du inte dra slutsatsen att det var det enda felet, och felets
källa kan ha legat var som helst i bildrutan.

Observera att när OpenGL körs distribuerat, som ofta på X11-system, kan andra användarfel fortfarande genereras så
länge de har olika felkoder. Ett anrop av `glGetError` nollställer då bara en av felflaggorna i stället för alla.
Därför rekommenderas det att anropa `glGetError` i en loop.

```cpp
glBindTexture(GL_TEXTURE_2D, tex);
std::cout << glGetError() << std::endl; // returns 0 (no error)

glTexImage2D(GL_TEXTURE_3D, 0, GL_RGB, 512, 512, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
std::cout << glGetError() << std::endl; // returns 1280 (invalid enum)

glGenTextures(-5, textures);
std::cout << glGetError() << std::endl; // returns 1281 (invalid value)

std::cout << glGetError() << std::endl; // returns 0 (no error)
```

Det fina med `glGetError` är att den gör det ganska lätt att ringa in var ett fel kan finnas och att kontrollera att
OpenGL används rätt. Säg att du får en svart skärm och inte har en aning om varför: är framebuffern inte rätt
inställd? Glömde jag binda en textur? Genom att anropa `glGetError` överallt i koden hittar du snabbt det första stället
där ett OpenGL-fel dyker upp.

Som standard ger `glGetError` bara felnummer, vilket inte är lätt att förstå om du inte kan felkoderna utantill. Ofta
lönar det sig att skriva en liten hjälpfunktion som skriver ut felets namn tillsammans med var kontrollen anropades:

```cpp
GLenum glCheckError_(const char *file, int line)
{
    GLenum errorCode;
    while ((errorCode = glGetError()) != GL_NO_ERROR)
    {
        std::string error;
        switch (errorCode)
        {
            case GL_INVALID_ENUM:                  error = "INVALID_ENUM"; break;
            case GL_INVALID_VALUE:                 error = "INVALID_VALUE"; break;
            case GL_INVALID_OPERATION:             error = "INVALID_OPERATION"; break;
            case GL_STACK_OVERFLOW:                error = "STACK_OVERFLOW"; break;
            case GL_STACK_UNDERFLOW:               error = "STACK_UNDERFLOW"; break;
            case GL_OUT_OF_MEMORY:                 error = "OUT_OF_MEMORY"; break;
            case GL_INVALID_FRAMEBUFFER_OPERATION: error = "INVALID_FRAMEBUFFER_OPERATION"; break;
        }
        std::cout << error << " | " << file << " (" << line << ")" << std::endl;
    }
    return errorCode;
}
#define glCheckError() glCheckError_(__FILE__, __LINE__)
```

Om du inte känner till preprocessordirektiven `__FILE__` och `__LINE__`: de ersätts vid kompileringen med filen och
raden där de står. Om vi strör ut många `glCheckError`-anrop i koden är det bra att veta exakt vilket av dem som
rapporterade felet.

Gör nu den första uppgiften, **check-error**: lägg till funktionen och makrot, och anropa `glCheckError();` två gånger –
direkt efter att texturen har laddats (efter `stbi_image_free(data);`) och direkt efter att de två uniformerna har
satts. Bygg och kör. Fönstret ändras inte, men programmet skriver nu ut två rader:

```text
INVALID_ENUM | main.cpp (180)
INVALID_OPERATION | main.cpp (187)
```

(talen är raderna för dina två `glCheckError();`-anrop). Det första felet uppstod någonstans medan texturen laddades,
det andra medan uniformerna sattes. Det ringar in felen rejält. Titta först på det andra stället:

```cpp
    glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 10.0f);
    glUniformMatrix4fv(glGetUniformLocation(shader.ID, "projection"), 1, GL_FALSE, glm::value_ptr(projection));
    glUniform1i(glGetUniformLocation(shader.ID, "tex"), 0);
```

`glUniform*` sätter en uniform i *det program som används* – och inget program används ännu: `shader.use()` anropas
först senare, i renderloopen. Båda anropen misslyckas med `GL_INVALID_OPERATION` och gör ingenting.
Projektionsmatrisen förblir bara nollor, så varje vertex hamnar på (0, 0, 0, 0) och ingen triangel täcker en enda
pixel. Det är det tomma fönstret.
:::
:::vulkan
OpenGL har en felflagga som programmet frågar efter med `glGetError`: varje anrop som används fel sätter den, och
learnopengls makro `glCheckError()` läser den efter en grupp anrop och skriver ut felets namn med fil och rad. Vulkan
har ingen sådan flagga. Det rapporterar fel på två helt olika sätt:

- **Returvärden.** Varje Vulkan-anrop som kan misslyckas *under körning* – för att minnet tar slut, en enhet går
  förlorad, en swap chain blir inaktuell, en fil inte var en giltig shader – returnerar ett `VkResult`: `VK_SUCCESS`
  eller en kod som `VK_ERROR_OUT_OF_DEVICE_MEMORY`. vulkan-tutorial kontrollerar dem där det spelar roll, `if (… !=
  VK_SUCCESS) throw std::runtime_error(…)`, och kursens kod gör likadant. Det är den del av `glGetError`s jobb som
  Vulkan sköter direkt.
- **Ingenting alls.** Att använda API:t *fel* – ett saknat tillstånd, en fel layout, ett värde som specifikationen inte
  tillåter – kontrolleras inte av drivrutinen. Specifikationen anger för varje anrop vad som är *giltig användning*
  (valid usage), och att bryta mot den är odefinierat beteende: programmet kan fungera på en GPU, rita skräp på en
  annan och krascha på en tredje. Att kontrollera varje anrop skulle kosta tid i varje bildruta i varje färdigt
  program, så Vulkan låter bli.

Kontrollerna finns i ett valfritt lager mellan ditt program och drivrutinen: **valideringslagret**
(`VK_LAYER_KHRONOS_validation`), som du slog på redan i det allra första Vulkan-kapitlet. Det kontrollerar varje anrop
mot specifikationens regler för giltig användning och skickar ett meddelande för varje överträdelse till en *debug
messenger* – objektet från `VK_EXT_debug_utils` som vulkan-tutorial skapar i `setupDebugMessenger()`, med
`debugCallback` som funktionen som tar emot meddelandena. I en release-build (`NDEBUG`) är `enableValidationLayers`
false, och programmet körs utan lagret och dess kostnad.

Projektets messenger ber om tre allvarlighetsgrader:

```cpp
        createInfo.messageSeverity = VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT;
        createInfo.messageType = VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_VALIDATION_BIT_EXT | VK_DEBUG_UTILS_MESSAGE_TYPE_PERFORMANCE_BIT_EXT;
```

och `debugCallback` skriver ut varje meddelande den får. Därför är utskriften från startprojektet så pratig: loadern
och lagret berättar vad de gör (rader som `validation layer: Searching for ICD drivers named …` och `validation layer:
Loading layer library libVkLayer_khronos_validation.so`), och mellan de pratiga raderna finns en som spelar roll.
Allvarlighetsgraderna är bitar i ordning efter hur viktiga de är:

| Allvarlighetsgrad | Värde | Betydelse |
|---|---|---|
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_VERBOSE_BIT_EXT` | 0x1 | Diagnostiska meddelanden (vad loadern och lagren gör) |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_INFO_BIT_EXT` | 0x10 | Informationsmeddelanden, som att en resurs har skapats |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT` | 0x100 | Beteende som inte nödvändigtvis är ett fel men mycket troligt en bugg |
| `VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT` | 0x1000 | Beteende som är ogiltigt och kan orsaka krascher |

så – som vulkan-tutorial påpekar – räcker en jämförelse för att bara behålla de viktiga. Gör nu den första uppgiften,
**message-severity**: låt `debugCallback` skriva ut ett meddelande bara om dess allvarlighetsgrad är en varning eller
värre:

```cpp
        if (messageSeverity >= VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT) {
            std::cerr << "validation layer: " << pCallbackData->pMessage << std::endl;
        }
```

Bygg och kör. Kuben är lika brun som förut, men programmets konsol har krympt till ett enda meddelande (förkortat här):

```text
validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0x…, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location. The Vulkan spec states: …
```

Läs det framifrån: det är ett **fel** av valideringssorten; `VUID-VkGraphicsPipelineCreateInfo-Input-07904` är
*valid usage ID*, namnet på regeln i specifikationen som bröts (meddelandet slutar med regelns text och en länk till
den); `Object 0` är objektet det gäller – en shader module, angiven med sitt handtag; och anropet som bröt mot regeln
var `vkCreateGraphicsPipelines`. Observera att `vkCreateGraphicsPipelines` ändå returnerade `VK_SUCCESS` – `throw`
efter anropet slog aldrig till. Utan lagret hade det inte funnits någon ledtråd alls.
:::
:::d3d12
OpenGL har en felflagga som programmet frågar efter med `glGetError`: varje anrop som används fel sätter den, och
learnopengls makro `glCheckError()` läser den efter en grupp anrop och skriver ut felets namn med fil och rad.
Direct3D 12 rapporterar fel på två sätt:

- **Returvärden.** Anrop som kan misslyckas under körning returnerar ett `HRESULT` – `S_OK` eller en felkod som
  `E_OUTOFMEMORY` eller `DXGI_ERROR_DEVICE_REMOVED`. Exemplen, och kursen, lindar in dem i `ThrowIfFailed`, som gör ett
  misslyckande till ett undantag.
- **Debuglagret.** Många anrop returnerar ingenting alls: `CreateShaderResourceView`, `SetGraphicsRootDescriptorTable`,
  `DrawInstanced` och alla andra command list-anrop är `void`. Felaktig användning av dem kontrolleras inte av
  runtime-miljön och drivrutinen – det skulle kosta tid i varje bildruta i varje färdigt program – och resultatet är
  odefinierat: det kan fungera på en GPU, rita skräp på en annan och ta bort enheten (device removed) på en tredje.
  Kontrollerna finns i det valfria **debuglagret**, som varje projekt i kursen har slagit på sedan det första
  DirectX 12-kapitlet:

```cpp
#if defined(_DEBUG)
    // Enable the debug layer (requires the Graphics Tools "optional feature").
    // NOTE: Enabling the debug layer after device creation will invalidate the active device.
    {
        ComPtr<ID3D12Debug> debugController;
        if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&debugController))))
        {
            debugController->EnableDebugLayer();
```

Det finns bara i en debug-build (`_DEBUG`) på ett Windows där den valfria funktionen "Graphics Tools" är installerad.
Det kontrollerar varje anrop och skriver ett meddelande för varje fel till debuggerns Output-fönster (i Visual Studio:
starta med F5, sedan *Output*, *Show output from: Debug*), som rader av typen

```text
D3D12 ERROR: ID3D12Device::CreateShaderResourceView: … [ STATE_CREATION ERROR #31: CREATESHADERRESOURCEVIEW_INVALIDDIMENSIONS]
```

Det är användbart, men bara medan en debugger körs, och programmet vet ingenting om det. Programmet kan dock läsa
meddelandena själv: debuglagret sparar dem också i enhetens **info queue**, `ID3D12InfoQueue`, som du får från enheten
med `QueryInterface` – ComPtrs `As`. Med den kan du skriva Direct3D 12-versionen av learnopengls `glCheckError_`: läs
varje meddelande som sparats sedan förra kontrollen, skriv ut det med kontrollens fil och rad, och töm kön.

```cpp
void CheckDebugMessages_(ID3D12InfoQueue* infoQueue, const char* file, int line)
{
    if (infoQueue == nullptr)
        return;    // no debug layer (a release build): no messages

    UINT64 count = infoQueue->GetNumStoredMessages();
    for (UINT64 i = 0; i < count; i++)
    {
        // first ask how big the message is, then get it into memory of that size
        SIZE_T messageLength = 0;
        infoQueue->GetMessage(i, nullptr, &messageLength);
        D3D12_MESSAGE* message = static_cast<D3D12_MESSAGE*>(malloc(messageLength));
        infoQueue->GetMessage(i, message, &messageLength);

        std::string text = std::string(SeverityName(message->Severity)) + " #" + std::to_string(message->ID) + ": "
            + message->pDescription + " | " + file + " (" + std::to_string(line) + ")\n";
        OutputDebugStringA(text.c_str());    // the debugger's Output window

        free(message);
    }
    infoQueue->ClearStoredMessages();
}
#define CheckDebugMessages() CheckDebugMessages_(m_infoQueue.Get(), __FILE__, __LINE__)
```

`GetMessage` anropas två gånger, som dokumentationen beskriver: först med `nullptr` för att få veta meddelandets
storlek (ett `D3D12_MESSAGE` med texten efter sig), sedan med minne av den storleken. Ett meddelande har en kategori,
en allvarlighetsgrad (`CORRUPTION`, `ERROR`, `WARNING`, `INFO`, `MESSAGE` – `SeverityName`, som redan finns i
projektet, gör den till text), ett `ID` och beskrivningen. Om du inte känner till `__FILE__` och `__LINE__`:
preprocessorn ersätter dem med filen och raden där de står, så varje anrop av `CheckDebugMessages()` rapporterar sin
egen plats.

Gör nu den första uppgiften, **info-queue**: hämta info queue i `LoadPipeline` direkt efter att enheten har skapats
(innanför `#if defined(_DEBUG)` – i en release-build finns inget debuglager, `As` misslyckas och `m_infoQueue` förblir
tom), lägg till funktionen och makrot, och anropa `CheckDebugMessages();` efter `LoadTexture(…)` i `LoadAssets` och
efter `ExecuteCommandLists` i `OnRender`. Kör programmet i debuggern (F5): debuglagret rapporterar felen, sparar dem i
info queue, och din funktion skriver ut dem. Bilden ändras inte, men debuggerns Output-fönster innehåller nu
meddelandena:

```text
ERROR #31: ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture. | main.cpp (…)
ERROR #708: CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x…:'Unnamed ID3D12DescriptorHeap Object') containing handle 0x… is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'. | main.cpp (…)
```

Det första en gång, efter att texturen har laddats; det andra två gånger efter varje bildruta – en gång för vart och ett
av de två anropen av `SetGraphicsRootDescriptorTable`. Två fel, två ställen. Kapitlet tar det andra först, eftersom det
är det som gör att ingenting alls ritas.
:::

:::opengl
```quiz
Efter uppgiften check-error skriver programmet ut `INVALID_ENUM` en gång för texturkoden, fast ett andra anrop där också misslyckas (`glGenerateMipmap` på en textur utan bild). Varför skrivs det andra felet inte ut?
- [ ] Därför att `glGenerateMipmap` aldrig sätter någon felflagga
- [ ] Därför att `glCheckError_` slutar efter det första felet den läser
- [x] Därför att OpenGL inte registrerar fler fel när en felflagga väl är satt, förrän `glGetError` har läst den – det senare felet går förlorat
- [ ] Därför att fel i texturfunktionerna rapporteras först vid nästa ritanrop
---
Det är `glGetError`s svaghet: den säger att något gick fel sedan förra kontrollen, och vad som gick fel först, inte allt. Att anropa den ofta ringar in stället; debugutskriften nedan rapporterar varje anrop som misslyckas.
```
:::
:::vulkan
```quiz
`vkCreateGraphicsPipelines` returnerade `VK_SUCCESS`, ändå rapporterar valideringslagret ett fel i just det anropet. Hur går det ihop?
- [ ] Det gör det inte: lagret har fel, pipelinen är giltig
- [x] Drivrutinen kontrollerar inte giltig användning – en pipeline vars vertex shader läser en indata som inget attribut beskriver är helt enkelt odefinierat beteende; bara lagret jämför anropet med specifikationens regler
- [ ] `VK_SUCCESS` betyder bara att anropet spelades in; det riktiga resultatet kommer senare via fencen
- [ ] Lagret gör om felet till `VK_SUCCESS` så att programmet fortsätter att köra
---
`VkResult` rapporterar det som kan gå fel under körning (slut på minne, förlorad enhet …). Felaktig användning av API:t är programmets bugg, och att hitta den är valideringslagrets jobb – därför kör du med det under utvecklingen och utan det i en release-build.
```
:::
:::d3d12
```quiz
`CreateShaderResourceView` returnerar `void`. Hur får programmet veta att vyn det bad om är ogiltig?
- [ ] Från `HRESULT` i nästa anrop av `ThrowIfFailed`
- [ ] Det kan det inte: felet syns bara i bilden
- [ ] Från `GetDeviceRemovedReason`, som anropet sätter
- [x] Debuglagret kontrollerar anropet och sparar ett meddelande (ERROR #31) i enhetens info queue, där `GetNumStoredMessages` / `GetMessage` läser det
---
Utan debuglagret kontrollerar ingenting beskrivningen alls – deskriptorn i heapen är helt enkelt ogiltig, och vad en shader läser genom den är odefinierat.
```
:::

:::opengl
Gör nu uppgiften **use-program**: anropa `shader.use();` före de två uniformanropen. Bygg och kör: kuben dyker upp –
**helt svart**. Nu skrivs bara en rad ut, `INVALID_ENUM | main.cpp (…)`, från texturkoden. Texturen är fortfarande
trasig, och en textur utan (giltig) bild är *ofullständig* (incomplete): att sampla den ger (0, 0, 0, 1). Här lönar sig
den blågröna rensningsfärgen.

`glGetError` berättade *att* något misslyckades mellan två kontroller. Den berättade inte *vilket* anrop, eller varför.
För det finns ett bättre verktyg.
:::

## Debugutskrift

:::opengl
Ett mindre känt men mer användbart verktyg än `glCheckError` är en OpenGL-utökning som heter *debug output*, som blev
en del av kärn-OpenGL i version 4.3. Med debug output skickar OpenGL självt ett fel- eller varningsmeddelande till
användaren, med betydligt fler detaljer än `glCheckError`. Det ger inte bara mer information, det kan också hjälpa dig
att fånga fel precis där de uppstår, om du använder en debugger på ett smart sätt.

Debug output ingår i kärnan sedan OpenGL 4.3, vilket betyder att du hittar funktionen på varje maskin som kör OpenGL
4.3 eller senare. Finns den inte kan funktionaliteten nås via utökningen `ARB_debug_output` eller `AMD_debug_output`
(och via `KHR_debug`, utökningen som 4.3-funktionaliteten gjordes av och som de flesta drivrutiner erbjuder även för
äldre kontextversioner). Observera att macOS inte verkar stödja debug output: dess OpenGL stannar vid 4.1 och har ingen
av utökningarna – där är det `glGetError` som gäller.

**Vad en 4.3-kontext betyder för kursen.** Alla andra OpenGL-projekt i kursen ber GLFW om en 3.3 core-kontext. Det här
ber om **4.3**:

```cpp
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4); // debug output (glDebugMessageCallback) is core OpenGL since 4.3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, true); // comment this line in a release build!
```

En 4.3 core-kontext kör 3.3 core-kod oförändrad – senare versioner lägger till funktioner, de tar inte bort några – så
du kan felsöka vilket som helst av kursens program på det här sättet: ändra de två versionstipsen, lägg till
debugtipset och ladda 4.3-funktionerna med GLAD (kursens GLAD för det här kapitlet är genererad för 4.3 core).
learnopengls demo behåller 3.3 och förlitar sig på en GLAD som genererats med utökningen `KHR_debug`; det fungerar också
med de flesta drivrutiner. Bara på en Mac, med sitt maximum 4.1, finns ingen debug output.

För att börja använda debug output måste vi begära en debugkontext av OpenGL under initieringen – tipset
`GLFW_OPENGL_DEBUG_CONTEXT` ovan, före `glfwCreateWindow`. Observera att en debugkontext kan vara långsammare än en
vanlig kontext, så när du arbetar med optimeringar eller släpper ditt program vill du ta bort tipset.

För att kontrollera att vi verkligen fick en debugkontext kan vi fråga OpenGL:

```cpp
    int flags; glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
    if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)
    {
        // initialize debug output
    }
```

Debug output fungerar så att vi ger OpenGL en callback-funktion för felloggning (ungefär som GLFW:s callbacks för
indata), och i den får vi hantera feldata som vi vill; i vårt fall skriver vi ut användbar information till konsolen.
Här är prototypen som OpenGL förväntar sig för callbacken:

```cpp
void APIENTRY glDebugOutput(GLenum source, GLenum type, unsigned int id, GLenum severity,
                            GLsizei length, const char *message, const void *userParam);
```

Med den stora mängd data vi får kan vi bygga ett användbart verktyg för att skriva ut fel, som det här:

```cpp
void APIENTRY glDebugOutput(GLenum source,
                            GLenum type,
                            unsigned int id,
                            GLenum severity,
                            GLsizei length,
                            const char *message,
                            const void *userParam)
{
    if (id == 131169 || id == 131185 || id == 131218 || id == 131204) return; // ignore these non-significant error codes

    std::cout << "---------------" << std::endl;
    std::cout << "Debug message (" << id << "): " << message << std::endl;

    switch (source)
    {
        case GL_DEBUG_SOURCE_API:             std::cout << "Source: API"; break;
        case GL_DEBUG_SOURCE_WINDOW_SYSTEM:   std::cout << "Source: Window System"; break;
        case GL_DEBUG_SOURCE_SHADER_COMPILER: std::cout << "Source: Shader Compiler"; break;
        case GL_DEBUG_SOURCE_THIRD_PARTY:     std::cout << "Source: Third Party"; break;
        case GL_DEBUG_SOURCE_APPLICATION:     std::cout << "Source: Application"; break;
        case GL_DEBUG_SOURCE_OTHER:           std::cout << "Source: Other"; break;
    } std::cout << std::endl;

    switch (type)
    {
        case GL_DEBUG_TYPE_ERROR:               std::cout << "Type: Error"; break;
        case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR: std::cout << "Type: Deprecated Behaviour"; break;
        case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:  std::cout << "Type: Undefined Behaviour"; break;
        case GL_DEBUG_TYPE_PORTABILITY:         std::cout << "Type: Portability"; break;
        case GL_DEBUG_TYPE_PERFORMANCE:         std::cout << "Type: Performance"; break;
        case GL_DEBUG_TYPE_MARKER:              std::cout << "Type: Marker"; break;
        case GL_DEBUG_TYPE_PUSH_GROUP:          std::cout << "Type: Push Group"; break;
        case GL_DEBUG_TYPE_POP_GROUP:           std::cout << "Type: Pop Group"; break;
        case GL_DEBUG_TYPE_OTHER:               std::cout << "Type: Other"; break;
    } std::cout << std::endl;

    switch (severity)
    {
        case GL_DEBUG_SEVERITY_HIGH:         std::cout << "Severity: high"; break;
        case GL_DEBUG_SEVERITY_MEDIUM:       std::cout << "Severity: medium"; break;
        case GL_DEBUG_SEVERITY_LOW:          std::cout << "Severity: low"; break;
        case GL_DEBUG_SEVERITY_NOTIFICATION: std::cout << "Severity: notification"; break;
    } std::cout << std::endl;
    std::cout << std::endl;
}
```

Varje gång debug output upptäcker ett OpenGL-fel anropar den callbacken, och vi kan skriva ut en hel del information
om felet. Observera att vi ignorerar några felkoder som sällan säger något användbart (som 131185 i NVIDIA:s drivrutiner,
som berättar att en buffer har skapats).

Nu när vi har callbacken är det dags att initiera debug output:

```cpp
    int flags; glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
    if (flags & GL_CONTEXT_FLAG_DEBUG_BIT)
    {
        glEnable(GL_DEBUG_OUTPUT);
        glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS); // makes sure errors are displayed synchronously
        glDebugMessageCallback(glDebugOutput, nullptr);
        glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_TRUE);
    }
```

Här säger vi åt OpenGL att slå på debug output. Anropet `glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS)` säger åt OpenGL att
anropa callbacken direkt när ett fel uppstår – inuti anropet som orsakade det. Den sista parametern till
`glDebugMessageCallback`, här `nullptr`, lämnas till callbacken som `userParam`. `glDebugMessageControl` bestämmer
vilka meddelanden som skickas; med `GL_DONT_CARE` för källa, typ och allvarlighetsgrad och `GL_TRUE` slås alla på
(också de med låg allvarlighetsgrad, som är avslagna från början).

Gör nu uppgiften **debug-output**: 4.3-debugkontexten, funktionen `glDebugOutput` och initieringen direkt efter att GLAD
har laddats. Bygg och kör. Bilden är samma svarta kub, men nu beskriver drivrutinen felen i ord (det här är Mesas
texter; NVIDIA och AMD formulerar dem annorlunda och använder andra id:n):

```text
---------------
Debug message (1): GL_INVALID_ENUM in glTexImage2D(target=GL_FRAMEBUFFER)
Source: API
Type: Error
Severity: high

---------------
Debug message (1): GL_INVALID_OPERATION in glGenerateMipmap(zero size base image)
Source: API
Type: Error
Severity: high

INVALID_ENUM | main.cpp (…)
```

Där är det: `glTexImage2D` anropades med målet `GL_FRAMEBUFFER`, som inte är något texturmål. Anropet misslyckas och
texturen får aldrig någon bild. Och debugutskriften visar också det som `glGetError` inte kunde visa: följdfelet –
`glGenerateMipmap` på en textur vars basbild har storleken noll. Den sista raden är ditt `glCheckError()`, som
fortfarande rapporterar det första av dem.

Gör nu uppgiften **fix-texture**: ladda upp bilden till `GL_TEXTURE_2D`, målet som texturen är bunden till:

```cpp
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
```

Bygg och kör: **träkuben**, med plankorna uppåt längs framsidan – och ingenting skrivs ut längre.

### Filtrera debugutskriften

Med `glDebugMessageControl` kan du filtrera vilka typer av fel du vill få meddelanden om. I vårt fall valde vi att inte
filtrera på någon källa, typ eller allvarlighetsgrad. Om vi bara ville se meddelanden från OpenGL-API:t som är fel med
hög allvarlighetsgrad, skulle vi först stänga av allt och sedan slå på just dem:

```cpp
glDebugMessageControl(GL_DONT_CARE, GL_DONT_CARE, GL_DONT_CARE, 0, nullptr, GL_FALSE);
glDebugMessageControl(GL_DEBUG_SOURCE_API, GL_DEBUG_TYPE_ERROR, GL_DEBUG_SEVERITY_HIGH, 0, nullptr, GL_TRUE);
```

Med vår konfiguration, och förutsatt att du har en kontext som stöder debug output, skriver nu varje felaktigt
OpenGL-kommando ut en stor bunt användbar information.

Programmet kan också skicka egna meddelanden (`glDebugMessageInsert`, källan `GL_DEBUG_SOURCE_APPLICATION`) och märka
upp delar av en bildruta med `glPushDebugGroup` / `glPopDebugGroup`, som callbacken ser som push- och pop-meddelanden –
och som verktyg som RenderDoc visar som namngivna grupper av ritanrop. Med `glObjectLabel` ger du ett objekt (en buffer,
en textur, ett program …) ett namn som meddelanden och verktyg sedan använder i stället för ett nakent nummer.

### Spåra felets källa

Ett annat bra knep med debug output är att du ganska enkelt kan hitta exakt vilken rad eller vilket anrop ett fel
uppstod i. Sätter du en brytpunkt i `glDebugOutput` vid en viss feltyp (eller överst i funktionen om du inte bryr dig
om typen) fångar debuggern felet, och du kan gå uppåt i anropsstacken till funktionen som orsakade meddelandet. Det
fungerar bara tack vare `GL_DEBUG_OUTPUT_SYNCHRONOUS`: utan det kan drivrutinen anropa callbacken senare, från en annan
tråd, när anropsstacken inte längre visar det skyldiga anropet.

Det kräver lite handpåläggning, men om du ungefär vet vad du letar efter är det otroligt användbart för att snabbt hitta
anropet som orsakar ett fel.
:::
:::vulkan
Messengern skickar varje meddelande till `debugCallback` med mer än bara texten. vulkan-tutorials callback har den här
signaturen:

```cpp
    static VKAPI_ATTR VkBool32 VKAPI_CALL debugCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData) {
```

- `messageSeverity` – allvarlighetsgraden i tabellen ovan.
- `messageType` – `VK_DEBUG_UTILS_MESSAGE_TYPE_GENERAL_BIT_EXT` (något som inte har med specifikationen eller
  prestandan att göra, som loaderns rader), `…_VALIDATION_BIT_EXT` (en bruten regel i specifikationen eller ett troligt
  misstag) eller `…_PERFORMANCE_BIT_EXT` (en potentiellt icke-optimal användning av Vulkan).
- `pCallbackData` – själva meddelandet: `pMessage` (hela texten), `pMessageIdName` (VUID:t, här
  `VUID-VkGraphicsPipelineCreateInfo-Input-07904`) och `messageIdNumber`, samt `pObjects` / `objectCount`, objekten
  meddelandet gäller, vart och ett med sin typ, sitt handtag och – om det har ett – sitt namn.
- `pUserData` – en pekare som du kan ge messengern när du skapar den (`createInfo.pUserData`), till exempel ditt
  applikationsobjekt.

Callbacken returnerar en `VkBool32`. `VK_TRUE` skulle få anropet som utlöste meddelandet att misslyckas med
`VK_ERROR_VALIDATION_FAILED_EXT`; det är bara tänkt för att testa själva lagren, så callbacken returnerar alltid
`VK_FALSE`.

Ordningen mellan de två filtren spelar lite roll: `createInfo.messageSeverity` bestämmer vilka meddelanden messengern
får över huvud taget, `if`-satsen i callbacken vilka av dem den skriver ut. Projektet behåller verbose-biten i create
info (så att du kan vända på `if`-satsen när du vill se vad loadern gör) och filtrerar i callbacken, som vulkan-tutorial
gör.

### Objektnamn

`Object 0: handle = 0x…, type = VK_OBJECT_TYPE_SHADER_MODULE` säger *vilken sorts* objekt meddelandet gäller, men ett
handtag är bara ett tal. I ett program med dussintals pipelines och hundratals bilder vill du ha ett namn. Utökningen
`VK_EXT_debug_utils` – den som messengern kommer från – låter dig ge varje Vulkan-objekt ett namn med
`vkSetDebugUtilsObjectNameEXT`. Valideringslagret skriver då ut namnet tillsammans med handtaget, och grafikdebuggers som
RenderDoc visar det också.

Precis som `vkCreateDebugUtilsMessengerEXT` är det en utökningsfunktion, som inte laddas automatiskt: den slås upp med
`vkGetInstanceProcAddr`, i en proxyfunktion bredvid messengerns:

```cpp
// vkSetDebugUtilsObjectNameEXT is a function of the VK_EXT_debug_utils extension too: look it up like the messenger's.
VkResult SetDebugUtilsObjectNameEXT(VkInstance instance, VkDevice device, const VkDebugUtilsObjectNameInfoEXT* pNameInfo) {
    auto func = (PFN_vkSetDebugUtilsObjectNameEXT) vkGetInstanceProcAddr(instance, "vkSetDebugUtilsObjectNameEXT");
    if (func != nullptr) {
        return func(device, pNameInfo);
    } else {
        return VK_ERROR_EXTENSION_NOT_PRESENT;
    }
}
```

En liten medlemsfunktion fyller i strukturen – objektets typ, dess handtag som ett 64-bitarstal och namnet:

```cpp
    void setObjectName(VkObjectType objectType, uint64_t objectHandle, const char* name) {
        if (!enableValidationLayers) return;

        VkDebugUtilsObjectNameInfoEXT nameInfo{};
        nameInfo.sType = VK_STRUCTURE_TYPE_DEBUG_UTILS_OBJECT_NAME_INFO_EXT;
        nameInfo.objectType = objectType;
        nameInfo.objectHandle = objectHandle;
        nameInfo.pObjectName = name;

        SetDebugUtilsObjectNameEXT(instance, device, &nameInfo);
    }
```

Utan valideringslagret returnerar den direkt: utökningen slås bara på tillsammans med lagret (se
`getRequiredExtensions()`). Gör nu uppgiften **object-names**: lägg till båda funktionerna och namnge de två shader
modules i `createPipeline()` efter sina filer och texturbilden i `loadTexture()` efter sin sökväg:

```cpp
        setObjectName(VK_OBJECT_TYPE_SHADER_MODULE, (uint64_t) vertShaderModule, vertShaderFile.c_str());
        setObjectName(VK_OBJECT_TYPE_SHADER_MODULE, (uint64_t) fragShaderModule, fragShaderFile.c_str());
```

Bygg och kör. Meddelandet säger nu vilken shader det menar:

```text
validation layer: Validation Error: [ VUID-VkGraphicsPipelineCreateInfo-Input-07904 ] Object 0: handle = 0x…, name = shaders/debugging.vert.spv, type = VK_OBJECT_TYPE_SHADER_MODULE; | MessageID = 0xcc9c32be | vkCreateGraphicsPipelines(): pCreateInfos[0].pVertexInputState->pVertexAttributeDescriptions does not have a Location 1 but vertex shader has an input variable at that Location. …
```

Nu är meddelandet en fullständig beskrivning av felet: vertex shadern `shaders/debugging.vert.spv` har en indata på
location 1, men pipelinens vertex input-tillstånd har ingen attributbeskrivning för location 1. Shadern:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;
```

och `Vertex::getAttributeDescriptions()` i startprojektet beskriver bara ett attribut, positionen på location 0.
Pipelinen skapas ändå, och vad shadern läser från en indata som ingen matar är odefinierat; här läser den (0, 0).
Varje fragment samplar då texeln på (0, 0) – en mörk ådra i träet – och kuben blir en enda platt brun färg.
OpenGL-motsvarigheten till felet är ett vertexattribut som aldrig slås på med `glEnableVertexAttribArray`.

Gör nu uppgiften **fix-attribute**: ge arrayen två element och beskriv texturkoordinaterna:

```cpp
        attributeDescriptions[1].binding = 0;
        attributeDescriptions[1].location = 1;
        attributeDescriptions[1].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, texCoord);
```

Bygg och kör: **träkuben**, med plankorna uppåt längs framsidan – och ingenting skrivs ut längre.

### Etiketter

Utökningen har mer för grafikdebuggers: `vkCmdBeginDebugUtilsLabelEXT` / `vkCmdEndDebugUtilsLabelEXT` märker upp ett
avsnitt av en command buffer med ett namn och en färg (ett "skuggpass", ett "UI-pass"), och
`vkCmdInsertDebugUtilsLabelEXT` en enskild punkt. RenderDoc och liknande verktyg visar kommandona grupperade efter
etiketterna. De motsvarar OpenGL:s `glPushDebugGroup` / `glPopDebugGroup`, precis som objektnamn motsvarar
`glObjectLabel`.
:::
:::d3d12
Info queue ger programmet meddelandena *i efterhand*: `CheckDebugMessages()` skriver ut det som samlats sedan förra
kontrollen. Det är `glGetError`-sättet. learnopengls bättre verktyg är *debug output*, en callback som drivrutinen
anropar med varje meddelande just när det uppstår. Direct3D 12 har samma två saker, plus en som debuggern erbjuder.
Men först en förbättring av själva meddelandena.

### Namn

Heapen i meddelande #708 kallas `'Unnamed ID3D12DescriptorHeap Object'`. I ett program med många heaps, buffrar och
texturer hjälper det inte mycket. Varje Direct3D 12-objekt (allt som härleds från `ID3D12Object`) kan få ett namn med
`SetName`, en bred sträng; debuglagrets meddelanden använder det sedan, och det gör grafikdebuggers som PIX också
(motsvarigheten i OpenGL är `glObjectLabel`, i Vulkan `vkSetDebugUtilsObjectNameEXT`). Gör nu uppgiften **set-name**:
namnge de tre heaparna när de skapas,

```cpp
        m_rtvHeap->SetName(L"RTV heap");
        m_dsvHeap->SetName(L"DSV heap");
        m_cbvSrvHeap->SetName(L"CBV/SRV heap");
```

varje render target i loopen som skapar dem (`std::wstring name = L"Render target " + std::to_wstring(n);` och
`m_renderTargets[n]->SetName(name.c_str());`), och i slutet av `LoadAssets` root signaturen, pipeline staten, vertex
buffern, texturen (`L"wood.png"`), constant buffern och djupbuffern. Kör programmet: meddelande #708 säger nu
`The descriptor heap (0x…:'CBV/SRV heap') containing handle 0x… is different from currently set descriptor heap
0x0000000000000000:'(nullptr)'.`

### Det första felet

Läs meddelandet: descriptor-tabellen pekar in i heapen `'CBV/SRV heap'`, men den descriptor heap som är satt på command
listen är `(nullptr)` – ingen. En descriptor-tabell är bara ett GPU-handtag, en adress *inuti* en shader-synlig
descriptor heap, och ett ritanrop kan bara använda deskriptorer från de heaps som command listen har fått med
`SetDescriptorHeaps`. Startprojektets `PopulateCommandList` sätter root signaturen och de två tabellerna, men aldrig
heapen. Därför pekar root-parametrarna 1 (constant buffern med projektionen) och 2 (texturen) ingenstans som ritanropet
kan följa – formellt odefinierat beteende; här ritas ingenting, precis som med learnopengls projektion som aldrig når
shadern.

Gör nu uppgiften **descriptor-heaps**: sätt heapen före tabellerna:

```cpp
    ID3D12DescriptorHeap* ppHeaps[] = { m_cbvSrvHeap.Get() };
    m_commandList->SetDescriptorHeaps(_countof(ppHeaps), ppHeaps);
    m_commandList->SetGraphicsRootDescriptorTable(1, m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart());
```

Kör programmet: kuben dyker upp – **helt svart**. Meddelande #708 är borta; #31 skrivs fortfarande ut en gång i början.
Texturens vy är fortfarande ogiltig, och det en shader läser genom den är svart här. Här lönar sig den blågröna
rensningsfärgen.

### Meddelande-callbacken

Nyare versioner av Direct3D 12 (Windows 11, eller ett program som levereras med Agility SDK) har `ID3D12InfoQueue1`,
och med den learnopengls debug output: `RegisterMessageCallback` registrerar en funktion som debuglagret anropar med
varje meddelande, i samma ögonblick som anropet som orsakar det görs.

```cpp
void CALLBACK D3D12DebugOutput(D3D12_MESSAGE_CATEGORY category,
                               D3D12_MESSAGE_SEVERITY severity,
                               D3D12_MESSAGE_ID id,
                               LPCSTR description,
                               void* context)
{
    std::string text = "---------------\nDebug message (" + std::to_string(id) + "): " + description + "\n";

    text += "Category: ";
    switch (category)
    {
        case D3D12_MESSAGE_CATEGORY_APPLICATION_DEFINED:   text += "Application defined"; break;
        case D3D12_MESSAGE_CATEGORY_MISCELLANEOUS:         text += "Miscellaneous"; break;
        case D3D12_MESSAGE_CATEGORY_INITIALIZATION:        text += "Initialization"; break;
        case D3D12_MESSAGE_CATEGORY_CLEANUP:               text += "Cleanup"; break;
        case D3D12_MESSAGE_CATEGORY_COMPILATION:           text += "Compilation"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_CREATION:        text += "State creation"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_SETTING:         text += "State setting"; break;
        case D3D12_MESSAGE_CATEGORY_STATE_GETTING:         text += "State getting"; break;
        case D3D12_MESSAGE_CATEGORY_RESOURCE_MANIPULATION: text += "Resource manipulation"; break;
        case D3D12_MESSAGE_CATEGORY_EXECUTION:             text += "Execution"; break;
        case D3D12_MESSAGE_CATEGORY_SHADER:                text += "Shader"; break;
        default:                                           text += "Other"; break;
    }
    text += "\nSeverity: " + std::string(SeverityName(severity)) + "\n\n";

    OutputDebugStringA(text.c_str());    // the debugger's Output window
}
```

Det är learnopengls `glDebugOutput` med Direct3D 12:s fält: en kategori i stället för OpenGL:s källa och typ,
allvarlighetsgraden, meddelandets ID och dess beskrivning; `context` är pekaren som angavs vid registreringen (här
`nullptr`).

Det andra verktyget är själva debuggern. `SetBreakOnSeverity(severity, TRUE)` får debuglagret att bryta in i debuggern
varje gång ett meddelande med den allvarlighetsgraden uppstår – precis som att träffa en brytpunkt vid det skyldiga
anropet: anropsstacken visar raden i din kod som gjorde det. Det är learnopengls "spåra felets källa" utan att du
behöver sätta brytpunkten själv. Utan en ansluten debugger utlöser brytningen däremot ett undantag som ingen hanterar,
och programmet avslutas – därav `IsDebuggerPresent()`.

Gör nu uppgiften **debug-callback**: skriv `D3D12DebugOutput`, och i `LoadPipeline`, efter att info queue har hämtats:

```cpp
    if (m_infoQueue)
    {
        if (IsDebuggerPresent())
        {
            m_infoQueue->SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_CORRUPTION, TRUE);
            m_infoQueue->SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_ERROR, TRUE);
        }

        ComPtr<ID3D12InfoQueue1> infoQueue1;
        if (SUCCEEDED(m_infoQueue.As(&infoQueue1)))
        {
            DWORD callbackCookie = 0;
            infoQueue1->RegisterMessageCallback(D3D12DebugOutput, D3D12_MESSAGE_CALLBACK_FLAG_NONE, nullptr, &callbackCookie);
        }
    }
```

(Cookien identifierar registreringen för `UnregisterMessageCallback`.) Kör programmet. Bilden är samma svarta kub, men
meddelande #31 kommer nu i samma ögonblick som `CreateShaderResourceView` anropas:

```text
---------------
Debug message (31): ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.
Category: State creation
Severity: ERROR
```

– och med en ansluten debugger stannar programmet precis på den raden i `LoadTexture`. (Startat utan debugger, med
Ctrl+F5, returnerar `IsDebuggerPresent()` false, så programmet skriver ut meddelandet och fortsätter.) (Meddelandena
ligger också kvar i kön, så `CheckDebugMessages()` skriver ut dem en gång till efteråt.)

### Det andra felet

Meddelandet säger det rakt ut: vyn ber om `MipLevels` 0, och värdet måste ligga mellan 1 och 1 – texturen har en
mipnivå – eller vara -1 för "alla". Startprojektet fyller i `srvDesc` så här:

```cpp
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = textureDesc.Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
```

`= {}` sätter varje fält till noll, och `Texture2D.MipLevels` sätts aldrig – en vy med noll mipnivåer, vilket inte är
någon giltig vy. `CreateShaderResourceView` returnerar ingenting, deskriptorn i heapens plats 1 förblir ogiltig, och
shadern läser svart genom den: learnopengls ofullständiga textur. Gör nu uppgiften **fix-texture**:

```cpp
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
```

Kör programmet: **träkuben**, med plankorna uppåt längs framsidan – och inga meddelanden längre.

### Filtrera meddelanden

Precis som OpenGL:s `glDebugMessageControl` kan info queue filtrera: `PushStorageFilter` / `PushRetrievalFilter` tar
ett `D3D12_INFO_QUEUE_FILTER` med listor av kategorier, allvarlighetsgrader och meddelande-ID:n som ska tillåtas eller
nekas – ett meddelande som nekas av lagringsfiltret sparas inte (och bryter inte heller in i debuggern). Riktiga program
nekar ofta några kända, ofarliga meddelanden på det här sättet.
:::

:::opengl
```quiz
Varför slår projektet på `GL_DEBUG_OUTPUT_SYNCHRONOUS`?
- [x] För att drivrutinen ska anropa `glDebugOutput` inuti det OpenGL-anrop som orsakade meddelandet: en brytpunkt i callbacken visar då det skyldiga anropet i anropsstacken
- [ ] För att callbacken annars aldrig anropas i en core profile-kontext
- [ ] För att meddelandena ska skrivas ut i ordning efter allvarlighetsgrad
- [ ] För att det får varje OpenGL-anrop att vänta tills GPU:n har ritat klart
---
Utan det kan en drivrutin leverera meddelandena senare, från en annan tråd – du får fortfarande texten, men inte platsen. Priset är hastighet, ytterligare ett skäl att skippa debugkontexten i en release-build.
```
:::
:::vulkan
```quiz
Vad ändrar det att ge shader modulen ett namn med `vkSetDebugUtilsObjectNameEXT`?
- [ ] Pipelinen skapas nu korrekt, eftersom lagret kan hitta shadern på namnet
- [ ] Ingenting i meddelandena; namnet sparas bara i SPIR-V-filen
- [x] Meddelanden om objektet visar namnet bredvid handtaget (`name = shaders/debugging.vert.spv`), och grafikdebuggers visar det också – själva felet finns kvar
- [ ] Namnet ersätter VUID:t, så meddelandet blir kortare
---
Ett namn är bara felsökningsinformation. Det kostar ingenting i en release-build: `setObjectName` returnerar direkt när valideringslagret (och därmed utökningen) inte är påslaget.
```
:::
:::d3d12
```quiz
Varför anropar projektet `SetBreakOnSeverity` bara `if (IsDebuggerPresent())`?
- [ ] Därför att `SetBreakOnSeverity` misslyckas med ett `HRESULT` när ingen debugger är ansluten
- [ ] Därför att info queue bara finns medan en debugger körs
- [ ] Därför att meddelande-callbacken annars inte längre skulle anropas
- [x] Därför att brytningen utlöser ett brytpunktsundantag: med en debugger stannar den vid det skyldiga anropet, utan en hanterar ingen undantaget och programmet avslutas
---
Med en ansluten debugger är brytningen den snabbaste vägen till orsaken: anropsstacken visar raden i din kod som gjorde anropet. Utan en skriver programmet ut meddelandena och fortsätter att köra.
```
:::

:::opengl
```quiz
Med uniformerna rättade men texturen fortfarande trasig ritades kuben helt svart. Varför svart?
- [ ] Därför att debugkontexten ritar varje objekt utan textur i svart
- [x] Därför att texturen aldrig fick någon bild: en ofullständig textur samplas som (0, 0, 0, 1)
- [ ] Därför att projektionsmatrisen fortfarande bara var nollor
- [ ] Därför att `glGenerateMipmap` fyllde texturen med nollor
---
"Ofullständig" betyder att texturen inte kan samplas som den är inställd – här har den ingen bild alls; ofta är det en textur med ett mipmap-filter men utan mipmaps. OpenGL returnerar då svart i stället för ett fel, och därför är ett svart föremål en klassisk ledtråd att kontrollera texturerna.
```
:::
:::vulkan
```quiz
Före rättningen var kuben en enda platt brun färg – färgen på texeln på (0, 0). Varför den texeln överallt?
- [ ] Därför att samplerns adresseringsläge var CLAMP_TO_EDGE
- [ ] Därför att bildens layoutövergång saknades
- [x] Därför att inget attribut matade location 1: shadern läste texturkoordinaterna som (0, 0) i varje vertex, så varje fragment samplade samma texel
- [ ] Därför att descriptor seten pekade på en tom bild
---
Vad en shader läser från en indata som inget attribut beskriver är odefinierat – (0, 0) med en drivrutin, något annat med en annan. En felaktig färg som är likadan överallt betyder ofta att indata som ett värde räknas ut från inte varierar.
```
:::
:::d3d12
```quiz
Meddelande #708 sa att tabellerna pekar in i `'CBV/SRV heap'` medan heapen som är satt på command listen är `(nullptr)`. Varför behöver en descriptor-tabell att den heapen är satt?
- [ ] Därför att `SetGraphicsRootDescriptorTable` kopierar deskriptorerna ur heapen som är satt
- [ ] Därför att root signaturen sparar vilken heap den skapades med
- [ ] Det gör den inte: meddelandet är bara en varning
- [x] Därför att en tabell bara är ett GPU-handtag till en plats inuti en shader-synlig heap, och shadrarna kan bara läsa deskriptorer från de heaps som satts med `SetDescriptorHeaps`
---
Högst en CBV/SRV/UAV-heap och en sampler-heap kan vara satta åt gången, och att byta dem kan vara dyrt på viss hårdvara – därför lägger program oftast alla sina deskriptorer i en stor shader-synlig heap och sätter den en gång per command list.
```
:::

## Felsöka shaderns utdata

När det gäller GLSL (eller HLSL) har vi tyvärr varken tillgång till en funktion som `glGetError` eller möjlighet att
stega igenom shaderkoden. När du får en svart skärm eller helt fel bild är det ofta svårt att avgöra om det är något
fel i shaderkoden. Visst, vi har kompileringsfelen som rapporterar syntaxfel, men att fånga semantiska fel är en helt
annan sak.

Ett vanligt knep för att ta reda på vad som är fel med en shader är att utvärdera alla relevanta variabler i
shaderprogrammet genom att skicka dem direkt till fragment shaderns utdata. Genom att skriva shadervariabler direkt
till färgkanalerna kan vi förmedla intressant information som vi kan granska i bilden. Säg till exempel att vi vill
kontrollera om en modell har korrekta normalvektorer. Vi kan skicka dem (transformerade eller inte) från vertex shadern
till fragment shadern och där skriva ut normalerna så här:

```glsl
#version 330 core
out vec4 FragColor;
in vec3 Normal;
[...]

void main()
{
    [...]
    FragColor.rgb = Normal;
    FragColor.a = 1.0f;
}
```

Genom att skriva en (icke-färg-)variabel till färgutdata på det här sättet kan vi snabbt se om variabeln, så långt du
kan bedöma, har rimliga värden. Är bilden till exempel helt svart är det tydligt att normalvektorerna inte skickas rätt
till shadrarna; och när de syns är det ganska lätt att kontrollera om de är (ungefär) rätt: för normaler i världsrymden
ska ytor som vetter åt höger (+x) vara rödaktiga, de som vetter uppåt (+y) grönaktiga. Tänk på att en färg kläms till
0..1 när den skrivs: negativa komponenter syns som 0, så en normal som pekar längs -x är lika svart som ingen normal
alls. För värden med tecken visar `Normal * 0.5 + 0.5` hela intervallet.

Kuben har inga normaler, men den har texturkoordinater – och det var dem Vulkan-projektet hade fel på. Gör nu uppgiften
**shader-output**: skriv texturkoordinaterna som färg i stället för texturen, u som rött och v som grönt, och behåll
texturraden som en kommentar:

:::opengl
```glsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    FragColor = vec4(TexCoords, 0.0, 1.0);
    // FragColor = texture(tex, TexCoords);
```

Bygg och kör: kuben visar en **röd–grön gradient** på varje sida: svart i sidans nedre vänstra hörn (u, v = 0, 0), rött
nere till höger (1, 0), grönt uppe till vänster (0, 1) och gult uppe till höger (1, 1). Texturkoordinaterna är som de
ska vara.
:::
:::vulkan
```glsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    outColor = vec4(fragTexCoord, 0.0, 1.0);
    // outColor = texture(texSampler, fragTexCoord);
```

Bygg och kör: kuben visar en **röd–grön gradient** på varje sida: svart i sidans nedre vänstra hörn (u, v = 0, 0), rött
nere till höger (1, 0), grönt uppe till vänster (0, 1) och gult uppe till höger (1, 1) – texturen laddas vänd
(`stbi_set_flip_vertically_on_load(true)`), så koordinaterna är OpenGL:s. Hade du gjort det här före rättningen hade
hela kuben varit svart: (0, 0) överallt – vilket pekar rakt på texturkoordinaterna.
:::
:::d3d12
```hlsl
    // debugging shader output: show the texture coordinates as a colour (u = red, v = green)
    return float4(input.texCoord, 0.0f, 1.0f);
    // return tex.Sample(wrapSampler, input.texCoord);
```

Kör programmet: kuben visar en **röd–grön gradient** på varje sida: svart i sidans övre vänstra hörn (u, v = 0, 0),
rött uppe till höger (1, 0), grönt nere till vänster (0, 1) och gult nere till höger (1, 1). Det skiljer sig med flit
från OpenGL-bilden: i Direct3D är v = 0 en bilds översta rad, så kursens vertexdata använder OpenGL:s 1 - v för att
hålla träet upprätt – och grönt, som är v, växer här nedåt på varje sida. Uppgiften visar värdet som shadern verkligen
har.
:::

```quiz
En belyst modell blir helt svart. Du skriver dess normal som fragmentfärg (`FragColor.rgb = Normal;`) och modellen är fortfarande helt svart. Vilken är den troligaste slutsatsen?
- [ ] Belysningskoden är fel, normalerna är bra
- [ ] Modellen är för långt från ljuset
- [ ] Texturen är ofullständig
- [x] Normalerna når inte fragment shadern (de är noll) – kontrollera vertexattributet och hur vertex shadern skickar dem vidare
---
En riktig modells normaler pekar åt alla håll, så åtminstone några sidor borde visa rött, grönt eller blått. Helt svart betyder noll (eller bara negativa komponenter – därför är `Normal * 0.5 + 0.5` det säkrare testet).
```

## OpenGL:s GLSL-referenskompilator

Varje drivrutin har sina egenheter; NVIDIA:s drivrutiner är till exempel mer tillåtande och tenderar att se mellan
fingrarna med vissa begränsningar i specifikationen, medan ATI/AMD:s drivrutiner tenderar att följa
OpenGL-specifikationen striktare (vilket enligt learnopengl är det bättre angreppssättet). Resultatet är att shaders
på en maskin kanske inte fungerar på en annan på grund av skillnader mellan drivrutiner.

Med åren lär du dig de små skillnaderna mellan GPU-tillverkarna, men vill du vara säker på att din shaderkod fungerar
på alla sorters maskiner kan du kontrollera den direkt mot den officiella specifikationen med OpenGL:s
GLSL-referenskompilator, **glslangValidator** (en del av Khronos projekt glslang och av Vulkan SDK). Givet en
shaderfil säger den om koden är giltig GLSL: `glslangValidator debugging.vert`. Den väljer shadersteg efter filens
ändelse – `.vert`, `.frag`, `.geom`, `.tesc`, `.tese`, `.comp` – så en fil med en annan ändelse behöver steget angivet
uttryckligen, till exempel `glslangValidator -S vert debugging.vs`. Observera att den kontrollerar mot specifikationen,
inte mot din drivrutin: kod som den godkänner kan fortfarande träffa en drivrutinsbugg, men kod som den underkänner bör
du inte lita på någonstans.

:::opengl
Kursens OpenGL-shaders är `.vs`- och `.fs`-filer, så de behöver `-S vert` och `-S frag`.
:::
:::vulkan
I Vulkan använder du redan den här kompilatorn: GLSL kompileras till SPIR-V innan programmet körs (med `glslc` eller
`glslangValidator -V`, kursens bygge gör det åt dig), så varje syntax- och typfel rapporteras när du bygger, aldrig av
drivrutinen. Det kompilatorn inte kan veta är hur shadern *används* – vilka attribut pipelinen matar, vilka
deskriptorer som är bundna – och det är precis den sortens fel som valideringslagret rapporterade i det här kapitlet.
:::
:::d3d12
I Direct3D 12 är HLSL-kompilatorn Microsofts egen, densamma för alla drivrutiner: `D3DCompileFromFile` (och de
fristående kompilatorerna `fxc` och `dxc`) rapporterar fel med rad och kolumn, och kursens projekt skriver ut dem via
fel-bloben – det sista argumentet till `D3DCompileFromFile`. Drivrutinerna får kompilerad bytekod, inte källkod, så det
finns mycket mindre utrymme för skillnader mellan tillverkare i själva språket. Det kompilatorn inte kan kontrollera är
hur shadern *används*: det är debuglagrets jobb, som i det här kapitlet.
:::

## Framebufferns utdata

:::opengl
När en framebuffer inte är komplett kommer inget av det du ritar till den fram. Sedan kapitlet Framebuffers har kursen
kontrollerat varje framebuffer den skapar:

```cpp
if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
    std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
```

Statusen som returneras anger orsaken (`GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT`, `…_MISSING_ATTACHMENT`, …), och att rita
till eller läsa från en ofullständig framebuffer sätter `GL_INVALID_FRAMEBUFFER_OPERATION` – sista raden i
`glGetError`s tabell.
:::
:::vulkan
Vulkan har ingen fullständighetskontroll att anropa: en framebuffer, dess attachments och render passet den används
med kontrolleras av valideringslagret när de skapas och används (fel format, storlekar, usage-flaggor, en framebuffer
som inte är kompatibel med render passet …) – ytterligare ett skäl att ha lagret påslaget under utvecklingen.
:::
:::d3d12
Direct3D 12 har ingen fullständighetskontroll att anropa: render target- och depth-stencil-vyer kontrolleras av
debuglagret när de skapas och binds (format, dimensioner, en vy som inte passar sin resurs, en PSO vars `RTVFormats`
skiljer sig från de bundna målen …) – ytterligare ett skäl att ha lagret påslaget under utvecklingen.
:::

Ett annat användbart knep i felsökningslådan är att visa innehållet i en framebuffer (eller ett render target) i ett
förutbestämt område av skärmen. Du kommer sannolikt att använda framebuffrar ganska ofta, och eftersom det mesta av
deras magi sker bakom kulisserna är det ibland svårt att se vad som pågår. Att visa framebufferns innehåll på skärmen
är ett användbart knep för att snabbt se om saker ser rätt ut.

Observera att visning av en framebuffers innehåll (attachments) på det här sättet bara fungerar för texture
attachments, inte för renderbuffer-objekt (eller andra mål som du inte kan sampla).

Idén är learnopengls: en liten shader för en skärmrektangel, med en vertex shader som bara skickar vidare position och
texturkoordinater och en fragment shader som samplar texturen. En hjälpfunktion ritar rektangeln i ett hörn av
skärmen – till exempel uppe till höger – med texturen du vill se bunden:

```cpp
void DisplayFramebufferTexture(unsigned int textureID)
{
    if (!initialized)
    {
        // initialize shader and vao w/ NDC vertex coordinates at top-right of the screen
        [...]
    }

    glActiveTexture(GL_TEXTURE0);
    glUseProgram(shaderDisplayFBOOutput);
        glBindTexture(GL_TEXTURE_2D, textureID);
        glBindVertexArray(vaoDebugTexturedRect);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);
    glUseProgram(0);
}

int main()
{
    [...]
    while (!glfwWindowShouldClose(window))
    {
        [...]
        DisplayFramebufferTexture(fboAttachment0);

        glfwSwapBuffers(window);
    }
}
```

Det ger dig ett trevligt litet fönster i skärmens hörn för att felsöka framebufferns utdata – användbart till exempel
när du försöker avgöra om normalvektorerna från geometripasset i en deferred renderer ser rätt ut. Du kan förstås bygga
ut en sådan hjälpfunktion så att den kan visa mer än en textur. Det är ett snabbt och enkelt sätt att få kontinuerlig
återkoppling om vad som finns i dina framebuffrar. Samma sak fungerar i alla API:er: rita en rektangel med render
targetets textur – kursen gjorde precis det i kapitlet Shadow Mapping, med djupkartan på skärmen.

## Externa felsökningsprogram

När allt annat misslyckas finns fortfarande möjligheten att ta hjälp av ett verktyg från tredje part. Sådana program
kopplar ofta in sig i grafikdrivrutinerna och kan fånga upp alla sorters API-anrop för att ge dig en mängd intressanta
data. De kan hjälpa dig på många sätt: profilera hur API-funktioner används, hitta flaskhalsar, granska buffrars minne
och visa texturer och framebuffer-attachments. När du arbetar med (stor) produktionskod kan den här sortens verktyg bli
ovärderliga.

Arbetssättet är detsamma i alla: du startar ditt program från verktyget (eller ansluter verktyget till det), *fångar*
en bildruta och stegar sedan igenom bildrutans API-anrop ett i taget – med pipelinens tillstånd vid varje ritanrop,
innehållet i varje buffer och textur, och för en vald pixel hela dess historik: vilka ritanrop som berörde den och vad
varje shader returnerade.

- **RenderDoc** är ett utmärkt (helt gratis och med öppen källkod) fristående felsökningsverktyg för Vulkan,
  Direct3D 11 och 12, OpenGL (core profile, 3.2 och senare) och OpenGL ES. Det visar objektnamnen som det här kapitlet
  gav (`glObjectLabel`, `vkSetDebugUtilsObjectNameEXT`, `SetName`) och grupperna och etiketterna för avsnitt av
  command buffers.
- **NVIDIA Nsight Graphics** är NVIDIA:s grafikdebugger och profilerare för Direct3D, Vulkan och OpenGL; den fungerar
  bäst på NVIDIA-hårdvara, där den också visar vad GPU:ns enheter gör.
- **PIX on Windows** är Microsofts verktyg för Direct3D 12-program: GPU-fångster av bildrutor och tidsfångster som
  visar var en bildrutas tid går åt på CPU:n och GPU:n.

learnopengl nämner också AMD:s CodeXL, som AMD inte längre utvecklar; efterföljarna är AMD:s utvecklarverktyg för
Radeon.

:::d3d12
Själva debuglagret har mer än det här kapitlet använde. **GPU-baserad validering** (`ID3D12Debug1::SetEnableGPUBasedValidation(TRUE)`,
innan enheten skapas) lappar shadrarna så att GPU:n medan den kör kontrollerar det som lagret på CPU-sidan inte kan
se: deskriptorer som är oinitierade eller av fel typ, resurser i fel tillstånd, indexering förbi slutet av en heap.
Det är långsamt, så det är tänkt för enstaka testkörningar. Och **DRED** (*Device Removed Extended Data*) registrerar,
när GPU:n kraschar och enheten tas bort, vilka command list-operationer som hade körts och vilken sidfelsadress som
träffades – svaret på "var kraschade den?" när `DXGI_ERROR_DEVICE_REMOVED` annars är allt du får.
:::
:::vulkan
Själva valideringslagret har mer än det här kapitlet använde: *synkroniseringsvalidering* (saknade barriärer och
konflikter mellan kommandon), *GPU-assisterad validering* (kontroller inuti shadrarna, till exempel av
deskriptorindexering), varningar om *best practices* och *debug printf*, en `printf` för shaders. De slås på med
`VkValidationFeaturesEXT` eller med Vulkan Configurator (`vkconfig`) i Vulkan SDK.
:::

```quiz
Vad ger en fångad bildruta i RenderDoc (eller Nsight Graphics, eller PIX) som det här kapitlets debugmeddelanden inte ger?
- [ ] En lista över varje API-anrop som bröt mot en regel i specifikationen
- [ ] Snabbare rendering, eftersom verktyget ersätter drivrutinen
- [x] Varje anrop i en bildruta i ordning, med pipelinens tillstånd, de bundna resurserna, innehållet i buffrar och texturer vid varje ritanrop och en pixels historik – för fel som är helt laglig API-användning men ger fel bild
- [ ] Shaderkällkoden för varje program som körs på datorn
---
Meddelandena hittar *otillåten* användning av API:t. En felaktig matris, ett felaktigt blend-tillstånd eller en textur bunden till fel plats är tillåtet – det ritar bara fel sak. Där hjälper det att stega igenom en fångad bildruta.
```

## Mer att läsa

- [Debugging](https://learnopengl.com/In-Practice/Debugging): learnopengls kapitel som det här kapitlet följer.

:::opengl
- [glGetError](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGetError.xhtml) och
  [glDebugMessageCallback](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDebugMessageCallback.xhtml):
  referenssidorna, med felkoderna och callbackens parametrar.
- [KHR_debug](https://registry.khronos.org/OpenGL/extensions/KHR/KHR_debug.txt): utökningen som debug output gjordes
  av, med standardtillståndet för varje meddelande.
:::
:::vulkan
- [Validation layers](https://vulkan-tutorial.com/Drawing_a_triangle/Setup/Validation_layers): vulkan-tutorials
  kapitel om lagret, messengern och callbacken.
- [Debugging (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/debugging.html): objektnamn,
  etiketter och messengern i specifikationen.
:::
:::d3d12
- [Understanding the D3D12 debug layer](https://learn.microsoft.com/en-us/windows/win32/direct3d12/understanding-the-d3d12-debug-layer)
  och [GPU-based validation](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-d3d12-debug-layer-gpu-based-validation):
  Microsofts dokumentation av debuglagret.
- [ID3D12InfoQueue::GetMessage](https://learn.microsoft.com/en-us/windows/win32/api/d3d12sdklayers/nf-d3d12sdklayers-id3d12infoqueue-getmessage):
  att läsa de sparade meddelandena.
:::
