# Prov: Avancerad belysning

Visa vad du har lärt dig i *Avancerad belysning*: Blinn-Phong, gammakorrigering, shadow maps för riktade ljus och
punktljus, normal mapping och parallax mapping, HDR och tone mapping, bloom, deferred shading och SSAO. Frågorna täcker
hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in svaren**; du behöver 80 % rätt för
att bli godkänd, och du kan göra provet igen.

```quiz
Du byter golvets spekulära term från Phong till Blinn-Phong och behåller glansexponenten 8. Vad ser du, och vad gör learnopengl åt det?
- [ ] Högdagern försvinner, eftersom halvvägsvektorn är vinkelrät mot normalen; exponenten sänks till 1
- [x] Högdagern blir bredare och ljusare, eftersom vinkeln mellan N och H är mindre än den mellan R och V; exponenten höjs 2–4 gånger – learnopengl använder 32
- [ ] Ingenting ändras: båda modellerna ger samma högdager för samma exponent
- [ ] Högdagern får en skarp kant där vinkeln passerar 90°; exponenten sänks till 2
---
För en plan yta är vinkeln mellan normalen och halvvägsvektorn ungefär hälften av vinkeln mellan reflektions- och synvektorn, så dess cosinus ligger närmare 1. En högre exponent ger tillbaka högdagern ungefär Phongs storlek – utan Phongs avklippning.
```

```quiz
En renderare gammakorrigerar sin utdata. Vilka av de här texturerna ska läsas med ett sRGB-format? (Flera svar är rätt.)
- [x] `wood.png`, golvets färgtextur
- [ ] `bricks2_normal.png`, en normal map
- [ ] `bricks2_disp.png`, en djupkarta för parallax mapping
- [x] `container2.png`, containrarnas färgtextur
---
Bara bilder av färger, gjorda genom att titta på en skärm, är sRGB-kodade; ett sRGB-format avkodar dem till linjära färger när de samplas. Normal maps, djupkartor, spekulära kartor och shadow maps lagrar data för matematiken och måste läsas som de är. (Projekten i normal mapping, parallax mapping och deferred shading gammakorrigerar inte sin utdata, precis som learnopengls – där läses även färgtexturer linjärt.)
```

:::opengl
```quiz
Vad i shadow mapping-projektet låter pass 2 sampla djupen som pass 1 skrev?
- [ ] Fönstrets djupbuffert, som `glBindFramebuffer(GL_FRAMEBUFFER, 0)` gör läsbar som textur
- [ ] En renderbuffer för djup i `depthMapFBO`, som läses tillbaka med `glReadPixels` varje bildruta
- [x] `depthMap` är en textur (`GL_DEPTH_COMPONENT`) kopplad som framebufferns `GL_DEPTH_ATTACHMENT`; efter pass 1 binds den till texturenhet 1 och samplas som `shadowMap`
- [ ] `glBlitFramebuffer` kopierar djupen till fönstrets färgbuffert
---
Att rendera till en textur och sampla den i ett senare draw-anrop är allt OpenGL behöver; drivrutinen låter det senare anropet vänta på skrivningarna. En renderbuffer kan inte samplas, och därför är djupkartan en textur.
```
:::
:::vulkan
```quiz
Vad i shadow mapping-projektet låter fönstrets pass sampla djupen som djuppasset skrev?
- [x] Imagen har användningen `SAMPLED` utöver `DEPTH_STENCIL_ATTACHMENT`; djuppasset lagrar den (`storeOp = STORE`) och lämnar den i `DEPTH_STENCIL_READ_ONLY_OPTIMAL`, och en subpass dependency får fragment shadrarna att vänta på djupskrivningarna
- [ ] `vkQueueWaitIdle` mellan command bufferns två render passes
- [ ] Ingenting: kommandon i en command buffer körs alltid strikt efter varandra
- [ ] Djup-attachmentets `storeOp = DONT_CARE`, som fönstrets djupbuffert, och en kopia till en samplad image
---
Imagen måste få samplas, dess djup måste behållas i stället för att kastas, den måste ligga i en layout som en shader kan läsa från, och läsningarna måste ordnas efter skrivningarna. Deskriptorn anger samma layout.
```
:::
:::d3d12
```quiz
Vad i shadow mapping-projektet låter scenens pixel shader sampla djupen som djuppasset skrev?
- [ ] En `DXGI_FORMAT_D32_FLOAT`-textur med en SRV i `D32_FLOAT` – inga andra vyer behövs
- [ ] Ingenting: kommandona i en command list körs alltid strikt efter varandra
- [ ] Att kopiera shadow mapen till en upload heap innan scenen ritas
- [x] En `R32_TYPELESS`-textur med en DSV i `D32_FLOAT` och en SRV i `R32_FLOAT`, och en transition barrier från `DEPTH_WRITE` till `PIXEL_SHADER_RESOURCE` efter djuppasset
---
En resurs med ett djupformat kan inte ha en shader resource view, så den är typlös och varje vy väljer sin tolkning. Barriären byter resursens roll och får läsningarna att vänta på skrivningarna; i slutet av bildrutan vänder en andra barriär tillbaka den.
```
:::

:::opengl
```quiz
I `ShadowCalculation` är `projCoords` positionen i ljusrymden efter perspektivdivisionen. Vilken rad gör om den till det som uppslagningen och jämförelsen behöver i OpenGL?
- [x] `projCoords = projCoords * 0.5 + 0.5;`
- [ ] `projCoords.xy = projCoords.xy * 0.5 + 0.5;`
- [ ] `vec2 uv = vec2(projCoords.x * 0.5 + 0.5, -projCoords.y * 0.5 + 0.5);` med z som det är
- [ ] Ingen: de dividerade koordinaterna är redan texturkoordinater och djup
---
OpenGL:s NDC är -1..1 i x, y och z, medan texturkoordinaterna och de lagrade djupen är 0..1 – alla tre avbildas. Texturens v = 0 är dess nedersta rad, som NDC y = -1, så ingen vändning behövs.
```
:::
:::vulkan
```quiz
I `ShadowCalculation` är `projCoords` positionen i ljusrymden efter perspektivdivisionen. Vilken rad gör om den till det som uppslagningen och jämförelsen behöver i Vulkan?
- [ ] `projCoords = projCoords * 0.5 + 0.5;`
- [x] `projCoords.xy = projCoords.xy * 0.5 + 0.5;`
- [ ] `vec2 uv = vec2(projCoords.x * 0.5 + 0.5, -projCoords.y * 0.5 + 0.5);` med z som det är
- [ ] Ingen: de dividerade koordinaterna är redan texturkoordinater och djup
---
Med `GLM_FORCE_DEPTH_ZERO_TO_ONE` är NDC-z redan 0..1, det intervall som djup-imagen lagrar. Och eftersom ljusets matris saknar y-vändning är NDC y = -1 rad 0 både när djuppasset skriver och när uppslagningen läser.
```
:::
:::d3d12
```quiz
I `ShadowCalculation` är `projCoords` positionen i ljusrymden efter perspektivdivisionen. Vilken rad gör om den till det som uppslagningen och jämförelsen behöver i Direct3D 12?
- [ ] `projCoords = projCoords * 0.5f + 0.5f;`
- [ ] `projCoords.xy = projCoords.xy * 0.5f + 0.5f;`
- [x] `float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);` med z som det är
- [ ] Ingen: de dividerade koordinaterna är redan texturkoordinater och djup
---
Direct3D:s NDC-z är redan 0..1, som djupen i shadow mapen. Dess textur-v = 0 är översta raden i ett render target, vilket är NDC y = +1, så y vänds.
```
:::

```quiz
Skugg-biasen ändras från `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)` till ett fast värde på 0.2. Vad väntar du dig?
- [ ] Mer shadow acne: ränderna kommer tillbaka på golvet
- [ ] Mjuka skuggkanter, som med PCF
- [ ] Allt utanför ljusets frustum blir mörkt
- [x] Peter panning: jämförelsen flyttas så långt mot ljuset att skuggorna börjar en synlig bit från föremålen som kastar dem
---
En bias behöver bara täcka djupskillnaderna inom en texel i djupkartan. En mycket större gör att de delar av en skugga som ligger nära föremålet räknas som belysta, så föremålen verkar lösgjorda från sina skuggor.
```

```quiz
Vilket påstående om PCF, så som det används i båda skuggkapitlen, stämmer?
- [x] Det jämför fragmentets djup med djupen som lagrats på flera närliggande platser och tar medelvärdet av resultaten (belyst eller i skugga), så att fragment vid kanten får mellanliggande värden
- [ ] Det gör djupkartan suddig före jämförelsen, så att de lagrade djupen blir jämnare
- [ ] Det höjer djupkartans upplösning genom att sampla den med linjär filtrering
- [ ] Det flyttar skuggan mot ljuset med en texels storlek
---
Att ta medelvärdet av djup skulle ge nonsens vid ett föremåls kant, där ett nära och ett avlägset djup möts. PCF tar medelvärdet av de binära testresultaten: där 3 av 9 sampel ligger i skugga är fragmentet till en tredjedel i skugga.
```

```quiz
Biasen i shadow mapping ligger mellan 0.005 och 0.05; punktskuggorna använder 0.05, och 0.15 med PCF. Varför kan punktskuggornas bias vara så mycket större?
- [ ] Cube maps har mer shadow acne än 2D-djupkartor
- [ ] Perspektivprojektionen gör det lagrade djupet icke-linjärt, så biasen måste vara stor nära det bortre planet
- [x] Jämförelsen sker mellan avstånd i världsenheter – det lagrade värdet gånger `far_plane` (25) och `length(fragToLight)` – inte mellan djup på 0..1; 0.05 är en tjugondels enhet
- [ ] Punktskuggornas bias läggs på ljusets position, inte på djupet
---
Det riktade ljusets djup går från 0 till 1 över 6.5 enheter, så 0.005 där är ungefär 0.03 enheter. I världsenheter är båda biasvärdena ungefär lika stora; PCF:s förskjutningar läser lite andra riktningar, vilket kräver lite mer.
```

:::opengl
```quiz
Vad låter ett enda draw-anrop i djuppasset fylla alla sex sidor av `depthCubemap`?
- [ ] `glFramebufferTexture2D` med `GL_TEXTURE_CUBE_MAP_POSITIVE_X`, som kopplar även sidorna efter den
- [x] `glFramebufferTexture` kopplar hela cube mapen som ett skiktat attachment, och geometry shadern sänder ut varje triangel sex gånger och sätter `gl_Layer` till sidan
- [ ] Sex viewports, en per sida, satta med `glViewport` före draw-anropet
- [ ] Vertex shadern skriver `gl_Layer`, en gång per hörn
---
Med ett skiktat attachment väljer geometry shadern lagret – sidan – för varje primitiv den sänder ut, varje gång transformerad med den sidans matris. Utan det skulle scenen renderas sex gånger, en gång per kopplad sida.
```
:::
:::vulkan
```quiz
Vad låter ett enda draw-anrop i djuppasset fylla alla sex sidor av djup-cube mapen?
- [ ] Sex framebuffers, en per lager, och sex render passes som spelas in efter varandra
- [ ] En vy av typen `VK_IMAGE_VIEW_TYPE_2D` och push constanten `face`
- [ ] Vertex shadern skriver `gl_Layer`, en gång per hörn
- [x] En cube-kompatibel image med sex lager vars vy är attachment i en framebuffer med `layers = 6`, och en geometry shader (en aktiverad enhetsfunktion) som sänder ut varje triangel sex gånger med `gl_Layer` satt till sidan
---
Framebuffern ser sex lager; geometry shadern väljer ett per primitiv. Samma cube-vy samplas sedan som en `samplerCube` i fönstrets pass.
```
:::
:::d3d12
```quiz
Vad låter ett enda draw-anrop i djuppasset fylla alla sex skivor av djup-cube mapen?
- [x] En depth stencil view av typen `TEXTURE2DARRAY` över de sex skivorna, och en geometry shader som lägger till varje triangel sex gånger med `SV_RenderTargetArrayIndex` satt till sidan
- [ ] Sex DSV:er bundna på en gång med `OMSetRenderTargets(6, …)`
- [ ] En depth stencil view av typen `TEXTURECUBE`, som rasteriseraren fyller sida för sida
- [ ] Vertex shadern returnerar `SV_RenderTargetArrayIndex`, en gång per hörn
---
Array-DSV:n gör de sex skivorna till en skiktad djupbuffert, och `SV_RenderTargetArrayIndex` – GLSL:s `gl_Layer` – väljer skivan för varje primitiv. Vyn av typen `TEXTURECUBE` är SRV:n som läser samma skivor som en kub.
```
:::

```quiz
Ett golv vetter mot +y, dess tangent är +x, och normal mapen har (0.5, 0.5, 1.0) vid ett fragment. Vilken normal belyser normal mapping i tangentrymden fragmentet med?
- [ ] (0.5, 0.5, 1.0) normaliserad, i världsrymden
- [x] (0, 0, 1) i tangentrymden, som TBN-matrisen gör till golvets egen normal (0, 1, 0): en plan fläck
- [ ] (0, 0, 1) i världsrymden, längs golvet
- [ ] (0, 1, 0) i tangentrymden: uppåt i texturen
---
`texel * 2.0 - 1.0` ger (0, 0, 1), tangentrymdens normal "rakt ut från ytan". Använd som normal i världsrymden – kapitlets första försök – skulle den peka längs +z, vinkelrätt mot golvets verkliga normal.
```

```quiz
learnopengls vertex shader transformerar ljusets, betraktarens och fragmentets positioner med `transpose(mat3(T, B, N))`. Varför får den använda transponatet i stället för inversen, och vad håller det sant på ett mesh med medelvärdesbildade tangenter?
- [ ] Transponatet av varje 3 × 3-matris är dess invers; inget mer behövs
- [ ] Transponatet är bara en approximation som ser likadan ut på avstånd
- [ ] Eftersom T och B har längden 2; att normalisera dem i fragment shadern rättar till det
- [x] T, B och N är vinkelräta enhetsvektorer, så matrisen är ortogonal och dess transponat är dess invers; Gram-Schmidt (`T = normalize(T - dot(T, N) * N)`, `B = cross(N, T)`) gör dem vinkelräta igen där medelvärdesbildningen har böjt dem
---
Att jämna ut tangenter över delade hörn kan göra att T inte längre är vinkelrät mot N. Att ta bort T:s komponent längs N ger tillbaka en ortogonal TBN-matris, och det billiga transponatet förblir exakt.
```

:::opengl
```quiz
learnopengls fyrhörning får bitangenten (0, 2, 0) – uppåt längs väggen – eftersom bilderna vänds vid inläsningen och v växer uppåt i bilden. Om v i stället växte nedåt i bilden, så att bitangenten pekade nedåt längs väggen, vad skulle tegelstenarnas ojämnheter behöva?
- [ ] Ingenting: normalen normaliseras ändå
- [ ] Att normal mapen läses in som en sRGB-textur
- [x] Normal mapens y (grönt) vänt – eller en normal map gjord för den konventionen – eftersom grönt betyder "uppåt i bilden" i den här kartan
- [ ] En negerad tangent, så att T och B byter plats
---
Tangentrymdens y-axel är bitangenten, riktningen som v växer i. Normal mapens grönt måste betyda samma riktning, annars belyses varje fasning från motsatt håll – precis det som Direct3D-versionen måste hantera.
```
:::
:::vulkan
```quiz
Projekten i Normal mapping och Parallax mapping vänder bilderna vid inläsningen och behåller learnopengls texturkoordinater. Vad skulle hända med de tidigare Vulkan-kapitlens sätt – raderna som de lagras, v vänt i hörndatan?
- [x] Bitangenten, beräknad från v, skulle peka nedåt längs väggen medan normal mapens grönt betyder uppåt i bilden: varje ojämnhet skulle belysas från fel håll
- [ ] Ingenting: tangentrymden beror inte på texturkoordinaterna
- [ ] Bilden skulle bli upp och ner på grund av `proj[1][1] *= -1`
- [ ] Normal mapen skulle avkodas som sRGB
---
Med vändningen vid inläsningen växer v uppåt i bilden, bitangenten pekar uppåt längs väggen, och tangentrymdens +y betyder det som kartans grönt betyder – som i learnopengl.
```
:::
:::d3d12
```quiz
Efter Gram-Schmidt beräknar Direct3D-shadrarna `B = cross(T, N)` i stället för learnopengls `cross(N, T)`. Varför?
- [ ] HLSL:s `cross` tar sina argument i omvänd ordning mot GLSL:s
- [x] Med Direct3D:s texturkoordinater växer v nedåt i bilden, så bitangenten måste peka nedåt längs väggen, som bitangent-attributet gjorde – `cross(T, N)` = (0, -1, 0); med `cross(N, T)` vore vändningen `normal.y = -normal.y` fel
- [ ] Eftersom `float3x3(T, B, N)` tar rader, vilket vänder på kryssprodukten
- [ ] Eftersom fönstrets y pekar nedåt i Direct3D
---
Tangentrymdens y måste följa texturens v. Den OpenGL-artade normal mapens grönt betyder uppåt i bilden, så dess y vänds, och B måste peka åt det håll v växer: nedåt.
```
:::

```quiz
Parallax mapping förskjuter texturkoordinaterna med `viewDir.xy / viewDir.z * (height * heightScale)`. Varför måste synriktningen ligga i tangentrymden för det?
- [x] I tangentrymden går x och y längs texturens u och v och z längs normalen, så `viewDir.xy` är en riktning i texturkoordinater och `viewDir.z` anger hur flack blicken är
- [ ] Eftersom djupkartan bara kan samplas i tangentrymden
- [ ] Eftersom tangentrymden har sitt origo i kameran
- [ ] Det behöver den inte: världsrymden ger samma förskjutning på varje yta
---
Förskjutningen måste ske längs texturens axlar, hur ytan än är orienterad i världen. Därför återanvänds normal mappingens vertex shader, som redan för betraktarens position till tangentrymden, som den är.
```

```quiz
I början av HDR-kapitlet är tunnelns bortre ände platt vit. Vilka ändringar ger tillsammans tillbaka dess brädor? (Flera svar är rätt.)
- [x] En flyttalsfärgbuffert, som behåller värdena över 1.0 medan scenen ritas
- [ ] Att läsa träet som en sRGB-textur
- [x] Tone mapping i skärmfyrhörningens shader, som avbildar värdena tillbaka till 0..1 innan de hamnar i fönstret
- [ ] Att stänga av gammakorrigeringen
---
Den första uppgiften ensam ändrar inget som syns: flyttalsbufferten har de sanna färgerna, men fönstret med 8 bitar begränsar dem som förut. Först tone mapping-kurvan för in dem i fönstrets intervall utan att slå ihop dem till ett enda vitt.
```

:::opengl
```quiz
Scenen ritar nu till en flyttalsfärgbuffert i stället för fönstret. Vad mer än själva bufferten måste känna till dess format?
- [ ] Shaderprogrammet, som måste länkas om för `GL_RGBA16F`
- [ ] `glDrawBuffers`, som tar `GL_RGBA16F` som argument
- [ ] Fragment shadern, vars utdata måste deklareras som `out vec4 FragColor : RGBA16F;`
- [x] Inget annat: programmen ritar till den framebuffer som är bunden; texturens interna format, `GL_RGBA16F`, är det enda som avgör hur dess texlar lagras
---
OpenGL:s tillstånd och program är oberoende av targetets format. Bind `hdrFBO` så lagras scenen som halvprecisionsflyttal; bind framebuffer 0 så skriver skärmfyrhörningen till fönstret med 8 bitar.
```
:::
:::vulkan
```quiz
Scenen ritar nu till en flyttalsbild i stället för swap chain-imagen. Vad mer än själva imagen måste känna till dess format?
- [ ] Vertex shadern, genom en specialization constant
- [ ] Ingenting: en pipeline kan rita i vilken render pass som helst
- [x] Render passen (`hdrRenderPass`) och scenens pipeline, som måste göras för den – en pipeline fungerar bara i render passes som är kompatibla med dess egen; skärmfyrhörningens pipeline görs för fönstrets
- [ ] Descriptor set-layouten, som behöver formatet på varje attachment
---
Kompatibla render passes har samma antal och format på sina attachments. Swap chain-imagen är `VK_FORMAT_B8G8R8A8_UNORM`, HDR-imagen `VK_FORMAT_R16G16B16A16_SFLOAT`, så scenens pipeline skapas på nytt med `hdrRenderPass`.
```
:::
:::d3d12
```quiz
Scenen ritar nu till ett flyttals-render target i stället för backbufferten. Vad mer än texturen och dess vyer måste känna till dess format?
- [ ] Root-signaturen, som listar render targetens format
- [x] Scenens PSO, `RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT` – och skärmfyrhörningen får ett eget PSO med backbuffertens format och utan djup
- [ ] Ingenting: `OMSetRenderTargets` konverterar färgerna till det som är bundet
- [ ] Vertex buffer-vyn
---
Ett PSO kompileras för formaten det renderar till, och de måste stämma med vyerna som är bundna när det ritar. Root-signaturen delas av båda PSO:erna.
```
:::

```quiz
Var gammakorrigeras färgen i Bloom-projektet?
- [ ] I scenens belysningsshader, så att ljuspasset jämför gammakorrigerade värden
- [ ] I varje blur-pass, efter att vikterna har tillämpats
- [x] En gång, i slutpasset, efter att de suddiga ljusa delarna har lagts till och summan tone-mappats – allt dessförinnan förblir linjärt i flyttalsbuffertar
- [ ] Ingenstans: sRGB-texturerna gör det onödigt
---
Belysning, blur, addition och tone mapping förväntar sig alla linjära värden; gammakorrigeringen är sista steget före fönstret. sRGB-texturer avkodar bara indata – utdata måste fortfarande kodas en gång.
```

```quiz
Varför fungerar bloom bäst tillsammans med HDR?
- [ ] Bloom kan bara göra flyttalstexturer suddiga
- [x] Med HDR har "ljust" en naturlig betydelse – en luminans över 1.0, mer än fönstret kan visa – så tröskeln väljer ut ljusen; med LDR skulle den behöva ligga under 1.0, och varje vit vägg skulle också glöda
- [ ] HDR gör den gaussiska bluren separerbar
- [ ] Utan HDR kan ljuskuberna inte ritas till en andra färgbuffert
---
Det är olika tekniker, och bloom kan göras med buffertar på 8 bitar. Men HDR behåller den verkliga ljusstyrkan, så en tröskel på 1.0 och en addition före tone mappingen ger ett sken bara där ljuset verkligen är för starkt för att visas.
```

```quiz
learnopengls blur kör 10 pass med en kärna på 9 tappar, omväxlande horisontellt och vertikalt. Vilket påstående stämmer?
- [ ] 10 pass behövs eftersom varje pass bara kan flytta ljuset en texel
- [ ] De vertikala passen tar ut de horisontella, utom deras ljusstyrka
- [ ] Varje pass använder en annan uppsättning vikter, från smal till bred
- [x] Varje par av horisontellt och vertikalt är en fullständig gaussisk blur på 9 × 9 med 18 i stället för 81 sampel per fragment; de fem paren gör den suddiga bilden suddig om och om igen, vilket breddar skenet
---
Gausskurvan är separerbar, så ett 1D-pass längs x följt av ett längs y ger 2D-resultatet. Att upprepa bluren sprider ljuset längre – till priset av ett helskärmspass varje gång.
```

:::opengl
```quiz
Vart och ett av de 10 blur-passen läser texturen som passet före skrev. Vad ser till att det läser det färdiga resultatet?
- [x] Ingenting uttryckligt: att binda den andra ping-pong-framebuffern och texturen som just skrevs räcker – OpenGL låter senare draw-anrop se resultaten av tidigare (så länge ett pass aldrig läser texturen det ritar till)
- [ ] `glFinish()` mellan passen
- [ ] `glDrawBuffers(2, …)` med båda ping-pong-texturerna
- [ ] Att rensa framebuffern före varje pass
---
Drivrutinen håller reda på vilka texturer som är kopplade och lästa och ordnar arbetet åt dig. Att läsa och skriva samma textur i ett pass är det enda den inte löser – därav de två buffertarna.
```
:::
:::vulkan
```quiz
Vart och ett av de 10 blur-passen läser imagen som passet före skrev. Vad ser till att det läser det färdiga resultatet?
- [ ] `vkQueueWaitIdle` efter varje blur-pass
- [ ] Ingenting: kommandona i en command buffer körs alltid strikt efter varandra
- [ ] En render pass med tio subpasses som alla skriver samma image
- [x] Varje blur-pass är en egen render pass: den lämnar sin image i `SHADER_READ_ONLY_OPTIMAL`, och dess subpass dependencies gör färgskrivningarna synliga för nästa pass fragment shader (och skrivningarna väntar på de tidigare läsningarna)
---
En image kan inte samplas medan den är attachment i det pass som körs, så passen är separata render passes. Dependencies kedjar ihop dem, och loopen spelar in alla i command bufferten innan GPU:n kör den.
```
:::
:::d3d12
```quiz
Vart och ett av de 10 blur-passen läser texturen som passet före skrev. Vad ser till att det läser det färdiga resultatet?
- [ ] `WaitForPreviousFrame()` efter varje pass
- [ ] Ingenting: kommandona i en command list körs alltid strikt efter varandra
- [x] Ett barriärpar runt varje pass: targetet blir `RENDER_TARGET` före draw-anropet och `PIXEL_SHADER_RESOURCE` igen efter det, vilket får nästa pass läsningar att vänta på skrivningarna
- [ ] Att binda båda ping-pong-buffertarna med `OMSetRenderTargets(2, …)`
---
En resurs tillstånd måste passa dess användning, och övergången ordnar också GPU:ns arbete. Loopen spelar in alla tio draw-anrop med sina barriärer i command listen.
```
:::

```quiz
Scenen i deferred shading har nio lådor och 32 ljus. Vad sparar deferred shading jämfört med startens forward rendering?
- [ ] Den behöver färre ljus för samma bild
- [ ] Den behöver inget djuptest längre
- [x] Belysningen körs en gång per synlig pixel – högst 800 × 600 × 32 ljusberäkningar – hur många lådor som än överlappar där; fragment som täcks senare belystes aldrig, eftersom geometripasset bara lagrar ytdata
- [ ] Ingenting: det är samma arbete i en annan ordning, bara bilden blir skarpare
---
Forward rendering belyser varje fragment medan det ritas, även de som döljs av senare objekt. Deferred shading skiljer de två åt: geometri först, sedan belysning från G-bufferten, så att belysningens kostnad beror på pixlar × ljus.
```

:::opengl
```quiz
Geometripasset skriver tre utdata – position, normal, albedo + spekulär. Vad skickar varje utdata till sin egen textur i G-bufferten?
- [ ] Tre framebuffers, bundna efter varandra för tre draw-anrop av scenen
- [x] De tre texturerna är kopplade till `GL_COLOR_ATTACHMENT0`, `1` och `2`, `glDrawBuffers(3, attachments)` listar dem, och shadern deklarerar utdata med `layout (location = 0)`, `1` och `2`
- [ ] Namnen `gPosition`, `gNormal` och `gAlbedoSpec`, som OpenGL matchar mot texturernas uniforms
- [ ] `glActiveTexture` med enhet 0, 1 och 2 före draw-anropet
---
Utdata på location n går till post n i listan av draw buffers. Utan `glDrawBuffers` skulle bara `GL_COLOR_ATTACHMENT0` skrivas.
```
:::
:::vulkan
```quiz
Geometripasset skriver tre utdata – position, normal, albedo + spekulär. Vad skickar varje utdata till sin egen image i G-bufferten?
- [x] Subpassen har tre referenser till färg-attachments – utdata på location n skriver `pColorAttachments[n]` –, framebuffern har vyerna i samma ordning (djupet på 3), och geometri-pipelinen har tre blend-attachment-tillstånd
- [ ] Tre descriptor sets, ett per image, bundna på binding 1 till 3
- [ ] Utdatanamnen, som Vulkan matchar mot imagernas namn
- [ ] Tre render passes som spelas in efter varandra
---
Pipelinens `colorBlending.attachmentCount` måste vara lika med subpassens antal färg-attachments – därför tar `createPipeline` det (3 för geometripasset, 1 för fönstret).
```
:::
:::d3d12
```quiz
Geometripasset skriver tre utdata – position, normal, albedo + spekulär. Vad skickar varje utdata till sin egen textur i G-bufferten?
- [ ] Tre root-parametrar, en per render target
- [ ] Medlemsnamnen i pixel shaderns struct, matchade mot texturernas namn
- [ ] Tre PSO:er, ett per render target, som ritar efter varandra
- [x] Pixel shadern returnerar en struct med `SV_TARGET0`, `1` och `2`, PSO:t har `NumRenderTargets = 3` med de tre formaten, och `OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle)` binder de tre RTV:erna
---
`SV_TARGETn` skriver det n:te bundna render targetet. Render target views binds med `OMSetRenderTargets`, inte via root-signaturen.
```
:::

```quiz
Varför kan inte de halvgenomskinliga fönstren från kapitlet *Blending* bara gå genom G-bufferten?
- [x] En pixel i G-bufferten rymmer data för en yta, men blending behöver även ytan bakom – transparenta objekt ritas forward efter belysningspasset, som ljuskuberna
- [ ] G-bufferten har ingen alfakanal
- [ ] Transparenta objekt kan inte djuptestas i en deferred renderer
- [ ] Belysningspasset ritar skärmfyrhörningen med blending avstängd
---
Belysningspasset belyser en position, en normal och ett albedo per pixel. Det är deferred shadings främsta begränsning, tillsammans med MSAA, som inte heller bara fungerar med en G-buffert.
```

:::opengl
```quiz
Ljuskuberna ritas forward, efter belysningspasset, och måste döljas bakom lådorna. Hur får de lådornas djup?
- [ ] Belysningspasset skriver djupen från `gPosition` till fönstrets djupbuffert
- [ ] De behöver dem inte: belysningsfyrhörningens djup döljer dem korrekt
- [ ] `gPosition` kopplas till framebuffer 0 som dess djupbuffert
- [x] `glBlitFramebuffer(…, GL_DEPTH_BUFFER_BIT, GL_NEAREST)` kopierar G-buffertens djup (`GL_READ_FRAMEBUFFER` gBuffer) till fönstrets djupbuffert (`GL_DRAW_FRAMEBUFFER` 0); de två djupformaten måste stämma överens
---
Fönstrets egen djupbuffert har bara skärmfyrhörningens platta djup. Efter kopian djuptestas kuberna mot lådorna som om de hade ritats i fönstret.
```
:::
:::vulkan
```quiz
Ljuskuberna ritas forward, efter belysningspasset, och måste döljas bakom lådorna. Hur får de lådornas djup?
- [ ] `vkCmdBlitImage` kopierar G-buffertens djup till fönstrets djup-image varje bildruta
- [x] G-buffertens djup-image behålls (`storeOp = STORE`) och är fönsterpassets djup-attachment, laddad med `loadOp = LOAD`; belysningsfyrhörningens pipeline har djuptest och djupskrivning avstängda, så fyrhörningen varken döljer eller skriver över det
- [ ] Ljuskubernas pipeline läser `gPosition` och kastar dolda fragment
- [ ] De behöver dem inte: fönstrets egen djup-image har redan fyrhörningens djup
---
learnopengl kopierar djupet med `glBlitFramebuffer`; blit av djup-images stöds inte på alla Vulkan-enheter, och en kopia kräver barriärer. Att dela imagen kräver inget av det.
```
:::
:::d3d12
```quiz
Ljuskuberna ritas forward, efter belysningspasset, och måste döljas bakom lådorna. Hur får de lådornas djup?
- [ ] `CopyResource` från G-buffertens djup till backbufferns egen djupbuffert varje bildruta
- [ ] Ljuskubernas pixel shader läser `gPosition` och kastar dolda pixlar
- [x] Ingen kopia: en djupbuffert hör inte till någon framebuffer, så `m_depthStencil`, som fortfarande har lådornas djup, binds igen tillsammans med backbufferns RTV; själva belysningsfyrhörningen ritas utan DSV
- [ ] De behöver dem inte: backbufferten lagrar djup i sin alfakanal
---
`OMSetRenderTargets(1, &rtvHandle, FALSE, &dsvHandle)` kombinerar vilket render target som helst med vilken djupbuffert som helst av samma storlek. learnopengls blit finns för att OpenGL:s fönster äger sin djupbuffert.
```
:::

```quiz
Belysningsshadern hoppar över ett ljus där fragmentet ligger längre bort än ljusets radie. Varför sparar det knappt någon tid på en GPU, och vad gör riktiga renderare i stället?
- [ ] Det sparar exakt 32 gånger arbetet; inget mer behövs
- [x] Fragmenten i en grupp körs i takt, så loopen kostar fortfarande ett ljus där ett enda fragment i gruppen behöver det; riktiga renderare ritar varje ljus volym (en sfär med dess radie) och belyser bara pixlarna den täcker, eller sorterar ljusen i rutor eller kluster av skärmen
- [ ] Radien beräknas på GPU:n för varje fragment, vilket kostar mer än det sparar
- [ ] GPU:n beräknar båda grenarna av varje `if`, så det sparar ingenting men gör bilden mörkare
---
Radien är där ljusets ljusstyrka sjunker under 5/256. Att hoppa över det per fragment ändrar bilden lite (32 små bidrag blir märkbara) utan att spara mycket; ljusvolymer och tiled eller clustered shading undviker att köra belysningen för avlägsna ljus över huvud taget.
```

```quiz
Vilken del av belysningen multipliceras det suddiga SSAO-värdet med?
- [ ] Fragmentets hela färg
- [ ] Ljusets diffusa term
- [ ] Ljusets färg, före dämpningen
- [x] Bara ambient-termen – `0.3 * Diffuse * AmbientOcclusion`: AO uppskattar hur mycket indirekt ljus som når ett skrymsle; det direkta ljuset behåller sin egen diffusa och spekulära del
---
Omgivningsljuset står för ljus som studsar runt i scenen, och skrymslen och kontaktpunkter får mindre av det. Att blockera det direkta ljuset är skuggornas jobb.
```

```quiz
Varför vrider SSAO sin kärna med slumpvektorer från en brustextur på 4 × 4, och gör resultatet suddigt efteråt?
- [ ] Rotationen får samplen att peka bort från normalen; bluren för tillbaka dem
- [ ] Brustexturen lagrar ocklusionen för 16 pixlar; bluren sprider den över fönstret
- [x] Med bara 32 sampel skulle samma kärna överallt lämna synliga band; en annan rotation för varje pixel i ett block på 4 × 4 gör dem till ett fint, regelbundet brusmönster, och en blur på 4 × 4 tar bort det genom medelvärdesbildning
- [ ] Bluren döljer kanterna på brustexturen, som clampas mot kanten
---
Att vrida kärnan ger angränsande pixlar olika samplingsriktningar, så att få sampel täcker många. Eftersom bruset upprepas var fjärde pixel täcker en låd-blur på 4 × 4 exakt en period och tar bort den.
```

:::opengl
```quiz
Brustexturen på 4 × 4 måste upprepas över hela fönstret, en slumpvektor per pixel. Hur sätts den upp?
- [x] `GL_RGBA32F`, 4 × 4, från `GL_RGB` / `GL_FLOAT`-data, med `GL_NEAREST` och `GL_REPEAT`, samplad vid `TexCoords * noiseScale` (800/4, 600/4)
- [ ] En textur på 800 × 600 med slumpvektorer och `GL_CLAMP_TO_EDGE`
- [ ] 4 × 4 med `GL_LINEAR`-filtrering, så att angränsande pixlar får mjukt varierande vektorer
- [ ] `GL_RED`, 4 × 4, med `GL_REPEAT` – en slumpvinkel per texel
---
`noiseScale` får texturen att upprepas 200 × 150 gånger; `GL_REPEAT` slår runt koordinaterna och `GL_NEAREST` ger varje pixel exakt en av de 16 vektorerna.
```
:::
:::vulkan
```quiz
Brustexturen på 4 × 4 måste upprepas över hela fönstret, en slumpvektor per pixel. Hur sätts den upp?
- [ ] En image på 800 × 600 med slumpvektorer och `CLAMP_TO_EDGE`
- [ ] `VK_FORMAT_R32G32B32_SFLOAT` med `glm::vec3`-brus, som learnopengls, och en LINEAR-sampler
- [x] `VK_FORMAT_R32G32B32A32_SFLOAT` med `vec4`-brus (enheter behöver inte kunna sampla flyttals-images med tre kanaler), uppladdad via en staging buffer, läst med en sampler med NEAREST och REPEAT vid `fragTexCoord * noiseScale`
- [ ] `VK_FORMAT_R8_UNORM`, 4 × 4, med en REPEAT-sampler – en slumpvinkel per texel
---
`noiseScale` (800/4, 600/4) får texturen att upprepas över fönstret; REPEAT slår runt koordinaterna och NEAREST ger varje pixel exakt en av de 16 vektorerna.
```
:::
:::d3d12
```quiz
Brustexturen på 4 × 4 måste upprepas över hela fönstret, en slumpvektor per pixel. Hur sätts den upp?
- [ ] En textur på 800 × 600 med slumpvektorer, läst med den clampande samplern s0
- [ ] `R8_UNORM`, 4 × 4, läst med en linjär sampler – en slumpvinkel per texel
- [ ] `R32G32B32_FLOAT` uppladdad från `XMFLOAT3`:or, läst med en linjär, clampande sampler
- [x] `R32G32B32A32_FLOAT`, uppladdad från `XMFLOAT4`:or med `UpdateSubresources`, läst med den statiska samplern s1 (punkt, WRAP) vid `texCoord * noiseScale`
---
`noiseScale` (800/4, 600/4) får texturen att upprepas över fönstret; WRAP upprepar koordinaterna och punktfiltrering ger varje pixel exakt en av de 16 vektorerna.
```
:::

```quiz
Vad förhindrar avståndskontrollen `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))`?
- [ ] Att sampel utanför fönstret läses
- [x] Att en yta långt framför fragmentet – planeten framför bakväggen – mörkar det: sampel vars lagrade djup skiljer sig mycket mer än radien räknas mindre och mindre
- [ ] Att en plan yta skymmer sig själv – det är halvsfären till för
- [ ] Att negativa djup jämförs
---
Utan den skulle väggen precis intill planetens kontur få en mörk gloria, eftersom planetens djup ligger mycket närmare än något sampel runt väggen. Att plana ytor skymmer sig själva hanteras av halvsfären och biasen.
```
