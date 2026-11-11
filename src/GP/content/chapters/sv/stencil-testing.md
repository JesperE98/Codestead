# Stenciltestning

När fragment shadern har behandlat fragmentet körs ett så kallat *stenciltest* som, precis som djuptestet, kan kasta
fragment. Därefter skickas de återstående fragmenten vidare till djuptestet, där GPU:n kan kasta ännu fler. Stenciltestet
bygger på innehållet i ännu en buffer, *stencilbuffern*, som vi får uppdatera under renderingen för att åstadkomma
intressanta effekter.

En stencilbuffer innehåller (oftast) 8 bitar per *stencilvärde*, vilket ger totalt 256 olika stencilvärden per pixel.
Vi kan sätta stencilvärdena till vad vi vill, och vi kan kasta eller behålla fragment när ett visst fragment har ett
visst stencilvärde.

:::opengl
Varje fönsterbibliotek måste skapa en stencilbuffer åt dig. GLFW gör det automatiskt: ett standardfönster har en
stencilbuffer på 8 bitar (fönsterhinten `GLFW_STENCIL_BITS`) bredvid djupbuffern på 24 bitar, så vi behöver inte be GLFW
att skapa en.
:::
:::vulkan
I Vulkan skapar ingen en stencilbuffer åt dig. Stencilbuffern är en del av djup-imagen: format som
`VK_FORMAT_D32_SFLOAT_S8_UINT` eller `VK_FORMAT_D24_UNORM_S8_UINT` lagrar ett djupvärde *och* ett stencilvärde på 8
bitar per pixel. Förra kapitlets djup-image, `VK_FORMAT_D32_SFLOAT`, har ingen stencildel, så den första uppgiften
byter dess format.
:::
:::d3d12
I Direct3D 12 skapar ingen en stencilbuffer åt dig. Stencilbuffern är en del av djupbuffern: formaten
`DXGI_FORMAT_D24_UNORM_S8_UINT` (24 bitar djup, 8 bitar stencil) och `DXGI_FORMAT_D32_FLOAT_S8X24_UINT` (ett djup som
32-bitars flyttal, 8 bitar stencil och 24 oanvända bitar) lagrar båda per pixel. Förra kapitlets djupbuffer,
`DXGI_FORMAT_D32_FLOAT`, har ingen stencildel, så den första uppgiften byter dess format.
:::

Ett enkelt exempel på en stencilbuffer: tänk dig ett rutnät av stencilvärden lika stort som skärmen, som först töms
till nollor och sedan får en rektangel av ettor skriven i mitten. Om vi sedan ritar en scen med ett stenciltest som
bara går igenom där stencilvärdet är 1, renderas scenens fragment bara inuti rektangeln (de andra kastas) – som om vi
tittade på scenen genom ett fönster utskuret i ett papper. Det är därifrån namnet kommer: som en schablon (stencil)
avgör buffern var färgen kommer igenom.

Med stenciloperationer kan vi sätta stencilbuffern till bestämda värden överallt där vi renderar fragment. Genom att
ändra stencilbufferns innehåll medan vi renderar *skriver* vi till stencilbuffern. I samma (eller följande)
bildruta(or) kan vi *läsa* värdena för att kasta eller släppa igenom vissa fragment. Med stencilbuffrar kan du bli
hur galen du vill, men det allmänna förloppet ser oftast ut så här:

- Slå på skrivning till stencilbuffern.
- Rendera föremål och uppdatera stencilbufferns innehåll.
- Slå av skrivning till stencilbuffern.
- Rendera (andra) föremål, och kasta den här gången vissa fragment utifrån stencilbufferns innehåll.

Med stencilbuffern kan vi alltså kasta vissa fragment utifrån fragmenten från andra föremål i scenen.

:::opengl
Du slår på stenciltestning genom att slå på `GL_STENCIL_TEST`. Från och med då påverkar alla renderingsanrop
stencilbuffern på ett eller annat sätt.

```cpp
glEnable(GL_STENCIL_TEST);
```

Observera att du också måste tömma stencilbuffern varje varv, precis som färg- och djupbuffern:

```cpp
glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
```

Precis som djuptestningens `glDepthMask` finns det också en motsvarande funktion för stencilbuffern. Funktionen
`glStencilMask` låter oss sätta en bitmask som AND:as med det stencilvärde som ska skrivas till buffern. Som standard
är den en bitmask med bara ettor, som inte påverkar resultatet, men om vi satte den till `0x00` skulle alla
stencilvärden som skrivs till buffern bli nollor. Det motsvarar djuptestningens `glDepthMask(GL_FALSE)`:

```cpp
glStencilMask(0xFF); // each bit is written to the stencil buffer as is
glStencilMask(0x00); // each bit ends up as 0 in the stencil buffer (disabling writes)
```

Oftast använder du bara `0x00` eller `0xFF` som stencilmask, men det är bra att veta att du kan sätta egna bitmasker.
:::
:::vulkan
Precis som djuptestet är stenciltestet en del av varje pipeline, i samma `VkPipelineDepthStencilStateCreateInfo`:
`stencilTestEnable = VK_TRUE` är OpenGL:s `glEnable(GL_STENCIL_TEST)`. Stencilbuffern töms i början av render passet
om djup-attachmentens `stencilLoadOp` är `VK_ATTACHMENT_LOAD_OP_CLEAR`; värdet kommer från samma clear-värde som
djupet – `0` i `depthStencil = {1.0f, 0}`.

Motsvarigheten till OpenGL:s `glStencilMask` – en bitmask som AND:as med det stencilvärde som ska skrivas – är
`writeMask` i pipelinens stenciltillstånd. `0xFF` skriver varje bit som den är, `0x00` gör att varje skrivning lämnar
det lagrade värdet orört: skrivningar är avslagna, som djuptestets `depthWriteEnable = VK_FALSE`. Oftast använder du
bara `0x00` eller `0xFF`, men det är bra att veta att du kan sätta egna bitmasker.
:::
:::d3d12
Precis som djuptestet är stenciltestet en del av varje PSO, i samma `DepthStencilState`: `StencilEnable = TRUE` är
OpenGL:s `glEnable(GL_STENCIL_TEST)`. Stencilbuffern töms tillsammans med djupbuffern, i samma `ClearDepthStencilView`,
om flaggorna innehåller `D3D12_CLEAR_FLAG_STENCIL`; stencilvärdet är det fjärde argumentet.

Motsvarigheten till OpenGL:s `glStencilMask` – en bitmask som AND:as med det stencilvärde som ska skrivas – är PSO:ns
`StencilWriteMask`. `0xFF` skriver varje bit som den är, `0x00` gör att varje skrivning lämnar det lagrade värdet
orört: skrivningar är avslagna, som djuptestets `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`. Oftast använder du bara
`0x00` eller `0xFF`, men det är bra att veta att du kan sätta egna bitmasker.
:::

## Stencilfunktioner

Precis som vid djuptestning har vi en viss kontroll över när ett stenciltest ska gå igenom eller misslyckas och hur
det ska påverka stencilbuffern. Det finns totalt två saker vi kan ställa in för stenciltestning: stenciltestets
funktion och hur stencilbuffern uppdateras.

:::opengl
Stenciltestets funktion sätts med `glStencilFunc`, som har tre parametrar:

- `func`: sätter stenciltestets funktion som avgör om ett fragment går igenom eller kastas. Funktionen tillämpas på
  det lagrade stencilvärdet och `glStencilFunc`:s `ref`-värde. Möjliga alternativ är: `GL_NEVER`, `GL_LESS`,
  `GL_LEQUAL`, `GL_GREATER`, `GL_GEQUAL`, `GL_EQUAL`, `GL_NOTEQUAL` och `GL_ALWAYS`. Deras betydelse liknar
  djupbufferns funktioner.
- `ref`: anger referensvärdet för stenciltestet. Stencilbufferns innehåll jämförs med det här värdet.
- `mask`: anger en mask som AND:as med både referensvärdet och det lagrade stencilvärdet innan testet jämför dem.
  Från början bara ettor.

I det enkla stencilexemplet i början skulle funktionen alltså sättas till:

```cpp
glStencilFunc(GL_EQUAL, 1, 0xFF);
```

Det säger åt OpenGL att när ett fragments stencilvärde är lika med (`GL_EQUAL`) referensvärdet `1` går fragmentet
igenom testet och ritas, annars kastas det.

Men `glStencilFunc` beskriver bara om OpenGL ska släppa igenom eller kasta fragment utifrån stencilbufferns innehåll,
inte hur vi faktiskt uppdaterar buffern. Där kommer `glStencilOp` in. Den har tre alternativ, och för vart och ett
anger vi vilken åtgärd som ska utföras:

- `sfail`: åtgärd om stenciltestet misslyckas.
- `dpfail`: åtgärd om stenciltestet går igenom men djuptestet misslyckas.
- `dppass`: åtgärd om både stencil- och djuptestet går igenom.
:::
:::vulkan
Båda finns i pipelinens stenciltillstånd, en `VkStencilOpState` – en för trianglar som ses framifrån
(`depthStencil.front`) och en för dem som ses bakifrån (`depthStencil.back`). OpenGL:s `glStencilFunc(func, ref, mask)`
motsvaras av tre av dess fält:

- `compareOp`: stenciltestets funktion som avgör om ett fragment går igenom eller kastas, en `VkCompareOp` som
  djuptestets: `VK_COMPARE_OP_NEVER`, `LESS`, `LESS_OR_EQUAL`, `GREATER`, `GREATER_OR_EQUAL`, `EQUAL`, `NOT_EQUAL` och
  `ALWAYS`. Den jämför referensvärdet med det lagrade stencilvärdet.
- `reference`: referensvärdet för stenciltestet (OpenGL:s `ref`).
- `compareMask`: en mask som AND:as med både referensvärdet och det lagrade stencilvärdet innan testet jämför dem
  (OpenGL:s `mask`).

I det enkla stencilexemplet i början skulle stenciltillståndet alltså vara `compareOp = VK_COMPARE_OP_EQUAL`,
`reference = 1`, `compareMask = 0xFF`: när ett fragments stencilvärde är lika med referensvärdet 1 går fragmentet
igenom testet och ritas, annars kastas det.

Men det beskriver bara om fragment går igenom eller kastas, inte hur vi faktiskt uppdaterar buffern. Det är vad tre
fält till är till för – OpenGL:s `glStencilOp(sfail, dpfail, dppass)`:

- `failOp`: åtgärd om stenciltestet misslyckas.
- `depthFailOp`: åtgärd om stenciltestet går igenom men djuptestet misslyckas.
- `passOp`: åtgärd om både stencil- och djuptestet går igenom.

Det sjunde fältet, `writeMask`, är skrivmasken från ovan. Allt det här bestäms när pipelinen skapas – om du inte
listar det som dynamiskt tillstånd: `VK_DYNAMIC_STATE_STENCIL_REFERENCE` (med `vkCmdSetStencilReference`) samt jämförelse-
och skrivmaskerna kan vara dynamiska sedan Vulkan 1.0, testfunktionen och operationerna sedan Vulkan 1.3. Den här
kursen behåller allt i pipelinen.
:::
:::d3d12
Maskerna är fält i PSO:ns `DepthStencilState`, testfunktionen och operationerna finns i en `D3D12_DEPTH_STENCILOP_DESC`
– en för trianglar som ses framifrån (`FrontFace`) och en för dem som ses bakifrån (`BackFace`). OpenGL:s
`glStencilFunc(func, ref, mask)` är utspridd på tre ställen:

- `FrontFace.StencilFunc`: stenciltestets funktion som avgör om en pixel går igenom eller kastas, en
  `D3D12_COMPARISON_FUNC` som djuptestets: `D3D12_COMPARISON_FUNC_NEVER`, `LESS`, `LESS_EQUAL`, `GREATER`,
  `GREATER_EQUAL`, `EQUAL`, `NOT_EQUAL` och `ALWAYS`. Den jämför referensvärdet med det lagrade stencilvärdet.
- referensvärdet finns **inte** i PSO:n: det sätts på command listen med `OMSetStencilRef` (OpenGL:s `ref`). Det är
  den enda delen av stenciltestet du kan ändra utan en annan PSO.
- `StencilReadMask`: en mask som AND:as med både referensvärdet och det lagrade stencilvärdet innan testet jämför dem
  (OpenGL:s `mask`).

I det enkla stencilexemplet i början skulle PSO:n alltså ha `StencilFunc = D3D12_COMPARISON_FUNC_EQUAL` och
`StencilReadMask = 0xFF`, och command listen skulle anropa `OMSetStencilRef(1)`: när en pixels stencilvärde är lika
med referensvärdet 1 går pixeln igenom testet och ritas, annars kastas den.

Men det beskriver bara om pixlar går igenom eller kastas, inte hur vi faktiskt uppdaterar buffern. Det är vad tre
fält till i `D3D12_DEPTH_STENCILOP_DESC` är till för – OpenGL:s `glStencilOp(sfail, dpfail, dppass)`:

- `StencilFailOp`: åtgärd om stenciltestet misslyckas.
- `StencilDepthFailOp`: åtgärd om stenciltestet går igenom men djuptestet misslyckas.
- `StencilPassOp`: åtgärd om både stencil- och djuptestet går igenom.
:::

```quiz
Det lagrade stencilvärdet är 3, referensvärdet är 1, testfunktionen är EQUAL och jämförelsemasken är `0x01`. Går fragmentet igenom?
- [ ] Nej – 3 är inte lika med 1
- [x] Ja – masken AND:as först med båda värdena: 3 & 1 = 1 och 1 & 1 = 1, som är lika
- [ ] Bara om skrivmasken också är `0xFF`
---
Jämförelsemasken väljer vilka bitar som deltar i testet. Med `0x01` jämförs bara den lägsta biten, och den är 1 i båda värdena. Skrivmasken har inget med testet att göra; den begränsar bara vad som skrivs efteråt.
```

För vart och ett av alternativen kan du sedan välja någon av följande åtgärder:

:::opengl
| Åtgärd | Beskrivning |
|---|---|
| `GL_KEEP` | Det lagrade stencilvärdet behålls. |
| `GL_ZERO` | Stencilvärdet sätts till 0. |
| `GL_REPLACE` | Stencilvärdet ersätts med referensvärdet som satts med `glStencilFunc`. |
| `GL_INCR` | Stencilvärdet ökas med 1 om det är lägre än maxvärdet. |
| `GL_INCR_WRAP` | Som `GL_INCR`, men slår runt till 0 så fort maxvärdet överskrids. |
| `GL_DECR` | Stencilvärdet minskas med 1 om det är högre än minvärdet. |
| `GL_DECR_WRAP` | Som `GL_DECR`, men slår runt till maxvärdet om det hamnar under 0. |
| `GL_INVERT` | Inverterar stencilbufferns nuvarande värde bitvis. |

Som standard är `glStencilOp` satt till `(GL_KEEP, GL_KEEP, GL_KEEP)`, så oavsett hur testerna går behåller
stencilbuffern sina värden. Standardbeteendet uppdaterar inte stencilbuffern, så om du vill skriva till den måste du
ange minst en annan åtgärd för något av alternativen.

(Båda funktionerna gäller både fram- och baksidor; `glStencilFuncSeparate` och `glStencilOpSeparate` sätter dem för
bara den ena sidan.)
:::
:::vulkan
| Åtgärd (`VkStencilOp`) | Beskrivning |
|---|---|
| `VK_STENCIL_OP_KEEP` | Det lagrade stencilvärdet behålls. |
| `VK_STENCIL_OP_ZERO` | Stencilvärdet sätts till 0. |
| `VK_STENCIL_OP_REPLACE` | Stencilvärdet ersätts med referensvärdet. |
| `VK_STENCIL_OP_INCREMENT_AND_CLAMP` | Stencilvärdet ökas med 1 om det är lägre än maxvärdet. |
| `VK_STENCIL_OP_INCREMENT_AND_WRAP` | Samma, men slår runt till 0 så fort maxvärdet överskrids. |
| `VK_STENCIL_OP_DECREMENT_AND_CLAMP` | Stencilvärdet minskas med 1 om det är högre än minvärdet. |
| `VK_STENCIL_OP_DECREMENT_AND_WRAP` | Samma, men slår runt till maxvärdet om det hamnar under 0. |
| `VK_STENCIL_OP_INVERT` | Inverterar stencilbufferns nuvarande värde bitvis. |

Med alla tre åtgärderna `VK_STENCIL_OP_KEEP` behåller stencilbuffern sina värden oavsett hur testerna går; för att
skriva till den behöver du minst en annan åtgärd.
:::
:::d3d12
| Åtgärd (`D3D12_STENCIL_OP`) | Beskrivning |
|---|---|
| `D3D12_STENCIL_OP_KEEP` | Det lagrade stencilvärdet behålls. |
| `D3D12_STENCIL_OP_ZERO` | Stencilvärdet sätts till 0. |
| `D3D12_STENCIL_OP_REPLACE` | Stencilvärdet ersätts med referensvärdet som satts med `OMSetStencilRef`. |
| `D3D12_STENCIL_OP_INCR_SAT` | Stencilvärdet ökas med 1 om det är lägre än maxvärdet. |
| `D3D12_STENCIL_OP_INCR` | Ökas med 1 och slår runt till 0 så fort maxvärdet överskrids. |
| `D3D12_STENCIL_OP_DECR_SAT` | Stencilvärdet minskas med 1 om det är högre än minvärdet. |
| `D3D12_STENCIL_OP_DECR` | Minskas med 1 och slår runt till maxvärdet om det hamnar under 0. |
| `D3D12_STENCIL_OP_INVERT` | Inverterar stencilbufferns nuvarande värde bitvis. |

Standardtillståndet (`CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)`) har stenciltestningen avslagen, alla tre åtgärderna
`D3D12_STENCIL_OP_KEEP`, funktionen `D3D12_COMPARISON_FUNC_ALWAYS` och båda maskerna `0xFF`. Med KEEP överallt behåller
stencilbuffern sina värden oavsett hur testerna går; för att skriva till den behöver du minst en annan åtgärd.
:::

Med testfunktionen och åtgärderna kan vi alltså ange när och hur vi vill uppdatera stencilbuffern, och när fragment
ska släppas igenom eller kastas utifrån dess innehåll.

## Konturer runt föremål

Det vore förvånande om du helt förstod hur stenciltestning fungerar bara från de föregående avsnitten, så vi ska visa
en särskilt användbar funktion som kan göras med enbart stenciltestning: *object outlining*, att rita konturer runt
föremål.

Object outlining gör precis vad namnet säger. För varje föremål (eller bara ett) skapar vi en smal färgad kant runt
(de sammanslagna) föremålen. Det är en särskilt användbar effekt när du till exempel vill välja enheter i ett
strategispel och behöver visa användaren vilka enheter som är valda. Förloppet för att rita konturer runt föremål är
följande:

1. Slå på skrivning till stencilbuffern.
2. Sätt stenciloperationen till att alltid gå igenom, och uppdatera, innan föremålen (som ska få konturer) ritas,
   stencilbuffern med ettor överallt där föremålens fragment renderas.
3. Rendera föremålen.
4. Slå av skrivning till stencilbuffern och djuptestning.
5. Skala upp varje föremål en liten bit.
6. Använd en annan fragment shader som ger ut en enda (kant)färg.
7. Rita föremålen igen, men bara där deras fragments stencilvärden inte är lika med 1.
8. Slå på djuptestning igen och återställ stencilinställningarna.

Förloppet sätter stencilbufferns innehåll till ettor för varje fragment av föremålen, och när det är dags att rita
kanterna ritar vi uppskalade versioner av föremålen bara där stenciltestet går igenom. Med hjälp av stencilbuffern
kastar vi i praktiken alla fragment av de uppskalade versionerna som ligger där originalföremålens fragment ligger.

Kapitlets projekt är scenen från *Djuptestning* ritad på vanligt sätt (med texturer och djupfunktionen LESS), med en
ändring hämtad från learnopengls stencilkod: loopen ritar **golvet först**, sedan de två kuberna. Med djuptestet ändrar
ordningen inte bilden, men den spelar roll för stencilbuffern, som du ska se. Bygg och kör programmet: startbilden är
den du känner igen från förra kapitlet.

:::opengl
`// TODO:`-kommentarerna markerar var din kod ska stå: efter `glDepthFunc`, efter shadern, vid `glClear`-anropet, efter
matriserna, före golvet, före kuberna och efter dem. Matriserna för varje bildruta räknas nu ut före `shader.use()`,
under `// set uniforms`, så att en andra shader också kan få dem.
:::
:::vulkan
Projektet har samma struktur som förra kapitlets: en vertex buffer, ett descriptor set per textur,
`createPipeline(vertFile, fragFile, pipeline)` med djupfunktionen LESS, och modellmatrisen som push constant.
Fragment shadern `shaders/stencil_single_color.frag` har en `// TODO:`-kommentar; ändringarna i `main.cpp` görs i rader
som redan finns och i de funktioner som varje uppgift nämner.
:::
:::d3d12
Projektet har samma struktur som förra kapitlets: en vertex buffer, en SRV per textur,
`SetGraphicsRootDescriptorTable(2, …)` före varje anrop. Den nya filen `stencil_single_color.hlsl` har redan konturens
vertex shader. `// TODO:`-kommentarer markerar varje ställe som en uppgift fyller i: djupbufferns format, PSO:ns
stenciltillstånd, konturens PSO, tömningen av stencilbuffern och de tre ritomgångarna i `PopulateCommandList`.
:::

Först behöver vi en stencilbuffer som är påslagen och töms varje bildruta, och stenciloperationen i steg 2: vi vill
bara uppdatera stencilbuffern när både stencil- och djuptestet går igenom – då ersätts det lagrade värdet med
referensvärdet. När något av testerna misslyckas behåller vi det.

:::opengl
Efter `glDepthFunc`:

```cpp
    glEnable(GL_STENCIL_TEST);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE); // stencil fails: keep, depth fails: keep, both pass: replace with the reference value
```

och i loopen:

```cpp
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT); // don't forget to clear the stencil buffer!
```

learnopengl anropar här också `glStencilFunc(GL_NOTEQUAL, 1, 0xFF)`. Vi utelämnar det: loopen sätter ändå
stencilfunktionen före varje anrop. Fram till dess är funktionen OpenGL:s standard, `GL_ALWAYS` med referensvärdet 0.
:::
:::vulkan
Djup-imagen behöver ett format med en stencildel. `findDepthFormat()` erbjuder nu bara sådana format;
`findSupportedFormat` väljer det första som GPU:n stöder:

```cpp
            {VK_FORMAT_D32_SFLOAT_S8_UINT, VK_FORMAT_D24_UNORM_S8_UINT}, // depth with an 8-bit stencil buffer
```

Viewn för djup-imagen i `createDepthResources()` omfattar nu båda delarna:

```cpp
        depthImageView = createImageView(depthImage, depthFormat, VK_IMAGE_ASPECT_DEPTH_BIT | VK_IMAGE_ASPECT_STENCIL_BIT);
```

Render passet tömmer stencildelen i början – OpenGL:s `GL_STENCIL_BUFFER_BIT` i `glClear` – till `0` i clear-värdet
`depthStencil = {1.0f, 0}`, som har funnits där hela tiden:

```cpp
        depthAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_CLEAR; // don't forget to clear the stencil buffer!
```

(`stencilStoreOp` förblir `VK_ATTACHMENT_STORE_OP_DONT_CARE`: ingen behöver stencilvärdena efter bildrutan.) Och i
`createPipeline()` slås stenciltestet på, med stenciltillståndet från steg 2 för båda sidorna:

```cpp
        depthStencil.stencilTestEnable = VK_TRUE;
        depthStencil.front.failOp = VK_STENCIL_OP_KEEP;      // the stencil test fails: keep the stored value
        depthStencil.front.depthFailOp = VK_STENCIL_OP_KEEP; // the stencil test passes, the depth test fails: keep it
        depthStencil.front.passOp = VK_STENCIL_OP_REPLACE;   // both pass: store the reference value
        depthStencil.front.compareOp = VK_COMPARE_OP_ALWAYS;
        depthStencil.front.compareMask = 0xFF;
        depthStencil.front.writeMask = 0xFF;
        depthStencil.front.reference = 1;
        depthStencil.back = depthStencil.front; // the same for triangles seen from behind
```

Kubernas trianglar cullas inte, så både fram- och bakåtvända ritas: `back` måste få samma tillstånd.
:::
:::d3d12
Djupbuffern behöver ett format med en stencildel, `DXGI_FORMAT_D24_UNORM_S8_UINT`, på fyra ställen: depth stencil
viewn (`depthStencilDesc.Format`), clear-värdet (`depthOptimizedClearValue.Format`), texturen
(`CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_D24_UNORM_S8_UINT, …)`) och PSO:n (`psoDesc.DSVFormat`):

```cpp
        // A depth stencil buffer: 24 bits of depth and 8 bits of stencil per pixel.
        D3D12_DEPTH_STENCIL_VIEW_DESC depthStencilDesc = {};
        depthStencilDesc.Format = DXGI_FORMAT_D24_UNORM_S8_UINT;
```

I `LoadAssets`, efter djupfunktionen, slås stenciltestet på med operationerna från steg 2 för båda sidorna:

```cpp
        // The stencil test: on. What happens to the stored stencil value when the stencil
        // test fails: keep it; when the stencil test passes but the depth test fails: keep
        // it; when both pass: replace it with the reference value (OMSetStencilRef). The
        // same for triangles seen from the front and from the back.
        psoDesc.DepthStencilState.StencilEnable = TRUE;
        psoDesc.DepthStencilState.FrontFace.StencilFailOp = D3D12_STENCIL_OP_KEEP;
        psoDesc.DepthStencilState.FrontFace.StencilDepthFailOp = D3D12_STENCIL_OP_KEEP;
        psoDesc.DepthStencilState.FrontFace.StencilPassOp = D3D12_STENCIL_OP_REPLACE;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
```

Kubernas trianglar cullas inte, så både fram- och bakåtvända ritas: `BackFace` måste få samma tillstånd. Till sist
tömmer `PopulateCommandList` även stencilbuffern – OpenGL:s `GL_STENCIL_BUFFER_BIT` – till 0, det fjärde argumentet:

```cpp
    m_commandList->ClearDepthStencilView(dsvHandle, D3D12_CLEAR_FLAG_DEPTH | D3D12_CLEAR_FLAG_STENCIL, 1.0f, 0, 0, nullptr);    // don't forget to clear the stencil buffer!
```

Testfunktionen är fortfarande standardvärdet `ALWAYS`, och referensvärdet är 0 tills en command list sätter ett annat.
:::

```quiz
Stenciloperationerna är KEEP (stenciltestet misslyckas), KEEP (djuptestet misslyckas), REPLACE (båda går igenom). När ändrar ett fragment det lagrade stencilvärdet?
- [ ] Varje gång det ritas, oavsett vad testerna säger
- [ ] Bara när stenciltestet misslyckas
- [ ] När stenciltestet går igenom, även om djuptestet misslyckas
- [x] Bara när det klarar både stencil- och djuptestet – då blir värdet referensvärdet
---
REPLACE är bara den tredje åtgärden, den för "båda testerna går igenom". Ett kubfragment som är dolt bakom något närmare lämnar alltså stencilbuffern orörd: ettorna hamnar exakt där kuben syns.
```

Gör nu uppgiften **stencil-buffer** och bygg och kör sedan. Inget synligt ändras: testfunktionen är ALWAYS, så varje
fragment går igenom och ritas som förut.

:::opengl
(Varje fragment skriver också referensvärdet – OpenGL:s standard, 0.)
:::
:::vulkan
(Varje fragment skriver också referensvärdet, 1 – golvet också, än så länge.)
:::
:::d3d12
(Varje pixel skriver också referensvärdet – fortfarande 0.)
:::

Steg 6 behöver en fragment shader som ger ut en enda kantfärg. Vi sätter helt enkelt ett hårdkodat färgvärde, en mörk
blågrön:

:::opengl
`stencil_single_color.fs`:

```glsl
#version 330 core
out vec4 FragColor;

void main()
{
    FragColor = vec4(0.04, 0.28, 0.26, 1.0);
}
```

Konturerna ritas med ett eget shaderprogram, `shaderSingleColor`, byggt av samma vertex shader och den här fragment
shadern, direkt efter `shader`:

```cpp
    Shader shaderSingleColor("stencil_testing.vs", "stencil_single_color.fs");
```

Det behöver samma vy- och projektionsmatriser som `shader`, varje bildruta. Ett program måste vara i bruk när du sätter
dess uniforms, så efter att matriserna räknats ut:

```cpp
        shaderSingleColor.use();
        shaderSingleColor.setMat4("view", view);
        shaderSingleColor.setMat4("projection", projection);
```
:::
:::vulkan
`shaders/stencil_single_color.frag`:

```glsl
#version 450

layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(0.04, 0.28, 0.26, 1.0);
}
```

Den läser inte `fragTexCoord`, som vertex shadern fortfarande skriver – en utdata som ingen läser är tillåten.
Konturerna kommer att använda den i en egen pipeline, tillsammans med `stencil_testing.vert`: samma vertex shader, och
därmed samma uniform buffer och push constant.
:::
:::d3d12
`PSMain` i `stencil_single_color.hlsl`:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    return float4(0.04f, 0.28f, 0.26f, 1.0f);
}
```

Filens `VSMain` är vertex shadern från `stencil_testing.hlsl` utan texturkoordinaterna. Konturerna ritas med en egen
PSO, `m_singleColorPipelineState` (en ny medlem `ComPtr<ID3D12PipelineState>`), skapad av samma `psoDesc` med de här två
shadrarna – som lampans PSO i belysningskapitlen. Den kommer efter att `m_pipelineState` har skapats:

```cpp
        // The outlines: the same description with the shaders of stencil_single_color.hlsl.
        ComPtr<ID3DBlob> singleColorVertexShader;
        ComPtr<ID3DBlob> singleColorPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"stencil_single_color.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &singleColorVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"stencil_single_color.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &singleColorPixelShader, nullptr));

        psoDesc.VS = CD3DX12_SHADER_BYTECODE(singleColorVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(singleColorPixelShader.Get());
        // TODO: the outline's depth and stencil state
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_singleColorPipelineState)));
```

Behåll `// TODO:`-raden: konturens djup- och stenciltillstånd kommer i den sista uppgiften. Input layouten listar
fortfarande `TEXCOORD`; en vertex shader får strunta i element som den inte läser.
:::

Gör uppgiften **single-color** och bygg och kör sedan. Inte heller nu ändras något: inget ritas med den nya shadern än.

Nu steg 1 till 3. Vi vill rita kuberna som vanligt och skriva 1 i stencilbuffern överallt där de ritas. Golvet ritas
också, men dess fragment får *inte* hamna i stencilbuffern: vi bryr oss bara om lådorna. Därför ritas golvet först,
med stencilskrivningar avslagna, och kuberna efter det, med skrivningar påslagna.

:::opengl
Före golvet:

```cpp
        // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers. We set its mask to 0x00 to not write to the stencil buffer.
        glStencilMask(0x00);
```

och före kuberna:

```cpp
        // 1st. render pass, draw objects as normal, writing to the stencil buffer
        // --------------------------------------------------------------------
        glStencilFunc(GL_ALWAYS, 1, 0xFF); // all fragments pass the stencil test and write the reference value 1
        glStencilMask(0xFF);
```

Genom att använda `GL_REPLACE` som stenciloperation ser vi till att vart och ett av lådornas fragment uppdaterar
stencilbuffern med stencilvärdet 1. Eftersom fragmenten alltid klarar stenciltestet uppdateras stencilbuffern med
referensvärdet överallt där vi har ritat dem.
:::
:::vulkan
I Vulkan betyder en annan stencilfunktion eller skrivmask en annan pipeline. `createPipeline()` får två parametrar för
dem:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkCompareOp stencilCompareOp, uint32_t stencilWriteMask, VkPipeline& pipeline) {
```

som ersätter de fasta värdena i stenciltillståndet:

```cpp
        depthStencil.front.compareOp = stencilCompareOp;
        depthStencil.front.compareMask = 0xFF;
        depthStencil.front.writeMask = stencilWriteMask;
```

Nu finns det två pipelines: en ny medlem `VkPipeline floorPipeline;` bredvid `graphicsPipeline`, båda förstörda i
`cleanup()`:

```cpp
        // the floor does not write to the stencil buffer (write mask 0x00); the cubes write 1 wherever they are drawn
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_COMPARE_OP_ALWAYS, 0x00, floorPipeline);
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_COMPARE_OP_ALWAYS, 0xFF, graphicsPipeline);
```

Skrivmasken 0x00 är OpenGL:s `glStencilMask(0x00)`; ALWAYS med referensvärdet 1 och skrivmasken 0xFF är
`glStencilFunc(GL_ALWAYS, 1, 0xFF); glStencilMask(0xFF);`. I `recordCommandBuffer()` ritas golvet med `floorPipeline` –
dess `vkCmdBindPipeline` ersätter den i början av render passet – och kuberna med `graphicsPipeline`:

```cpp
        // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, floorPipeline);
        ...
        // 1st. render pass, draw objects as normal, writing to the stencil buffer
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, graphicsPipeline);
        // cubes
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);
```

Att binda en annan pipeline behåller den viewport, scissor, vertex buffer och de descriptor sets som är bundna:
pipelinerna delar en layout. Eftersom `passOp` är `VK_STENCIL_OP_REPLACE` uppdaterar vart och ett av lådornas fragment
stencilbuffern med referensvärdet 1; eftersom de alltid klarar stenciltestet sker det överallt där vi har ritat dem.
:::
:::d3d12
I Direct3D 12 betyder en annan stencilfunktion eller skrivmask en annan PSO. Innan `m_pipelineState` skapas, en PSO för
golvet (en ny medlem `m_floorPipelineState`) som inte skriver något till stencilbuffern; sedan kubernas PSO, som skriver
referensvärdet överallt där den ritar:

```cpp
        // The floor: drawn as normal, but it does not write to the stencil buffer (we only
        // care about the containers): stencil write mask 0x00.
        psoDesc.DepthStencilState.StencilWriteMask = 0x00;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_floorPipelineState)));

        // The containers: all pixels pass the stencil test (ALWAYS) and write the reference
        // value (StencilPassOp REPLACE) with all 8 bits (write mask 0xFF).
        psoDesc.DepthStencilState.StencilWriteMask = 0xFF;
        psoDesc.DepthStencilState.FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_ALWAYS;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_pipelineState)));
```

`CreateGraphicsPipelineState` kopierar det den behöver, så samma `psoDesc` kan ändras och användas igen för nästa PSO.
I `PopulateCommandList` ritas golvet med golvets PSO och kuberna med den andra – och referensvärdet 1, som är
command list-tillstånd:

```cpp
    // draw floor as normal, but don't write the floor to the stencil buffer, we only care about the containers
    m_commandList->SetPipelineState(m_floorPipelineState.Get());
    ...
    // 1st. render pass, draw objects as normal, writing to the stencil buffer: the reference
    // value 1 wherever a cube is drawn
    m_commandList->SetPipelineState(m_pipelineState.Get());
    m_commandList->OMSetStencilRef(1);
```

Det här är OpenGL:s `glStencilMask(0x00)` före golvet och `glStencilFunc(GL_ALWAYS, 1, 0xFF); glStencilMask(0xFF);`
före kuberna. Eftersom `StencilPassOp` är `D3D12_STENCIL_OP_REPLACE` uppdaterar var och en av lådornas pixlar
stencilbuffern med referensvärdet 1; eftersom de alltid klarar stenciltestet sker det överallt där vi har ritat dem.
:::

```quiz
Varför får golvet inte skriva till stencilbuffern?
- [x] Konturerna ritas bara där stencilvärdet inte är 1; om golvet skrev ettor skulle konturen runt kubernas nedre del – som ligger över golvet – kastas
- [ ] Därför att golvet annars skulle misslyckas med djuptestet
- [ ] Därför att en stencilbuffer bara kan rymma formen av ett slags föremål
---
Stencilbuffern ska innehålla 1 exakt där kuberna är. De skalade kubernas ring ligger över bakgrunden upptill och över golvet nedtill; ett golv som skrev 1 där skulle blockera konturens nedre del.
```

Gör uppgiften **write-stencil** och bygg och kör sedan. Än en gång ändras inte bilden – men stencilbuffern innehåller nu
1 överallt där en kub syns och 0 överallt annars.

Nu när stencilbuffern är uppdaterad med ettor där lådorna ritades ska vi rita de uppskalade lådorna, men den här gången
med rätt testfunktion och med skrivningar till stencilbuffern avslagna: steg 4 till 8. Vi sätter testfunktionen till
NOT_EQUAL med referensvärdet 1, vilket ser till att vi bara ritar de delar av lådorna där värdet inte är 1. På så sätt
ritar vi bara den del av lådorna som ligger utanför de tidigare ritade lådorna. Vi slår också av djuptestningen, så att
de skalade lådorna (kanterna) inte skrivs över av – eller döljs bakom – golvet. Skalfaktorn är 1.1, en kub som är 10 %
större.

:::opengl
Efter kuberna:

```cpp
        // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
        // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
        // the objects' size differences, making it look like borders.
        // -----------------------------------------------------------------------------------------------------------------------------
        glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
        glStencilMask(0x00);
        glDisable(GL_DEPTH_TEST);
        shaderSingleColor.use();
        float scale = 1.1f;
        // cubes
        glBindVertexArray(cubeVAO);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        shaderSingleColor.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        shaderSingleColor.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        // restore the state for the next frame: stencil writes on (glClear obeys the stencil mask too), test always passes, depth test on
        glStencilMask(0xFF);
        glStencilFunc(GL_ALWAYS, 0, 0xFF);
        glEnable(GL_DEPTH_TEST);
```

(`glBindTexture` är learnopengls; shadern med en enda färg samplar ingen textur.) Se till att slå på djuptestningen
igen och sätta tillbaka stencilmasken till `0xFF` efteråt. OpenGL är en tillståndsmaskin: det vi lämnar inställt
gäller även i nästa bildruta – och `glClear` lyder också stencilmasken, så med masken kvar på `0x00` skulle nästa
bildrutas `glClear` inte kunna tömma stencilbuffern.
:::
:::vulkan
Återigen en egen pipeline: konturens pipeline behöver djuptestet *avslaget*, så `createPipeline()` får en tredje
parameter, `VkBool32 depthTestEnable`, före de andra två:

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, VkBool32 depthTestEnable, VkCompareOp stencilCompareOp, uint32_t stencilWriteMask, VkPipeline& pipeline) {
```

```cpp
        depthStencil.depthTestEnable = depthTestEnable;
        depthStencil.depthWriteEnable = depthTestEnable; // with the test off nothing is written either (like glDisable(GL_DEPTH_TEST))
```

De två befintliga pipelinerna får `VK_TRUE`, och en tredje, `VkPipeline outlinePipeline;` (förstörd i `cleanup()`),
byggs av `stencil_testing.vert` och `stencil_single_color.frag` med konturens tillstånd:

```cpp
        // the floor does not write to the stencil buffer (write mask 0x00); the cubes write 1 wherever they are drawn
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_TRUE, VK_COMPARE_OP_ALWAYS, 0x00, floorPipeline);
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_testing.frag.spv", VK_TRUE, VK_COMPARE_OP_ALWAYS, 0xFF, graphicsPipeline);
        // the outlines: one colour, only where the stencil value is not 1, no stencil writes, no depth test
        createPipeline("shaders/stencil_testing.vert.spv", "shaders/stencil_single_color.frag.spv", VK_FALSE, VK_COMPARE_OP_NOT_EQUAL, 0x00, outlinePipeline);
```

Referensvärdet är 1 i varje pipeline, så NOT_EQUAL jämför med 1. I `recordCommandBuffer()`, efter kuberna:

```cpp
        // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
        // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
        // the objects' size differences, making it look like borders.
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, outlinePipeline);
        float scale = 1.1f;
        // cubes
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        model = glm::scale(model, glm::vec3(scale, scale, scale));
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // nothing to restore: every pipeline carries its own depth and stencil state
```

learnopengls steg 8 – slå på djuptestning igen och återställ stencilinställningarna – har ingen motsvarighet här.
OpenGL behöver det eftersom dess tillstånd är globalt och ligger kvar; i Vulkan bär varje pipeline sitt kompletta
djup- och stenciltillstånd, och nästa bildruta börjar med att binda `floorPipeline` igen. Tömningen av stencilbuffern
beror inte heller på någon mask: render passets load op tömmer hela stencilbuffern, oavsett pipelinernas skrivmasker.
:::
:::d3d12
Återigen en egen PSO. Den sista uppgiftens `// TODO:`-rad innan `m_singleColorPipelineState` skapas får konturens
tillstånd:

```cpp
        // Only where the stencil value is not 1 (NOT_EQUAL with the reference value 1), no
        // stencil writes, and no depth test: the outlines are drawn over everything.
        psoDesc.DepthStencilState.FrontFace.StencilFunc = D3D12_COMPARISON_FUNC_NOT_EQUAL;
        psoDesc.DepthStencilState.BackFace = psoDesc.DepthStencilState.FrontFace;
        psoDesc.DepthStencilState.StencilWriteMask = 0x00;
        psoDesc.DepthStencilState.DepthEnable = FALSE;
```

`DepthEnable = FALSE` är OpenGL:s `glDisable(GL_DEPTH_TEST)`: inget djuptest och inga djupskrivningar. I
`PopulateCommandList`, efter kuberna:

```cpp
    // 2nd. render pass: now draw slightly scaled versions of the objects, this time disabling stencil writing.
    // Because the stencil buffer is now filled with several 1s. The parts of the buffer that are 1 are not drawn, thus only drawing
    // the objects' size differences, making it look like borders.
    m_commandList->SetPipelineState(m_singleColorPipelineState.Get());
    float scale = 1.1f;
    model = XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(-1.0f, 0.0f, -1.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    model = XMMatrixScaling(scale, scale, scale) * XMMatrixTranslation(2.0f, 0.0f, 0.0f);
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // Nothing to restore for the next frame: the depth and stencil states belong to the
    // pipeline state objects, Reset sets the stencil reference back to 0, and
    // ClearDepthStencilView ignores the write mask (OpenGL's glClear obeys glStencilMask).
```

Skala först, flytta sedan: DirectXMath multiplicerar radvektorer från vänster, så `XMMatrixScaling(…) *
XMMatrixTranslation(…)` skalar kuben och flyttar den sedan – samma sak som GLM:s `translate` följd av `scale`.
Referensvärdet 1, som sattes före kuberna, gäller fortfarande. learnopengls steg 8 – slå på djuptestning igen och
återställ stencilinställningarna – har ingen motsvarighet här, av skälen i den sista kommentaren: OpenGL behöver det
eftersom dess tillstånd är globalt och ligger kvar; i Direct3D 12 bär varje PSO sitt kompletta djup- och
stenciltillstånd.
:::

:::opengl
```quiz
Varför slutar OpenGL-loopen med `glStencilMask(0xFF)`, `glStencilFunc(GL_ALWAYS, 0, 0xFF)` och `glEnable(GL_DEPTH_TEST)`?
- [ ] Konturernas ritanrop körs först efter de här anropen
- [ ] För att tömma stencilbuffern inför nästa bildruta
- [x] OpenGL:s tillstånd är globalt och ligger kvar in i nästa bildruta – och `glClear` lyder stencilmasken, så med masken kvar på 0x00 skulle stencilbuffern inte tömmas
---
Den andra omgången lämnade djuptestet avslaget, masken på 0x00 och funktionen på NOTEQUAL. Nästa bildrutas golv och kuber behöver djuptestet, och dess `glClear(… | GL_STENCIL_BUFFER_BIT)` skriver genom stencilmasken som vilken annan stencilskrivning som helst.
```
:::
:::vulkan
```quiz
learnopengl avslutar bildrutan med att återställa djuptestet och stencilmasken. Varför har Vulkan-versionen inget att återställa?
- [ ] Vulkan återställer allt tillstånd i slutet av varje command buffer
- [ ] Konturens pipeline skapas sist, så den åsidosätter de andra
- [x] Varje pipeline bär sitt kompletta djup- och stenciltillstånd, och render passets load op tömmer stencilbuffern oavsett skrivmask
---
När `floorPipeline` binds i början av nästa bildruta följer dess eget tillstånd med (djuptest på, skrivmask 0x00). I OpenGL ligger det sista anropets tillstånd kvar globalt – och `glClear` lyder `glStencilMask`, och därför måste learnopengl sätta tillbaka masken till 0xFF.
```
:::
:::d3d12
```quiz
learnopengl avslutar bildrutan med att återställa djuptestet och stencilmasken. Varför har Direct3D 12-versionen inget att återställa?
- [ ] Direct3D 12 återställer allt tillstånd i slutet av varje bildrutas `Present`
- [ ] Konturens PSO skapas sist, så den åsidosätter de andra
- [x] Varje PSO bär sitt kompletta djup- och stenciltillstånd, `ClearDepthStencilView` struntar i skrivmasken, och command listens `Reset` sätter tillbaka stencilreferensen till 0
---
När `m_floorPipelineState` väljs i nästa bildruta följer dess eget tillstånd med (djuptest på, skrivmask 0x00). I OpenGL ligger det sista anropets tillstånd kvar globalt – och `glClear` lyder `glStencilMask`, och därför måste learnopengl sätta tillbaka masken till 0xFF.
```
:::

Gör nu uppgiften **outline** och bygg och kör sedan. Båda kuberna har nu en heldragen mörkt blågrön kant, ungefär 8 till
15 pixlar bred, runt allt du kan se av dem – upptill över bakgrunden och nedtill över golvet, eftersom djuptestet är
avslaget. Själva kuberna, golvet och bakgrunden är oförändrade.

```quiz
De skalade kuberna ritas i sin helhet, men bara en ring runt varje kub syns. Varför?
- [ ] Vertex shadern flyttar bara ut kantvertexarna
- [x] Där originalkuben ritades är stencilvärdet 1, så NOT_EQUAL kastar de fragmenten; bara den del av den större kuben som ligger utanför originalet går igenom
- [ ] Djuptestet kastar insidan, eftersom den skalade kuben ligger bakom originalet
- [ ] Shadern med en enda färg är genomskinlig i mitten
---
Stencilbuffern minns originalkubernas siluett. Den 10 % större kuben täcker siluetten plus en marginal runt den; marginalen är allt som klarar testet. Djuptestet spelar ingen roll – det är avslaget för konturerna.
```

Du ser att kanterna överlappar mellan de två lådorna, vilket oftast är den effekt vi vill ha (tänk på strategispel där
vi vill välja 10 enheter; sammanflytande kanter är i allmänhet att föredra). Om du vill ha en hel kant per föremål
måste du tömma stencilbuffern per föremål och vara lite kreativ med djupbuffern.

Algoritmen för konturer som du har sett används ofta i spel för att visa valda föremål (tänk strategispel), och en
sådan algoritm kan lätt byggas in i en modellklass. Du kan sätta en boolesk flagga i modellklassen för att rita med
eller utan kanter. Om du vill vara kreativ kan du till och med ge kanterna ett mer naturligt utseende med hjälp av
efterbehandlingsfilter som Gaussian blur.

Observera att skalning kring föremålets eget origo bara ger en jämn kant för föremål som våra kuber, vars mittpunkt
ligger i origo i deras lokala rum; för andra modeller skulle du i stället flytta ut vertexarna längs deras normaler.

Stenciltestning har många fler användningsområden (utöver konturer runt föremål), till exempel att rita texturer i en
backspegel så att de passar precis i spegelns form, eller att rendera skuggor i realtid med en stencilbufferteknik som
kallas *shadow volumes*. Stencilbuffrar ger oss ännu ett bra verktyg i vår redan omfattande {{api}}-verktygslåda.
