# Sammanfattning: Avancerad belysning

Grattis, du har nått slutet av delen *Avancerad belysning*. Du började med ett trägolv och en högdager på det; sedan
dess har du gett högdagern en bättre modell, gjort belysningen fysikaliskt linjär med gammakorrigering, låtit kuber kasta
skuggor från ett riktat ljus och från ett punktljus i ett rum, gett en tegelvägg som fortfarande är två trianglar
ojämnheter och djup, behållit ljuset från en lampa med styrkan 200 med HDR och tone mapping, fått starka ljus att glöda,
belyst nio lådor med 32 ljus i en deferred renderer och mörkat scenens skrymslen med ambient occlusion i screen space.
Den här sidan är en ordlista över delens viktigaste begrepp, kapitel för kapitel, som de genomgångar learnopengl.com
har i slutet av sina delar. Använd den för att slå upp saker, och som en kontroll: om en definition överraskar dig, gå
tillbaka till kapitlet den kommer från.

Nästan allt i den här delen är matematik i shaders plus extra render passes till egna texturer: ett render target med
bara djup för skuggor, en djup-cube map, flyttalsfärgbuffertar, flera render targets som skrivs på en gång, och
skärmfyrhörningar som läser dem. Begreppen utanför rutorna är desamma i alla API:er; rutorna visar hur {{api}} gör. En
skillnad går genom hela delen: i OpenGL samlar ett framebuffer object texturerna, och drivrutinen ser till att ett pass
läser det som det förra skrev. I Vulkan beskriver en render pass attachments, deras format, vad som händer med dem i
början och slutet av passet och vilken layout de lämnas i, och subpass dependencies ordnar passen; pipelines görs för en
render pass. I Direct3D 12 får en textur en vy för varje roll (RTV, DSV, SRV), en transition barrier meddelar varje
rollbyte, och varje pipeline state anger formaten den renderar till. När du är klar kontrollerar provet i slutet av
delen vad du har lärt dig.

## Avancerad belysning

- **Phongs avklippning**: Phongs spekulära term använder vinkeln mellan synriktningen och reflektionsvektorn. Över 90° är
  deras skalärprodukt negativ och `max(…, 0.0)` gör termen exakt 0 – även på belysta ytor. Med en låg exponent är
  högdagern bred nog att nå den gränsen, och dess kant klipps av skarpt.
- **Blinn-Phong**: använder **halvvägsvektorn** H = normalize(L + V), enhetsvektorn precis mitt emellan riktningen till
  ljuset och riktningen till betraktaren, och `pow(max(dot(N, H), 0.0), shininess)`. För en yta som både ljuset och
  betraktaren ser blir vinkeln mellan N och H aldrig större än 90°: högdagern tonar ut mjukt. Det är modellen i OpenGL:s
  gamla fasta pipeline.
- **Exponenten**: vinkeln mellan N och H är oftast mindre än den mellan R och V, så samma exponent ger en bredare,
  ljusare högdager. Tumregel: 2–4 gånger Phongs exponent – learnopengl använder 8 för Phong, 32 för Blinn-Phong.
- **Scenen**: ett trägolv på 20 × 20 enheter med `wood.png` upprepad tio gånger, ett ljus en halv enhet ovanför och en
  flagga `blinn` som växlar mellan de två modellerna (learnopengls B-tangent).

:::opengl
- **Flaggan**: `uniform bool blinn;` – det finns ingen `glUniform1b`: en boolesk uniform sätts med `glUniform1i`
  (shaderklassens `setInt`) eller `glUniform1f`, där 0 betyder falskt.
:::
:::vulkan
- **Flaggan**: en push constant, `layout(push_constant) uniform PushConstants { bool blinn; } pc;`. En GLSL-`bool` i ett
  block tar 4 byte, så C++-structen använder `VkBool32`, inte C++:s `bool` på 1 byte; pipeline-layouten har ett
  `VkPushConstantRange` för fragmentsteget, och `vkCmdPushConstants` sätter den före draw-anropet.
- **std140-utfyllnad**: `viewPos` och `lightPos` är `vec3`:or som var och en börjar på en multipel av 16 byte, så
  C++-structen fyller ut var och en med en float.
:::
:::d3d12
- **Flaggan**: en **root constant** – `rootParameters[0].InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)`, 32
  bitar som ligger i själva root-signaturen, satta med `SetGraphicsRoot32BitConstant(0, blinn, 0)` utan buffert eller
  deskriptor. Shadern läser den som `cbuffer BlinnConstant : register(b0) { bool blinn; };` – en HLSL-`bool` i en
  konstantbuffert tar 32 bitar.
- **Packning**: en `float3` korsar aldrig en rad på 16 byte, så `SceneConstantBuffer` fyller ut `viewPos` och
  `lightPos` med en float var.
:::

## Gammakorrigering

- **Gamma**: en bildskärm visar ett värde v med en ljusstyrka på ungefär v upphöjt till **2.2**. Värdet 0.5 syns som
  0.5^2.2 ≈ 0.218 av vitt.
- **Linjärt rum och sRGB-rum**: belysningsmatematiken – att lägga ihop ljus, skala med `diff`, dämpning – förutsätter
  att dubbla värdet betyder dubbelt så mycket ljus (linjärt). Färgerna vi väljer på en skärm, och bilderna som grafiker
  gör, ligger i det icke-linjära **sRGB**-rummet (ungefär en gamma på 2.2).
- **Gammakorrigering**: höj den slutliga färgen till **1/2.2** innan den når skärmen (0.5 blir 0.73, som skärmen visar
  som 0.5). Den görs **exakt en gång, som sista steg**; mellanresultat från flera pass förblir linjära.
- **Två sätt**: i shadern (`pow(color, vec3(1.0/2.2))`), eller av hårdvaran, som kodar varje färg som skrivs till ett
  sRGB-render target. Aldrig båda: bilden skulle korrigeras två gånger och se urblekt ut.
- **sRGB-texturer**: färgtexturer är sRGB-kodade. Lästa som om de vore linjära och sedan gammakorrigerade blir de
  korrigerade två gånger – det urblekta golvet. Ett **sRGB-format** får GPU:n att avkoda dem till linjära när de samplas
  (alfa förblir linjär). Texturer med data – spekulära kartor, normal maps, djupkartor, shadow maps – är linjära och får
  inte vara sRGB.
- **Dämpning**: när belysningen är linjär ser den fysikaliskt korrekta `1.0 / (distance * distance)` rätt ut. Innan
  gjorde skärmen `1 / d` till ungefär `1 / d^2.2` – nära det fysikaliska – och `1 / d²` till `1 / d^4.4`, alldeles för
  brant.
- **Justera belysningen med gammakorrigeringen på plats**: värden som justerats utan den har skärmens kurva inbakad.

:::opengl
- **sRGB-texturer**: de interna formaten `GL_SRGB` och `GL_SRGB_ALPHA`; dataformatet förblir `GL_RGB` / `GL_RGBA`.
  learnopengls `loadTexture(path, gammaCorrection)` väljer dem.
- **Korrigering i hårdvara**: `glEnable(GL_FRAMEBUFFER_SRGB)` kodar varje färg som skrivs till en sRGB-kapabel
  framebuffer, standard-framebuffern inräknad.
- **Uniform-arrayer**: `glUniform3fv(location, 4, &lightPositions[0][0])` sätter alla fyra `vec3`-element från 12
  floats i följd; uniforms utanför ett block har ingen minneslayout att matcha.
:::
:::vulkan
- **sRGB-texturer**: `VK_FORMAT_R8G8B8A8_SRGB` för imagen och dess vy – samma byte som `_UNORM`, avkodade när de samplas;
  `loadTexture` tar formatet som parameter.
- **Korrigering i hårdvara**: ett `_SRGB`-attachment kodar det som skrivs till det. vulkan-tutorials swap chain är
  `VK_FORMAT_B8G8R8A8_SRGB` – dess bilder gammakorrigeras gratis. Kursen använder `VK_FORMAT_B8G8R8A8_UNORM`, så att dess
  färger stämmer med OpenGL:s standard-framebuffer och shadrarna korrigerar, på learnopengls sätt.
- **Uniform-arrayer**: i std140 börjar varje arrayelement på en multipel av 16 byte, så ljusen är `vec4`-arrayer på båda
  sidor (xyz används).
:::
:::d3d12
- **sRGB-texturer**: `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` för texturen och dess SRV – samma byte som `_UNORM`, avkodade när
  de samplas.
- **Korrigering i hårdvara**: en flip-model swap chain kan inte ha ett `_SRGB`-format, men dess `R8G8B8A8_UNORM`-buffertar
  får en render target view med `R8G8B8A8_UNORM_SRGB`; PSO:ts `RTVFormats[0]` måste då också vara `_SRGB`-formatet.
  Kursen behåller UNORM-vyer och korrigerar i shadern.
- **Arrayer i konstantbuffertar**: varje element i en cbuffer-array börjar på en ny rad på 16 byte, så ljusen är
  `float4`-arrayer på båda sidor. (`distance` är en inbyggd HLSL-funktion, därav `lightDistance`.)
:::

## Shadow mapping

- **Shadow mapping**: rendera scenen från ljuset till en **djupkarta** (shadow map) – det närmaste djupet i varje
  riktning ljuset tittar i – och rendera den sedan från kameran och jämför varje fragments djup i ljusets vy med det
  lagrade: längre bort betyder att något står emellan, fragmentet ligger **i skugga**.
- **Djupkartan**: ett render target med bara djup, här 1024 × 1024, samplat med närmaste-filtrering (djup jämförs, de
  blandas inte). Djuppasset behöver ingen färg, ingen belysning och ingen textur – bara hörnen transformerade till
  ljusrymden – och en egen viewport i djupkartans storlek.
- **Ljusrummets transformation**: `lightSpaceMatrix = lightProjection * lightView`, en vy från ljuset mot origo och, för
  ett **riktat ljus** med parallella strålar, en **ortografisk** projektion: en låda på 20 × 20 enheter från 1.0 till 7.5
  enheter framför ljuset. Bara det som lådan innehåller kastar skuggor.
- **ShadowCalculation**: positionen i ljusrymden efter perspektivdivisionen (w är 1 för en ortografisk projektion, men
  divisionen gör funktionen rätt även för perspektiviska), omvandlad till texturkoordinater och ett djup 0..1;
  `currentDepth > closestDepth` betyder skugga.
- **Skuggor och omgivningsljus**: `(ambient + (1.0 - shadow) * (diffuse + specular)) * color` – skuggor är sällan helt
  svarta, så ambient-termen blir kvar.
- **Shadow acne**: flera fragment delar en texel i djupkartan; på en yta som lutar mot ljuset ligger några av dem lite
  bakom det lagrade djupet och skuggar sin egen yta – ränder. **Skugg-bias**:
  `max(0.05 * (1.0 - dot(normal, lightDir)), 0.005)` dras från fragmentets djup, större för branta vinklar.
- **Peter panning**: en för stor bias lossar skuggorna från föremålen som kastar dem. Att rendera djupkartan med
  framsidorna bortplockade hjälper för solida föremål – men inte för ett enskilt plan som golvet, så det används inte
  här.
- **Översampling**: utanför djupkartans koordinater 0..1 returnerar en upprepande karta orelaterade djup. En kantfärg med
  djupet 1.0 (clamp to border) gör de områdena belysta; fragment bortom det bortre planet (projicerat z > 1.0) får
  `shadow = 0.0`.
- **PCF** (percentage-closer filtering): jämför mot de 3 × 3 texlarna runt positionen (en texel = 1 / kartans storlek)
  och ta medelvärdet av de nio resultaten: mjuka kanter. Det är jämförelserna som medelvärdesbildas, inte djupen.
- **Ortografisk eller perspektiv**: ortografisk för riktade ljus, perspektiv för spotlights och punktljus; en
  perspektivisk djupkarta är icke-linjär och måste linjäriseras för att kunna visas.

:::opengl
- **Framebuffern**: `depthMapFBO` med en `GL_DEPTH_COMPONENT`-textur kopplad som `GL_DEPTH_ATTACHMENT`, och
  `glDrawBuffer(GL_NONE)` / `glReadBuffer(GL_NONE)` – utan färgbuffert vore den annars ofullständig.
- **Passen**: `glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT)` för pass 1 och tillbaka till fönstrets storlek för pass 2;
  `shadowMap` på texturenhet 1.
- **Koordinater**: NDC är -1..1 i x, y **och** z, så `projCoords = projCoords * 0.5 + 0.5;` avbildar alla tre.
- **Kant**: `GL_CLAMP_TO_BORDER` och `GL_TEXTURE_BORDER_COLOR` { 1.0, 1.0, 1.0, 1.0 }; texelstorleken från
  `textureSize(shadowMap, 0)`.
:::
:::vulkan
- **Djup-imagen**: ett format från `findDepthMapFormat()` (`VK_FORMAT_D32_SFLOAT` eller `VK_FORMAT_D16_UNORM`, med
  funktionerna djup-attachment **och** samplad image), användningen `DEPTH_STENCIL_ATTACHMENT | SAMPLED`.
- **Render passen**: ett djup-attachment, `colorAttachmentCount = 0` (learnopengls `glDrawBuffer(GL_NONE)`),
  `storeOp = STORE` (fönstrets djup använder `DONT_CARE`), `finalLayout = DEPTH_STENCIL_READ_ONLY_OPTIMAL`, och två
  subpass dependencies som ordnar djupskrivningarna mot fragment shadrarna som samplar kartan.
- **Djup-pipelinen**: ett hörnattribut, gjord för `depthMapRenderPass`, inget blend-attachment för färg; passet spelas
  in före fönstrets, med en viewport på 1024 × 1024.
- **Koordinater**: med `GLM_FORCE_DEPTH_ZERO_TO_ONE` är NDC-z redan 0..1, så bara
  `projCoords.xy = projCoords.xy * 0.5 + 0.5;`. Ljusets matris har **ingen** y-vändning: pass 1 och uppslagningen är
  överens om raderna (bara debug-fyrhörningen vänder v).
- **Kant**: `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_BORDER` med `VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE` – Vulkan har några fasta
  kantfärger, ingen fri.
:::
:::d3d12
- **Shadow mapen**: en `DXGI_FORMAT_R32_TYPELESS`-textur med `ALLOW_DEPTH_STENCIL`, en **DSV** med `D32_FLOAT` för att
  rita i den och en **SRV** med `R32_FLOAT` för att läsa den – en resurs med ett djupformat kan inte ha en SRV.
- **Djup-PSO:t**: bara en vertex shader (`PS` tom), `NumRenderTargets = 0`, `DSVFormat = DXGI_FORMAT_D32_FLOAT`;
  `OMSetRenderTargets(0, nullptr, FALSE, &shadowDsvHandle)` binder bara DSV:n.
- **Barriärer**: `DEPTH_WRITE` → `PIXEL_SHADER_RESOURCE` efter pass 1, och tillbaka i slutet av bildrutan.
- **Matrisen**: `XMMatrixOrthographicRH(20.0f, 20.0f, …)` och `lightView * lightProjection` – radvektorer, vyn först.
- **Koordinater**: NDC-z är redan 0..1, och texturens v pekar nedåt medan NDC-y pekar uppåt: `shadowUV =
  (x * 0.5 + 0.5, -y * 0.5 + 0.5)`.
- **Kant**: `D3D12_TEXTURE_ADDRESS_MODE_BORDER` med `D3D12_STATIC_BORDER_COLOR_OPAQUE_WHITE`; texelstorleken från
  `shadowMap.GetDimensions(width, height)`. Alternativ i hårdvara: rasteriserarens `DepthBias` /
  `SlopeScaledDepthBias`, och PCF med en jämförelse-sampler och `SampleCmpLevelZero`.
:::

## Punktskuggor

- **Rundstrålande shadow maps**: ett punktljus lyser åt alla håll, så dess djupkarta är en **djup-cube map** – sex sidor
  runt ljuset.
- **Ett pass med en geometry shader**: djup-cube mapen är ett **skiktat** (layered) attachment; geometry shadern sänder
  ut varje triangel sex gånger (högst 18 hörn), varje gång med en sidas ljusmatris och den sidans index som lagret den
  hamnar i. Klippningen kastar det som en sida inte kan se.
- **De sex matriserna**: en perspektivprojektion med **90° synfält** och bildförhållandet 1 – exakt en sida per frustum,
  inga luckor eller överlapp – near 1.0, far 25.0; sex `lookAt` mot +X, -X, +Y, -Y, +Z, -Z (sidornas ordning) med upp
  (0, -1, 0) för de fyra sidoytorna och (0, 0, 1) / (0, 0, -1) för ±Y: en cube map-sidas första rad är dess överkant, och
  de här upp-vektorerna lagrar varje sida så som en uppslagning läser den. De är desamma i alla API:er.
- **Det lagrade värdet**: fragment shadern skriver `distance(fragment, ljus) / far_plane` som sitt djup. Ett avstånd är
  detsamma på alla sex sidor och kan jämföras direkt med fragmentets eget avstånd i pass 2. (Att skriva djupet stänger
  av tidig djuptestning.)
- **Uppslagningen**: cube mapen samplas med `fragToLight = fragPos - lightPos` (vilken längd som helst; den pekar från
  ljuset till fragmentet), det lagrade värdet multipliceras med `far_plane` och jämförs med `length(fragToLight)`. Biasen
  är nu i världsenheter: 0.05.
- **PCF**: 20 förskjutningsriktningar – kubens 8 hörn och 12 kantmitter – skalade med
  `diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0` (mjukare skuggor längre från betraktaren), bias 0.15. Ett
  rutnät på 4 × 4 × 4 förskjutningar skulle ta 64 sampel, många av dem överflödiga.
- **Scenen**: ett rum sett inifrån (normalerna vända i vertex shadern) med fem kuber och ett ljus i mitten; learnopengl
  flyttar ljuset med tiden, kursen håller det stilla.

:::opengl
- **Cube mapen**: `GL_TEXTURE_CUBE_MAP` med sex `glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0,
  GL_DEPTH_COMPONENT, …)`, `GL_NEAREST`, `GL_CLAMP_TO_EDGE` på S, T och R.
- **Skiktat attachment**: `glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthCubemap, 0)` kopplar alla sex
  sidor (`glFramebufferTexture2D` skulle koppla en sida).
- **Shaders**: geometry shadern sätter `gl_Layer = face`; fragment shadern skriver `gl_FragDepth`; belysningsshadern
  samplar en `samplerCube`. Shader-klassen tar geometry shadern som en tredje fil.
:::
:::vulkan
- **Cube mapen**: en 2D-image med `arrayLayers = 6` och `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, en vy av typen
  `VK_IMAGE_VIEW_TYPE_CUBE` över alla sex lager, och en framebuffer med `layers = 6` – det skiktade attachmentet. Render
  passen är förra kapitlets pass med bara djup; dess rensning och övergångar täcker alla lager.
- **Shaders**: geometry shadern sätter `gl_Layer`; enheten aktiverar funktionen `geometryShader`, och uniform-bufferten
  syns även för geometristeget. `gl_FragDepth` ersätter djupet; uppslagningen är en `samplerCube`.
- **Ingen y-vändning** av skuggprojektionen: NDC y = -1 hamnar på en sidas rad 0 i Vulkan som i OpenGL, så learnopengls
  matriser lagrar samma texlar. Culling är av överallt (rummet skulle behöva egna pipelines).
:::
:::d3d12
- **Cube mapen**: en `R32_TYPELESS`-textur med `DepthOrArraySize = 6`, en DSV med `D32_FLOAT` av typen
  `TEXTURE2DARRAY` över alla sex skivor (det skiktade attachmentet) och en SRV med `R32_FLOAT` av typen `TEXTURECUBE`.
- **Shaders**: geometry shadern (`[maxvertexcount(18)]`, `gs_5_0`) skriver `SV_RenderTargetArrayIndex`; pixel shadern
  returnerar `SV_Depth`; uppslagningen är en `TextureCube` som samplas med en `float3`.
- **Y-vändningen**: Direct3D lägger NDC y = +1 på ett render targets rad 0, så skuggprojektionen följs av
  `XMMatrixScaling(1.0f, -1.0f, 1.0f)`, annars skulle varje sida lagras upp och ner. Culling är av överallt.
:::

## Normal mapping

- **Normal mapping** (bump mapping): en normal per fragment från en textur, så att en plan yta belyses som om den hade
  ojämnheter, sprickor och fogar.
- **Normal mapen**: varje komponent lagras som `normal * 0.5 + 0.5`; mest ljusblå, (0.5, 0.5, 1.0), eftersom de flesta
  normaler pekar rakt ut från ytan. Den innehåller riktningar, så den läses linjärt, aldrig som sRGB. I shadern:
  `normalize(texel * 2.0 - 1.0)`.
- **Det felaktiga första försöket**: kartans normaler använda som normaler i världsrymden – bara rätt för en yta som
  vetter mot +z.
- **Tangentrymden**: rymden lokal för ytan, där kartans normaler pekar ungefär längs +z. Dess axlar är **tangenten** T
  (där texturens u växer), **bitangenten** B (där v växer) och normalen N: kartans rött mäts längs T, grönt längs B, blått
  längs N.
- **TBN-matrisen**: `mat3(T, B, N)` med T, B och N som kolumner tar en vektor från tangentrymden till världsrymden. Dess
  invers är dess **transponat** – T, B och N är vinkelräta enhetsvektorer.
- **Att beräkna tangenter**: för en triangel med kanterna E1, E2 och texturkoordinatskillnaderna ΔU, ΔV gäller
  `E1 = ΔU1·T + ΔV1·B` och `E2 = ΔU2·T + ΔV2·B`; att lösa systemet ger `T = f·(ΔV2·E1 − ΔV1·E2)`,
  `B = f·(−ΔU2·E1 + ΔU1·E2)` med `f = 1 / (ΔU1·ΔV2 − ΔU2·ΔV1)`. De blir två hörnattribut till.
- **Belysning i tangentrymden**: learnopengls slutliga kod transformerar ljusets, betraktarens och fragmentets
  positioner med den transponerade TBN-matrisen i **vertex** shadern – en gång per hörn i stället för en gång per
  fragment – och fragment shadern använder den samplade normalen som den är.
- **Gram-Schmidt**: medelvärdesbildade tangenter på ett riktigt mesh är kanske inte vinkelräta mot N;
  `T = normalize(T - dot(T, N) * N)` gör dem det, och `B = cross(N, T)`.
- **Komplexa objekt**: Assimps `aiProcess_CalcTangentSpace` beräknar tangenterna; normal maps låter ett enkelt mesh visa
  detaljerna hos ett mycket finare.

:::opengl
- **Hörndata**: 14 floats per hörn – position, normal, texturkoordinater, tangent, bitangent – med attribut 3 och 4 för
  tangenten och bitangenten. Bilderna vänds vid inläsningen, så v växer uppåt i bilden och B = (0, 2, 0) pekar uppåt
  längs väggen – den riktning som normal mapens grönt betyder.
:::
:::vulkan
- **Hörndata**: `Vertex` får `tangent` och `bitangent`, och `getAttributeDescriptions()` två poster till (location 3 och
  4); normal mapen är binding 2.
- **Vända vid inläsningen**: de här kapitlen anropar `stbi_set_flip_vertically_on_load(true)` och behåller learnopengls
  texturkoordinater. Med de tidigare kapitlens vända v skulle bitangenten – beräknad från v – peka nedåt längs väggen
  medan kartans grönt betyder uppåt i bilden: varje ojämnhet skulle belysas från fel håll.
:::
:::d3d12
- **Hörndata**: två element till i input layouten, `TANGENT` och `BINORMAL` (HLSL:s namn på bitangenten).
- **Matriser**: HLSL:s `float3x3(T, B, N)` tar **rader**, så den är redan learnopengls `transpose(mat3(T, B, N))`,
  matrisen värld → tangent.
- **v pekar nedåt**: med Direct3D:s texturkoordinater pekar bitangenten nedåt längs väggen, medan den OpenGL-artade
  normal mapens grönt betyder uppåt i bilden – så `PSMain` vänder det, `normal.y = -normal.y`, och Gram-Schmidt beräknar
  `B = cross(T, N)` (nedåt, åt det håll v växer), inte learnopengls `cross(N, T)`.
:::

## Parallax mapping

- **Displacement mapping** flyttar hörn efter en höjdkarta – verklig relief, men många hörn. **Parallax mapping** flyttar
  bara **texturkoordinaterna**, i fragment shadern, så att ett fragment visar den punkt som synstrålen skulle träffa på
  reliefen.
- **Djupkarta**: en inverterad höjdkarta – vit där ytan är djup (fogarna), svart vid ytan; `heightScale` (0.1) anger hur
  djupt 1.0 är.
- **Förskjutningen**: `texCoords - viewDir.xy / viewDir.z * (height * heightScale)`, med synriktningen i tangentrymden,
  där x och y går längs texturens u och v. Divisionen gör att förskjutningen växer vid flacka vinklar; att utelämna den
  är *parallax mapping med offset limiting*.
- **Att kasta kanterna**: fragment vars förskjutna koordinater lämnar [0,1] kastas – fyrhörningens kontur följer de
  upphöjda tegelstenarna. Fungerar för ett plan, inte för komplexa ytor.
- **Steep parallax mapping**: delar djupintervallet i **lager** och går längs strålen, ett lager och ett
  koordinatsteg i taget, tills lagret är djupare än djupkartans värde. Fler lager vid flacka vinklar:
  `mix(maxLayers, minLayers, abs(dot(vec3(0.0, 0.0, 1.0), viewDir)))`, 8 till 32. Lämnar synliga trappsteg.
- **Parallax occlusion mapping**: interpolerar mellan det sista lagret ovanför och det första lagret under ytan, med
  `weight = afterDepth / (afterDepth - beforeDepth)`. *Relief parallax mapping* är noggrannare och dyrare.

:::opengl
- **Bindningar**: djupkartan på texturenhet 2, `heightScale` en uniform.
- **Sampling i loopen**: `texture()` väljer mipnivå från implicita derivator, som GLSL lämnar odefinierade när
  angränsande fragment tar olika vägar genom en loop. Det fungerar oftast; den strikta versionen tar `dFdx` / `dFdy` av
  de ursprungliga koordinaterna före loopen och samplar med `textureGrad`.
:::
:::vulkan
- **Bindningar**: djupkartan på binding 3; `heightScale` i uniform-bufferten, i stället för en utfyllnads-float.
- **Sampling i loopen**: `texture()` väljer mipnivå från implicita derivator, som GLSL lämnar odefinierade när
  angränsande fragment tar olika vägar genom en loop. Det fungerar oftast; den strikta versionen tar `dFdx` / `dFdy` av
  de ursprungliga koordinaterna före loopen och samplar med `textureGrad`.
:::
:::d3d12
- **Bindningar**: djupkartan på t2 (ett intervall med tre SRV:er); `heightScale` i konstantbufferten, i stället för en
  utfyllnads-float.
- **Sampling i loopen**: `Sample` behöver gradienter mellan angränsande pixlar; i en loop vars antal varierar per pixel
  finns inga, och kompilatorn vägrar (varning X3570). Loopen använder `SampleLevel(wrapSampler, uv, 0)`; med mipmaps
  `SampleGrad` med `ddx` / `ddy` tagna före loopen.
- **v pekar nedåt**: B = `cross(T, N)` pekar också nedåt, så `viewDir.xy` ligger i texturkoordinaternas riktningar och
  förskjutningen fungerar oförändrad.
:::

## HDR

- **LDR** (low dynamic range): en färgbuffert med 8 bitar lagrar 0.0 till 1.0 per kanal; allt ljusare begränsas, och
  stora ljusa områden blir ett enda platt vitt.
- **HDR** (high dynamic range): färger får överstiga 1.0 medan scenen renderas, så ljus kan ha realistiska styrkor –
  ljuset i tunnelns ände har 200.
- **Flyttals-framebuffer**: en färgbuffert med **16-bitars halvprecisionsflyttal** per kanal (upp till 65504, ungefär
  tre värdesiffror), RGBA i alla API:er – flyttals-targets med tre kanaler är inte portabla.
- **Passen**: scenen till flyttalsbufferten, linjärt och obegränsat; sedan en skärmfyrhörning som läser den,
  **tone-mappar** den till 0..1 och gammakorrigerar den. Gammakorrigeringen flyttar ut ur belysningsshadern: den måste
  komma efter tone mappingen, som allra sista steg.
- **Tone mapping**: att omvandla HDR till LDR utan att förlora detaljer. **Reinhard**: `hdrColor / (hdrColor + 1.0)` –
  1 → 0.5, 3 → 0.75, 200 → 0.995; varje värde stannar under 1.0 och behåller sin ordning, små värden ändras knappt.
- **Exponering**: `1.0 - exp(-hdrColor * exposure)`. En **hög** exponering visar detaljerna i mörka områden (de ljusa
  trängs ihop nära vitt); en **låg** exponering visar detaljerna i ljusa områden (de mörka sjunker mot svart).
  learnopengl ändrar den med Q och E; kursen byter koden i uppgifterna.
- **Mer HDR**: filmiska kurvor; **automatisk exponering** (eye adaptation) utifrån förra bildrutans ljusstyrka.
- **Scenen**: en trätunnel med tre svaga färgade ljus och ett med styrkan 200 i den bortre änden; kameran tittar in i
  tunneln (yaw +90), och det är fyra ljus i stället för learnopengls array med sexton platser.

:::opengl
- **Framebuffern**: `hdrFBO` med en färgtextur vars **interna format** är `GL_RGBA16F` (`GL_RGBA` / `GL_FLOAT` beskriver
  bara den data som inte finns) och en renderbuffer för djup. Programmen ändras inte: de ritar till den framebuffer som
  är bunden.
- **Fyrhörningen**: `hdrShader` samplar `hdrBuffer`; `exposure` är en uniform.
:::
:::vulkan
- **Render passen**: `hdrRenderPass` med ett färg-attachment i `VK_FORMAT_R16G16B16A16_SFLOAT` som lämnas i
  `SHADER_READ_ONLY_OPTIMAL`, ett djup-attachment och två subpass dependencies; varje enhet måste kunna rendera till det
  formatet och sampla det linjärt.
- **Pipelines**: en pipeline fungerar bara i render passes som är kompatibla med den den gjordes för – scenens pipeline
  görs för `hdrRenderPass`, skärmfyrhörningens för fönstrets.
- **Deskriptorer**: `hdrDescriptorSet` med flyttalsbilden; poolen delar ut två set. `exposure` hamnar i uniform-bufferten
  i stället för en utfyllnads-float.
:::
:::d3d12
- **Bufferten**: en `DXGI_FORMAT_R16G16B16A16_FLOAT`-textur med `ALLOW_RENDER_TARGET`, en RTV efter swap chainens och en
  SRV; barriärer `PIXEL_SHADER_RESOURCE` ↔ `RENDER_TARGET` runt scenpasset.
- **PSO:er**: ett PSO kompileras för formaten det renderar till – scenens PSO får `RTVFormats[0] =
  DXGI_FORMAT_R16G16B16A16_FLOAT`, skärmfyrhörningen ett eget `m_hdrPipelineState` med backbuffertens format och utan
  djup.
- **Exponering**: en root constant; root-parameter 0 blir synlig för alla shaders, eftersom pixel shadern nu läser den.
:::

## Bloom

- **Bloom**: ett sken runt starka ljuskällor och starkt belysta områden – ljuset verkar läcka ut över omgivningen. Det
  är inte samma sak som HDR, men fungerar bäst tillsammans med det.
- **Stegen**: rendera scenen och samtidigt dess ljusa delar till en andra buffert; gör den ljusa bufferten suddig; lägg
  den till scenen, och tone-mappa och gammakorrigera sedan.
- **Flera render targets** (MRT): en fragment shader med flera utdata, som var och en skrivs till sin egen färgbuffert i
  ett och samma pass.
- **Ljusa delar**: **luminansen** `dot(color, vec3(0.2126, 0.7152, 0.0722))` (ögat är känsligast för grönt, minst för
  blått) över **1.0** – det som fönstret inte kan visa. Med LDR skulle en lägre tröskel få varje vit vägg att glöda.
- **Gaussisk blur**: vikter från den klockformade gausskurvan, så att närliggande sampel väger mest. Den är
  **separerbar**: ett horisontellt pass och sedan ett vertikalt ger hela 2D-bluren – 9 + 9 = 18 sampel i stället för 81
  för en kärna med 9 tappar. Fem vikter, från 0.2270270270 för mitten ner till 0.0162162162 fyra texlar bort, summerar
  till 1 (de övriga räknas två gånger).
- **Ping-pong-framebuffers**: ett pass kan inte läsa texturen det ritar till, så två buffertar turas om – varje pass
  läser den ena och skriver den andra. learnopengl gör **10 pass** (horisontellt först): fem par av horisontellt och
  vertikalt, där varje par gör den redan suddiga bilden suddig igen, vilket breddar skenet. Resultatet hamnar i buffert
  `[!horizontal]`, buffert 0.
- **Clamping**: färgbuffertarna samplas med clamp to edge, annars skulle bluren blanda in motsatta kanten.
- **Att blanda båda texturerna**: `hdrColor += bloomColor` **före** tone mappingen – båda är HDR-ljus i samma enheter,
  och summan går genom kurvan i stället för att klippas till vitt.
- **Avslutande tankar**: ett bredare sken blir billigare med en kedja av nedsamplade blurar (halv, kvarts, åttondels
  storlek); learnopengls *Physically Based Bloom* bygger en sådan och slopar tröskeln.

:::opengl
- **MRT**: två `GL_RGBA16F`-texturer på `GL_COLOR_ATTACHMENT0` och `1`, `glDrawBuffers(2, attachments)` – utan det ritas
  bara attachment 0 – och `layout (location = 1) out vec4 BrightColor;` i shadern.
- **Ping-pong**: `pingpongFBO[2]` med en färgtextur var och inget djup; att binda den andra framebuffern och texturen är
  allt ett pass behöver.
- **Slutpasset**: `scene` på enhet 0 och `bloomBlur` på enhet 1.
:::
:::vulkan
- **MRT**: utdata på location n skriver `pColorAttachments[n]` i subpassen; `createHdrRenderPass()` har två
  färg-attachments (djupet på index 2), framebuffern tre vyer, passet tre clear-värden, och varje pipeline ett
  blend-attachment-tillstånd per färg-attachment (`colorAttachmentCount`).
- **Ping-pong**: en image i en render pass kan inte samplas i samma pass, så varje blur-pass är en egen render pass:
  `blurRenderPass` (`loadOp = DONT_CARE` – fyrhörningen täcker varje pixel –, `finalLayout = SHADER_READ_ONLY_OPTIMAL`,
  dependencies som kedjar ihop passen). Loopen körs medan command bufferten spelas in.
- **Shaders**: `horizontal` är en push constant av typen `VkBool32`; vikterna en `const float weight[5]` (Vulkans GLSL
  har inga uniforms utanför block).
- **Deskriptorer**: en layout för alla set, nu med binding 2 – så varje set tar två combined image samplers, och sju set
  behöver 14 i poolen.
:::
:::d3d12
- **MRT**: pixel shadern returnerar en struct med `SV_TARGET0` och `SV_TARGET1`; PSO:t har `NumRenderTargets = 2` och
  två `RTVFormats`; `OMSetRenderTargets(2, hdrRtvHandles, FALSE, …)` binder båda (`FALSE`: en array av handtag).
  `IndependentBlendEnable = FALSE` tillämpar `RenderTarget[0]`:s blend-inställningar på alla targets.
- **Ping-pong**: `m_pingpongColorbuffers[2]`, varje pass mellan en barriär till `RENDER_TARGET` och en tillbaka till
  `PIXEL_SHADER_RESOURCE` – det som låter nästa pass läsa den.
- **Shaders**: `static const float weight[5]` (utan `static` vore den indata i en konstantbuffert vars initierare
  ignoreras); `horizontal` en root constant.
- **Två tabeller**: slutpasset läser scenen och den suddiga bufferten genom två descriptor tables (root-parameter 2 och
  3), eftersom en tabell pekar på deskriptorer i följd.
:::

## Deferred shading

- **Forward rendering**: varje objekt belyses medan det ritas – varje fragment med varje ljus, även fragment som senare
  objekt täcker.
- **Deferred shading**: ett **geometripass** skriver varje pixels ytdata till **G-bufferten** utan belysning; ett
  **belysningspass** ritar en skärmfyrhörning och belyser varje pixel en gång, från G-bufferten. Belysningens kostnad
  beror på pixlar × ljus, inte längre på hur många objekt som överlappar.
- **G-bufferten**: tre färg-targets och en djupbuffert – positioner och normaler (världsrymd) i 16-bitars
  flyttals-targets, eftersom de behöver omfång och precision, och albedo (rgb) plus spekulär intensitet (a) i ett
  8-bitars target. De läses med närmaste-filtrering.
- **Scenen**: nio containerlådor (learnopengl ritar sin ryggsäcksmodell) och learnopengls 32 ljus från `srand(13)`,
  sedda ovanifrån rutnätet; belysningen är learnopengls, utan gammakorrigering.
- **Att kombinera deferred med forward rendering**: det som inte passar i G-bufferten – ljuskuberna, blendade objekt –
  ritas forward efter belysningspasset, djuptestat mot geometripassets djup.
- **Ljusvolymer**: ett ljus **radie** är där dess dämpade ljusstyrka sjunker under 5/256: att lösa
  `Imax · 1 / (1 + Kl·d + Kq·d²) = 5/256` ger
  `(-linear + sqrt(linear² - 4·quadratic·(constant - (256/5)·Imax))) / (2·quadratic)`, här ungefär 3.5 till 5.1. Att
  hoppa över ljus bortom den gör bilden lite mörkare – varje överhoppat ljus bidrar med mindre än 5/256, men 32 av dem
  blir märkbara.
- **Varför `if`-satsen sparar lite**: en GPU kör fragmenten i en grupp i takt, så en loop kostar varje ljus där ett
  enda fragment i gruppen behöver det. Riktiga renderare ritar varje ljus **volym** (en sfär med den radien, med
  framsidorna bortplockade) och belyser bara pixlarna den täcker, eller sorterar ljusen i skärmrutor eller kluster
  (**tiled** och **clustered** shading).
- **Begränsningar**: en pixel i G-bufferten rymmer en yta, så **blending** (transparens) behöver ett forward-pass;
  **MSAA** fungerar inte bara så; alla ytor delar en belysningsmodell; G-bufferten kostar minne och bandbredd.

:::opengl
- **G-bufferten**: `gBuffer` med `gPosition` och `gNormal` (`GL_RGBA16F`), `gAlbedoSpec` (`GL_RGBA`), kopplade till
  `GL_COLOR_ATTACHMENT0`–`2` med `glDrawBuffers(3, attachments)`, och en renderbuffer `GL_DEPTH_COMPONENT`.
- **Ljuskuberna**: `glBlitFramebuffer(…, GL_DEPTH_BUFFER_BIT, GL_NEAREST)` från `gBuffer` (`GL_READ_FRAMEBUFFER`) till
  framebuffer 0 kopierar geometripassets djup till fönstrets djupbuffert – de två djupformaten måste stämma överens.
:::
:::vulkan
- **G-bufferten**: `gBufferRenderPass` med tre färg-attachments (`R16G16B16A16_SFLOAT` två gånger, `R8G8B8A8_UNORM`) och
  djupet på attachment 3; geometri-pipelinen har tre blend-tillstånd; `gBufferSampler` är NEAREST (utan anisotropi) och
  clampar.
- **Ljuskuberna**: ingen kopia – G-buffertens djup-image behålls (`storeOp = STORE`) och är fönsterpassets
  djup-attachment (`loadOp = LOAD`, `initialLayout = DEPTH_STENCIL_ATTACHMENT_OPTIMAL`); belysningsfyrhörningens pipeline
  har djuptest och djupskrivning avstängda.
- **Ljusen**: `struct Light { vec3 position; float linear; vec3 color; float quadratic; }` – floatarna fyller luckorna
  efter `vec3`:orna; med `radius` växer structen till 36 byte och std140 avrundar arrayens steg uppåt till 48.
:::
:::d3d12
- **G-bufferten**: `m_gBuffer[3]` (`R16G16B16A16_FLOAT` två gånger, `R8G8B8A8_UNORM`), ett PSO med
  `NumRenderTargets = 3`, `OMSetRenderTargets(3, gBufferRtvHandles, FALSE, &dsvHandle)` och en pixel shader med
  `SV_TARGET0`–`2`; belysningspasset läser dem med en punkt-sampler som clampar, genom två descriptor tables.
- **Ljuskuberna**: ingen kopia – en djupbuffert hör inte till någon framebuffer, så `m_depthStencil`, som fortfarande
  har lådornas djup, binds igen tillsammans med backbufferten (själva belysningsfyrhörningen ritas utan DSV).
- **Ljusen**: HLSL packar `Light` i 48 byte (Color börjar på andra raden); C++-structen fylls ut så att den stämmer.
  Microsofts `rand()` skiljer sig från glibc:s, så på Windows hamnar ljusen på andra ställen.
:::

## SSAO

- **Ambient occlusion**: skrymslen, hörn och ställen där föremål möts får mindre av scenens indirekta (ambienta) ljus.
  Att beräkna det ordentligt är dyrt.
- **SSAO** (screen-space ambient occlusion, Crytek 2007): uppskattar det per pixel från G-bufferten – sampla punkter
  runt fragmentet; ju fler av dem som ligger bakom den lagrade ytan, desto mer skymt är fragmentet.
- **Normalorienterad halvsfär**: samplen ligger i en halvsfär på normalens sida, så att en plan yta inte skymmer sig
  själv (en hel sfär gör allt grått).
- **Vyrymd**: G-bufferten lagrar positioner och normaler i **vyrymden**, så det lagrade z är djupet att jämföra;
  albedot är ett enkelt 0.95.
- **Samplingskärnan**: 32 sampel (learnopengl 64 – kursen ritar sina kontroller och förväntade resultat på CPU:n), z ≥
  0, var och en skalad med `lerp(0.1, 1.0, (i / 32)²)`: fler sampel nära fragmentet. Radie 0.5, bias 0.025.
- **Slumpmässiga rotationer av kärnan**: en **brustextur** på 4 × 4 med slumpvektorer i xy-planet, upprepad över
  fönstret med repeat och närmaste-sampling. Med normalen ger den en TBN-matris (Gram-Schmidt), så varje pixel i ett
  block på 4 × 4 vrider kärnan olika: få sampel, inga band – men ett regelbundet brusmönster.
- **SSAO-shadern**: `samplePos = fragPos + TBN * sample * radius`, projicerad till texturkoordinater, det lagrade djupet
  läst på den platsen; skymt om `sampleDepth >= samplePos.z + bias`. **Avståndskontrollen** (range check)
  `smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth))` hindrar ytor långt framför fragmentet från att mörka
  det. Resultat: `1.0 - occlusion / kernelSize`, i ett target med en kanal.
- **Blur**: en låd-blur på 4 × 4 (förskjutningar -2..1) tar bort brusmönstret.
- **Att använda den**: bara ambient-termen multipliceras – `0.3 * Diffuse * AmbientOcclusion`; det direkta ljuset
  behåller sin egen diffusa och spekulära del.
- **Scenen**: planeten i ett rum i stället för learnopengls ryggsäck. Dess ring är ett enda plan med normalen uppåt,
  sett underifrån: halvsfären ligger bakom den sett från kameran, så dess undersida blir mörk. Slumptalen kommer från
  `srand(42)` och `rand() / (float)RAND_MAX` – samma kärna och brus i kursens bilder och vid varje körning (learnopengls
  `std::uniform_real_distribution` skiljer sig mellan standardbibliotek).

:::opengl
- **Targets**: `ssaoColorBuffer` och `ssaoColorBufferBlur` med det interna formatet `GL_RED` (en kanal); `gPosition`
  clampar mot kanten, så att sampel nära fönstrets kant inte slår runt.
- **Brus**: en `GL_RGBA32F`-textur på 4 × 4 från `GL_RGB` / `GL_FLOAT`-data, `GL_NEAREST`, `GL_REPEAT`, samplad vid
  `TexCoords * noiseScale` (800/4, 600/4). Det projicerade samplet blir texturkoordinater med `* 0.5 + 0.5`.
:::
:::vulkan
- **Targets**: `VK_FORMAT_R8_UNORM`-images för SSAO och dess blur, ritade med `ssaoRenderPass` (inget djup,
  `loadOp = DONT_CARE`); ett descriptor set för alla pass (binding 0–6).
- **Brus**: `VK_FORMAT_R32G32B32A32_SFLOAT` med `vec4`-brus – enheter behöver inte kunna sampla flyttals-images med tre
  kanaler – uppladdad via en staging buffer, `noiseSampler` NEAREST och REPEAT. Upprepad från fönstrets överkant (v
  pekar nedåt), så enskilda AO-pixlar skiljer sig från OpenGL:s.
- **Kärnan**: `vec4 samples[32]` i uniform-bufferten (std140:s arraysteg). Den vända projektionens y pekar nedåt som v:
  `offset.xy * 0.5 + 0.5` behöver ingen extra vändning.
:::
:::d3d12
- **Targets**: `R8_UNORM`-render targets för SSAO och dess blur; varje skärmpass har en egen kopia av fyrhörningens
  `VSMain`.
- **Brus**: `R32G32B32A32_FLOAT` uppladdad från `XMFLOAT4`:or med `UpdateSubresources`, läst med den statiska samplern s1
  (punkt, WRAP); G-bufferten med s0 (punkt, CLAMP).
- **Kärnan**: `XMFLOAT4 samples[32]` i konstantbufferten (varje element på en egen rad). Texturkoordinaterna är
  `(x * 0.5 + 0.5, -y * 0.5 + 0.5)`, och `mul(samples[i].xyz, TBN)` är GLSL:s `TBN * samples[i]` eftersom `float3x3` tar
  rader.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Ett litet värde per draw-anrop | `uniform bool`, `setInt` | push constant, `VkBool32` | root constant |
| sRGB-textur | `GL_SRGB` / `GL_SRGB_ALPHA` | `VK_FORMAT_R8G8B8A8_SRGB` | `DXGI_FORMAT_R8G8B8A8_UNORM_SRGB` |
| Gammakorrigering i hårdvaran | `GL_FRAMEBUFFER_SRGB` | `_SRGB`-format för swap chainen | `_SRGB`-RTV av UNORM-backbufferten |
| Target med bara djup | FBO, `GL_DEPTH_COMPONENT`-textur, `glDrawBuffer(GL_NONE)` | djup-image + render pass utan färg | `R32_TYPELESS`, D32-DSV + R32-SRV, PSO utan pixel shader |
| Läsbart efter passet | sköts av drivrutinen | `storeOp`, `finalLayout`, subpass dependency | transition barrier |
| Ljusrymdens NDC → djupkarta | `xyz * 0.5 + 0.5` | `xy * 0.5 + 0.5` | `x * 0.5 + 0.5`, `-y * 0.5 + 0.5` |
| Djup 1.0 utanför kartan | `GL_CLAMP_TO_BORDER` + kantfärg | `CLAMP_TO_BORDER` + `FLOAT_OPAQUE_WHITE` | `BORDER` + `STATIC_BORDER_COLOR_OPAQUE_WHITE` |
| Texturstorlek i en shader | `textureSize` | `textureSize` | `GetDimensions` |
| Skiktad djup-cube map | `glFramebufferTexture`, `gl_Layer` | 6 lager, framebuffer med `layers = 6`, `gl_Layer` | `TEXTURE2DARRAY`-DSV, `SV_RenderTargetArrayIndex` |
| Skriva djupet | `gl_FragDepth` | `gl_FragDepth` | `SV_Depth` |
| Tangent och bitangent | attribut 3 och 4 | medlemmar i `Vertex`, location 3 och 4 | `TANGENT`, `BINORMAL` |
| Sampling i en varierande loop | `textureGrad` (strikt) | `textureGrad` (strikt) | `SampleLevel` / `SampleGrad` |
| Flyttals-target | `GL_RGBA16F` | `VK_FORMAT_R16G16B16A16_SFLOAT` | `DXGI_FORMAT_R16G16B16A16_FLOAT` |
| Flera render targets | `glDrawBuffers`, `location = n` | subpassens färg-attachments, blend-tillstånd | `NumRenderTargets`, `SV_TARGETn` |
| Forward-objekt efter deferred | `glBlitFramebuffer` av djupet | G-buffertens djup-image, `loadOp` LOAD | samma DSV bunden igen |
| Target med en kanal | `GL_RED` | `VK_FORMAT_R8_UNORM` | `DXGI_FORMAT_R8_UNORM` |
| Upprepande brustextur | `GL_REPEAT`, `GL_NEAREST` | sampler REPEAT, NEAREST | statisk sampler WRAP, punkt |

Med den här delen klar kan du byggstenarna i en modern realtidsrenderare: linjär belysning med gammakorrigering, shadow
maps, normal maps och parallax maps, en HDR-pipeline med tone mapping och bloom, en G-buffert och effekter i screen
space som läser den. Fysikaliskt baserad rendering, learnopengls nästa del, behåller allt det och ersätter Blinn-Phong
med en fysikaliskt baserad belysningsmodell.
