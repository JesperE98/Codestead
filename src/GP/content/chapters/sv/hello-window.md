# Hello Window

I förra kapitlet skapade du ett fönster och satte upp {{api}}. Men ett fönster som inte visar något är inte till
mycket nytta. I det här kapitlet håller du fönstret öppet, reagerar på tangentbordet och – viktigast av allt – ger
fönstret dess första färg: varje frame rensas hela fönstret till en mörk grönblå färg, `(0.2, 0.3, 0.3, 1.0)`.

:::opengl
Just nu skapar programmet fönstret, laddar GLAD och avslutas direkt, så fönstret försvinner så fort det öppnats.
Du lägger till en *render loop* som håller det öppet, en callback som håller viewporten i takt med fönstrets
storlek, en funktion som stänger fönstret när du trycker på Escape och till sist de två anrop som rensar skärmen.
:::
:::vulkan
I OpenGL är det här kapitlet kort: fönstret du får av GLFW kommer med en *default framebuffer* som OpenGL ritar i
och GLFW visar. Vulkan har inget sådant. Innan du kan visa ens ett rensat fönster måste du själv bygga hela kedjan
från "en bild i GPU-minnet" till "pixlar i fönstret": en window surface, en presentationskö, en swap chain med
sina bilder och image views, en render pass vars attachment rensas, framebuffers, en command buffer som spelar in
rensningen och synkroniseringen som binder ihop att hämta, rendera och presentera. Det motsvarar vulkan-tutorial.coms
kapitel "Presentation" och "Drawing" – allt utom grafikpipelinen och shaders, som rensningen inte behöver och som
kommer i nästa kapitel.

Projektet är resultatet av förra kapitlet (instans, valideringslager, fysisk och logisk enhet), utbyggt till det
här kapitlets form: `initVulkan()` anropar redan `createSurface()`, `createSwapChain()`, `createImageViews()`,
`createRenderPass()`, `createFramebuffers()`, `createCommandPool()`, `createCommandBuffer()` och
`createSyncObjects()`, och `mainLoop()` anropar redan `drawFrame()` varje frame. Funktionskropparna är fortfarande
tomma. Fönstret öppnas och förblir öppet, men ingenting presenteras någonsin i det, så innehållet är odefinierat
(oftast svart) ända fram till sista uppgiften.
:::
:::d3d12
I OpenGL är det här kapitlet kort: fönstret du får av GLFW kommer med en *default framebuffer* som OpenGL ritar i
och GLFW visar. Direct3D 12 har inget sådant. Du följer Microsofts exempel **D3D12HelloWindow**, som skapar allt
som behövs för att visa ett rensat fönster: en swap chain med två back buffers, en descriptor heap med en render
target view för var och en av dem, en command allocator och en command list samt en fence för att vänta på GPU:n.
Sedan spelar det varje frame in några kommandon – "gör back buffern till render target, rensa den, gör den
presenterbar igen" – kör dem och presenterar resultatet.

Projektet är resultatet av förra kapitlet (factory, adapter, device, command queue), utbyggt till exemplets form:
klassen `D3D12App` deklarerar redan alla medlemmar från exemplet (`m_swapChain`, `m_renderTargets[FrameCount]`,
`m_rtvHeap`, `m_commandAllocator`, `m_commandList`, `m_fence` …) och funktionerna `LoadAssets`, `OnUpdate`,
`OnRender`, `PopulateCommandList` och `WaitForPreviousFrame`, men de flesta funktionskroppar är fortfarande tomma.
Fönstret öppnas och förblir öppet, men ingenting presenteras någonsin i det, så dess klientyta förblir omålad tills
du renderar den första framen.
:::

Som tidigare markerar `// TODO:`-kommentarerna i projektet var din kod ska in, och **Bygg & kör** (Ctrl+Enter)
kompilerar programmet och kör det i den inbyggda simulatorn.

## Ready your engines

Vi vill inte ha ett program som ritar en enda bild och sedan genast avslutas och stänger fönstret. Vi vill att
programmet fortsätter rita bilder och hantera användarens indata tills det uttryckligen har blivit tillsagt att
sluta. Därför skapar vi en loop, som vi kallar *render loop*, som fortsätter köras tills vi säger åt den att
sluta. Ett varv i render loopen kallas oftare en *frame*.

:::opengl
Här är en mycket enkel render loop:

```cpp
while (!glfwWindowShouldClose(window))
{
    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

- `glfwWindowShouldClose` kontrollerar i början av varje varv om GLFW har blivit instruerat att stänga. I så fall
  returnerar funktionen `true` och render loopen slutar, varefter vi kan avsluta programmet.
- `glfwPollEvents` kontrollerar om några händelser har inträffat (som tangentbordsindata eller musrörelser),
  uppdaterar fönstrets tillstånd och anropar motsvarande funktioner (som vi kan registrera som callbacks). Ett
  klick på fönstrets stängknapp är en sådan händelse: det är den som får `glfwWindowShouldClose` att returnera
  `true`.
- `glfwSwapBuffers` byter färgbufferten (en stor 2D-buffert med ett färgvärde för varje pixel i GLFW:s fönster)
  som renderades till under det här varvet och visar den på skärmen.

Gör nu den första uppgiften, **render-loop**: ersätt TODO-kommentaren i `main` med render loopen. Förutom de två
GLFW-anropen innehåller loopen två kommentarer, `// input` och `// render`, var och en med en TODO – de markerar
platserna för nästa uppgifter:

```cpp
while (!glfwWindowShouldClose(window))
{
    // input
    // -----
    // TODO: process the input (processInput)

    // render
    // ------
    // TODO: clear the screen with a colour

    // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
    // -------------------------------------------------------------------------------
    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

Bygg och kör: fönstret förblir nu öppet tills du stänger det. Innehållet är fortfarande odefinierat (troligen
svart), eftersom ingenting rensar eller ritar i det ännu.
:::
:::vulkan
I Vulkan-projektet finns render loopen redan, i `mainLoop()`:

```cpp
void mainLoop() {
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        drawFrame();
    }

    vkDeviceWaitIdle(device);
}
```

`glfwWindowShouldClose` och `glfwPollEvents` gör precis samma sak som i OpenGL: loopen körs tills någon klickar på
fönstrets stängknapp, och `glfwPollEvents` behandlar fönstrets händelser. Det som saknas är motsvarigheten till
OpenGL:s `glfwSwapBuffers` – Vulkan har inga buffertar som GLFW kan byta. Det jobbet ska `drawFrame()` göra (och
`vkDeviceWaitIdle` förklaras i slutet av kapitlet), men först behöver du något att rita i och ett sätt att visa
det.
:::
:::d3d12
I DirectX 12-projektet finns loopen redan, i slutet av `wWinMain`:

```cpp
MSG msg = {};
while (msg.message != WM_QUIT)
{
    if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
    {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    // TODO: when no messages are waiting, update and render a frame (app.OnUpdate, app.OnRender)
}
```

`PeekMessage` är Win32:s motsvarighet till `glfwPollEvents`: den tar ut nästa meddelande till fönstret (en
tangenttryckning, ett klick på stängknappen …) ur kön, och `DispatchMessage` skickar det vidare till `WindowProc`.
Till skillnad från `GetMessage` väntar `PeekMessage` inte när kön är tom – den returnerar `FALSE` direkt, så
loopen kan rendera en frame när det inte finns något annat att göra. Det är vad TODO-kommentaren gäller; du fyller
i den när det finns något att rendera. Loopen slutar när meddelandet `WM_QUIT` kommer, som `PostQuitMessage`
skickar när fönstret förstörs.
:::

**Dubbelbuffring.** När ett program ritar i en enda buffert kan bilden flimra. Det beror på att bilden inte ritas
på ett ögonblick, utan pixel för pixel och oftast från vänster till höger och uppifrån och ned. Eftersom bilden
visas för användaren medan den fortfarande renderas kan resultatet innehålla artefakter. För att undvika det
använder fönsterprogram en dubbelbuffert för renderingen. *Front*-bufferten innehåller den färdiga bilden som
visas på skärmen, medan alla renderingskommandon ritar i *back*-bufferten. Så snart alla renderingskommandon är
klara *byter* vi back-bufferten mot front-bufferten, så att bilden kan visas utan att fortfarande renderas till –
och alla de nämnda artefakterna försvinner.

```quiz
Varför renderar fönsterprogram i en back buffer i stället för direkt i bilden som syns på skärmen?
- [ ] Eftersom GPU:n bara kan skriva till buffertar som inte syns
- [ ] Eftersom två buffertar fördubblar fönstrets upplösning
- [ ] Så att programmet slipper rensa skärmen varje frame
- [x] Så att betraktaren aldrig ser en halvfärdig bild: framen visas först när den är helt ritad
---
Att rita tar tid och sker bit för bit. Med en front- och en back buffer visar skärmen alltid en färdig frame,
medan nästa ritas utom synhåll.
```

:::opengl
```quiz
Vad händer om du utelämnar `glfwPollEvents()` i render loopen?
- [x] Fönstrets händelser behandlas aldrig, så ett klick på stängknappen gör ingenting och fönstret slutar svara
- [ ] Fönstret stängs omedelbart
- [ ] Ingenting ändras, GLFW hämtar händelser automatiskt
- [ ] Ingenting visas, eftersom det är `glfwPollEvents` som presenterar framen
---
Det är `glfwPollEvents` som behandlar händelserna och uppdaterar fönstrets tillstånd – inklusive flaggan som
`glfwWindowShouldClose` läser. Utan den tar loopen aldrig slut och operativsystemet anser att fönstret inte svarar.
```
:::
:::vulkan
I Vulkan är dubbelbufferten ett objekt som du skapar uttryckligen: **swap chainen**. Innan du kan skapa den
behöver du en surface att presentera till och en kö som kan presentera.

### Window surface

Eftersom Vulkan är ett plattformsoberoende API kan det inte på egen hand prata direkt med fönstersystemet. För att
koppla ihop Vulkan med fönstersystemet och kunna visa resultat på skärmen behöver vi WSI-tilläggen (Window System
Integration). Det första är `VK_KHR_surface`. Det tillhandahåller objektet `VkSurfaceKHR`, som representerar en
abstrakt yta att presentera renderade bilder till. I vårt program backas ytan upp av fönstret som vi redan har
öppnat med GLFW.

`VK_KHR_surface` är ett tillägg på instansnivå, och du har faktiskt redan aktiverat det: det finns med i listan
som `glfwGetRequiredInstanceExtensions` returnerar, tillsammans med det plattformsspecifika tillägg (till exempel
`VK_KHR_win32_surface` på Windows) som behövs för att skapa en surface för ett fönster. GLFW döljer de
plattformsskillnaderna bakom en enda funktion, `glfwCreateWindowSurface`:

```cpp
void createSurface() {
    if (glfwCreateWindowSurface(instance, window, nullptr, &surface) != VK_SUCCESS) {
        throw std::runtime_error("failed to create window surface!");
    }
}
```

Parametrarna är instansen, GLFW-fönsterpekaren, egna allokerare och en pekare till variabeln av typen
`VkSurfaceKHR`. Ytan måste skapas direkt efter instansen (och debug messengern), eftersom den faktiskt kan påverka
valet av fysisk enhet – därför anropar `initVulkan()` `createSurface()` före `pickPhysicalDevice()`. En surface
hör till instansen, så den förstörs med `vkDestroySurfaceKHR` före instansen:

```cpp
vkDestroySurfaceKHR(instance, surface, nullptr);
```

Gör nu uppgiften **surface**: lägg till medlemmen `VkSurfaceKHR surface;`, fyll i `createSurface()` och förstör
ytan i `cleanup()` (efter debug messengern, före instansen).

### Presentationskö

Även om Vulkan-implementationen stöder fönsterintegration betyder det inte att varje enhet i systemet gör det. Det
är faktiskt möjligt att köfamiljerna som stöder ritkommandon och de som stöder presentation inte överlappar. Du
behöver alltså en köfamilj som kan presentera till *din* surface, och du letar efter den bredvid grafikfamiljen i
`findQueueFamilies()`:

```cpp
struct QueueFamilyIndices {
    std::optional<uint32_t> graphicsFamily;
    std::optional<uint32_t> presentFamily;

    bool isComplete() {
        return graphicsFamily.has_value() && presentFamily.has_value();
    }
};
```

```cpp
VkBool32 presentSupport = false;
vkGetPhysicalDeviceSurfaceSupportKHR(device, i, surface, &presentSupport);

if (presentSupport) {
    indices.presentFamily = i;
}
```

Det är mycket troligt att grafik- och presentationsfamiljen blir samma index, men programmet behandlar dem som
separata köer för att hålla det enhetligt. I `createLogicalDevice()` skapar du därför en `VkDeviceQueueCreateInfo`
per *unik* familj – en `std::set` tar bort dubbletten:

```cpp
std::vector<VkDeviceQueueCreateInfo> queueCreateInfos;
std::set<uint32_t> uniqueQueueFamilies = {indices.graphicsFamily.value(), indices.presentFamily.value()};

float queuePriority = 1.0f;
for (uint32_t queueFamily : uniqueQueueFamilies) {
    VkDeviceQueueCreateInfo queueCreateInfo{};
    queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
    queueCreateInfo.queueFamilyIndex = queueFamily;
    queueCreateInfo.queueCount = 1;
    queueCreateInfo.pQueuePriorities = &queuePriority;
    queueCreateInfos.push_back(queueCreateInfo);
}
```

Sedan använder `createInfo.queueCreateInfoCount` och `createInfo.pQueueCreateInfos` den här vektorn, och när
enheten har skapats hämtar du köns handle (om familjerna är desamma får båda handles troligen samma värde):

```cpp
vkGetDeviceQueue(device, indices.presentFamily.value(), 0, &presentQueue);
```

Gör nu uppgiften **present-queue**.

### Kontrollera stöd för swap chain

Alla grafikkort kan inte presentera bilder direkt på en skärm, till exempel för att de är byggda för servrar och
saknar bildutgångar. Eftersom bildpresentation är så tätt knuten till fönstersystemet och fönstrens ytor ingår den
inte i Vulkans kärna. Du måste aktivera *enhets*tillägget `VK_KHR_swapchain` efter att ha kontrollerat att det
stöds. Deklarera först listan med nödvändiga enhetstillägg:

```cpp
const std::vector<const char*> deviceExtensions = {
    VK_KHR_SWAPCHAIN_EXTENSION_NAME
};
```

`checkDeviceExtensionSupport()` räknar upp en enhets tillägg med `vkEnumerateDeviceExtensionProperties` och bockar
av de nödvändiga i en `std::set<std::string>`; är mängden tom på slutet finns allt. Att aktivera tillägget tar två
rader i `createLogicalDevice()`:

```cpp
createInfo.enabledExtensionCount = static_cast<uint32_t>(deviceExtensions.size());
createInfo.ppEnabledExtensionNames = deviceExtensions.data();
```

Det räcker inte att bara kontrollera att tillägget finns, eftersom det kanske inte är kompatibelt med din window
surface. Det finns i grunden tre sorters egenskaper att kontrollera:

- grundläggande egenskaper hos ytan (min/max antal bilder i swap chainen, min/max bredd och höjd på bilderna),
- ytformat (pixelformat, färgrymd),
- tillgängliga presentationslägen.

De samlas i en struct:

```cpp
struct SwapChainSupportDetails {
    VkSurfaceCapabilitiesKHR capabilities;
    std::vector<VkSurfaceFormatKHR> formats;
    std::vector<VkPresentModeKHR> presentModes;
};
```

`querySwapChainSupport()` fyller i den med `vkGetPhysicalDeviceSurfaceCapabilitiesKHR`,
`vkGetPhysicalDeviceSurfaceFormatsKHR` och `vkGetPhysicalDeviceSurfacePresentModesKHR` (de två sista med de vanliga
två anropen: först antalet, sedan datan). Alla tre tar den fysiska enheten *och ytan*, eftersom de är swap
chainens kärnkomponenter. För det här programmet räcker stödet för swap chain om det finns minst ett bildformat
och ett presentationsläge som stöds, så `isDeviceSuitable()` blir:

```cpp
bool isDeviceSuitable(VkPhysicalDevice device) {
    QueueFamilyIndices indices = findQueueFamilies(device);

    bool extensionsSupported = checkDeviceExtensionSupport(device);

    bool swapChainAdequate = false;
    if (extensionsSupported) {
        SwapChainSupportDetails swapChainSupport = querySwapChainSupport(device);
        swapChainAdequate = !swapChainSupport.formats.empty() && !swapChainSupport.presentModes.empty();
    }

    return indices.isComplete() && extensionsSupported && swapChainAdequate;
}
```

Det är viktigt att du frågar efter stödet för swap chain först efter att ha kontrollerat att tillägget finns. Gör
nu uppgiften **swap-chain-support**.

### Välja rätt inställningar för swap chainen

Om `swapChainAdequate` är sant räcker stödet, men det kan fortfarande finnas många olika lägen av varierande
kvalitet. Tre inställningar ska bestämmas, var och en med en egen hjälpfunktion.

**Ytformat.** Varje `VkSurfaceFormatKHR` innehåller ett `format` (färgkanalerna och deras typer) och en
`colorSpace`. vulkan-tutorial föredrar `VK_FORMAT_B8G8R8A8_SRGB`. Det här projektet föredrar medvetet
`VK_FORMAT_B8G8R8A8_UNORM` i stället (med den vanliga färgrymden `VK_COLOR_SPACE_SRGB_NONLINEAR_KHR`):

```cpp
VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& availableFormats) {
    // A UNORM format shows the colours we write unchanged (like OpenGL's default framebuffer).
    for (const auto& availableFormat : availableFormats) {
        if (availableFormat.format == VK_FORMAT_B8G8R8A8_UNORM && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
            return availableFormat;
        }
    }

    return availableFormats[0];
}
```

Skälet: när du skriver till en `_SRGB`-bild behandlar hårdvaran värdena som *linjära* färger och omvandlar dem
till sRGB på vägen in. Det är rätt för ljusberäkningar, men det betyder att rensningsfärgen `(0.2, 0.3, 0.3)`
skulle se märkbart ljusare ut på skärmen – ungefär RGB (124, 149, 149) i stället för (51, 76, 76). OpenGL:s
default framebuffer och DirectX 12-exemplen (`DXGI_FORMAT_R8G8B8A8_UNORM`) skriver värdena oförändrade, så med ett
`UNORM`-format visar alla tre API:erna samma färger genom hela kursen. Gamma och sRGB får ett eget kapitel längre
fram.

**Presentationsläge.** Presentationsläget är förmodligen den viktigaste inställningen för swap chainen, eftersom
det avgör de faktiska villkoren för att visa bilder på skärmen. Det finns fyra möjliga lägen:

- `VK_PRESENT_MODE_IMMEDIATE_KHR`: bilder som programmet skickar överförs direkt till skärmen, vilket kan ge
  tearing.
- `VK_PRESENT_MODE_FIFO_KHR`: swap chainen är en kö där skärmen tar en bild från köns början när skärmen
  uppdateras, och programmet lägger renderade bilder sist i kön. Om kön är full måste programmet vänta. Det liknar
  mest vertikal synkronisering (vsync) i moderna spel. Ögonblicket då skärmen uppdateras kallas "vertical blank".
- `VK_PRESENT_MODE_FIFO_RELAXED_KHR`: skiljer sig från FIFO bara om programmet är sent och kön var tom vid förra
  vertical blank. I stället för att vänta på nästa vertical blank överförs bilden direkt när den till slut kommer,
  vilket kan ge synlig tearing.
- `VK_PRESENT_MODE_MAILBOX_KHR`: en annan variant av FIFO. I stället för att blockera programmet när kön är full
  ersätts bilderna som redan står i kö helt enkelt av de nyare. Det brukar kallas "trippelbuffring".

Bara `VK_PRESENT_MODE_FIFO_KHR` finns garanterat, så `chooseSwapPresentMode()` letar efter MAILBOX och faller
tillbaka på FIFO:

```cpp
VkPresentModeKHR chooseSwapPresentMode(const std::vector<VkPresentModeKHR>& availablePresentModes) {
    for (const auto& availablePresentMode : availablePresentModes) {
        if (availablePresentMode == VK_PRESENT_MODE_MAILBOX_KHR) {
            return availablePresentMode;
        }
    }

    return VK_PRESENT_MODE_FIFO_KHR;
}
```

**Swap extent.** Swap extent är upplösningen på swap chainens bilder, och den är nästan alltid exakt lika med
fönstrets upplösning i *pixlar*. Intervallet av möjliga upplösningar anges i `VkSurfaceCapabilitiesKHR`. Vulkan
säger åt oss att matcha fönstrets upplösning genom att sätta bredd och höjd i `currentExtent`. Vissa
fönsterhanterare tillåter dock att vi avviker här, vilket anges genom att bredd och höjd i `currentExtent` sätts
till största värdet för `uint32_t`. Då väljer du den upplösning som bäst matchar fönstret inom gränserna
`minImageExtent` och `maxImageExtent` – i pixlar, och därför frågar koden GLFW efter *framebufferns* storlek (på
skärmar med hög DPI skiljer sig skärmkoordinater och pixlar åt):

```cpp
VkExtent2D chooseSwapExtent(const VkSurfaceCapabilitiesKHR& capabilities) {
    if (capabilities.currentExtent.width != std::numeric_limits<uint32_t>::max()) {
        return capabilities.currentExtent;
    } else {
        int width, height;
        glfwGetFramebufferSize(window, &width, &height);

        VkExtent2D actualExtent = {
            static_cast<uint32_t>(width),
            static_cast<uint32_t>(height)
        };

        actualExtent.width = std::clamp(actualExtent.width, capabilities.minImageExtent.width, capabilities.maxImageExtent.width);
        actualExtent.height = std::clamp(actualExtent.height, capabilities.minImageExtent.height, capabilities.maxImageExtent.height);

        return actualExtent;
    }
}
```

### Skapa swap chainen

`createSwapChain()` börjar med att anropa de tre hjälpfunktionerna. Sedan bestämmer den hur många bilder swap
chainen ska ha. Håller man sig till minimum kan man ibland behöva vänta på att drivrutinen ska bli klar med interna
operationer innan man kan hämta nästa bild att rendera till, så den begär minst en bild mer än minimum (och ett
`maxImageCount` på 0 betyder att det inte finns något maximum):

```cpp
uint32_t imageCount = swapChainSupport.capabilities.minImageCount + 1;
if (swapChainSupport.capabilities.maxImageCount > 0 && imageCount > swapChainSupport.capabilities.maxImageCount) {
    imageCount = swapChainSupport.capabilities.maxImageCount;
}
```

Strukturen `VkSwapchainCreateInfoKHR` får ytan, antalet bilder, det valda formatet, färgrymden och extent, samt
några fält till:

- `imageArrayLayers` är alltid 1, om du inte utvecklar ett stereoskopiskt 3D-program.
- `imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT`: vi renderar direkt till bilderna, så de används som
  färg-attachments.
- `imageSharingMode`: om grafik- och presentationsfamiljen skiljer sig åt används bilderna av två familjer.
  `VK_SHARING_MODE_CONCURRENT` (med båda familjeindexen) låter båda använda dem utan uttryckliga
  ägarskapsöverföringar. Är familjerna desamma – vilket de är på det mesta hårdvara – använder programmet
  `VK_SHARING_MODE_EXCLUSIVE`, som ger bäst prestanda.
- `preTransform = currentTransform` säger att vi inte vill att någon transformation (som en rotation på 90 grader)
  ska tillämpas.
- `compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR` ignorerar alfakanalen vid blandning med andra fönster.
- `presentMode` är det valda läget, och `clipped = VK_TRUE` betyder att vi inte bryr oss om färgen på pixlar som
  är skymda, till exempel för att ett annat fönster ligger framför dem.
- `oldSwapchain = VK_NULL_HANDLE`: fältet behövs bara när en swap chain skapas om (till exempel efter en
  storleksändring), vilket det här programmet inte gör.

Sedan skapas swap chainen, och du hämtar handles till dess bilder – återigen med två anrop, eftersom
implementationen får skapa fler bilder än du bad om:

```cpp
if (vkCreateSwapchainKHR(device, &createInfo, nullptr, &swapChain) != VK_SUCCESS) {
    throw std::runtime_error("failed to create swap chain!");
}

vkGetSwapchainImagesKHR(device, swapChain, &imageCount, nullptr);
swapChainImages.resize(imageCount);
vkGetSwapchainImagesKHR(device, swapChain, &imageCount, swapChainImages.data());

swapChainImageFormat = surfaceFormat.format;
swapChainExtent = extent;
```

Bilderna ägs av swap chainen och förstörs tillsammans med den. Själva swap chainen förstörs i `cleanup()`, före
enheten, med `vkDestroySwapchainKHR(device, swapChain, nullptr);`.

```quiz
Swap chainen använder `VK_PRESENT_MODE_FIFO_KHR` och dess kö av bilder som väntar på att visas är full. Vad händer när programmet vill presentera ännu en bild?
- [ ] Bilden visas direkt, kanske med tearing
- [x] Programmet måste vänta tills skärmen tar en bild ur kön vid nästa vertical blank
- [ ] Den äldsta bilden i kön ersätts av den nya
- [ ] `vkQueuePresentKHR` misslyckas och bilden går förlorad
---
FIFO är en kö som skärmen tömmer en gång per uppdatering – precis som vsync. Att ersätta bilder i kön är vad
MAILBOX gör, och att visa bilden direkt är IMMEDIATE (eller FIFO_RELAXED när programmet är sent).
```

Gör nu uppgiften **swap-chain**: lägg till medlemmarna (`swapChain`, `swapChainImages`, `swapChainImageFormat`,
`swapChainExtent`), skriv de tre hjälpfunktionerna, fyll i `createSwapChain()` och förstör swap chainen i
`cleanup()`.

### Image views

För att använda en `VkImage`, även dem i swap chainen, måste du skapa ett `VkImageView`-objekt. En image view är
bokstavligen en vy in i en bild: den beskriver hur bilden ska läsas och vilken del av den, till exempel om den ska
behandlas som en 2D-textur eller som en djuptextur utan mipmap-nivåer. `createImageViews()` skapar en vy per bild i
swap chainen:

```cpp
VkImageViewCreateInfo createInfo{};
createInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
createInfo.image = swapChainImages[i];
createInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
createInfo.format = swapChainImageFormat;
createInfo.components.r = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.g = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.b = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.components.a = VK_COMPONENT_SWIZZLE_IDENTITY;
createInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
createInfo.subresourceRange.baseMipLevel = 0;
createInfo.subresourceRange.levelCount = 1;
createInfo.subresourceRange.baseArrayLayer = 0;
createInfo.subresourceRange.layerCount = 1;

if (vkCreateImageView(device, &createInfo, nullptr, &swapChainImageViews[i]) != VK_SUCCESS) {
    throw std::runtime_error("failed to create image views!");
}
```

Med fältet `components` kan du kasta om färgkanalerna (identitetsmappningen behåller dem som de är), och
`subresourceRange` säger att bilderna är färgmål utan mipmap-nivåer eller flera lager. Till skillnad från bilderna
har vi själva skapat våra image views, så de förstörs i `cleanup()` med `vkDestroyImageView` i en loop.

Gör nu uppgiften **image-views**: lägg till `std::vector<VkImageView> swapChainImageViews;`, ändra dess storlek
till `swapChainImages.size()` och skapa en vy för varje bild.
:::
:::d3d12
I DirectX 12 är dubbelbufferten ett objekt som du skapar uttryckligen: **swap chainen**.

### Swap chainen

En swap chain är en uppsättning buffertar som DXGI visar i fönstret i tur och ordning. I slutet av `LoadPipeline`
beskriver du den med en `DXGI_SWAP_CHAIN_DESC1`:

```cpp
// Describe and create the swap chain.
DXGI_SWAP_CHAIN_DESC1 swapChainDesc = {};
swapChainDesc.BufferCount = FrameCount;
swapChainDesc.Width = m_width;
swapChainDesc.Height = m_height;
swapChainDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
swapChainDesc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
swapChainDesc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
swapChainDesc.SampleDesc.Count = 1;
```

- `BufferCount = FrameCount`, och `FrameCount` är 2: en buffert syns på skärmen (front buffern) medan du ritar i
  den andra (back buffern) – precis den dubbelbuffring som beskrivs ovan.
- `Width` och `Height` är buffertarnas storlek: fönstrets klientyta på 800×600.
- `DXGI_FORMAT_R8G8B8A8_UNORM` lagrar 8 bitar per kanal, som värden från 0.0 till 1.0 som skrivs oförändrade – så
  `(0.2, 0.3, 0.3)` ser likadant ut som i OpenGL.
- `DXGI_USAGE_RENDER_TARGET_OUTPUT` säger att buffertarna ska renderas till.
- `DXGI_SWAP_EFFECT_FLIP_DISCARD` väljer *flip-modellen*: vid `Present` byter buffertarna roller i stället för att
  kopieras, och innehållet i en back buffer kastas när den har presenterats – du måste rita om hela bufferten
  varje frame. Direct3D 12 stöder bara flip-modellen (`FLIP_SEQUENTIAL` eller `FLIP_DISCARD`), som kräver minst
  två buffertar.
- `SampleDesc.Count = 1`: ingen multisampling (en swap chain med flip-modellen kan inte multisamplas).

Sedan skapar factoryn swap chainen för fönstret:

```cpp
ComPtr<IDXGISwapChain1> swapChain;
ThrowIfFailed(factory->CreateSwapChainForHwnd(
    m_commandQueue.Get(),        // Swap chain needs the queue so that it can force a flush on it.
    m_hwnd,
    &swapChainDesc,
    nullptr,
    nullptr,
    &swapChain
    ));

// This program does not support fullscreen transitions (Alt+Enter).
ThrowIfFailed(factory->MakeWindowAssociation(m_hwnd, DXGI_MWA_NO_ALT_ENTER));

ThrowIfFailed(swapChain.As(&m_swapChain));
m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();
```

Lägg märke till första parametern: i Direct3D 12 tar `CreateSwapChainForHwnd` **command queuen**, inte devicen.
Presentationen är arbete som måste ske i ordning med renderingsarbetet på den kön. De två `nullptr` är en valfri
beskrivning för helskärm och en utgång (output) som swap chainen kan begränsas till. `MakeWindowAssociation` med
`DXGI_MWA_NO_ALT_ENTER` hindrar DXGI från att växla till helskärm vid Alt+Enter, vilket programmet inte hanterar.

`CreateSwapChainForHwnd` returnerar ett `IDXGISwapChain1`; `swapChain.As(&m_swapChain)` frågar efter det nyare
gränssnittet `IDXGISwapChain3` (ett COM-`QueryInterface`), som har `GetCurrentBackBufferIndex`. Indexet – 0 eller
1 – talar om vilken buffert som är back buffer just nu; det sparas i `m_frameIndex`.

```quiz
Swap chainen använder `DXGI_SWAP_EFFECT_FLIP_DISCARD`. Vad betyder det för din rendering?
- [x] Efter `Present` kastas back bufferns innehåll, så varje frame måste rita hela bufferten igen
- [ ] Swap chainen kopierar back buffern till fönstret och behåller innehållet till nästa frame
- [ ] Swap chainen fungerar bara med en enda buffert
- [ ] Frames som inte är klara till nästa vertical blank kastas
---
Med flip-modellen byter buffertarna roller vid `Present`; "discard" betyder att DXGI inte sparar något av back
bufferns gamla innehåll åt dig. Att rensa hela render targeten varje frame tar hand om det.
```

Gör nu uppgiften **swap-chain**: skapa swap chainen i slutet av `LoadPipeline`, som ovan.

### Render target views

Swap chainen äger de två buffertarna, men GPU:n renderar inte till en resurs bara för att den finns. Den behöver
en **descriptor**: ett litet datablock som fullständigt beskriver en resurs för GPU:n och hur den används. En
*render target view* (RTV) är en descriptor som säger "den här texturen är en render target". Descriptors bor i en
**descriptor heap**, som kan ses som en array av descriptors. Du skapar en heap med plats för `FrameCount` RTV:er:

```cpp
// Create descriptor heaps.
{
    // Describe and create a render target view (RTV) descriptor heap.
    D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
    rtvHeapDesc.NumDescriptors = FrameCount;
    rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    ThrowIfFailed(m_device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&m_rtvHeap)));

    m_rtvDescriptorSize = m_device->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
}
```

Storleken på en descriptor beror på hårdvaran, så du frågar devicen med `GetDescriptorHandleIncrementSize` och
sparar den i `m_rtvDescriptorSize`: descriptor nummer *n* ligger *n* × `m_rtvDescriptorSize` byte efter heapens
början. Sedan hämtar du varje back buffer från swap chainen med `GetBuffer` och skriver en RTV för den i heapen:

```cpp
// Create frame resources.
{
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart());

    // Create a RTV for each frame.
    for (UINT n = 0; n < FrameCount; n++)
    {
        ThrowIfFailed(m_swapChain->GetBuffer(n, IID_PPV_ARGS(&m_renderTargets[n])));
        m_device->CreateRenderTargetView(m_renderTargets[n].Get(), nullptr, rtvHandle);
        rtvHandle.Offset(1, m_rtvDescriptorSize);
    }
}
```

`CD3DX12_CPU_DESCRIPTOR_HANDLE` är en hjälpklass från `d3dx12.h` runt ett vanligt `D3D12_CPU_DESCRIPTOR_HANDLE`;
`Offset(1, m_rtvDescriptorSize)` flyttar den till nästa descriptor. `nullptr` i `CreateRenderTargetView` betyder
"en standardvy av hela resursen i dess eget format".

Gör nu uppgiften **render-targets**.
:::

## One last thing

Så snart vi lämnar render loopen vill vi städa upp alla resurser som allokerats på ett korrekt sätt.

:::opengl
Det görs med funktionen `glfwTerminate`, som projektet redan anropar i slutet av `main`:

```cpp
glfwTerminate();
return 0;
```

Den städar upp alla resurser och avslutar programmet på rätt sätt.
:::
:::vulkan
I Vulkan är det ditt jobb, objekt för objekt: varje `vkCreate…` i det här kapitlet får ett motsvarande
`vkDestroy…` i `cleanup()`, i omvänd ordning mot hur de skapades (swap chainen före enheten, ytan före instansen
…). Varje uppgift talar om vilket objekt som ska förstöras var. En sak till behövs innan `cleanup()` får förstöra
något: GPU:n måste ha slutat använda det. Det är vad `vkDeviceWaitIdle(device)` efter render loopen är till för –
mer om det i slutet av kapitlet.
:::
:::d3d12
I DirectX 12 släpper `ComPtr`-pekarna sina objekt automatiskt när `app` försvinner. Men GPU:n ligger efter CPU:n:
när loopen slutar kan den fortfarande arbeta med den sista framen och använda just de objekt som är på väg att
släppas. Därför väntar `OnDestroy()` – som anropas direkt efter loopen – först tills GPU:n är klar, och stänger
sedan event-handlen som används för väntandet. Du skriver den tillsammans med fencen, längre ned.
:::

## Viewport

:::opengl
Innan vi kan börja rendera måste vi tala om för OpenGL hur stort renderingsfönstret är, så att OpenGL vet hur vi
vill visa data och koordinater i förhållande till fönstret. Vi anger de måtten med funktionen `glViewport`:

```cpp
glViewport(0, 0, 800, 600);
```

De två första parametrarna till `glViewport` anger var fönstrets nedre vänstra hörn ligger. Den tredje och fjärde
parametern anger renderingsfönstrets bredd och höjd i pixlar. Vi skulle faktiskt kunna sätta viewporten mindre än
fönstret; då skulle all OpenGL-rendering visas i ett mindre område, och vi skulle till exempel kunna visa andra
element utanför OpenGL-viewporten.

Bakom kulisserna använder OpenGL värdena från `glViewport` för att omvandla de 2D-koordinater som den har
behandlat till koordinater på skärmen. Till exempel skulle en behandlad punkt på `(-0.5, 0.5)` (som sista
transformation) avbildas på `(200, 450)` i skärmkoordinater. Observera att behandlade koordinater i OpenGL ligger
mellan -1 och 1, så vi avbildar i praktiken intervallet (-1 till 1) på (0, 800) och (0, 600).

När kontexten görs aktuell första gången sätter OpenGL viewporten till fönstrets storlek, och därför behöver
projektet inget `glViewport`-anrop från början. Men så fort användaren ändrar fönstrets storlek bör viewporten
också justeras. Vi kan registrera en callback-funktion på fönstret som anropas varje gång fönstrets storlek
ändras. Den här callbacken har följande prototyp:

```cpp
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
```

Funktionen tar ett `GLFWwindow` som första argument och två heltal med fönstrets nya mått. När fönstrets storlek
ändras anropar GLFW funktionen och fyller i rätt argument åt dig:

```cpp
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and
    // height will be significantly larger than specified on retina displays.
    glViewport(0, 0, width, height);
}
```

Vi måste tala om för GLFW att vi vill att funktionen anropas vid varje storleksändring genom att registrera den:

```cpp
glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
```

På retinaskärmar blir `width` och `height` betydligt större än de ursprungliga värdena – därför är det
*framebufferns* storlek (i pixlar) och inte fönstrets storlek (i skärmkoordinater) som spelar roll här.

Det finns många callback-funktioner vi kan sätta för att registrera egna funktioner. Vi kan till exempel göra en
callback som hanterar ändringar i joystick-indata, tar hand om felmeddelanden osv. Vi registrerar
callback-funktionerna efter att fönstret har skapats och innan render loopen startar.

Gör nu uppgiften **viewport**: deklarera `framebuffer_size_callback` överst i filen, registrera den direkt efter
`glfwMakeContextCurrent(window);` och skriv definitionen längst ned. Inget synligt ändras ännu, eftersom ingenting
ritas.

```quiz
Viewporten är satt med `glViewport(0, 0, 800, 600)`. Var hamnar en behandlad punkt på `(-0.5, 0.5)` i fönsterkoordinater?
- [x] (200, 450)
- [ ] (400, 300)
- [ ] (600, 150)
- [ ] (-400, 300)
---
Viewporten avbildar x från -1…1 på 0…800 och y från -1…1 på 0…600: x = (-0.5 + 1) / 2 × 800 = 200 och
y = (0.5 + 1) / 2 × 600 = 450 (räknat från nedre vänstra hörnet).
```
:::
:::vulkan
Vulkan har också en viewport, med samma uppgift som i OpenGL: den avbildar de behandlade koordinaterna (-1 till 1)
på framebuffern. Men den är en del av grafikpipelinen, som du skapar i nästa kapitel – där sätter du den till swap
chainens extent. Rensning, som är allt det här kapitlet gör, använder inte viewporten: render passen rensar hela
sin render area.

Och storleksändringar? Storleken på swap chainens bilder bestäms när swap chainen skapas (`swapChainExtent`). Om
fönstret ändrar storlek passar swap chainen inte längre och måste *skapas om* tillsammans med allt som beror på
den. vulkan-tutorial tar hand om det i ett senare kapitel ("Swap chain recreation"). Fram till dess skapas
fönstret helt enkelt utan möjlighet att ändra storlek, vilket du ser i `initWindow()`:

```cpp
glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
glfwWindowHint(GLFW_RESIZABLE, GLFW_FALSE);
```

Vulkan-projektet behöver alltså ännu ingen motsvarighet till OpenGL:s `framebuffer_size_callback`, och det finns
ingen uppgift i det här avsnittet.

```quiz
Varför behöver Vulkan-programmet i det här kapitlet ingen `framebuffer_size_callback`?
- [ ] Swap chainens extent är alltid skärmens storlek, inte fönstrets
- [ ] `glfwPollEvents` uppdaterar viewporten själv
- [ ] Vulkan ändrar storleken på swap chainens bilder automatiskt när fönstret ändrar storlek
- [x] Fönstret skapas utan möjlighet att ändra storlek, och en ny storlek skulle kräva att swap chainen skapas om – det kommer senare
---
Swap chainens bilder behåller den extent de skapades med. En storleksändring kräver att swap chainen (och dess
image views och framebuffers) skapas om; tills det har gåtts igenom är `GLFW_RESIZABLE` `GLFW_FALSE`.
```
:::
:::d3d12
Direct3D 12 har också en viewport, med samma uppgift som i OpenGL: en `D3D12_VIEWPORT` avbildar de behandlade
koordinaterna (-1 till 1) på render targeten. Den sätts inte en gång för alla, utan spelas in i command listen
varje frame med `RSSetViewports` (tillsammans med en scissor-rektangel), eftersom en command list börjar utan
eget tillstånd. Du lägger till båda i nästa kapitel, Hello Triangle, när du börjar rita. Rensning använder inte
viewporten: `ClearRenderTargetView` rensar hela render targeten.

Och storleksändringar? Back buffrarnas storlek bestäms när swap chainen skapas (`m_width` × `m_height`). Precis som
exemplet D3D12HelloWindow reagerar programmet inte på en ny fönsterstorlek; DXGI sträcker då helt enkelt ut back
buffrarna på 800×600 över fönstrets klientyta. Ett program som vill att buffertarna ska följa fönstret hanterar
meddelandet `WM_SIZE`: det väntar på GPU:n, släpper sina referenser till back buffrarna, anropar
`IDXGISwapChain::ResizeBuffers` och skapar render target views på nytt. Det finns ingen uppgift i det här
avsnittet.

```quiz
Var sätter ett Direct3D 12-program viewporten?
- [ ] En gång på devicen, som OpenGL:s `glViewport`
- [x] I command listen, med `RSSetViewports`, varje gång listen spelas in
- [ ] I `DXGI_SWAP_CHAIN_DESC1`, när swap chainen skapas
- [ ] Ingenstans: Direct3D 12 ritar alltid till hela render targeten
---
En command list tar inte med sig något tillstånd från tidigare inspelningar, så viewporten (och
scissor-rektangeln) spelas in i den varje frame – från nästa kapitel, när något ritas.
```
:::

## Input

Vi vill också ha någon form av styrning via indata.

:::opengl
Det kan vi åstadkomma med flera av GLFW:s indatafunktioner. Vi använder GLFW:s funktion `glfwGetKey`, som tar
fönstret och en tangent. Funktionen returnerar om tangenten är nedtryckt just nu. Vi skapar en funktion
`processInput` för att hålla ordning på all indatakod:

```cpp
void processInput(GLFWwindow *window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
}
```

Här kontrollerar vi om användaren har tryckt på Escape (om den inte är nedtryckt returnerar `glfwGetKey`
`GLFW_RELEASE`). Om användaren har tryckt på Escape stänger vi GLFW genom att sätta dess `WindowShouldClose` till
`true` med `glfwSetWindowShouldClose`. Nästa villkorskontroll i `while`-loopen misslyckas då och programmet
stängs.

Sedan anropar vi `processInput` i varje varv av render loopen:

```cpp
while (!glfwWindowShouldClose(window))
{
    processInput(window);

    glfwSwapBuffers(window);
    glfwPollEvents();
}
```

Det ger oss ett enkelt sätt att kontrollera specifika tangenttryckningar och reagera på dem varje frame.

Gör nu uppgiften **input**: deklarera `processInput` överst, skriv den längst ned i filen och anropa den som det
första i render loopen (den ersätter TODO-kommentaren för input). Bygg och kör, och tryck på **Escape**: fönstret
stängs.
:::
:::vulkan
I Vulkan-program kommer indata också från GLFW, precis som i OpenGL: `glfwPollEvents` i render loopen behandlar
händelserna, och du skulle kunna kontrollera en tangent varje frame med `glfwGetKey(window, GLFW_KEY_ESCAPE)` och
anropa `glfwSetWindowShouldClose(window, true)`. vulkan-tutorial lägger inte till någon indatahantering, och det
gör inte det här projektet heller: fönstret stängs med stängknappen, vilket avslutar loopen i `mainLoop()`. Det
finns ingen uppgift i det här avsnittet.
:::
:::d3d12
Utan GLFW kommer indata som Win32-*meddelanden*. När en tangent trycks ned lägger Windows ett `WM_KEYDOWN`-meddelande
i fönstrets kö; `PeekMessage` tar ut det och `DispatchMessage` anropar `WindowProc` med det. För `WM_KEYDOWN`
innehåller parametern `wParam` tangentens *virtuella tangentkod*, till exempel `VK_ESCAPE`. För att stänga
fönstret med Escape hanterar `WindowProc` meddelandet:

```cpp
case WM_KEYDOWN:
    // Escape closes the window.
    if (wParam == VK_ESCAPE)
    {
        DestroyWindow(hWnd);
    }
    return 0;
```

`DestroyWindow` förstör fönstret, vilket skickar `WM_DESTROY`; den befintliga hanteraren svarar på det med
`PostQuitMessage(0)`, som lägger `WM_QUIT` i kön. Huvudloopen ser det och slutar, och `OnDestroy()` väntar på GPU:n
innan programmet avslutas – samma väg som när man klickar på stängknappen.

Till skillnad från GLFW:s `glfwGetKey`, som du *frågar* en gång per frame, är det här händelsestyrt: `WindowProc`
anropas en gång per tangenttryckning. Det här är kapitlets sista uppgift (**input**); du gör den när fönstret
visar sin färg, i slutet av nästa avsnitt.
:::

## Rendering

Vi vill lägga alla renderingskommandon i render loopen, eftersom vi vill köra alla renderingskommandon i varje varv,
alltså varje frame. I början av varje frame vill vi rensa skärmen. Annars skulle vi fortfarande se resultatet från
förra framen (det kan vara effekten du är ute efter, men oftast inte).

:::opengl
Vi kan rensa skärmens färgbuffert med `glClear`, där vi skickar in buffertbitar som anger vilken buffert vi vill
rensa. De möjliga bitarna är `GL_COLOR_BUFFER_BIT`, `GL_DEPTH_BUFFER_BIT` och `GL_STENCIL_BUFFER_BIT`. Just nu
bryr vi oss bara om färgvärdena, så vi rensar bara färgbufferten.

```cpp
glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);
```

Observera att vi också anger färgen som skärmen ska rensas med, med `glClearColor`. När vi anropar `glClear` och
rensar färgbufferten fylls hela färgbufferten med den färg som `glClearColor` har ställt in. De fyra värdena är
rött, grönt, blått och alfa, vart och ett mellan 0.0 och 1.0; resultatet är en mörk grönblå färg.

Som du kanske minns från kapitlet om OpenGL är `glClearColor` en *tillståndssättande* funktion (state-setting) och
`glClear` en *tillståndsanvändande* funktion (state-using), eftersom den hämtar rensningsfärgen från det aktuella
tillståndet. OpenGL är en stor tillståndsmaskin: `glClearColor` ändrar tillståndet, och varje senare `glClear`
läser det, tills rensningsfärgen ändras igen. (Strängt taget skulle du kunna sätta rensningsfärgen en gång före
loopen – den är ju alltid densamma – men det är tydligare att hålla ihop båda anropen i renderingsdelen.)

Gör nu uppgiften **clear**: lägg de två anropen i loopens renderingsdel, i stället för TODO-kommentaren, före
`glfwSwapBuffers`. Bygg och kör: hela fönstret är nu mörkt grönblått.

```quiz
Vilket av dessa anrop är en *tillståndsanvändande* funktion?
- [x] `glClear`
- [ ] `glClearColor`
- [ ] `glViewport`
---
`glClearColor` och `glViewport` ändrar bara OpenGL:s tillstånd. `glClear` gör faktiskt något – fyller
färgbufferten – och tar färgen från det aktuella tillståndet.
```

```quiz
Vad skulle du se om render loopen aldrig anropade `glClear`, medan programmet ritar ett objekt som rör sig?
- [ ] Ett fel från OpenGL
- [x] Rester av tidigare frames, eftersom varje frame ritar ovanpå det som redan finns i bufferten
- [ ] Exakt samma sak, eftersom `glfwSwapBuffers` rensar bufferten
- [ ] Ett tomt fönster, eftersom ingenting visas utan rensning
---
Bytet av buffertar rensar ingenting, så utan `glClear` börjar varje frame med gammalt (eller odefinierat)
innehåll. Därför börjar renderingen oftast med att skärmen rensas.
```
:::
:::vulkan
I OpenGL är rensning två anrop. I Vulkan körs ingenting direkt: du *spelar in* kommandon i en command buffer och
*skickar* den till en kö. Och kommandona arbetar inte heller på en "aktuell framebuffer", utan inuti en **render
pass** på en uttryckligen angiven framebuffer. Det som återstår är render passen, framebuffers, command buffern och
inspelningen av den, och till sist själva framen.

### Render pass

Innan vi kan rendera måste vi tala om för Vulkan vilka framebuffer-attachments som används under renderingen: hur
många färg- och djupbuffertar det blir, hur många samples var och en ska ha och hur innehållet ska hanteras under
renderingen. All den informationen samlas i ett render pass-objekt. I vårt fall finns bara ett enda
färg-attachment, som representeras av en av bilderna i swap chainen:

```cpp
VkAttachmentDescription colorAttachment{};
colorAttachment.format = swapChainImageFormat;
colorAttachment.samples = VK_SAMPLE_COUNT_1_BIT;
colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
colorAttachment.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
```

`loadOp` och `storeOp` bestämmer vad som ska hända med datan i attachmentet före och efter renderingen. Valen för
`loadOp` är `LOAD` (behåll det befintliga innehållet), `CLEAR` (rensa värdena till en konstant i början) och
`DONT_CARE` (befintligt innehåll är odefinierat; vi bryr oss inte om det). **`VK_ATTACHMENT_LOAD_OP_CLEAR` är så
Vulkan rensar skärmen i det här kapitlet**: varje gång render passen börjar rensas attachmentet till ett
rensningsvärde som du skickar med när du startar den. `STORE` behåller det renderade innehållet i minnet efteråt,
eftersom vi vill se det på skärmen. Vi har ingen stencilbuffert, så stenciloperationerna spelar ingen roll.

Bilder måste ha en viss *layout* för den operation de används i härnäst. `initialLayout = UNDEFINED` betyder att vi
inte bryr oss om vilken layout bilden hade innan – det går bra, eftersom vi ändå rensar den (innehållet bevaras
inte garanterat). `finalLayout = PRESENT_SRC_KHR` betyder att bilden ska vara redo att presenteras med swap
chainen efter renderingen.

En render pass består av en eller flera *subpasses*. Vår har en, som använder attachmentet som sin färgutdata:

```cpp
VkAttachmentReference colorAttachmentRef{};
colorAttachmentRef.attachment = 0;
colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

VkSubpassDescription subpass{};
subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
subpass.colorAttachmentCount = 1;
subpass.pColorAttachments = &colorAttachmentRef;
```

`attachment = 0` är indexet i render passens array av attachments, och layouten är den som bilden övergår till
under subpassen – `COLOR_ATTACHMENT_OPTIMAL` ger bäst prestanda för ett färg-attachment.

Subpasserna i en render pass tar automatiskt hand om dessa layoutövergångar, och övergångarna styrs av *subpass
dependencies*. Operationerna direkt före och direkt efter vår subpass räknas som implicita "subpasses"
(`VK_SUBPASS_EXTERNAL`). Det inbyggda beroendet i början av render passen antar att övergången sker i början av
pipelinen, men vid den tidpunkten har vi inte nödvändigtvis hämtat bilden än! Därför lägger vi till ett beroende
som får övergången – och rensningen – att vänta på steget för färgutdata (color attachment output), samma steg där
framen kommer att vänta på att bilden blir tillgänglig (det ser du i `drawFrame()`):

```cpp
VkSubpassDependency dependency{};
dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
dependency.dstSubpass = 0;
dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
dependency.srcAccessMask = 0;
dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
```

`VkRenderPassCreateInfo` får sedan attachmentet, subpassen och beroendet, och `vkCreateRenderPass` skapar render
passen. Den förstörs i `cleanup()` med `vkDestroyRenderPass`.

I vulkan-tutorial ingår render passen i kapitlen om grafikpipelinen. Lägg märke till att rensning inte behöver
någon pipeline alls: `loadOp` ensam rensar attachmentet, även om ingenting ritas i render passen.

Gör nu uppgiften **render-pass**: lägg till `VkRenderPass renderPass;`, fyll i `createRenderPass()` och förstör
den i `cleanup()`.

### Framebuffers

De attachments som angavs när render passen skapades binds genom att de packas in i ett `VkFramebuffer`-objekt. En
framebuffer refererar till alla `VkImageView`-objekt som representerar attachmenten. I vårt fall är det bara ett
enda: färg-attachmentet. Men vilken bild vi ska använda som attachment beror på vilken bild swap chainen ger oss
när vi hämtar en för presentation. Därför måste vi skapa en framebuffer för varje bild i swap chainen och vid
ritningen använda den som hör till den hämtade bilden:

```cpp
VkImageView attachments[] = {
    swapChainImageViews[i]
};

VkFramebufferCreateInfo framebufferInfo{};
framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
framebufferInfo.renderPass = renderPass;
framebufferInfo.attachmentCount = 1;
framebufferInfo.pAttachments = attachments;
framebufferInfo.width = swapChainExtent.width;
framebufferInfo.height = swapChainExtent.height;
framebufferInfo.layers = 1;
```

En framebuffer kan bara användas med en render pass som är kompatibel med den den skapades för, vilket ungefär
betyder att de använder samma antal och typ av attachments. Framebuffers förstörs i `cleanup()` före render passen
och de image views som de bygger på.

Gör nu uppgiften **framebuffers**: lägg till `std::vector<VkFramebuffer> swapChainFramebuffers;` och skapa en
framebuffer per image view i `createFramebuffers()`.

### Command pool och command buffer

Kommandon i Vulkan, som ritoperationer och minnesöverföringar, körs inte direkt via funktionsanrop. Du måste spela
in alla operationer du vill utföra i command buffer-objekt. Fördelen är att när vi är redo att tala om för Vulkan
vad vi vill göra skickas alla kommandon tillsammans, och Vulkan kan behandla dem effektivare eftersom alla finns
tillgängliga samtidigt.

Command buffers allokeras från en **command pool**, som hanterar minnet där buffertarna lagras. En pool kan bara
allokera command buffers som skickas till en enda typ av kö – här grafikkön, eftersom rensningen sker i en render
pass:

```cpp
VkCommandPoolCreateInfo poolInfo{};
poolInfo.sType = VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;
poolInfo.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
poolInfo.queueFamilyIndex = queueFamilyIndices.graphicsFamily.value();
```

Vi spelar in en command buffer varje frame, så vi vill kunna nollställa och spela in den igen:
`VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT` gör att command buffers kan nollställas var för sig. Sedan
allokerar `createCommandBuffer()` en command buffer från poolen:

```cpp
VkCommandBufferAllocateInfo allocInfo{};
allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
allocInfo.commandPool = commandPool;
allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
allocInfo.commandBufferCount = 1;
```

`VK_COMMAND_BUFFER_LEVEL_PRIMARY` betyder att bufferten kan skickas till en kö för körning (sekundära buffertar kan
bara anropas från primära). Command buffers frigörs automatiskt när deras pool förstörs, så `cleanup()` behöver
bara `vkDestroyCommandPool(device, commandPool, nullptr);`.

Gör nu uppgiften **command-buffer**: lägg till `commandPool` och `commandBuffer`, fyll i `createCommandPool()` och
`createCommandBuffer()` och förstör poolen i `cleanup()`.

### Spela in command buffern

`recordCommandBuffer` skriver kommandona vi vill köra i en command buffer, för bilden i swap chainen med det givna
indexet. Inspelningen börjar alltid med `vkBeginCommandBuffer`:

```cpp
void recordCommandBuffer(VkCommandBuffer commandBuffer, uint32_t imageIndex) {
    VkCommandBufferBeginInfo beginInfo{};
    beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;

    if (vkBeginCommandBuffer(commandBuffer, &beginInfo) != VK_SUCCESS) {
        throw std::runtime_error("failed to begin recording command buffer!");
    }
```

Ritning – och i vårt fall rensning – börjar med att render passen startas med `vkCmdBeginRenderPass`. Render
passen ställs in med en `VkRenderPassBeginInfo`:

```cpp
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = renderPass;
    renderPassInfo.framebuffer = swapChainFramebuffers[imageIndex];
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = swapChainExtent;

    VkClearValue clearColor = {{{0.2f, 0.3f, 0.3f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
```

De första parametrarna är själva render passen och framebuffern som ska bindas – den för bilden i swap chainen som
vi ska rendera till. Render area anger var shaderns läsningar och skrivningar sker; för bäst prestanda bör den
matcha attachmentens storlek. De två sista fälten anger rensningsvärdena för `VK_ATTACHMENT_LOAD_OP_CLEAR`, som vi
använde som load-operation för färg-attachmentet: samma `(0.2, 0.3, 0.3, 1.0)` som i OpenGL. De tredubbla
klammerparenteserna beror på att `VkClearValue` är en union (av ett färgvärde och ett djup/stencil-värde), vars
färgmedlem `VkClearColorValue` i sin tur är en union som innehåller en array `float32[4]`.

`VK_SUBPASS_CONTENTS_INLINE` betyder att render passens kommandon ligger direkt i den primära command buffern.
Det finns inget att rita än, så render passen avslutas direkt, och inspelningen likaså:

```cpp
    vkCmdEndRenderPass(commandBuffer);

    if (vkEndCommandBuffer(commandBuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to record command buffer!");
    }
}
```

Jämför med OpenGL:s tillståndsmaskin: i Vulkan finns ingen "aktuell rensningsfärg" som en tillståndssättande
funktion ändrar och en tillståndsanvändande funktion läser. Rensningsfärgen skickas direkt med kommandot som
använder den.

```quiz
Vad är det i Vulkan-programmet som faktiskt rensar bilden i swap chainen till `(0.2, 0.3, 0.3, 1.0)`?
- [x] Att render passen startar: attachmentets `loadOp` är `VK_ATTACHMENT_LOAD_OP_CLEAR`, och färgen kommer från `pClearValues` i `VkRenderPassBeginInfo`
- [ ] Swap chainen, som rensar varje bild med färgen från `VkSwapchainCreateInfoKHR`
- [ ] `vkQueuePresentKHR`, som fyller bilden innan den visas
- [ ] Ett `vkCmdClearColorImage`-kommando som spelas in efter `vkCmdBeginRenderPass`
---
Load-operationen körs när render passen startar och använder rensningsvärdet som skickas till
`vkCmdBeginRenderPass`. Därför räcker en tom render pass för att rensa fönstret.
```

Gör nu uppgiften **record-commands**: skriv `recordCommandBuffer` som ovan. Ingenting anropar den än, så fönstret
ser likadant ut.

### Rendering och presentation

Det är här allt sätts ihop. På en övergripande nivå består renderingen av en frame i Vulkan av en gemensam
uppsättning steg:

1. Vänta tills förra framen är klar.
2. Hämta en bild från swap chainen.
3. Spela in en command buffer som rensar (senare: ritar scenen på) den bilden.
4. Skicka den inspelade command buffern.
5. Presentera bilden från swap chainen.

**Synkronisering.** En grundtanke i Vulkans design är att synkroniseringen av körning på GPU:n är uttrycklig.
Många Vulkan-anrop som startar arbete på GPU:n är asynkrona: funktionerna returnerar innan operationen är klar.
Att hämta bilden, köra command buffern och presentera är tre sådana operationer som beror på varandra, så vi måste
ordna dem:

- En **semafor** används för att ordna operationer mellan köer, på GPU:n. En operation *signalerar* den när den är
  klar; en annan operation *väntar* på den innan den börjar. CPU:n blockeras inte.
- En **fence** har ett liknande syfte, men används för att synkronisera körningen på CPU:n ("host"). Om hosten
  behöver veta när GPU:n är klar med något använder vi en fence; `vkWaitForFences` blockerar tills den är
  signalerad, och hosten måste själv nollställa den.

Vi behöver en semafor som signalerar att en bild har hämtats från swap chainen och är redo för rendering, en
semafor som signalerar att renderingen är klar och presentationen kan ske, och en fence som ser till att bara en
frame renderas åt gången:

```cpp
VkSemaphore imageAvailableSemaphore;
std::vector<VkSemaphore> renderFinishedSemaphores;
VkFence inFlightFence;
```

Här avviker projektet medvetet från vulkan-tutorial, som använder en enda `renderFinishedSemaphore`. Semaforen
"render finished" väntas på av *presentationsmotorn*, och framens fence talar bara om att command buffern är klar
– inte att presentationen har slutat vänta på semaforen. Med en enda semafor skulle nästa frame kunna signalera den
igen medan förra presentationen fortfarande väntar på den, och nyare versioner av valideringslagren rapporterar
just det som ett fel. En semafor per bild i swap chainen, indexerad med `imageIndex`, undviker det: när swap
chainen lämnar ut samma bild igen är dess förra presentation – och därmed väntan på bildens semafor – över.

```cpp
void createSyncObjects() {
    // One "render finished" semaphore per swap chain image: the presentation engine may still
    // be waiting on it after the fence of the frame has signaled.
    renderFinishedSemaphores.resize(swapChainImages.size());

    VkSemaphoreCreateInfo semaphoreInfo{};
    semaphoreInfo.sType = VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;

    VkFenceCreateInfo fenceInfo{};
    fenceInfo.sType = VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;
    fenceInfo.flags = VK_FENCE_CREATE_SIGNALED_BIT;
```

följt av `vkCreateSemaphore` för `imageAvailableSemaphore`, `vkCreateFence` för `inFlightFence` och en loop som
skapar var och en av `renderFinishedSemaphores`. Lägg märke till `VK_FENCE_CREATE_SIGNALED_BIT`; du ser snart
varför. Alla förstörs överst i `cleanup()` med `vkDestroySemaphore` och `vkDestroyFence`.

**Vänta på förra framen.** I början av framen vill vi vänta tills förra framen är klar, så att command buffern och
semaforerna är lediga att använda:

```cpp
void drawFrame() {
    vkWaitForFences(device, 1, &inFlightFence, VK_TRUE, UINT64_MAX);
    vkResetFences(device, 1, &inFlightFence);
```

`vkWaitForFences` väntar på hosten på fencen (`VK_TRUE`: alla angivna fences; med en enda fence spelar det ingen
roll), med tidsgränsen avstängd via `UINT64_MAX`. Efter väntan nollställs fencen till osignalerat läge. Vid allra
första framen finns ingen tidigare frame som kan signalera fencen, så `vkWaitForFences` skulle blockera för evigt –
om inte fencen skapas i signalerat läge, vilket är precis vad `VK_FENCE_CREATE_SIGNALED_BIT` gör.

**Hämta en bild från swap chainen.**

```cpp
    uint32_t imageIndex;
    vkAcquireNextImageKHR(device, swapChain, UINT64_MAX, imageAvailableSemaphore, VK_NULL_HANDLE, &imageIndex);
```

Efter enheten och swap chainen kommer en tidsgräns och de synkroniseringsobjekt som ska signaleras när
presentationsmotorn är klar med bilden – det är tidpunkten då vi kan börja rita i den. Funktionen returnerar
indexet för den bild i swap chainen som har blivit tillgänglig i `imageIndex`; det är indexet i `swapChainImages`,
och därmed också i `swapChainFramebuffers` och `renderFinishedSemaphores`.

**Spela in command buffern.** Med bildindexet kan du spela in kommandona. Nollställ först command buffern så att
den säkert kan spelas in, och anropa sedan din funktion:

```cpp
    vkResetCommandBuffer(commandBuffer, /*VkCommandBufferResetFlagBits*/ 0);
    recordCommandBuffer(commandBuffer, imageIndex);
```

**Skicka command buffern.**

```cpp
    VkSubmitInfo submitInfo{};
    submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;

    VkSemaphore waitSemaphores[] = {imageAvailableSemaphore};
    VkPipelineStageFlags waitStages[] = {VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT};
    submitInfo.waitSemaphoreCount = 1;
    submitInfo.pWaitSemaphores = waitSemaphores;
    submitInfo.pWaitDstStageMask = waitStages;

    submitInfo.commandBufferCount = 1;
    submitInfo.pCommandBuffers = &commandBuffer;

    VkSemaphore signalSemaphores[] = {renderFinishedSemaphores[imageIndex]};
    submitInfo.signalSemaphoreCount = 1;
    submitInfo.pSignalSemaphores = signalSemaphores;

    if (vkQueueSubmit(graphicsQueue, 1, &submitInfo, inFlightFence) != VK_SUCCESS) {
        throw std::runtime_error("failed to submit draw command buffer!");
    }
```

De tre första parametrarna anger vilka semaforer som ska väntas på innan körningen börjar och i vilket steg av
pipelinen väntan sker. Vi vill vänta med att skriva färger till bilden tills den är tillgänglig, så vi anger det
steg i grafikpipelinen som skriver till färg-attachmentet – samma steg som i subpass-beroendet. Sedan kommer command
buffern som ska skickas och semaforen som ska signaleras när den har körts klart. Sista parametern till
`vkQueueSubmit` är fencen som signaleras när command buffern har körts klart; det är den som nästa frames
`vkWaitForFences` väntar på.

**Presentation.** Sista steget är att lämna tillbaka resultatet till swap chainen så att det till slut syns på
skärmen:

```cpp
    VkPresentInfoKHR presentInfo{};
    presentInfo.sType = VK_STRUCTURE_TYPE_PRESENT_INFO_KHR;

    presentInfo.waitSemaphoreCount = 1;
    presentInfo.pWaitSemaphores = signalSemaphores;

    VkSwapchainKHR swapChains[] = {swapChain};
    presentInfo.swapchainCount = 1;
    presentInfo.pSwapchains = swapChains;

    presentInfo.pImageIndices = &imageIndex;

    vkQueuePresentKHR(presentQueue, &presentInfo);
}
```

Presentationen väntar på den här bildens "render finished"-semafor och anger swap chainen och indexet för bilden
som ska presenteras. `vkQueuePresentKHR` är Vulkans motsvarighet till `glfwSwapBuffers`. Observera att det här
programmet bara har en frame "in flight" åt gången: CPU:n väntar på förra framen innan den börjar på nästa.
vulkan-tutorial tar bort den begränsningen i ett senare kapitel ("Frames in flight").

```quiz
Varför skapas `inFlightFence` med `VK_FENCE_CREATE_SIGNALED_BIT`?
- [ ] Eftersom bara signalerade fences kan nollställas med `vkResetFences`
- [x] Så att `vkWaitForFences` i början av första framen returnerar direkt i stället för att vänta för evigt
- [ ] Så att `vkQueueSubmit` inte behöver någon fence vid första framen
- [ ] Så att GPU:n kan börja rendera innan bilden har hämtats
---
`drawFrame()` väntar på förra framens fence innan något annat. Vid första framen har ingen submit signalerat den
än, så den skapas redan signalerad.
```

**Vänta på enheten på slutet.** Alla operationer i `drawFrame` är asynkrona. Det betyder att när vi lämnar loopen
i `mainLoop` kan ritning och presentation fortfarande pågå, och att städa upp resurser medan det pågår är en dålig
idé. Därför anropar `mainLoop()` `vkDeviceWaitIdle(device)` efter loopen: den väntar tills den logiska enheten är
klar med sina operationer innan `cleanup()` förstör något.

Gör nu sista uppgiften, **draw-frame**: lägg till synkroniseringsmedlemmarna, fyll i `createSyncObjects()` och
`drawFrame()` och förstör semaforerna och fencen i `cleanup()`. Bygg och kör: hela fönstret är nu mörkt grönblått,
och när du stänger det stängs det rent utan något meddelande från valideringslagret.
:::
:::d3d12
I OpenGL är rensning två anrop. I Direct3D 12 körs ingenting direkt: du *spelar in* kommandon i en command list och
*kör* den på command queuen. Och GPU:n arbetar asynkront, så du behöver ett sätt att ta reda på när den är klar.
Fyra steg återstår: command listen, fencen, inspelningen av kommandona och till sist renderingen av framen.

### Command allocator och command list

En **command list** spelar in kommandon till GPU:n; minnet som kommandona lagras i kommer från en **command
allocator**. Skapa allocatorn i slutet av `LoadPipeline`:

```cpp
ThrowIfFailed(m_device->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&m_commandAllocator)));
```

`D3D12_COMMAND_LIST_TYPE_DIRECT` är den typ som GPU:n kan köra direkt och som får innehålla alla sorters kommandon
(ritning, rensning, kopiering), och den matchar command queuens typ. I `LoadAssets` skapar du command listen som
spelar in i den här allocatorn:

```cpp
// Create the command list.
ThrowIfFailed(m_device->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m_commandAllocator.Get(), nullptr, IID_PPV_ARGS(&m_commandList)));

// Command lists are created in the recording state, but there is nothing
// to record yet. The main loop expects it to be closed, so close it now.
ThrowIfFailed(m_commandList->Close());
```

`0` är nodmasken (för en enda GPU), och `nullptr` är det initiala pipeline state-objektet. Ett pipeline state
beskriver shaders och de fasta inställningarna för ritning; det här kapitlet ritar ingenting, så `m_pipelineState`
förblir null, precis som i exemplet – det får sitt värde i nästa kapitel. En ny command list är öppen för
inspelning; render loopen nollställer den varje frame, och bara en stängd lista får nollställas, så den stängs
direkt.

Gör nu uppgiften **command-list**.

### Fence

GPU:n ligger efter CPU:n: `ExecuteCommandLists` lämnar bara över kommandona till kön och returnerar. För att veta
när GPU:n är klar använder Direct3D 12 en **fence**: ett objekt som håller ett 64-bitarsvärde. Du ber *kön* att
`Signal`-era fencen med ett värde; när GPU:n kommer fram till den punkten i kön – efter allt arbete som skickats
före den – sätter den fencen till det värdet. CPU:n kan läsa värdet med `GetCompletedValue`, eller be om att ett
event sätts när värdet nås. Skapa båda i `LoadAssets`:

```cpp
// Create synchronization objects.
{
    ThrowIfFailed(m_device->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&m_fence)));
    m_fenceValue = 1;

    // Create an event handle to use for frame synchronization.
    m_fenceEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (m_fenceEvent == nullptr)
    {
        ThrowIfFailed(HRESULT_FROM_WIN32(GetLastError()));
    }
}
```

Fencen börjar på 0, och `m_fenceValue` – nästa värde att signalera – på 1. `WaitForPreviousFrame` använder dem:

```cpp
void D3D12App::WaitForPreviousFrame()
{
    // WAITING FOR THE FRAME TO COMPLETE BEFORE CONTINUING IS NOT BEST PRACTICE.
    // This is code implemented as such for simplicity. The D3D12HelloFrameBuffering
    // sample illustrates how to use fences for efficient resource usage and to
    // maximize GPU utilization.

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

    m_frameIndex = m_swapChain->GetCurrentBackBufferIndex();
}
```

Den lägger en `Signal` sist i kön och kontrollerar sedan om GPU:n redan har kommit dit. Om inte ser
`SetEventOnCompletion` till att eventet sätts när fencen når värdet, och `WaitForSingleObject` låter CPU:n sova
tills dess. Efteråt är allt som skickats hittills klart, och funktionen hämtar indexet för nästa frames back
buffer. Som kommentaren säger är det enkelt men inte snabbt att vänta på GPU:n efter varje frame – CPU:n och GPU:n
turas om i stället för att arbeta samtidigt. Microsofts exempel gör så här för att hålla de första stegen enkla.

`OnDestroy` använder samma funktion för att se till att GPU:n inte längre använder något objekt innan
`ComPtr`-pekarna släpper dem, och stänger sedan eventet:

```cpp
void D3D12App::OnDestroy()
{
    // Ensure that the GPU is no longer referencing resources that are about to be
    // cleaned up by the destructor.
    WaitForPreviousFrame();

    CloseHandle(m_fenceEvent);
}
```

Gör nu uppgiften **fence**: skapa fencen och eventet i `LoadAssets`, och fyll i `WaitForPreviousFrame` och
`OnDestroy`.

### Spela in kommandona

`PopulateCommandList` spelar in en frame. Först nollställs allocatorn och listen:

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

Att nollställa allocatorn återanvänder minnet från förra framens kommandon – tillåtet bara för att
`WaitForPreviousFrame` har sett till att GPU:n är klar med dem.

Sedan **resource barriers**. Varje resurs befinner sig i ett *tillstånd* (state) som säger hur den används. En back
buffer som lämnas till swap chainen är i `D3D12_RESOURCE_STATE_PRESENT`; för att rendera till den måste den vara i
`D3D12_RESOURCE_STATE_RENDER_TARGET`. En transition barrier berättar för GPU:n om bytet, så att den kan avsluta
tidigare arbete och förbereda minnet. Hjälpfunktionen `CD3DX12_RESOURCE_BARRIER::Transition` från `d3dx12.h`
bygger en:

```cpp
// Indicate that the back buffer will be used as a render target.
CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_PRESENT, D3D12_RESOURCE_STATE_RENDER_TARGET);
m_commandList->ResourceBarrier(1, &barrier);
```

(Microsofts exempel skickar `&CD3DX12_RESOURCE_BARRIER::Transition(...)` direkt. Att ta adressen till ett
temporärt objekt kompilerar bara med MSVC, så projektet sparar barriären i en lokal variabel först.)

Sedan själva rensningen. `ClearRenderTargetView` tar RTV:n för den aktuella back buffern – descriptor nummer
`m_frameIndex` i heapen – och färgen:

```cpp
CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), m_frameIndex, m_rtvDescriptorSize);

// Record commands.
const float clearColor[] = { 0.2f, 0.3f, 0.3f, 1.0f };
m_commandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
```

De två sista parametrarna är ett antal rektanglar och själva rektanglarna; `0, nullptr` rensar hela vyn. Jämför med
OpenGL:s tillståndsmaskin: det finns ingen "aktuell rensningsfärg" som en tillståndssättande funktion ändrar och en
tillståndsanvändande funktion läser – färgen skickas direkt med kommandot.

Till sist går back buffern tillbaka till tillståndet `PRESENT`, eftersom en back buffer måste vara i det
tillståndet när den presenteras, och listen stängs:

```cpp
// Indicate that the back buffer will now be used to present.
barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_renderTargets[m_frameIndex].Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PRESENT);
m_commandList->ResourceBarrier(1, &barrier);

ThrowIfFailed(m_commandList->Close());
```

```quiz
Varför spelar `PopulateCommandList` in en resource barrier före `ClearRenderTargetView`?
- [ ] Eftersom `ClearRenderTargetView` bara fungerar på resurser som delas mellan köer
- [ ] För att kopiera back buffern till front buffern
- [ ] För att vänta tills förra framen har presenterats
- [x] Back buffern är i tillståndet `PRESENT`; den måste övergå till `RENDER_TARGET` innan man kan rendera till den
---
Resurser har tillstånd. Swap chainen behöver bufferten i `PRESENT`, rendering behöver `RENDER_TARGET`, så listen
för den dit och tillbaka igen.
```

Gör nu uppgiften **clear**: fyll i `PopulateCommandList`. Ingenting anropar den än, så fönstret ser likadant ut.

### Rendera framen

`OnRender` sätter ihop alltihop:

```cpp
void D3D12App::OnRender()
{
    // Record all the commands we need to render the scene into the command list.
    PopulateCommandList();

    // Execute the command list.
    ID3D12CommandList* ppCommandLists[] = { m_commandList.Get() };
    m_commandQueue->ExecuteCommandLists(_countof(ppCommandLists), ppCommandLists);

    // Present the frame.
    ThrowIfFailed(m_swapChain->Present(1, 0));

    WaitForPreviousFrame();
}
```

`ExecuteCommandLists` skickar en array av command lists till kön. `Present` är DirectX 12:s motsvarighet till
`glfwSwapBuffers`: den lämnar back buffern till swap chainen för att visas och gör den andra bufferten till back
buffer. Första parametern, *sync interval*, är 1: presentera vid nästa vertical blank (vsync), så programmet
renderar inte snabbare än skärmen uppdateras. Andra parametern innehåller flaggor; 0 betyder inga. Sedan väntar
`WaitForPreviousFrame` på GPU:n och hämtar det nya back buffer-indexet.

Huvudloopen måste anropa `OnRender`: när `PeekMessage` inte hittar något meddelande uppdaterar och renderar den en
frame:

```cpp
if (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
{
    TranslateMessage(&msg);
    DispatchMessage(&msg);
}
else
{
    // No messages waiting: update and render a frame.
    app.OnUpdate();
    app.OnRender();
}
```

`OnUpdate` är tom i det här kapitlet; det är där senare kapitel ändrar saker från frame till frame.

```quiz
Varför anropar `OnRender` `WaitForPreviousFrame()` efter `Present`?
- [ ] För att vänta på användarens nästa meddelande
- [ ] Så att fence-värdet aldrig ändras
- [x] Så att GPU:n är klar med den här framen innan nästa `PopulateCommandList` nollställer command allocatorn och spelar in i den igen
- [ ] `Present` fungerar bara när GPU:n är sysslolös
---
Inspelningen återanvänder allocatorns minne, vilket bara är tillåtet när GPU:n inte längre kör de kommandona. Att
vänta varje frame garanterar det – enkelt, men CPU:n och GPU:n turas om i stället för att arbeta parallellt.
```

Gör nu uppgiften **render**: fyll i `OnRender` och lägg till `else`-grenen i huvudloopen. Bygg och kör: hela
fönstret är nu mörkt grönblått.

Gör till sist den sista uppgiften, **input**: hantera `WM_KEYDOWN` i `WindowProc` som det beskrivs i avsnittet
Input ovan. Bygg och kör, och tryck på **Escape**: fönstret stängs.
:::

Och det var allt: ett fönster som rensas till valfri färg varje frame, med {{api}}. Allt du ritar i de följande
kapitlen hamnar mellan rensningen och presentationen.

```quiz
I alla API:er följer en frame i det här kapitlets program samma ordning. Vilken?
- [ ] Rensa front buffern medan den syns på skärmen, behandla sedan händelserna
- [ ] Presentera bilden, rensa den sedan
- [x] Behandla fönstrets händelser, rensa back buffern (bilden) och presentera den sedan
- [ ] Skapa swap chainen (eller default framebuffern), rensa den, förstör den
---
Först händelser (indata, stängknappen), sedan rendering i bufferten som inte syns, sedan visas den:
`glfwSwapBuffers`, `vkQueuePresentKHR` eller `Present`.
```
